import { useCallback, useEffect, useRef, useState } from 'react'
import { captchaEnabled, loadTurnstile, TURNSTILE_SITE_KEY } from '../lib/captcha'
import campusPhotoAerial from '../assets/footer-building.jpg'
import campusPhotoBackground from '../assets/hcdc-background.png'
import './CaptchaCheck.css'

const CAMPUS_PHOTOS = [campusPhotoAerial, campusPhotoBackground]
const pickCampusPhoto = () => CAMPUS_PHOTOS[Math.floor(Math.random() * CAMPUS_PHOTOS.length)]

// Slide-puzzle check for the sign-up, sign-in and forgot-password forms:
// drag the slider until the piece fits the gap in the campus photo.
//
// The puzzle is the part people see; the real bot check is Cloudflare
// Turnstile, whose token Supabase verifies on the server. It starts in the
// background as soon as the check opens (it can take several seconds), so
// the check usually passes the moment the puzzle is solved. Cloudflare's own
// widget only appears if it needs an extra step.
//
// Some browsers (strict privacy settings, incognito, VPNs, school networks)
// get an extra Cloudflare checkbox: the page says "tick the box below". If
// Cloudflare never answers (usually an ad blocker or privacy shield blocking
// it), the check gives up after CHECK_TIMEOUT_MS with a clear message instead
// of spinning forever.
//
// Calls onToken(token) when passed and onToken(null) when it expires or
// fails. Tokens are single-use: remount it (change its `key`) after each
// attempt. Renders nothing when CAPTCHA isn't enabled (see lib/captcha.js).

const WIDTH = 300
const HEIGHT = 150
const PIECE = 46
const TOLERANCE = 6
const CHECK_TIMEOUT_MS = 45000

