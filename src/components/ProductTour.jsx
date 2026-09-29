import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { START_TOUR_EVENT } from '../lib/tourSteps'
import { publishTourState } from '../lib/tourState'
import TourPreview from './TourPreview'
import { useScrollLock } from '../lib/useScrollLock'
import hcdcLogo from '../assets/hcdc-logo.png'
import './ProductTour.css'

// Guided demo tour that plays like a short video. Each step opens its real
// page (the path of its sidebar link, or step.route), waits for it to load
// and spotlights the whole page; then a pointer glides to the important
// parts one by one (step.highlights, or common parts of any list page) with
// a caption, and the tour moves on by itself. Pause / Back / Next are always
// there. Steps without a page (welcome, security check) show a picture.
//
// Starts on its own the first time a newly created account opens its
// portal, and whenever START_TOUR_EVENT is dispatched (the User Guide's
// "Start demo" button). Finishing or skipping remembers it per account in
// this browser.

const NEW_ACCOUNT_DAYS = 14
// How long to wait for a page's content before showing it anyway.
const AREA_WAIT_MS = 4000
const DWELL_MS = 3200 // per highlighted part
const PAGE_ONLY_MS = 5000 // a page with no parts found
const PICTURE_MS = 6500 // welcome / security picture steps
const PART_RETRY_MS = 300 // while a page is still loading its parts
const PART_RETRIES = 10
const MOBILE = 700
const INTRO_MS = 2600 // the "Guided demo" countdown before step 1

const storageKey = (role, userId) => `certichain_tour_done:${role}:${userId}`

function readDone(key) {
    try { return localStorage.getItem(key) === '1' } catch { return false }
}

function writeDone(key) {
    try { localStorage.setItem(key, '1') } catch { /* storage unavailable: the tour may show again */ }
}

const PORTAL_CLASS = { student: 'student', employee: 'employee', head: 'admin' }

// The page a step belongs to: step.route, else its sidebar link's href.
function routeOf(step) {
    if (step.route) return step.route
    return step.target?.match(/href="([^"]+)"/)?.[1] || null
}

// Signs that a page has finished loading (its main sections are there).
function areaCandidates(step, portal) {
    return [
        ...(step.area ? [step.area] : []),
        '.chat-app',
        '.ocal-layout',
        `.${portal}-request-grid`,
        '.page-stats',
        `.${portal}-stat-grid`,
        '.dash-overview-grid',
        `.${portal}-list-card`,
        `.${portal}-card`,
        `.${portal}-empty`,
    ]
}

// Parts of a typical list page, used when a step has no highlights of its own.
function genericHighlights(portal) {
    return [
        { selector: `.${portal}-page-header h1, .${portal}-page-header-row h1, .${portal}-dashboard-header h1`, text: 'This is the page — here’s what’s on it.' },
        { selector: '.page-stats, .dash-overview-grid', text: 'A quick summary at the top. Tap a tile to filter.' },
        { selector: `.ui-search-field, .${portal}-search-field, .chat-search`, text: 'Search the list.' },
        { selector: `.${portal}-filter-row, .chat-tabs`, text: 'Filter by status.' },
        { selector: `.${portal}-list-card, .chat-item`, text: 'Each card is one item — open it for the details.' },
        { selector: `.ui-card-actions, .${portal}-card-actions`, text: 'Actions for that item are here.' },
    ]
}

function isShown(el) {
    if (!el) return false
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0 && !el.closest('[aria-busy="true"]')
}

function firstShown(selector) {
    try {
        return [...document.querySelectorAll(selector)].find(isShown) || null
    } catch {
        return null
    }
}

// The portal's content area -- the page spotlight.
function pageArea(portal) {
    return document.querySelector(`.${portal}-content`)
}

function findArea(step, portal) {
    for (const selector of areaCandidates(step, portal)) {
        const el = firstShown(selector)
        if (el) return el
    }
    return null
}

// A highlight's selector may be a list: the first one on screen wins.
function findPart(selector) {
    for (const s of [].concat(selector)) {
        const el = firstShown(s)
        if (el) return el
    }
    return null
}

