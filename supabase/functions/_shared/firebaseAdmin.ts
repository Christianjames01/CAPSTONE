// Sends web push notifications via the FCM v1 HTTP API, authenticated with
// the Firebase service account JSON stored in the FIREBASE_SERVICE_ACCOUNT
// secret (see googleAuth.ts for the OAuth2 token exchange).
import { getGoogleAccessToken } from './googleAuth.ts'

export async function sendPushNotification({
    fcmToken,
    title,
    body,
    url,
}: {
    fcmToken: string
    title: string
    body: string
    url?: string
}) {
    const { token, projectId } = await getGoogleAccessToken([
        'https://www.googleapis.com/auth/firebase.messaging',
    ])

    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            message: {
                token: fcmToken,
                notification: { title, body },
                data: url ? { url } : undefined,
                webpush: { fcm_options: url ? { link: url } : undefined },
            },
        }),
    })

    const responseBody = await res.json()

    if (!res.ok) {
        console.error('FCM SEND ERROR:', res.status, responseBody)
        throw new Error(`FCM ${res.status}: ${JSON.stringify(responseBody)}`)
    }

    console.log('FCM SEND SUCCESS:', responseBody)
    return responseBody
}
