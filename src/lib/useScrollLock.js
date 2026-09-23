import { useEffect } from 'react'

// Stops the page behind a modal from scrolling while `active` is true.
//
// Locks <html> rather than <body> so it doesn't fight the layouts, which
// already toggle body overflow for the mobile nav drawer. A counter keeps
// the page locked while any modal is still open (e.g. a confirm popup on
// top of an edit modal), and the scrollbar's width is kept as padding so
// the page doesn't shift sideways when the scrollbar disappears.
let lockCount = 0
let saved = null

export function useScrollLock(active = true) {
    useEffect(() => {
        if (!active) return undefined

        const root = document.documentElement

        if (lockCount === 0) {
            const scrollbarWidth = window.innerWidth - root.clientWidth
            saved = { overflow: root.style.overflow, paddingRight: root.style.paddingRight }
            root.style.overflow = 'hidden'
            if (scrollbarWidth > 0) root.style.paddingRight = `${scrollbarWidth}px`
        }
        lockCount += 1

        return () => {
            lockCount -= 1
            if (lockCount === 0 && saved) {
                root.style.overflow = saved.overflow
                root.style.paddingRight = saved.paddingRight
                saved = null
            }
        }
    }, [active])
}
