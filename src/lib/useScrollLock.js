import { useEffect } from 'react'

// Stops the page behind a modal from scrolling while `active` is true.
//
// Locks <body>, the same element SweetAlert2 locks for its popups. Locking
// <html> instead broke the layout whenever a Swal popup opened on top of a
// modal: with <html> hidden, Swal's hidden <body> became its own scroll box,
// so the sticky sidebar lost its place and the page jumped.
//
// A counter keeps the page locked while any modal is still open (e.g. a
// confirm popup on top of an edit modal), and the scrollbar's width is kept
// as padding so the page doesn't shift sideways when the scrollbar hides.
let lockCount = 0
let saved = null

export function useScrollLock(active = true) {
    useEffect(() => {
        if (!active) return undefined

        const { body } = document

        if (lockCount === 0) {
            const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
            saved = { overflow: body.style.overflow, paddingRight: body.style.paddingRight }
            body.style.overflow = 'hidden'
            if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`
        }
        lockCount += 1

        return () => {
            lockCount -= 1
            if (lockCount === 0 && saved) {
                body.style.overflow = saved.overflow
                body.style.paddingRight = saved.paddingRight
                saved = null
            }
        }
    }, [active])
}
