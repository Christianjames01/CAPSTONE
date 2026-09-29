import { useEffect, useState } from 'react'

// Which page the guided demo is showing, so a page can switch into a
// "sample data" mode while it's being demonstrated (e.g. the walk-in queue
// shows sample tickets instead of an empty list). ProductTour publishes;
// pages subscribe with useTourOnPage(path).

const TOUR_STATE_EVENT = 'certichain:tour-state'

let current = { open: false, route: null, session: 0 }

export function publishTourState(next) {
    current = { ...current, ...next }
    window.dispatchEvent(new CustomEvent(TOUR_STATE_EVENT, { detail: current }))
}

// True while the guided demo is open anywhere (e.g. the walkthrough video
// on the User Guide pauses so the two don't play over each other).
export function useTourOpen() {
    const [open, setOpen] = useState(current.open)

    useEffect(() => {
        const onChange = (e) => setOpen(!!e.detail.open)
        window.addEventListener(TOUR_STATE_EVENT, onChange)
        return () => window.removeEventListener(TOUR_STATE_EVENT, onChange)
    }, [])

    return open
}

// { active, session }: active while the demo is on `path`; session changes
// with every new demo run (so a page can drop what it changed last time).
export function useTourOnPage(path) {
    const [state, setState] = useState(current)

    useEffect(() => {
        const onChange = (e) => setState(e.detail)
        window.addEventListener(TOUR_STATE_EVENT, onChange)
        return () => window.removeEventListener(TOUR_STATE_EVENT, onChange)
    }, [])

    return { active: state.open && state.route === path, session: state.session }
}
