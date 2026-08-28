// Sends web push notifications via the FCM v1 HTTP API, authenticated with
// the Firebase service account JSON stored in the FIREBASE_SERVICE_ACCOUNT
// secret. FCM v1 needs a short-lived Google OAuth2 access token rather than
// a static server key, so this signs the standard service-account JWT
// bearer assertion and exchanges it at Google's token endpoint.

interface ServiceAccount {
    project_id: string
    client_email: string
    private_key: string
}

let cachedToken: { value: string; expiresAt: number } | null = null

function getServiceAccount(): ServiceAccount {
    const raw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT')
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT secret is not set')
    return JSON.parse(raw)
}

function base64url(input: ArrayBuffer | string): string {
    const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input)
    let str = ''
    for (const b of bytes) str += String.fromCharCode(b)
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
    const body = pem
        .replace(/-----BEGIN PRIVATE KEY-----/, '')
        .replace(/-----END PRIVATE KEY-----/, '')
        .replace(/\s+/g, '')

    const binary = atob(body)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

    return crypto.subtle.importKey(
        'pkcs8',
        bytes.buffer,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['sign']
    )
}

async function getAccessToken(): Promise<{ token: string; projectId: string }> {
    const account = getServiceAccount()

    if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
        return { token: cachedToken.value, projectId: account.project_id }
    }

    const now = Math.floor(Date.now() / 1000)
    const header = { alg: 'RS256', typ: 'JWT' }
    const claims = {
        iss: account.client_email,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
    }

    const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`
    const key = await importPrivateKey(account.private_key)
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned))
    const jwt = `${unsigned}.${base64url(signature)}`

    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: jwt,
        }),
    })

    const body = await res.json()
    if (!res.ok) {
        console.error('GOOGLE OAUTH TOKEN ERROR:', body)
        throw new Error(`Failed to get FCM access token: ${JSON.stringify(body)}`)
    }

    cachedToken = { value: body.access_token, expiresAt: now * 1000 + body.expires_in * 1000 }
    return { token: body.access_token, projectId: account.project_id }
}

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
    const { token, projectId } = await getAccessToken()

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
