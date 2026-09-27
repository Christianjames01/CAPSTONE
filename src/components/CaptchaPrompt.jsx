import { useEffect, useRef } from 'react'
import CaptchaCheck from './CaptchaCheck'
import './CaptchaCheck.css'

// Pop-up with the slide-puzzle security check, opened by getCaptchaToken()
// (lib/captcha.js) when the user presses Log in / Create account / Send
// reset link, so the forms themselves stay clean. onDone(token) once it's
// solved and verified, onDone(null) if the user closes it.
function CaptchaPrompt({ onDone }) {
    const doneRef = useRef(false)

    const finish = (token) => {
        if (doneRef.current) return
        doneRef.current = true
        onDone(token)
    }

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') finish(null)
        }
        document.addEventListener('keydown', onKey)
        const { overflow } = document.body.style
        document.body.style.overflow = 'hidden'
        return () => {
            document.removeEventListener('keydown', onKey)
            document.body.style.overflow = overflow
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <div className="captcha-prompt-backdrop" onMouseDown={(e) => e.target === e.currentTarget && finish(null)}>
            <div className="captcha-prompt" role="dialog" aria-modal="true" aria-label="Security check">
                <button type="button" className="captcha-prompt-close" onClick={() => finish(null)} aria-label="Cancel">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
                </button>
                <CaptchaCheck
                    onToken={(token) => {
                        // Show "Verified" for a moment, then continue.
                        if (token) setTimeout(() => finish(token), 700)
                    }}
                />
            </div>
        </div>
    )
}

export default CaptchaPrompt
