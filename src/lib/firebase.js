import { initializeApp } from 'firebase/app'
import { isSupported, getMessaging } from 'firebase/messaging'

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

export const firebaseApp = initializeApp(firebaseConfig)

let messagingInstance
let messagingChecked = false

// Push isn't supported everywhere (Safari on iOS < 16.4, private browsing in
// some browsers, etc.), so this resolves to null instead of throwing.
export async function getMessagingInstance() {
    if (messagingChecked) return messagingInstance

    messagingChecked = true

    try {
        const supported = await isSupported()
        messagingInstance = supported ? getMessaging(firebaseApp) : null
    } catch (error) {
        console.error('FIREBASE MESSAGING SUPPORT CHECK ERROR:', error)
        messagingInstance = null
    }

    return messagingInstance
}
