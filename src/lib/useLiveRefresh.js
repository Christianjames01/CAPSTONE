import { useEffect, useRef } from 'react'
import { supabase } from './supabase'

// Keeps a list/dashboard page up to date without a manual reload.
//
//   useLiveRefresh(['document_requests'], loadRequests)
//
// `refresh` is called as refresh({ silent: true }) -- pages use that to skip
// their loading skeleton so the list just updates in place. It runs:
//   - shortly after any change to the given tables (Supabase Realtime; RLS
//     means each user only hears about rows they can see). A burst of
//     changes is batched into one reload.
//   - when the tab becomes visible again, in case changes were missed.
//   - every POLL_MS while visible, as a safety net if Realtime is down or
//     the table isn't in the realtime publication yet.
const DEBOUNCE_MS = 700
const POLL_MS = 60_000

let channelSeq = 0

export function useLiveRefresh(tables, refresh) {
    const refreshRef = useRef(refresh)

    useEffect(() => {
        refreshRef.current = refresh
    })

    const tableKey = tables.join(',')

    useEffect(() => {
        let timer = null
        let missedWhileHidden = false

        const isVisible = () => document.visibilityState === 'visible'

        const run = () => {
            if (!isVisible()) {
                missedWhileHidden = true
                return
            }
            refreshRef.current?.({ silent: true })
        }

        const schedule = () => {
            clearTimeout(timer)
            timer = setTimeout(run, DEBOUNCE_MS)
        }

        channelSeq += 1
        const channel = supabase.channel(`live-refresh-${channelSeq}`)
        for (const table of tableKey.split(',')) {
            channel.on('postgres_changes', { event: '*', schema: 'public', table }, schedule)
        }
        channel.subscribe()

        const onVisibility = () => {
            if (isVisible() && missedWhileHidden) {
                missedWhileHidden = false
                schedule()
            }
        }
        document.addEventListener('visibilitychange', onVisibility)

        const poll = setInterval(() => {
            if (isVisible()) run()
            else missedWhileHidden = true
        }, POLL_MS)

        return () => {
            clearTimeout(timer)
            clearInterval(poll)
            document.removeEventListener('visibilitychange', onVisibility)
            supabase.removeChannel(channel)
        }
    }, [tableKey])
}
