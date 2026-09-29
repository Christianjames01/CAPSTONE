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
        let settled = false
        const fail = () => {
            if (settled) return
            settled = true
            scriptPromise = null
            script.remove()
            reject(new Error('The security check could not load. Check your connection, or turn off any ad blocker or privacy shield for this site, then try again.'))
        }
        // Gives up after 15 s instead of waiting forever when the request
        // hangs (some networks/blockers never answer).
        const timer = setTimeout(fail, 15000)
        // Cloudflare calls this once turnstile is ready -- the script's own
        // load event can fire a moment before that.
        window.__certichainTurnstileReady = () => {
            if (settled) return
            settled = true
            clearTimeout(timer)
            resolve(window.turnstile)
        }
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__certichainTurnstileReady'
        script.async = true
        script.onerror = () => {
            clearTimeout(timer)
            fail()
        }
        document.head.appendChild(script)
    })

    return scriptPromise
}

// Called when a sign-in / sign-up page loads: fetch Cloudflare's script and
// the pop-up's code early, so the check is ready the moment it's needed.
export function preloadCaptcha() {
    if (!captchaEnabled || typeof window === 'undefined') return
    loadTurnstile().catch(() => { /* retried when the check opens */ })
    import('./captchaPrompt.jsx').catch(() => { /* loaded on demand */ })
}

// Asks the user to pass the security check (slide puzzle, then Cloudflare)
// in a pop-up, and returns the one-time token -- or null if they closed it.
// Called right before each sign-up / password sign-in / password reset (and
// the Profile password re-checks), so the forms don't show the puzzle until
// it's needed. Returns undefined when CAPTCHA isn't enabled.
export async function getCaptchaToken() {
    if (!captchaEnabled) return undefined
    const { openCaptchaPrompt } = await import('./captchaPrompt.jsx')
    return openCaptchaPrompt()
}
