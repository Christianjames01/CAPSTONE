import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activityLog'
import { createQueueTicket, createQueueTicketBatch, formatQueueNumber, todayStr } from '../../lib/queue'
import { notifyError, notifySuccess, confirmModal } from '../../lib/notify'
import { SkeletonList } from '../../components/Skeleton'
import './EmployeePages.css'

const HISTORY_STATUSES = ['completed', 'no_show', 'cancelled']

function formatTime(value) {
    if (!value) return ''
    return new Date(value).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
}

function EmployeeQueue() {
    const [tickets, setTickets] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [acting, setActing] = useState(null)
    const [issuing, setIssuing] = useState(false)
    const [batchCount, setBatchCount] = useState(1)

    useEffect(() => {
        loadQueue()
        const interval = setInterval(() => loadQueue({ silent: true }), 5000)
        return () => clearInterval(interval)
    }, [])

    const loadQueue = async ({ silent = false } = {}) => {
        try {
            if (!silent) setLoading(true)
            setError('')

            const today = todayStr()

            const { data: rows, error: loadError } = await supabase
                .from('walk_in_queue')
                .select('queue_id, queue_number, status, purpose, visitor_name, called_at, created_at, student_id, request_id')
                .eq('queue_date', today)
                .order('queue_number', { ascending: true })

            if (loadError) throw new Error('Failed to load the queue: ' + loadError.message)

            const rowData = rows || []
            const studentIds = [...new Set(rowData.map((r) => r.student_id).filter(Boolean))]
            const requestIds = [...new Set(rowData.map((r) => r.request_id).filter(Boolean))]

            const [{ data: students }, { data: requests }] = await Promise.all([
                studentIds.length
                    ? supabase.from('students').select('student_id, user_id, student_number').in('student_id', studentIds)
                    : Promise.resolve({ data: [] }),
                requestIds.length
                    ? supabase.from('document_requests').select('request_id, request_number').in('request_id', requestIds)
                    : Promise.resolve({ data: [] }),
            ])

            const studentUserIds = (students || []).map((s) => s.user_id).filter(Boolean)

            const { data: profiles } = studentUserIds.length
                ? await supabase.from('profiles').select('user_id, first_name, last_name').in('user_id', studentUserIds)
                : { data: [] }

            const profileByUserId = Object.fromEntries((profiles || []).map((p) => [p.user_id, p]))
            const studentById = Object.fromEntries((students || []).map((s) => [s.student_id, s]))
            const requestById = Object.fromEntries((requests || []).map((r) => [r.request_id, r]))

            setTickets(
                rowData.map((r) => {
                    const student = studentById[r.student_id]
                    const profile = student ? profileByUserId[student.user_id] : null
                    const linkedName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : null
                    return {
                        ...r,
                        displayName: r.visitor_name || linkedName || null,
                        studentNumber: student?.student_number || null,
                        requestNumber: requestById[r.request_id]?.request_number || null,
                    }
                })
            )

        } catch (err) {
            console.error('EMPLOYEE QUEUE LOAD ERROR:', err)
            if (!silent) setError(err.message || 'Failed to load the queue.')
        } finally {
            if (!silent) setLoading(false)
        }
    }

    const logQueue = async (action, ticket, description) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        await logActivity({ userId: user.id, action, tableName: 'walk_in_queue', recordId: ticket.queue_id, description })
    }

    const updateTicket = async (ticket, changes, description) => {
        try {
            setActing(ticket.queue_id)

            const { error: updateError } = await supabase
                .from('walk_in_queue')
                .update({ ...changes, updated_at: new Date().toISOString() })
                .eq('queue_id', ticket.queue_id)

            if (updateError) throw new Error(updateError.message)

            await logQueue(changes.status ? `queue_${changes.status}` : 'queue_recall', ticket, description)
            await loadQueue({ silent: true })

        } catch (err) {
            console.error('UPDATE QUEUE TICKET ERROR:', err)
            notifyError(err.message || 'Failed to update this ticket.')
        } finally {
            setActing(null)
        }
    }

    const callTicket = async (ticket) => {
        const { data: { user } } = await supabase.auth.getUser()
        const { data: employee } = await supabase.from('employees').select('employee_id').eq('user_id', user.id).maybeSingle()

        await updateTicket(
            ticket,
            { status: 'called', called_at: new Date().toISOString(), served_by: employee?.employee_id || null },
            `Called ${formatQueueNumber(ticket.queue_number)}.`
        )
    }

    const recallTicket = (ticket) =>
        updateTicket(
            ticket,
            { called_at: new Date().toISOString() },
            `Re-called ${formatQueueNumber(ticket.queue_number)}.`
        )

    const markServing = (ticket) =>
        updateTicket(ticket, { status: 'serving' }, `Started serving ${formatQueueNumber(ticket.queue_number)}.`)

    const markCompleted = (ticket) =>
        updateTicket(ticket, { status: 'completed' }, `Completed ${formatQueueNumber(ticket.queue_number)}.`)

    const markNoShow = async (ticket) => {
        const confirmed = await confirmModal(`Mark ${formatQueueNumber(ticket.queue_number)} as a no-show?`)
        if (!confirmed) return
        await updateTicket(ticket, { status: 'no_show' }, `Marked ${formatQueueNumber(ticket.queue_number)} as a no-show.`)
    }

    const cancelTicket = async (ticket) => {
        const confirmed = await confirmModal(`Cancel ticket ${formatQueueNumber(ticket.queue_number)}?`)
        if (!confirmed) return
        await updateTicket(ticket, { status: 'cancelled' }, `Cancelled ${formatQueueNumber(ticket.queue_number)}.`)
    }

    const issueTicket = async () => {
        const count = Math.max(1, Math.min(100, Number(batchCount) || 1))

        try {
            setIssuing(true)

            const { data: { user } } = await supabase.auth.getUser()

            if (count === 1) {
                const ticket = await createQueueTicket()

                await logActivity({
                    userId: user?.id,
                    action: 'queue_issue_ticket',
                    tableName: 'walk_in_queue',
                    recordId: ticket.queue_id,
                    description: `Issued walk-in ticket ${formatQueueNumber(ticket.queue_number)}.`,
                })

                notifySuccess(`Ticket ${formatQueueNumber(ticket.queue_number)} issued.`)
            } else {
                const created = await createQueueTicketBatch(count)
                const first = created[0]
                const last = created[created.length - 1]

                await logActivity({
                    userId: user?.id,
                    action: 'queue_issue_batch',
                    tableName: 'walk_in_queue',
                    recordId: null,
                    description: `Issued ${created.length} walk-in tickets ${formatQueueNumber(first.queue_number)} to ${formatQueueNumber(last.queue_number)}.`,
                })

                notifySuccess(`Issued ${created.length} tickets: ${formatQueueNumber(first.queue_number)} to ${formatQueueNumber(last.queue_number)}.`)
            }

            await loadQueue({ silent: true })

        } catch (err) {
            console.error('ISSUE TICKET ERROR:', err)
            notifyError(err.message || 'Failed to issue a ticket.')
        } finally {
            setIssuing(false)
        }
    }

    const waiting = tickets.filter((t) => t.status === 'waiting')
    const active = tickets.filter((t) => t.status === 'called' || t.status === 'serving')
    const history = tickets.filter((t) => HISTORY_STATUSES.includes(t.status))

    return (
        <div>
            <div className="employee-page-header-row">
                <div>
                    <h1 style={{ fontSize: 26, marginBottom: 6 }}>Walk-in Queue</h1>
                    <p>Today's walk-in numbers. Open the Queue Display on the lobby TV to show what's next.</p>
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <a className="employee-secondary-button" href="/queue-display" target="_blank" rel="noopener noreferrer">
                        Open Queue Display →
                    </a>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                        <span style={{ color: 'var(--slate)' }}>Count</span>
                        <input
                            type="number"
                            min={1}
                            max={100}
                            className="employee-search-input"
                            style={{ width: 70, padding: '8px 10px' }}
                            value={batchCount}
                            onChange={(e) => setBatchCount(e.target.value)}
                            disabled={issuing}
                        />
                    </label>

                    <button className="employee-primary-button" onClick={issueTicket} disabled={issuing}>
                        {issuing
                            ? 'Issuing...'
                            : Number(batchCount) > 1
                                ? `+ Issue ${Math.max(1, Math.min(100, Number(batchCount) || 1))} Numbers`
                                : '+ Issue Number'}
                    </button>
                </div>
            </div>

            {error && <div className="employee-error-box" style={{ marginTop: 16 }}>{error}</div>}

            {loading ? (
                <SkeletonList count={3} />
            ) : (
                <>
                    {active.length > 0 && (
                        <div style={{ marginTop: 20 }}>
                            <h2 style={{ fontSize: 16, marginBottom: 12 }}>Now Serving</h2>
                            {active.map((t) => (
                                <div className="employee-list-card" key={t.queue_id}>
                                    <div className="employee-list-card-header">
                                        <div>
                                            <h3>{formatQueueNumber(t.queue_number)}{t.displayName ? ` — ${t.displayName}` : ''}</h3>
                                            <p>
                                                {t.studentNumber ? `Student ${t.studentNumber}` : 'Walk-in'}
                                                {t.requestNumber ? ` · ${t.requestNumber}` : ''}
                                                {t.purpose ? ` · ${t.purpose}` : ''}
                                                {t.called_at ? ` · Called ${formatTime(t.called_at)}` : ''}
                                            </p>
                                        </div>
                                        <span className={`employee-status-pill status-${t.status}`}>{t.status}</span>
                                    </div>

                                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                        {t.status === 'called' && (
                                            <>
                                                <button className="employee-link-button" onClick={() => markServing(t)} disabled={acting === t.queue_id}>
                                                    Mark as serving
                                                </button>
                                                <button className="employee-link-button" onClick={() => recallTicket(t)} disabled={acting === t.queue_id}>
                                                    Recall (announce again)
                                                </button>
                                            </>
                                        )}
                                        <button className="employee-link-button" onClick={() => markCompleted(t)} disabled={acting === t.queue_id}>
                                            Mark completed
                                        </button>
                                        <button className="employee-link-button" style={{ color: 'var(--red)' }} onClick={() => markNoShow(t)} disabled={acting === t.queue_id}>
                                            No-show
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div style={{ marginTop: 20 }}>
                        <h2 style={{ fontSize: 16, marginBottom: 12 }}>Waiting ({waiting.length})</h2>
                        {waiting.length === 0 ? (
                            <div className="employee-empty">No one is currently waiting.</div>
                        ) : (
                            waiting.map((t) => (
                                <div className="employee-list-card" key={t.queue_id}>
                                    <div className="employee-list-card-header">
                                        <div>
                                            <h3>{formatQueueNumber(t.queue_number)}{t.displayName ? ` — ${t.displayName}` : ''}</h3>
                                            <p>
                                                {t.studentNumber ? `Student ${t.studentNumber}` : 'Walk-in'}
                                                {t.requestNumber ? ` · ${t.requestNumber}` : ''}
                                                {t.purpose ? ` · ${t.purpose}` : ''}
                                            </p>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: 16 }}>
                                        <button className="employee-primary-button" onClick={() => callTicket(t)} disabled={acting === t.queue_id}>
                                            {acting === t.queue_id ? 'Calling...' : 'Call'}
                                        </button>
                                        <button
                                            className="employee-secondary-button"
                                            style={{ color: 'var(--red)', borderColor: 'var(--red)' }}
                                            onClick={() => cancelTicket(t)}
                                            disabled={acting === t.queue_id}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {history.length > 0 && (
                        <div style={{ marginTop: 20 }}>
                            <h2 style={{ fontSize: 16, marginBottom: 12 }}>Earlier Today ({history.length})</h2>
                            {history.map((t) => (
                                <div className="employee-list-card" key={t.queue_id} style={{ opacity: 0.7 }}>
                                    <div className="employee-list-card-header">
                                        <div>
                                            <h3>{formatQueueNumber(t.queue_number)}{t.displayName ? ` — ${t.displayName}` : ''}</h3>
                                            {t.studentNumber && <p>Student {t.studentNumber}</p>}
                                        </div>
                                        <span className={`employee-status-pill status-${t.status}`}>{t.status.replace('_', ' ')}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    )
}

export default EmployeeQueue
