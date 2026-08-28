// Firebase can't inject env vars into a static service worker file, so this
// config is duplicated from .env's VITE_FIREBASE_* values. Update both places
// together if the Firebase project config ever changes.
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js')

firebase.initializeApp({
    apiKey: 'AIzaSyBZncBjSo9pAsZYX3Xog0lQuruT9oaFQ0Q',
    authDomain: 'certichain-3293f.firebaseapp.com',
    projectId: 'certichain-3293f',
    storageBucket: 'certichain-3293f.firebasestorage.app',
    messagingSenderId: '834259780061',
    appId: '1:834259780061:web:8000fb29d2bcf77c3cb634',
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title || 'CertiChain'
    const options = {
        body: payload.notification?.body || '',
        icon: '/favicon.svg',
        data: payload.data || {},
    }
    self.registration.showNotification(title, options)
})

self.addEventListener('notificationclick', (event) => {
    event.notification.close()
    const url = event.notification.data?.url || '/'
    event.waitUntil(clients.openWindow(url))
})
