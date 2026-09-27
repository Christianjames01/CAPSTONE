import { useCallback, useEffect, useRef, useState } from 'react'
import { captchaEnabled, loadTurnstile, TURNSTILE_SITE_KEY } from '../lib/captcha'
import campusPhoto from '../assets/footer-building.jpg'
import './CaptchaCheck.css'

// Slide-puzzle check for the sign-up, sign-in and forgot-password forms:
// drag the slider until the piece fits the gap in the campus photo.
//
// The puzzle is the part people see; the real bot check is Cloudflare
// Turnstile, which only runs once the puzzle is solved (execution:
// 'execute') and whose token Supabase verifies on the server. Cloudflare's
// own widget only appears if it needs an extra step.
//
// Calls onToken(token) when passed and onToken(null) when it expires or
// fails. Tokens are single-use: remount it (change its `key`) after each
// attempt. Renders nothing when CAPTCHA isn't enabled (see lib/captcha.js).

const WIDTH = 300
const HEIGHT = 150
const PIECE = 46
const TOLERANCE = 6

const newPuzzle = () => ({
    x: Math.round(WIDTH * 0.42 + Math.random() * (WIDTH * 0.5 - PIECE)),
    y: Math.round(18 + Math.random() * (HEIGHT - PIECE - 36)),
})

function CaptchaCheck({ onToken }) {
    const hostRef = useRef(null)
    const widgetRef = useRef(null)
    const trackRef = useRef(null)
    const onTokenRef = useRef(onToken)
    const drag = useRef(null)

    const [puzzle, setPuzzle] = useState(newPuzzle)
    const [offset, setOffset] = useState(0)
    const [state, setState] = useState('idle') // idle | dragging | wrong | checking | done | error
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
                        onTokenRef.current?.(null)
                        try { turnstile.reset(widgetRef.current) } catch { /* gone */ }
                        setPuzzle(newPuzzle())
                        setOffset(0)
                        setState('idle')
                    },
                    'error-callback': () => {
                        setState('error')
                        setError('Verification failed. Please try the puzzle again.')
                        onTokenRef.current?.(null)
                    },
                    'timeout-callback': () => {
                        setState('error')
                        setError('Verification timed out. Please try the puzzle again.')
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

    const maxOffset = WIDTH - PIECE
    const locked = state === 'checking' || state === 'done'

    const reset = useCallback(() => {
        setPuzzle(newPuzzle())
        setOffset(0)
        setState('idle')
        setError('')
        try { if (widgetRef.current !== null) window.turnstile?.reset(widgetRef.current) } catch { /* gone */ }
    }, [])

    // Solved: now run the Cloudflare check.
    const check = (finalOffset) => {
        if (Math.abs(finalOffset - puzzle.x) > TOLERANCE) {
            setState('wrong')
            setTimeout(() => {
                setPuzzle(newPuzzle())
                setOffset(0)
                setState('idle')
            }, 700)
            return
        }

        setOffset(puzzle.x)
        const turnstile = window.turnstile
        if (!turnstile || widgetRef.current === null) {
            setState('error')
            setError('The security check is still loading. Please try again in a moment.')
            return
        }
        setState('checking')
        try {
            turnstile.execute(widgetRef.current)
        } catch {
            setState('error')
            setError('Verification failed. Please try the puzzle again.')
        }
    }

    const moveTo = (clientX) => {
        const { startX, startOffset } = drag.current
        setOffset(Math.max(0, Math.min(maxOffset, startOffset + clientX - startX)))
    }

    const onPointerDown = (e) => {
        if (locked) return
        if (state === 'error') reset()
        e.currentTarget.setPointerCapture?.(e.pointerId)
        drag.current = { startX: e.clientX, startOffset: offset }
        setState('dragging')
    }

    const onPointerMove = (e) => {
        if (!drag.current) return
        moveTo(e.clientX)
    }

    const onPointerUp = (e) => {
        if (!drag.current) return
        const { startX, startOffset } = drag.current
        drag.current = null
        check(Math.max(0, Math.min(maxOffset, startOffset + e.clientX - startX)))
    }

    const onKeyDown = (e) => {
        if (locked) return
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            e.preventDefault()
            const step = e.shiftKey ? 10 : 2
            setOffset((o) => Math.max(0, Math.min(maxOffset, o + (e.key === 'ArrowRight' ? step : -step))))
        } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            check(offset)
        }
    }

    if (!captchaEnabled) return null

    const photo = { backgroundImage: `url(${campusPhoto})`, backgroundSize: `${WIDTH}px ${HEIGHT}px` }

    return (
        <div className={`captcha-puzzle is-${state}`} style={{ '--puzzle-w': `${WIDTH}px` }}>
            <div className="captcha-puzzle-head">
                <strong>{state === 'done' ? 'Verified' : state === 'checking' ? 'Verifying…' : 'Security check'}</strong>
                <span>{state === 'done' ? 'You can continue.' : 'Slide the piece into the gap.'}</span>
                {!locked && (
                    <button type="button" className="captcha-puzzle-refresh" onClick={reset} aria-label="New puzzle" title="New puzzle">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 5v6h-6" /></svg>
                    </button>
                )}
            </div>

            <div className="captcha-puzzle-image" style={photo} aria-hidden="true">
                <span className="captcha-puzzle-gap" style={{ left: puzzle.x, top: puzzle.y, width: PIECE, height: PIECE }} />
                <span
                    className="captcha-puzzle-piece"
                    style={{
                        ...photo,
                        left: offset,
                        top: puzzle.y,
                        width: PIECE,
                        height: PIECE,
                        backgroundPosition: `-${puzzle.x}px -${puzzle.y}px`,
                    }}
                />
                {state === 'done' && (
                    <span className="captcha-puzzle-ok">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                    </span>
                )}
            </div>

            <div className="captcha-puzzle-track" ref={trackRef}>
                <span className="captcha-puzzle-fill" style={{ width: offset + PIECE }} />
                <span className="captcha-puzzle-hint">{locked ? '' : 'Drag the slider →'}</span>
                <button
                    type="button"
                    className="captcha-puzzle-handle"
                    style={{ left: offset }}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                    onKeyDown={onKeyDown}
                    disabled={locked}
                    role="slider"
                    aria-label="Slide the puzzle piece into the gap"
                    aria-valuemin={0}
                    aria-valuemax={maxOffset}
                    aria-valuenow={offset}
                >
                    {state === 'checking' ? <span className="captcha-spinner" /> : state === 'done' ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                    ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                    )}
                </button>
            </div>

            <span className="captcha-puzzle-brand">Protected by Cloudflare</span>
            <div ref={hostRef} className="captcha-host" />
            {error && <p className="captcha-check-error" role="alert">{error}</p>}
        </div>
    )
}

export default CaptchaCheck
