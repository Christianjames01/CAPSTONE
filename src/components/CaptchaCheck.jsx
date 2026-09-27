import { useEffect, useRef, useState } from 'react'
import { captchaEnabled, loadTurnstile, TURNSTILE_SITE_KEY } from '../lib/captcha'
import './CaptchaCheck.css'

// "Verify you are human" box (Cloudflare Turnstile) for the sign-up,
// sign-in and forgot-password forms. Calls onToken(token) when passed and
// onToken(null) when it expires or fails. Tokens are single-use: remount it
// (change its `key`) after each attempt. Renders nothing when CAPTCHA isn't
// enabled (see lib/captcha.js).
function CaptchaCheck({ onToken }) {
    const hostRef = useRef(null)
    const onTokenRef = useRef(onToken)
    const [loadError, setLoadError] = useState('')

    useEffect(() => {
        onTokenRef.current = onToken
    })

    useEffect(() => {
        if (!captchaEnabled || !hostRef.current) return undefined

        let widgetId = null
        let cancelled = false

        loadTurnstile()
            .then((turnstile) => {
                if (cancelled || !hostRef.current) return
                widgetId = turnstile.render(hostRef.current, {
                    sitekey: TURNSTILE_SITE_KEY,
                    theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
                    callback: (token) => onTokenRef.current?.(token),
                    'expired-callback': () => onTokenRef.current?.(null),
                    'error-callback': () => onTokenRef.current?.(null),
                })
            })
            .catch((err) => setLoadError(err.message))

        return () => {
            cancelled = true
            try { if (widgetId !== null) window.turnstile?.remove(widgetId) } catch { /* already gone */ }
            onTokenRef.current?.(null)
        }
    }, [])

    if (!captchaEnabled) return null

    return (
        <div className="captcha-check">
            <div ref={hostRef} />
            {loadError && <p className="captcha-check-error">{loadError}</p>}
        </div>
    )
}

export default CaptchaCheck
