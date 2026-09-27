import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

// "… is typing" for the Messages pages, over Supabase Realtime broadcast
// (nothing is stored). Everyone listens on their own `typing:<userId>`
// channel; while typing, a page pings each person in the conversation on
// theirs. A ping lasts a few seconds, so a closed tab or lost connection
// clears itself.
//
//   const { typingUserIds, sendTyping } = useTyping(myUserId)
//   sendTyping([recipientId, ...])          // on every keystroke (throttled)
//   sendTyping([recipientId, ...], false)   // after sending / clearing
const SHOW_MS = 5000
const RESEND_MS = 2500

const topicFor = (userId) => `typing:${userId}`

export function useTyping(selfId) {
    const [typing, setTyping] = useState({}) // userId -> shown until (ms)
    const outgoing = useRef({}) // recipientId -> { channel, ready }
    const lastSent = useRef({}) // recipientId -> ms

    useEffect(() => {
        if (!selfId) return undefined

        const channel = supabase
            .channel(topicFor(selfId), { config: { broadcast: { self: false } } })
            .on('broadcast', { event: 'typing' }, ({ payload }) => {
                if (!payload?.from || payload.from === selfId) return
                setTyping((prev) => ({ ...prev, [payload.from]: payload.typing ? Date.now() + SHOW_MS : 0 }))
            })
            .subscribe()

        const tick = setInterval(() => {
            setTyping((prev) => {
                const now = Date.now()
                const live = Object.entries(prev).filter(([, until]) => until > now)
                return live.length === Object.keys(prev).length ? prev : Object.fromEntries(live)
            })
        }, 1000)

        const sent = outgoing.current
        return () => {
            clearInterval(tick)
            supabase.removeChannel(channel)
            for (const { channel: ch } of Object.values(sent)) supabase.removeChannel(ch)
            outgoing.current = {}
        }
    }, [selfId])

    const sendTyping = useCallback((recipientIds, isTyping = true) => {
        if (!selfId) return
        const now = Date.now()

        for (const id of new Set(recipientIds.filter(Boolean))) {
            if (id === selfId) continue
            if (isTyping && now - (lastSent.current[id] || 0) < RESEND_MS) continue
            lastSent.current[id] = isTyping ? now : 0

            let entry = outgoing.current[id]
            if (!entry) {
                entry = { channel: supabase.channel(`${topicFor(id)}`, { config: { broadcast: { self: false } } }), ready: false, pending: null }
                outgoing.current[id] = entry
                entry.channel.subscribe((status) => {
                    if (status !== 'SUBSCRIBED') return
                    entry.ready = true
                    if (entry.pending) {
                        entry.channel.send(entry.pending)
                        entry.pending = null
                    }
                })
            }

            const message = { type: 'broadcast', event: 'typing', payload: { from: selfId, typing: isTyping } }
            if (entry.ready) entry.channel.send(message)
            else entry.pending = message
        }
    }, [selfId])

    const typingUserIds = Object.keys(typing)

    return { typingUserIds, sendTyping }
}