// The parts to point at on this page, in order. A step's own highlights keep
// their places (el is null for one not on screen yet, and it's skipped), so
// a click that changes the page doesn't shift the ones after it; the generic
// list only keeps what's there.
function resolveHighlights(step, portal) {
    if (step.highlights) return step.highlights.map((h) => ({ ...h, el: findPart(h.selector) }))
    return genericHighlights(portal).map((h) => ({ ...h, el: findPart(h.selector) })).filter((h) => h.el)
}

// The sidebar link's box if it's actually on screen (it's off-canvas on
// phones), otherwise null.
function visibleRect(selector) {
    if (!selector) return null
    const el = document.querySelector(selector)
    if (!el) return null
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) return null
    if (r.right <= 0 || r.left >= window.innerWidth || r.bottom <= 0 || r.top >= window.innerHeight) return null
    return r
}

// The on-screen part of an element.
function clippedRect(el) {
    const r = el.getBoundingClientRect()
    const top = Math.max(r.top, 8)
    const left = Math.max(r.left, 8)
    const bottom = Math.min(r.bottom, window.innerHeight - 8)
    const right = Math.min(r.right, window.innerWidth - 8)
    if (bottom - top < 12 || right - left < 12) return null
    return { top, left, width: right - left, height: bottom - top, bottom, right }
}

// Scroll instantly (the page is scroll-locked while the tour is open, and a
// smooth scroll doesn't run on a locked page).
function scrollPageTo(y) {
    const top = Math.max(0, y)
    document.documentElement.scrollTop = top
    document.body.scrollTop = top
}

// Put a highlighted part in the upper part of the screen (above the phone
// sheet / clear of the desktop card) if it isn't already comfortably visible.
function bringPartIntoView(el) {
    const r = el.getBoundingClientRect()
    const mobile = window.innerWidth < MOBILE
    const visibleTop = mobile ? 70 : 24
    const visibleBottom = mobile ? window.innerHeight * 0.5 : window.innerHeight - 40
    if (r.top >= visibleTop && r.bottom <= visibleBottom) return
    scrollPageTo(window.scrollY + r.top - (mobile ? 90 : Math.max(60, window.innerHeight * 0.22)))
}

