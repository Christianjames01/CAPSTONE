import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

// Public site key -- safe to be in client code, this is how Turnstile is
// meant to be embedded (the secret key never leaves Supabase's servers).
const SITE_KEY = '0x4AAAAAAAEk6wBO7GnQDBJCw'

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
let scriptLoadPromise = null

function loadTurnstileScript() {
    if (window.turnstile) return Promise.resolve()
    if (scriptLoadPromise) return scriptLoadPromise

    scriptLoadPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script')
        script.src = SCRIPT_SRC
        script.async = true
        script.defer = true
        script.onload = resolve
        script.onerror = reject
        document.head.appendChild(script)
    })

    return scriptLoadPromise
}

// Anti-bot check shown on registration forms. Renders the widget and calls
// onVerify(token) once solved; parent passes that token as
// options.captchaToken to supabase.auth.signUp(). Tokens are single-use, so
// call ref.current.reset() after any failed submit to get a fresh one.
const Turnstile = forwardRef(function Turnstile({ onVerify, onExpire }, ref) {
    const containerRef = useRef(null)
    const widgetIdRef = useRef(null)

    useImperativeHandle(ref, () => ({
        reset: () => {
            if (window.turnstile && widgetIdRef.current) {
                window.turnstile.reset(widgetIdRef.current)
            }
        },
    }))

    useEffect(() => {
        let cancelled = false

        loadTurnstileScript().then(() => {
            if (cancelled || !containerRef.current || widgetIdRef.current) return

            widgetIdRef.current = window.turnstile.render(containerRef.current, {
                sitekey: SITE_KEY,
                callback: (token) => onVerify?.(token),
                'expired-callback': () => onExpire?.(),
                'error-callback': () => onExpire?.(),
            })
        })

        return () => {
            cancelled = true
            if (window.turnstile && widgetIdRef.current) {
                window.turnstile.remove(widgetIdRef.current)
                widgetIdRef.current = null
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return <div ref={containerRef} style={{ margin: '4px 0 14px' }} />
})

export default Turnstile
