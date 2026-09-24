import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import './RescheduleHistory.css'

function formatDateTime(value) {
    if (!value) return ''
    return new Date(value).toLocaleString('en-PH', {
        month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    })
}

function formatClaimSlot(date, time) {
    if (!date) return ''
    const d = new Date(`${date}T${time || '00:00'}`)
    const day = d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
    return time ? `${day} at ${d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}` : day
}

// Every reschedule request the student sent for this claim schedule, with
// whether staff handled it (and the date they moved it to). Used on the
// admin and employee Claim Schedule pages.
//
// `pending` is the schedule's current reschedule_requested_at/reason, used
// if the history table isn't there yet or doesn't have this request.
// `reloadKey` re-fetches after staff save a new date.
function RescheduleHistory({ scheduleId, pending, reloadKey }) {
    const [rows, setRows] = useState([])

    useEffect(() => {
        if (!scheduleId) return undefined
        let cancelled = false

        supabase
            .from('claim_reschedule_requests')
            .select('reschedule_request_id, reason, requested_at, handled_at, new_claim_date, new_claim_time')
            .eq('claim_schedule_id', scheduleId)
            .order('requested_at', { ascending: false })
            .then(({ data, error }) => {
                if (cancelled) return
                if (error) console.warn('LOAD RESCHEDULE HISTORY ERROR:', error)
                setRows(data || [])
            })

        return () => { cancelled = true }
    }, [scheduleId, reloadKey])

    const items = [...rows]
    if (pending?.requestedAt && !items.some((r) => !r.handled_at)) {
        items.unshift({ reschedule_request_id: 'pending', reason: pending.reason, requested_at: pending.requestedAt, handled_at: null })
    }

    if (items.length === 0) return null

    const openCount = items.filter((r) => !r.handled_at).length

    return (
        <section className="rsh" aria-label="Student's reschedule requests">
            <div className="rsh-head">
                <strong>Student's Reschedule Requests</strong>
                {openCount > 0 && <span className="rsh-pill is-pending">{openCount} pending</span>}
            </div>

            <ul className="rsh-list">
                {items.map((r) => (
                    <li key={r.reschedule_request_id} className={`rsh-item${r.handled_at ? ' is-handled' : ' is-pending'}`}>
                        <div className="rsh-item-top">
                            <span className={`rsh-pill ${r.handled_at ? 'is-handled' : 'is-pending'}`}>
                                {r.handled_at ? 'Handled' : 'Pending'}
                            </span>
                            <span className="rsh-meta">Sent {formatDateTime(r.requested_at)}</span>
                        </div>

                        <p className="rsh-reason">{r.reason?.trim() ? `“${r.reason.trim()}”` : 'No message provided.'}</p>

                        {r.handled_at && (
                            <p className="rsh-meta">
                                Rescheduled {formatDateTime(r.handled_at)}
                                {r.new_claim_date && <> · moved to <strong>{formatClaimSlot(r.new_claim_date, r.new_claim_time)}</strong></>}
                            </p>
                        )}
                    </li>
                ))}
            </ul>
        </section>
    )
}

export default RescheduleHistory
