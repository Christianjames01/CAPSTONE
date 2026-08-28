import { getToken } from 'firebase/messaging'
import { getMessagingInstance } from './firebase'
import { supabase } from './supabase'

// Requests notification permission, registers the FCM service worker, and
// saves the resulting token on the user's profile. Safe to call on every
// login: it no-ops quietly if push isn't supported or permission is denied.
export async function registerPushNotifications(userId) {
    if (!userId) return null

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY
    if (!vapidKey) {
        console.warn('PUSH NOTIFICATIONS: missing VITE_FIREBASE_VAPID_KEY, skipping registration.')
        return null
    }

    const messaging = await getMessagingInstance()
    if (!messaging) return null

    try {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') return null

        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js')

        const token = await getToken(messaging, {
            vapidKey,
            serviceWorkerRegistration: registration,
        })
        if (!token) return null

        const { error } = await supabase
            .from('profiles')
            .update({ fcm_token: token })
            .eq('user_id', userId)

        if (error) {
            console.error('PUSH NOTIFICATIONS: failed to save token:', error)
        }

        return token
    } catch (error) {
        console.error('PUSH NOTIFICATIONS: registration failed:', error)
        return null
    }
}
