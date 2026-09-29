import { useState } from 'react'
import { useTourOnPage } from './tourState'

// Sample walk-in queue shown while the guided demo is on the Queue page, so
// the demo has numbers to call even when today's queue is empty. Changes
// made during the demo (calling, completing, issuing) stay on this screen
// only -- nothing is saved.

const minutesAgo = (m) => new Date(Date.now() - m * 60000).toISOString()

const SAMPLE_TICKETS = [
    { queue_id: 'demo-10', queue_number: 10, status: 'completed', displayName: 'Ana Lim', studentNumber: '59984001' },
    { queue_id: 'demo-11', queue_number: 11, status: 'no_show', displayName: null, studentNumber: null },
    { queue_id: 'demo-12', queue_number: 12, status: 'serving', displayName: 'Maria Santos', studentNumber: '59984052', requestNumber: 'REQ-000121', purpose: 'Claim document', called_at: minutesAgo(4) },
    { queue_id: 'demo-13', queue_number: 13, status: 'waiting', displayName: 'Juan Dela Cruz', studentNumber: '59984080', requestNumber: 'REQ-000124', purpose: 'Claim document' },
    { queue_id: 'demo-14', queue_number: 14, status: 'waiting', displayName: null, studentNumber: null, purpose: 'Inquiry' },
    { queue_id: 'demo-15', queue_number: 15, status: 'waiting', displayName: null, studentNumber: null },
].map((t) => ({ ...t, sample: true }))

const EMPTY = { session: null, changes: {}, added: [] }

// { demo, tickets(realTickets), update(ticket, changes), issue(count) }
export function useQueueDemo(path) {
    const { active, session } = useTourOnPage(path)
    const [edits, setEdits] = useState(EMPTY)
    const mine = edits.session === session ? edits : EMPTY

    const tickets = (realTickets) => {
        if (!active) return realTickets
        return [...SAMPLE_TICKETS, ...mine.added]
            .map((t) => ({ ...t, ...mine.changes[t.queue_id] }))
            .sort((a, b) => a.queue_number - b.queue_number)
    }

    const update = (ticket, changes) => setEdits((prev) => {
        const base = prev.session === session ? prev : { ...EMPTY, session }
        return { ...base, changes: { ...base.changes, [ticket.queue_id]: { ...base.changes[ticket.queue_id], ...changes } } }
    })

    const issue = (count) => setEdits((prev) => {
        const base = prev.session === session ? prev : { ...EMPTY, session }
        const last = Math.max(15, ...base.added.map((t) => t.queue_number))
        const added = Array.from({ length: count }, (_, i) => ({
            queue_id: `demo-${last + i + 1}`, queue_number: last + i + 1, status: 'waiting', displayName: null, studentNumber: null, sample: true,
        }))
        return { ...base, added: [...base.added, ...added] }
    })

    return { demo: active, tickets, update, issue }
}
