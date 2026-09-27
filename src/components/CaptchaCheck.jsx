import { useEffect, useRef, useState } from 'react'
import { captchaEnabled, loadTurnstile, TURNSTILE_SITE_KEY } from '../lib/captcha'
import './CaptchaCheck.css'

// "I'm not a robot" check for the sign-up, sign-in and forgot-password
// forms. Turnstile passes most visitors without a click, so on its own it
// would show "Success" before the user did anything; here the Turnstile
// check only runs once the user clicks the box (execution: 'execute'), and
// Cloudflare's own widget only appears if it needs an extra step.
//
// Calls onToken(token) when passed and onToken(null) when it expires or
// fails. Tokens are single-use: remount it (change its `key`) after each
// attempt. Renders nothing when CAPTCHA isn't enabled (see lib/captcha.js).
function CaptchaCheck({ onToken }) {
    const hostRef = useRef(null)
    const widgetRef = useRef(null)
    const onTokenRef = useRef(onToken)
    const [state, setState] = useState('idle') // idle | checking | done | error
    const [error, setError] = useState('')

    useEffect(() => {
        onTokenRef.current = onToken
    })

    useEffect(() => {
        if (!captchaEnabled || !hostRef.current) return undefined
        let cancelled = false

        loadTurnstile()
            .then((turnstile) => {
                if (cancelled || !hostRef.current) return
                widgetRef.current = turnstile.render(hostRef.current, {
                    sitekey: TURNSTILE_SITE_KEY,
                    execution: 'execute',
                    appearance: 'interaction-only',
                    theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
                    callback: (token) => {
                        setState('done')
                        setError('')
                        onTokenRef.current?.(token)
                    },
                    'expired-callback': () => {
                        setState('idle')
                        onTokenRef.current?.(null)
                        try { turnstile.reset(widgetRef.current) } catch { /* gone */ }
                    },
                    'error-callback': () => {
                        setState('error')
                        setError('Verification failed. Please try again.')
                        onTokenRef.current?.(null)
                    },
                    'timeout-callback': () => {
                        setState('error')
                        setError('Verification timed out. Please try again.')
                        onTokenRef.current?.(null)
                    },
                })
            })
            .catch((err) => {
                setState('error')
                setError(err.message)
            })

        return () => {
            cancelled = true
            try { if (widgetRef.current !== null) window.turnstile?.remove(widgetRef.current) } catch { /* gone */ }
            widgetRef.current = null
            onTokenRef.current?.(null)
        }
    }, [])

    const verify = () => {
        if (state === 'checking' || state === 'done') return
        const turnstile = window.turnstile
        if (!turnstile || widgetRef.current === null) {
            setState('error')
            setError('The security check is still loading. Please try again in a moment.')
            return
        }
        setState('checking')
        setError('')
        try {
            if (state === 'error') turnstile.reset(widgetRef.current)
            turnstile.execute(widgetRef.current)
        } catch {
            setState('error')
            setError('Verification failed. Please try again.')
        }
    }

    if (!captchaEnabled) return null

    return (
        <div className="captcha-check">
            <button
                type="button"
                className={`captcha-box is-${state}`}
                onClick={verify}
                aria-pressed={state === 'done'}
                disabled={state === 'checking' || state === 'done'}
            >
                <span className="captcha-box-mark" aria-hidden="true">
                    {state === 'checking' && <span className="captcha-spinner" />}
                    {state === 'done' && (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                    )}
                </span>
                <span className="captcha-box-text">
                    {state === 'done' ? 'Verified' : state === 'checking' ? 'Verifying…' : 'I’m not a robot'}
                </span>
                <span className="captcha-box-brand">Protected by<br />Cloudflare</span>
            </button>
            <div ref={hostRef} className="captcha-host" />
            {error && <p className="captcha-check-error" role="alert">{error}</p>}
        </div>
    )
}

export default CaptchaCheck
