import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { START_TOUR_EVENT } from '../lib/tourSteps'
import TourPreview from './TourPreview'
import { useScrollLock } from '../lib/useScrollLock'
import './ProductTour.css'

// Guided demo tour: highlights parts of the portal one step at a time.
// Starts on its own the first time a newly created account opens its
// portal, and whenever START_TOUR_EVENT is dispatched (the User Guide's
// "Start demo" button). Finishing or skipping remembers it per account in
// this browser.

const NEW_ACCOUNT_DAYS = 14

const storageKey = (role, userId) => `certichain_tour_done:${role}:${userId}`

function readDone(key) {
    try { return localStorage.getItem(key) === '1' } catch { return false }
}

function writeDone(key) {
    try { localStorage.setItem(key, '1') } catch { /* storage unavailable: the tour may show again */ }
}

// The target's box if it's actually on screen (sidebar links are off-canvas
// on phones), otherwise null.
function visibleRect(selector) {
    if (!selector) return null
    const el = document.querySelector(selector)
    if (!el) return null
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) return null
    if (r.right <= 0 || r.left >= window.innerWidth || r.bottom <= 0 || r.top >= window.innerHeight) return null
    return r
}

function ProductTour({ role, steps: allSteps }) {
    const navigate = useNavigate()
    const [key, setKey] = useState(null)
    const [steps, setSteps] = useState([])
    const [index, setIndex] = useState(-1) // -1 = closed
    const [rect, setRect] = useState(null)

    const open = index >= 0 && index < steps.length
    const step = open ? steps[index] : null

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

    // Track the highlighted element's position.
    useLayoutEffect(() => {
        if (!open) return undefined

        const measure = () => setRect(visibleRect(step.target))
        const el = step.target && document.querySelector(step.target)
        el?.scrollIntoView?.({ block: 'nearest' })
        measure()

        window.addEventListener('resize', measure)
        window.addEventListener('scroll', measure, true)
        return () => {
            window.removeEventListener('resize', measure)
            window.removeEventListener('scroll', measure, true)
        }
    }, [open, step])

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

    return (
        <div className="tour-root" role="dialog" aria-modal="true" aria-labelledby="tour-title">
            {rect ? (
                <div
                    className="tour-spotlight"
                    style={{ left: rect.left - 6, top: rect.top - 6, width: rect.width + 12, height: rect.height + 12 }}
                />
            ) : (
                <div className="tour-backdrop" />
            )}

            <div className="tour-card is-centered">
                <div className="tour-card-top">
                    <span className="tour-progress">Step {index + 1} of {steps.length}</span>
                    <button type="button" className="tour-skip" onClick={close}>Skip demo</button>
                </div>

                <TourPreview key={index} name={step.preview} />

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