function ProductTour({ role, steps: allSteps }) {
    const navigate = useNavigate()
    const location = useLocation()
    const portal = PORTAL_CLASS[role] || role
    const [key, setKey] = useState(null)
    const [steps, setSteps] = useState([])
    const [index, setIndex] = useState(-1) // -1 = closed
    const [rect, setRect] = useState(null) // sidebar link (fallback)
    const [area, setArea] = useState(null) // { rect } of the page
    const [finding, setFinding] = useState(false)
    const [playing, setPlaying] = useState(true)
    const [hl, setHl] = useState(0) // which part of the page is being shown
    const [partCount, setPartCount] = useState(0)
    const [pointer, setPointer] = useState(null) // { x, y, rect, text }
    const [attempt, setAttempt] = useState(0) // re-looks for parts while a page loads
    const [intro, setIntro] = useState(false) // opening countdown
    const areaEl = useRef(null)
    const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < MOBILE)

    const open = index >= 0 && index < steps.length
    const step = open ? steps[index] : null
    const route = step ? routeOf(step) : null
    const ready = open && !finding && (!route || !!area)
    const pageReady = !!area

    // The page behind the demo stays put while it is open.
    useScrollLock(open)

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < MOBILE)
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
    }, [])

    const goTo = useCallback((i) => {
        setIndex(i)
        setHl(0)
        setAttempt(0)
        setPartCount(0)
        setPointer(null)
    }, [])

    // steps: a custom list (e.g. the Queue page's own demo), else the role's.
    const start = useCallback((custom) => {
        // Drop optional steps whose target isn't in this portal (e.g. links
        // hidden for limited-access employees).
        const list = Array.isArray(custom) ? custom : allSteps
        setSteps(list.filter((s) => !s.optional || document.querySelector(s.target)))
        publishTourState({ session: Date.now() })
        setPlaying(true)
        setIntro(!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
        goTo(0)
    }, [allSteps, goTo])

    // The countdown ends by itself (or on a tap).
    useEffect(() => {
        if (!intro) return undefined
        const t = setTimeout(() => setIntro(false), INTRO_MS)
        return () => clearTimeout(t)
    }, [intro])

    // Auto-start for new accounts that haven't seen the tour.
    useEffect(() => {
        let cancelled = false

        supabase.auth.getUser().then(({ data }) => {
            const user = data?.user
            if (cancelled || !user) return

            const k = storageKey(role, user.id)
            setKey(k)

            const ageDays = (Date.now() - new Date(user.created_at).getTime()) / 86400000
            if (!readDone(k) && ageDays <= NEW_ACCOUNT_DAYS) {
                // Let the portal render its sidebar first.
                setTimeout(() => { if (!cancelled) start() }, 700)
            }
        })

        return () => { cancelled = true }
    }, [role, start])

    // Manual start (User Guide "Start demo").
    useEffect(() => {
        const onStart = (e) => start(e.detail?.steps)
        window.addEventListener(START_TOUR_EVENT, onStart)
        return () => window.removeEventListener(START_TOUR_EVENT, onStart)
    }, [start])

    // Tell pages which one the demo is showing (see lib/tourState.js).
    useEffect(() => {
        publishTourState({ open, route: open ? route : null })
    }, [open, route])

    useEffect(() => () => publishTourState({ open: false, route: null }), [])

    // Go to the step's page.
    useEffect(() => {
        if (open && route && location.pathname !== route) navigate(route)
    }, [open, route, location.pathname, navigate])

    // Wait for the page's content, then spotlight the whole page (and keep
    // the spotlight on it while it loads or re-renders).
    useLayoutEffect(() => {
        if (!open) return undefined
        // Syncing with the page layout (an external system).
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setArea(null)
        areaEl.current = null

        if (!route) {
            setFinding(false)
            setRect(visibleRect(step.target))
            return undefined
        }
        if (location.pathname !== route) {
            setFinding(true)
            return undefined
        }

        setFinding(true)
        let stopped = false
        let timer = null
        let scrolledTop = false
        const startedAt = Date.now()

        const measure = () => {
            let el = areaEl.current
            if (!el || !el.isConnected) {
                el = pageArea(portal)
                areaEl.current = el
            }
            if (!el) {
                setArea(null)
                return
            }
            if (!scrolledTop) {
                scrolledTop = true
                scrollPageTo(window.scrollY + el.getBoundingClientRect().top - (window.innerWidth < MOBILE ? 64 : 0))
            }
            const r = clippedRect(el)
            setArea(r ? { rect: r } : null)
        }

        const look = () => {
            if (stopped) return
            const loaded = findArea(step, portal)
            const timedOut = Date.now() - startedAt > AREA_WAIT_MS
            const page = pageArea(portal)
            if (page && (loaded || timedOut)) {
                areaEl.current = page
                measure()
                setTimeout(() => {
                    if (stopped) return
                    measure()
                    setFinding(false)
                }, 400)
                return
            }
            if (timedOut) {
                setFinding(false)
                setRect(visibleRect(step.target))
                return
            }
            timer = setTimeout(look, 150)
        }
        look()

        window.addEventListener('resize', measure)
        window.addEventListener('scroll', measure, true)
        const follow = setInterval(measure, 500)
        return () => {
            stopped = true
            clearTimeout(timer)
            clearInterval(follow)
            window.removeEventListener('resize', measure)
            window.removeEventListener('scroll', measure, true)
        }
    }, [open, step, route, location.pathname, portal])

    const close = useCallback(() => {
        setIndex(-1)
        setPointer(null)
        setIntro(false)
        if (key) writeDone(key)
    }, [key])

    const next = useCallback(() => {
        if (index + 1 >= steps.length) {
            close()
            return
        }
        goTo(index + 1)
    }, [index, steps.length, goTo, close])

    const back = useCallback(() => goTo(Math.max(0, index - 1)), [index, goTo])

    // The walkthrough: point at each part of the page in turn, then move on.
    useEffect(() => {
        if (!ready) return undefined
        const parts = route && pageReady ? resolveHighlights(step, portal) : []
        const anyFound = parts.some((p) => p.el)
        const part = anyFound ? parts[hl] : null
        const missing = !!part && !part.el
        let frame = 0

        // After a click the part may move (e.g. a called ticket jumps to Now
        // Serving): stop following it and let the ring fade.
        let clicked = false

        const place = () => {
            if (!part || missing || clicked) return
            // The page may have re-rendered the part: find it again.
            if (!part.el.isConnected) part.el = findPart(part.selector)
            if (!part.el) return
            const r = clippedRect(part.el)
            if (!r) return
            setPointer({
                x: r.left + Math.min(r.width * 0.72, r.width - 14),
                y: r.top + Math.min(r.height * 0.62, 34),
                rect: r,
                text: part.text,
            })
        }

        if (part && !missing) {
            bringPartIntoView(part.el)
            frame = requestAnimationFrame(place)
        }
        frame = requestAnimationFrame(() => {
            setPartCount(anyFound ? parts.length : 0)
            if (!part || missing) setPointer(null)
            place()
        })

        window.addEventListener('scroll', place, true)
        window.addEventListener('resize', place)

        // "click" parts are pressed once the pointer arrives (e.g. picking a
        // document so its preview shows).
        const clickTimer = part?.click && !missing
            ? setTimeout(() => {
                const el = part.el?.isConnected ? part.el : findPart(part.selector)
                el?.click()
                clicked = true
                setPointer((p) => (p ? { ...p, clicked: true } : p))
            }, 1100)
            : null

        let timer = null
        if (missing) {
            // Not on this page (right now): go straight to the next part.
            timer = setTimeout(() => {
                if (hl + 1 < parts.length) setHl(hl + 1)
                else if (index < steps.length - 1) goTo(index + 1)
            }, 0)
        } else if (route && !part && attempt < PART_RETRIES) {
            // Still loading: look for the parts again shortly.
            timer = setTimeout(() => setAttempt((a) => a + 1), PART_RETRY_MS)
        } else if (playing && !intro) {
            const isLastStep = index === steps.length - 1
            const wait = part ? DWELL_MS : route ? PAGE_ONLY_MS : PICTURE_MS
            timer = setTimeout(() => {
                if (part && hl + 1 < parts.length) setHl(hl + 1)
                else if (!isLastStep) goTo(index + 1)
                else setPlaying(false)
            }, wait)
        }

        return () => {
            cancelAnimationFrame(frame)
            clearTimeout(timer)
            clearTimeout(clickTimer)
            window.removeEventListener('scroll', place, true)
            window.removeEventListener('resize', place)
        }
    }, [ready, pageReady, route, step, portal, hl, playing, intro, index, steps.length, goTo, attempt])

    useEffect(() => {
        if (!open) return undefined
        const onKey = (e) => {
            if (e.key === 'Escape') close()
            else if (e.key === 'ArrowRight') next()
            else if (e.key === 'ArrowLeft') back()
            else if (e.key === ' ' && e.target === document.body) {
                e.preventDefault()
                setPlaying((p) => !p)
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [open, close, next, back])

    if (!open) return null

    const isLast = index === steps.length - 1
    const onPage = !!area
    const spot = area?.rect || (!finding && rect)
    const partProgress = partCount > 0 ? Math.min(1, (hl + 1) / partCount) : 1
    // How long until the demo moves on by itself -- drawn as a ring around
    // the play button (same waits as the walkthrough effect).
    const waitMs = pointer ? DWELL_MS : route ? PAGE_ONLY_MS : PICTURE_MS
    const counting = playing && !intro && ready && !(isLast && !pointer && hl + 1 >= partCount)

    // Caption beside the pointed-at part (desktop); in the sheet on phones.
    const captionStyle = pointer && !isMobile
        ? (() => {
            const r = pointer.rect
            const below = window.innerHeight - r.bottom > 90
            return {
                left: Math.max(12, Math.min(r.left, window.innerWidth - 332)),
                ...(below ? { top: r.bottom + 12 } : { bottom: window.innerHeight - r.top + 12 }),
            }
        })()
        : null

    return (
        <div className="tour-root" role="dialog" aria-modal="true" aria-labelledby="tour-title">
            {intro && (
                <button type="button" className="tour-intro" onClick={() => setIntro(false)} aria-label="Start the demo now">
                    <span className="tour-intro-seal"><img src={hcdcLogo} alt="" /></span>
                    <span className="tour-intro-eyebrow">Guided demo</span>
                    <strong>A quick tour of your portal</strong>
                    <span className="tour-intro-count" aria-hidden="true">
                        <i>3</i><i>2</i><i>1</i>
                        <svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" /></svg>
                    </span>
                    <small>{steps.length} steps · pause, go back or skip anytime · tap to start now</small>
                </button>
            )}

            {!intro && (
                <div key={`chapter-${index}`} className="tour-chapter" aria-hidden="true">
                    <span>{index + 1}</span>{step.title.replace(/^d+.s*/, '')}
                </div>
            )}

            {spot ? (
                <div
                    className="tour-spotlight"
                    style={{ left: spot.left - 6, top: spot.top - 6, width: spot.width + 12, height: spot.height + 12 }}
                />
            ) : (
                <div className="tour-backdrop" />
            )}

            {pointer && (
                <>
                    <div
                        className={`tour-focus${pointer.clicked ? ' is-clicked' : ''}`}
                        style={{ left: pointer.rect.left - 5, top: pointer.rect.top - 5, width: pointer.rect.width + 10, height: pointer.rect.height + 10 }}
                    />
                    <div className="tour-pointer" style={{ transform: `translate(${pointer.x}px, ${pointer.y}px)` }} aria-hidden="true">
                        <span key={`${index}-${hl}`} className="tour-click" />
                        <svg viewBox="0 0 24 24" width="26" height="26">
                            <path d="M4 2.5 20 13l-7.2 1.4L9.6 21 4 2.5z" fill="#fff" stroke="#101827" strokeWidth="1.6" strokeLinejoin="round" />
                        </svg>
                    </div>
                    {captionStyle && (
                        <div key={`cap-${index}-${hl}`} className="tour-caption" style={captionStyle}>{pointer.text}</div>
                    )}
                </>
            )}

            <div
                key={onPage ? 'floating' : 'centered'}
                className={`tour-card ${onPage ? 'is-floating' : 'is-centered'}${intro ? ' is-waiting' : ''}`}
                style={onPage ? (isMobile ? { left: 12, right: 12, bottom: 12 } : { right: 16, bottom: 16, width: Math.min(380, window.innerWidth - 24) }) : undefined}
            >
                {isLast && (
                    <div className="tour-confetti" aria-hidden="true">
                        {Array.from({ length: 16 }, (_, i) => <i key={i} style={{ '--i': i }} />)}
                    </div>
                )}

                <div className="tour-card-top">
                    <span className="tour-progress">Step {index + 1} of {steps.length}</span>
                    <button type="button" className="tour-skip" onClick={close}>Skip demo</button>
                </div>

                <div className="tour-timeline" aria-hidden="true">
                    {steps.map((s, i) => (
                        <span key={s.title} className={i < index ? 'is-done' : i === index ? 'is-active' : ''}>
                            {i === index && <i style={{ width: `${partProgress * 100}%` }} />}
                        </span>
                    ))}
                </div>

                {finding ? (
                    <div className="tour-loading"><span className="tour-loading-bar" /> Opening {step.title.replace(/^\d+\.\s*/, '')}…</div>
                ) : !onPage && (
                    <TourPreview key={index} name={step.preview} />
                )}

                <h3 key={`t-${index}`} id="tour-title" className="tour-anim">{step.title}</h3>
                <p key={`b-${index}`} className="tour-anim" style={{ '--d': '90ms' }}>{step.body}</p>

                {pointer && isMobile && (
                    <p key={`m-${index}-${hl}`} className="tour-now"><span aria-hidden="true">▶</span> {pointer.text}</p>
                )}

                <div className="tour-actions">
                    <button
                        type="button"
                        className="tour-play"
                        onClick={() => setPlaying((p) => !p)}
                        aria-label={playing ? 'Pause demo' : 'Play demo'}
                        title={playing ? 'Pause' : 'Play'}
                    >
                        {counting && (
                            <svg key={`ring-${index}-${hl}-${partCount}`} className="tour-ring" viewBox="0 0 40 40" style={{ '--wait': `${waitMs}ms` }} aria-hidden="true">
                                <circle cx="20" cy="20" r="18" />
                            </svg>
                        )}
                        {playing ? (
                            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
                        ) : (
                            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" /></svg>
                        )}
                    </button>
                    <span className="tour-actions-spacer" />
                    {index > 0 && (
                        <button type="button" className="tour-back" onClick={back}>Back</button>
                    )}
                    {isLast && step.action ? (
                        <button
                            type="button"
                            className="tour-next"
                            onClick={() => { close(); navigate(step.action.to) }}
                        >
                            {step.action.label} →
                        </button>
                    ) : (
                        <button type="button" className="tour-next" onClick={next} autoFocus>
                            {isLast ? 'Finish' : 'Next'} →
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

export default ProductTour
