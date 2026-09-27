// Cloudflare Turnstile CAPTCHA for Supabase Auth (sign-up, password sign-in,
// password reset). Supabase checks the token server-side once "CAPTCHA
// protection" is enabled in Auth settings with the Turnstile secret key.
//
// With CAPTCHA enabled in Supabase, every sign-up, password sign-in and
// password reset must send a token from this site key.

// The public site key, written here on purpose instead of read from a
// Vercel variable: a secret key pasted into that variable by mistake would
// otherwise be published inside the website (Vite inlines env values).
// The secret key belongs only in Supabase Auth.
export const TURNSTILE_SITE_KEY = '0x4AAAAAAEk6wBO7GnQDBJCw'
export const captchaEnabled = Boolean(TURNSTILE_SITE_KEY)

let scriptPromise = null

export function loadTurnstile() {
    if (typeof window === 'undefined') return Promise.reject(new Error('No window'))
    if (window.turnstile) return Promise.resolve(window.turnstile)

    scriptPromise ||= new Promise((resolve, reject) => {
        const script = document.createElement('script')
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
        script.async = true
        script.onload = () => resolve(window.turnstile)
        script.onerror = () => {
            scriptPromise = null
            reject(new Error('The security check could not load. Check your connection and try again.'))
        }
        document.head.appendChild(script)
    })

    return scriptPromise
}

// A one-time token for actions without a visible check on the page (e.g.
// confirming your current password on the Profile page). Usually passes
// silently; if Cloudflare wants a click, a small box appears on screen.
// Returns undefined when CAPTCHA isn't enabled.
export async function getCaptchaToken() {
    if (!captchaEnabled) return undefined

    const turnstile = await loadTurnstile()

    return new Promise((resolve, reject) => {
        const host = document.createElement('div')
        host.className = 'captcha-floating'
        document.body.appendChild(host)

        let widgetId = null
        const cleanup = () => {
            setTimeout(() => {
                try { if (widgetId !== null) turnstile.remove(widgetId) } catch { /* already gone */ }
                host.remove()
            }, 0)
        }

        widgetId = turnstile.render(host, {
            sitekey: TURNSTILE_SITE_KEY,
            appearance: 'interaction-only',
            callback: (token) => {
                resolve(token)
                cleanup()
            },
            'error-callback': () => {
                reject(new Error('Security check failed. Please try again.'))
                cleanup()
            },
            'timeout-callback': () => {
                reject(new Error('Security check timed out. Please try again.'))
                cleanup()
            },
        })
    })
}
