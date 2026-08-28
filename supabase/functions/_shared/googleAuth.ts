// Mints short-lived Google OAuth2 access tokens from the Firebase service
// account JSON (FIREBASE_SERVICE_ACCOUNT secret), for any Google API scope.
// Shared by firebaseAdmin.ts (FCM) and firebaseStorage.ts (Cloud Storage).
export interface ServiceAccount {
    project_id: string
    client_email: string
    private_key: string
}

const tokenCache = new Map<string, { value: string; expiresAt: number }>()

export function getServiceAccount(): ServiceAccount {
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

export async function getGoogleAccessToken(scopes: string[]): Promise<{ token: string; projectId: string }> {
    const account = getServiceAccount()
    const cacheKey = scopes.join(' ')
    const cached = tokenCache.get(cacheKey)

    if (cached && cached.expiresAt > Date.now() + 30_000) {
        return { token: cached.value, projectId: account.project_id }
    }

    const now = Math.floor(Date.now() / 1000)
    const header = { alg: 'RS256', typ: 'JWT' }
    const claims = {
        iss: account.client_email,
        scope: cacheKey,
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
        throw new Error(`Failed to get Google access token: ${JSON.stringify(body)}`)
    }

    tokenCache.set(cacheKey, { value: body.access_token, expiresAt: now * 1000 + body.expires_in * 1000 })
    return { token: body.access_token, projectId: account.project_id }
}