// Shown after a failure; after two, suggest what usually causes it.
const failureMessage = (count, base) => count >= 2
    ? `${base} If it keeps failing, turn off your ad blocker or privacy shield (e.g. Brave Shields) for this site, leave private/incognito mode, or try Chrome or Edge.`
    : `${base} Please slide the puzzle again.`

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
    const [campusPhoto, setCampusPhoto] = useState(pickCampusPhoto)
    const [offset, setOffset] = useState(0)
    const [state, setState] = useState('idle') // idle | dragging | wrong | checking | done | error
    const [error, setError] = useState('')
    // Cloudflare asked for its own tick (shown under the puzzle).
    const [needsTick, setNeedsTick] = useState(false)

    // Cloudflare runs in the background from the moment the check opens, so
    // it's usually finished by the time the puzzle is solved.
    const tokenRef = useRef(null) // Cloudflare's answer, waiting for the puzzle
    const solvedRef = useRef(false) // puzzle solved, waiting for Cloudflare
    const runningRef = useRef(false)
    const pendingErrorRef = useRef(null) // Cloudflare failed before the puzzle was solved
    const autoRetriesRef = useRef(0)
    const watchdog = useRef(null)
    const failures = useRef(0)

    const stopWatchdog = () => {
        clearTimeout(watchdog.current)
        watchdog.current = null
    }

    // Start (or restart) Cloudflare's check in the background.
    const runCloudflare = useCallback(() => {
        const turnstile = window.turnstile
        if (!turnstile || widgetRef.current === null || runningRef.current) return
        tokenRef.current = null
        pendingErrorRef.current = null
        runningRef.current = true
        try {
            turnstile.reset(widgetRef.current)
            turnstile.execute(widgetRef.current)
        } catch {
            runningRef.current = false
        }
    }, [])

    const finish = useCallback((token) => {
        stopWatchdog()
        failures.current = 0
        setNeedsTick(false)
        setState('done')
        setError('')
        onTokenRef.current?.(token)
    }, [])

    // Show a failure, and get a fresh Cloudflare check going for the next try.
    const fail = useCallback((base) => {
        stopWatchdog()
        failures.current += 1
        solvedRef.current = false
        runningRef.current = false
        setNeedsTick(false)
        setState('error')
        setError(failureMessage(failures.current, base))
        onTokenRef.current?.(null)
        runCloudflare()
    }, [runCloudflare])

    // A Cloudflare failure: silently start over once while the student is
    // still on the puzzle; otherwise (or the second time) report it.
    const cloudflareFailed = useCallback((message) => {
        runningRef.current = false
        if (!solvedRef.current && autoRetriesRef.current < 1) {
            autoRetriesRef.current += 1
            runCloudflare()
            return
        }
        if (solvedRef.current) fail(message)
        else pendingErrorRef.current = message
    }, [fail, runCloudflare])

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
                    // Report failures instead of retrying silently behind a
                    // spinner (cloudflareFailed decides what to do).
                    retry: 'never',
                    callback: (token) => {
                        runningRef.current = false
                        tokenRef.current = token
                        if (solvedRef.current) finish(token)
                    },
                    'expired-callback': () => {
                        runningRef.current = false
                        tokenRef.current = null
                        if (solvedRef.current) {
                            // Passed but not used in time: start over.
                            solvedRef.current = false
                            onTokenRef.current?.(null)
                            setPuzzle(newPuzzle())
                            setCampusPhoto(pickCampusPhoto())
                            setOffset(0)
                            setState('idle')
                        }
                        runCloudflare()
                    },
                    'error-callback': (code) => {
                        cloudflareFailed(`Verification failed${code ? ` (code ${code})` : ''}.`)
                        return true
                    },
                    'timeout-callback': () => {
                        cloudflareFailed('Verification timed out.')
                    },
                    // Cloudflare wants a tick: no time limit while it waits.
                    'before-interactive-callback': () => {
                        stopWatchdog()
                        setNeedsTick(true)
                    },
                    'after-interactive-callback': () => {
                        setNeedsTick(false)
                    },
                    'unsupported-callback': () => {
                        runningRef.current = false
                        pendingErrorRef.current = 'This browser isn’t supported by the security check. Please update it, or use Chrome, Edge, Safari or Firefox.'
                        if (solvedRef.current) fail(pendingErrorRef.current)
                    },
                })
                runCloudflare()
            })
            .catch((err) => {
                setState('error')
                setError(err.message)
            })

        return () => {
            cancelled = true
            clearTimeout(watchdog.current)
            try { if (widgetRef.current !== null) window.turnstile?.remove(widgetRef.current) } catch { /* gone */ }
            widgetRef.current = null
            onTokenRef.current?.(null)
        }
    }, [cloudflareFailed, fail, finish, runCloudflare])

    const maxOffset = WIDTH - PIECE
    const locked = state === 'checking' || state === 'done'

    const reset = useCallback(() => {
        stopWatchdog()
        solvedRef.current = false
        setPuzzle(newPuzzle())
        setCampusPhoto(pickCampusPhoto())
        setOffset(0)
        setState('idle')
        setError('')
        // Keep a Cloudflare answer that's already in; otherwise make sure a
        // check is running.
        if (!tokenRef.current) runCloudflare()
    }, [runCloudflare])

    // Puzzle solved: use Cloudflare's answer if it's in, else wait for it.
    const check = (finalOffset) => {
        if (Math.abs(finalOffset - puzzle.x) > TOLERANCE) {
            setState('wrong')
            setTimeout(() => {
                setPuzzle(newPuzzle())
                setCampusPhoto(pickCampusPhoto())
                setOffset(0)
                setState('idle')
            }, 700)
            return
        }

        setOffset(puzzle.x)
        if (!window.turnstile || widgetRef.current === null) {
            setState('error')
            setError('The security check is still loading. Please try again in a moment.')
            return
        }

        solvedRef.current = true
        if (tokenRef.current) {
            finish(tokenRef.current)
            return
        }
        if (pendingErrorRef.current) {
            fail(pendingErrorRef.current)
            return
        }

        setState('checking')
        if (!runningRef.current) runCloudflare()
        // No answer from Cloudflare (blocked, or a very slow network): give
        // up with a clear message rather than spinning forever.
        stopWatchdog()
        watchdog.current = setTimeout(() => fail('The security check is taking too long.'), CHECK_TIMEOUT_MS)
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
                <strong>{state === 'done' ? 'Verified' : needsTick ? 'One more step' : state === 'checking' ? 'Verifying…' : 'Security check'}</strong>
                <span>{state === 'done' ? 'You can continue.' : needsTick ? 'Tick the Cloudflare box below.' : 'Slide the piece into the gap.'}</span>
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
            {needsTick && state !== 'done' && <p className="captcha-check-hint" role="status">Cloudflare needs one more check — tick the box below.</p>}
            <div ref={hostRef} className="captcha-host" />
            {error && <p className="captcha-check-error" role="alert">{error}</p>}
        </div>
    )
}

export default CaptchaCheck
