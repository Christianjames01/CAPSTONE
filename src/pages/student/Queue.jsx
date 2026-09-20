import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { isOfficeOpenToday, createQueueTicket, formatQueueNumber, todayStr } from '../../lib/queue'
import { notifyError, notifyWarning, confirmModal } from '../../lib/notify'
import { SkeletonList } from '../../components/Skeleton'
import '../auth/Auth.css'
import './StudentPages.css'

const STATUS_LABEL = {
    waiting: 'Waiting',
    called: "You're being called",
    serving: 'Now at the counter',
}

function Queue() {
    const [studentId, setStudentId] = useState(null)
    const [officeOpen, setOfficeOpen] = useState(false)
    const [myTicket, setMyTicket] = useState(null)
    const [nowServing, setNowServing] = useState(null)
    const [peopleAhead, setPeopleAhead] = useState(0)
    const [requests, setRequests] = useState([])
    const [requestId, setRequestId] = useState('')
    const [purpose, setPurpose] = useState('')
    const [loading, setLoading] = useState(true)
    const [creating, setCreating] = useState(false)
    const [cancelling, setCancelling] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        loadQueue()

        // Live-ish updates: a TV-display-style feature is worthless if the
        // student's own position only updates on a manual refresh.
        const interval = setInterval(() => loadQueue({ silent: true }), 5000)
        return () => clearInterval(interval)
    }, [])

    const loadQueue = async ({ silent = false } = {}) => {
        try {
            if (!silent) setLoading(true)
            setError('')

            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('You are not logged in.')

            const { data: student } = await supabase
                .from('students')
                .select('student_id')
                .eq('user_id', user.id)
                .single()

            if (!student) throw new Error('Student record could not be found.')
            setStudentId(student.student_id)

            const open = await isOfficeOpenToday()
            setOfficeOpen(open)

            const today = todayStr()

            const { data: ticketRows } = await supabase
                .from('walk_in_queue')
                .select('queue_id, queue_number, status, created_at')
                .eq('student_id', student.student_id)
                .eq('queue_date', today)
                .in('status', ['waiting', 'called', 'serving'])
                .order('created_at', { ascending: false })
                .limit(1)

            const ticket = ticketRows?.[0] || null
            setMyTicket(ticket)

            const { data: servingRows } = await supabase
                .from('walk_in_queue')
                .select('queue_number')
                .eq('queue_date', today)
                .in('status', ['called', 'serving'])
                .order('called_at', { ascending: false })
                .limit(1)

            setNowServing(servingRows?.[0]?.queue_number ?? null)

            if (ticket && ticket.status === 'waiting') {
                const { count } = await supabase
                    .from('walk_in_queue')
                    .select('queue_id', { count: 'exact', head: true })
                    .eq('queue_date', today)
                    .eq('status', 'waiting')
                    .lt('queue_number', ticket.queue_number)

                setPeopleAhead(count || 0)
            }

            if (!ticket) {
                const { data: requestRows } = await supabase
                    .from('document_requests')
                    .select('request_id, request_number, document_type_id, document_types(document_name)')
                    .eq('student_id', student.student_id)
                    .order('requested_at', { ascending: false })

                setRequests(requestRows || [])
            }

        } catch (err) {
            console.error('QUEUE LOAD ERROR:', err)
            if (!silent) setError(err.message || 'Failed to load the queue.')
        } finally {
            if (!silent) setLoading(false)
        }
    }

    const getNumber = async () => {
        if (!studentId) return

        try {
            setCreating(true)
            await createQueueTicket({ studentId, requestId: requestId || null, purpose })
            setRequestId('')
            setPurpose('')
            await loadQueue({ silent: true })
        } catch (err) {
            console.error('GET QUEUE NUMBER ERROR:', err)
            notifyError(err.message || 'Failed to get a queue number.')
        } finally {
            setCreating(false)
        }
    }

    const cancelTicket = async () => {
        if (!myTicket) return

        const confirmed = await confirmModal(`Cancel your queue number ${formatQueueNumber(myTicket.queue_number)}?`)
        if (!confirmed) return

        try {
            setCancelling(true)

            const { error: updateError } = await supabase
                .from('walk_in_queue')
                .update({ status: 'cancelled', updated_at: new Date().toISOString() })
                .eq('queue_id', myTicket.queue_id)

            if (updateError) throw new Error(updateError.message)

            await loadQueue({ silent: true })

        } catch (err) {
            console.error('CANCEL QUEUE TICKET ERROR:', err)
            notifyError(err.message || 'Failed to cancel your ticket.')
        } finally {
            setCancelling(false)
        }
    }

    return (
        <div>
            <div className="student-page-header">
                <h1>Walk-in Queue</h1>
                <p>Get a number if you're at the Registrar's Office without a pre-booked claim schedule.</p>
            </div>

            {error && <div className="student-error-box">{error}</div>}

            {loading ? (
                <SkeletonList count={2} />
            ) : !officeOpen && !myTicket ? (
                <div className="student-empty">
                    The Registrar's Office isn't taking walk-in numbers today. Check the Office Calendar or your
                    dashboard announcements for hours.
                </div>
            ) : myTicket ? (
                <div className="student-card" style={{ textAlign: 'center', padding: '32px 20px' }}>
                    <p style={{ fontSize: 13, color: 'var(--slate)', marginBottom: 8 }}>Your number</p>
                    <div style={{ fontSize: 56, fontWeight: 700, color: 'var(--blue)', lineHeight: 1 }}>
                        {formatQueueNumber(myTicket.queue_number)}
                    </div>
                    <p style={{ marginTop: 10, fontSize: 14.5, fontWeight: 600 }}>{STATUS_LABEL[myTicket.status]}</p>

                    {nowServing !== null && (
                        <p style={{ marginTop: 4, fontSize: 13, color: 'var(--slate)' }}>
                            Now serving: {formatQueueNumber(nowServing)}
                        </p>
                    )}

                    {myTicket.status === 'waiting' && (
                        <p style={{ marginTop: 4, fontSize: 13, color: 'var(--slate)' }}>
                            {peopleAhead === 0 ? "You're next" : `${peopleAhead} ${peopleAhead === 1 ? 'person' : 'people'} ahead of you`}
                        </p>
                    )}

                    {myTicket.status === 'called' && (
                        <div className="student-notice tone-warning" style={{ marginTop: 16, textAlign: 'left' }}>
                            <strong>Please proceed to the counter</strong>
                            <p>Your number was called. Head to the Registrar's Office counter now.</p>
                        </div>
                    )}

                    {myTicket.status === 'waiting' && (
                        <button className="student-link-button" style={{ marginTop: 20 }} onClick={cancelTicket} disabled={cancelling}>
                            {cancelling ? 'Cancelling...' : 'Cancel my number'}
                        </button>
                    )}
                </div>
            ) : (
                <div className="student-card">
                    {nowServing !== null && (
                        <p style={{ fontSize: 13, color: 'var(--slate)', marginBottom: 16 }}>
                            Now serving: <strong>{formatQueueNumber(nowServing)}</strong>
                        </p>
                    )}

                    <div className="form-group" style={{ marginBottom: 14 }}>
                        <label className="form-label" htmlFor="queue-request">Which request is this for? (optional)</label>
                        <select id="queue-request" className="form-input" value={requestId} onChange={(e) => setRequestId(e.target.value)} disabled={creating}>
                            <option value="">-- Not tied to a specific request --</option>
                            {requests.map((r) => (
                                <option key={r.request_id} value={r.request_id}>
                                    {r.request_number} · {r.document_types?.document_name || 'Document'}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: 16 }}>
                        <label className="form-label" htmlFor="queue-purpose">What are you here for? (optional)</label>
                        <input
                            id="queue-purpose"
                            className="form-input"
                            value={purpose}
                            onChange={(e) => setPurpose(e.target.value)}
                            placeholder="e.g. Claiming my TOR"
                            disabled={creating}
                        />
                    </div>

                    <button className="auth-submit" onClick={getNumber} disabled={creating}>
                        {creating ? 'Getting your number...' : 'Get a Queue Number'}
                    </button>
                </div>
            )}
        </div>
    )
}

export default Queue
