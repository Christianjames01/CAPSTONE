import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { START_TOUR_EVENT } from '../lib/tourSteps'
import TourPreview from './TourPreview'
import { useScrollLock } from '../lib/useScrollLock'
import './ProductTour.css'

// Guided demo tour. Each step opens its real page (the path of its sidebar
// link, or step.route), waits for it to load, and spotlights the whole page
// (the portal's content area, from the top) with the explanation in the
// corner -- a sheet at the bottom on phones. Steps without a page (welcome,
// security check) show a picture instead.
//
// Starts on its own the first time a newly created account opens its
// portal, and whenever START_TOUR_EVENT is dispatched (the User Guide's
// "Start demo" button). Finishing or skipping remembers it per account in
// this browser.

const NEW_ACCOUNT_DAYS = 14
// How long to wait for a page's content before showing it anyway.
const AREA_WAIT_MS = 4000

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

function isShown(el) {
    if (!el) return false
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0 && !el.closest('[aria-busy="true"]')
}

// The portal's content area -- what the tour spotlights.
function pageArea(portal) {
    return document.querySelector(`.${portal}-content`)
}

function findArea(step, portal) {
    for (const selector of areaCandidates(step, portal)) {
        const el = [...document.querySelectorAll(selector)].find(isShown)
        if (el) return el
    }
    return null
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

// The on-screen part of an element (a tall section is only spotlit where
// it's visible).
function clippedRect(el) {
    const r = el.getBoundingClientRect()
    const top = Math.max(r.top, 8)
    const left = Math.max(r.left, 8)
    const bottom = Math.min(r.bottom, window.innerHeight - 8)
    const right = Math.min(r.right, window.innerWidth - 8)
    if (bottom - top < 20 || right - left < 20) return null
    return { top, left, width: right - left, height: bottom - top, bottom, right }
}

// Put the card beside the spotlight where there's room; a sheet at the
// bottom on phones.
function cardPosition(r) {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const W = Math.min(380, vw - 24)
    const clampX = (x) => Math.max(12, Math.min(x, vw - W - 12))
    const clampY = (y) => Math.max(12, Math.min(y, vh - 280))

    if (vw < 700) return { left: 12, right: 12, bottom: 12 }
    if (vw - r.right >= W + 28) return { left: r.right + 16, top: clampY(r.top), width: W }
    if (r.left >= W + 28) return { left: r.left - W - 16, top: clampY(r.top), width: W }
    if (vh - r.bottom >= 300) return { left: clampX(r.left), top: r.bottom + 16, width: W }
    if (r.top >= 300) return { left: clampX(r.left), bottom: vh - r.top + 16, width: W }
    return { right: 16, bottom: 16, width: W }
}

function ProductTour({ role, steps: allSteps }) {
    const navigate = useNavigate()
    const location = useLocation()
    const portal = PORTAL_CLASS[role] || role
    const [key, setKey] = useState(null)
    const [steps, setSteps] = useState([])
    const [index, setIndex] = useState(-1) // -1 = closed
    const [rect, setRect] = useState(null) // sidebar link (fallback)
    const [area, setArea] = useState(null) // { rect } of the real section
    const [finding, setFinding] = useState(false)
    const areaEl = useRef(null)

    const open = index >= 0 && index < steps.length
    const step = open ? steps[index] : null
    const route = step ? routeOf(step) : null

    // The page behind the demo stays put while it is open.
    useScrollLock(open)

    const start = useCallback(() => {
        // Drop optional steps whose target isn't in this portal (e.g. links
        // hidden for limited-access employees).
        setSteps(allSteps.filter((s) => !s.optional || document.querySelector(s.target)))
        setIndex(0)
    }, [allSteps])

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
        const onStart = () => start()
        window.addEventListener(START_TOUR_EVENT, onStart)
        return () => window.removeEventListener(START_TOUR_EVENT, onStart)
    }, [start])

    // Go to the step's page.
    useEffect(() => {
        if (open && route && location.pathname !== route) navigate(route)
    }, [open, route, location.pathname, navigate])

    // Find the real section once the page has loaded, bring it into view
    // and keep the spotlight on it.
    useLayoutEffect(() => {
        if (!open) return undefined
        // Syncing with the page layout (an external system): reset, then
        // measure once the section is found.
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
        const startedAt = Date.now()
        let timer = null

        // Pages re-render (data loading, live updates) and can swap the
        // section for a new element: find it again when that happens.
        // Bring the section into view. Instant: the page is scroll-locked
        // while the tour is open, and a smooth scroll doesn't run on a locked
        // page. On phones, leave room at the bottom for the explanation sheet.
        let scrolledTo = null
        let scrollTries = 0
        const bringIntoView = (el) => {
            const r = el.getBoundingClientRect()
            const target = window.scrollY + r.top - (window.innerWidth < 700 ? 64 : 0)
            document.documentElement.scrollTop = Math.max(0, target)
            document.body.scrollTop = Math.max(0, target)
        }

        // Pages re-render (data loading, live updates) and can swap the
        // section for a new element or move it: find it again and scroll it
        // back into view when that happens.
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
            let r = clippedRect(el)
            if ((el !== scrolledTo || !r) && scrollTries < 12) {
                scrolledTo = el
                scrollTries += 1
                bringIntoView(el)
                r = clippedRect(el)
            }
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
                }, 450)
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
        // Content still loading can move the section; keep up with it.
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
        if (key) writeDone(key)
    }, [key])

    const next = useCallback(() => {
        setIndex((i) => {
            if (i + 1 >= steps.length) {
                if (key) writeDone(key)
                return -1
            }
            return i + 1
        })
    }, [steps.length, key])

    const back = () => setIndex((i) => Math.max(0, i - 1))

    useEffect(() => {
        if (!open) return undefined
        const onKey = (e) => {
            if (e.key === 'Escape') close()
            else if (e.key === 'ArrowRight') next()
            else if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [open, close, next])

    if (!open) return null

    const isLast = index === steps.length - 1
    const onPage = !!area
    const spot = area?.rect || (!finding && rect)

    return (
        <div className="tour-root" role="dialog" aria-modal="true" aria-labelledby="tour-title">
            {spot ? (
                <div
                    className="tour-spotlight"
                    style={{ left: spot.left - 6, top: spot.top - 6, width: spot.width + 12, height: spot.height + 12 }}
                />
            ) : (
                <div className="tour-backdrop" />
            )}

            <div
                className={`tour-card ${onPage ? 'is-floating' : 'is-centered'}`}
                style={onPage ? cardPosition(area.rect) : undefined}
            >
                <div className="tour-card-top">
                    <span className="tour-progress">Step {index + 1} of {steps.length}</span>
                    <button type="button" className="tour-skip" onClick={close}>Skip demo</button>
                </div>

                {finding ? (
                    <div className="tour-loading"><span className="tour-loading-bar" /> Opening {step.title.replace(/^\d+\.\s*/, '')}…</div>
                ) : !onPage && (
                    <TourPreview key={index} name={step.preview} />
                )}

                <h3 id="tour-title">{step.title}</h3>
                <p>{step.body}</p>

                <div className="tour-dots" aria-hidden="true">
                    {steps.map((s, i) => <span key={s.title} className={i === index ? 'is-active' : i < index ? 'is-done' : ''} />)}
                </div>

                <div className="tour-actions">
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
                            {index === 0 ? 'Start tour' : isLast ? 'Finish' : 'Next'} →
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

export default ProductTour
