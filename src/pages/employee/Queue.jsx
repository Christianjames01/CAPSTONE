import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activityLog'
import { createQueueTicket, formatQueueNumber, todayStr } from '../../lib/queue'
import { notifyError, notifyWarning, notifySuccess, confirmModal } from '../../lib/notify'
import { SkeletonList } from '../../components/Skeleton'
import Modal from '../../components/Modal'
import './EmployeePages.css'

const HISTORY_STATUSES = ['completed', 'no_show', 'cancelled']

function formatTime(value) {
    if (!value) return ''
    return new Date(value).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
}

function EmployeeQueue() {
    const [employeeId, setEmployeeId] = useState(null)
    const [tickets, setTickets] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [acting, setActing] = useState(null)

    const [showAddModal, setShowAddModal] = useState(false)
    const [lookupNumber, setLookupNumber] = useState('')
    const [foundStudent, setFoundStudent] = useState(null)
    const [lookupError, setLookupError] = useState('')
    const [purpose, setPurpose] = useState('')
    const [looking, setLooking] = useState(false)
    const [adding, setAdding] = useState(false)

    useEffect(() => {
        loadQueue()
        const interval = setInterval(() => loadQueue({ silent: true }), 5000)
        return () => clearInterval(interval)
    }, [])

    const loadQueue = async ({ silent = false } = {}) => {
        try {
            if (!silent) setLoading(true)
            setError('')

            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('You are not logged in.')

            const { data: employee } = await supabase
                .from('employees')
                .select('employee_id')
                .eq('user_id', user.id)
                .single()

            setEmployeeId(employee?.employee_id || null)

            const today = todayStr()

            const { data: rows, error: loadError } = await supabase
                .from('walk_in_queue')
                .select('queue_id, queue_number, status, purpose, called_at, created_at, student_id, request_id')
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
                    return {
                        ...r,
                        studentName: profile ? `${profile.first_name} ${profile.last_name}`.trim() : 'Unknown student',
                        studentNumber: student?.student_number || 'N/A',
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

    const callTicket = (ticket) =>
        updateTicket(
            ticket,
            { status: 'called', called_at: new Date().toISOString(), served_by: employeeId },
            `Called ${formatQueueNumber(ticket.queue_number)} (${ticket.studentName}).`
        )

    const recallTicket = (ticket) =>
        updateTicket(
            ticket,
            { called_at: new Date().toISOString() },
            `Re-called ${formatQueueNumber(ticket.queue_number)} (${ticket.studentName}).`
        )

    const markServing = (ticket) =>
        updateTicket(ticket, { status: 'serving' }, `Started serving ${formatQueueNumber(ticket.queue_number)}.`)

    const markCompleted = (ticket) =>
        updateTicket(ticket, { status: 'completed' }, `Completed ${formatQueueNumber(ticket.queue_number)}.`)

    const markNoShow = async (ticket) => {
        const confirmed = await confirmModal(`Mark ${formatQueueNumber(ticket.queue_number)} (${ticket.studentName}) as a no-show?`)
        if (!confirmed) return
        await updateTicket(ticket, { status: 'no_show' }, `Marked ${formatQueueNumber(ticket.queue_number)} as a no-show.`)
    }

    const cancelTicket = async (ticket) => {
        const confirmed = await confirmModal(`Cancel ${formatQueueNumber(ticket.queue_number)} (${ticket.studentName})'s ticket?`)
        if (!confirmed) return
        await updateTicket(ticket, { status: 'cancelled' }, `Cancelled ${formatQueueNumber(ticket.queue_number)}.`)
    }

    const openAddModal = () => {
        setLookupNumber('')
        setFoundStudent(null)
        setLookupError('')
        setPurpose('')
        setShowAddModal(true)
    }

    const lookupStudent = async () => {
        if (!lookupNumber.trim()) return

        try {
            setLooking(true)
            setLookupError('')
            setFoundStudent(null)

            const { data: student, error: lookupErr } = await supabase
                .from('students')
                .select('student_id, user_id, student_number')
                .eq('student_number', lookupNumber.trim())
                .maybeSingle()

            if (lookupErr) throw new Error(lookupErr.message)
            if (!student) {
                setLookupError('No student found with that student number.')
                return
            }

            const { data: profile } = await supabase
                .from('profiles')
                .select('first_name, last_name')
                .eq('user_id', student.user_id)
                .single()

            setFoundStudent({ ...student, name: profile ? `${profile.first_name} ${profile.last_name}`.trim() : 'Unknown' })

        } catch (err) {
            console.error('QUEUE LOOKUP ERROR:', err)
            setLookupError(err.message || 'Lookup failed.')
        } finally {
            setLooking(false)
        }
    }

    const addWalkIn = async () => {
        if (!foundStudent) {
            notifyWarning('Look up a student first.')
            return
        }

        try {
            setAdding(true)
            const ticket = await createQueueTicket({ studentId: foundStudent.student_id, purpose })
            await logActivity({
                userId: (await supabase.auth.getUser()).data.user?.id,
                action: 'queue_add_walkin',
                tableName: 'walk_in_queue',
                recordId: ticket.queue_id,
                description: `Added walk-in ${formatQueueNumber(ticket.queue_number)} for ${foundStudent.name} (${foundStudent.student_number}).`,
            })
            notifySuccess(`Ticket ${formatQueueNumber(ticket.queue_number)} created for ${foundStudent.name}.`)
            setShowAddModal(false)
            await loadQueue({ silent: true })
        } catch (err) {
            console.error('ADD WALKIN ERROR:', err)
            notifyError(err.message || 'Failed to add this walk-in.')
        } finally {
            setAdding(false)
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

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <a className="employee-secondary-button" href="/queue-display" target="_blank" rel="noopener noreferrer">
                        Open Queue Display →
                    </a>
                    <button className="employee-primary-button" onClick={openAddModal}>+ Add Walk-in</button>
                </div>
            </div>

            {error && <div className="employee-error-box" style={{ marginTop: 16 }}>{error}</div>}

            {showAddModal && (
                <Modal title="Add Walk-in" maxWidth={480} onClose={() => { if (adding) return; setShowAddModal(false) }}>
                    <div className="form-group" style={{ marginBottom: 12 }}>
                        <label className="form-label" htmlFor="lookup-number">Student Number</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input
                                id="lookup-number"
                                className="form-input"
                                value={lookupNumber}
                                onChange={(e) => setLookupNumber(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && lookupStudent()}
                                placeholder="e.g. 20230001"
                                disabled={looking}
                            />
                            <button className="employee-secondary-button" onClick={lookupStudent} disabled={looking}>
                                {looking ? 'Searching...' : 'Find'}
                            </button>
                        </div>
                        {lookupError && <p style={{ color: 'var(--red)', fontSize: 12.5, marginTop: 6 }}>{lookupError}</p>}
                    </div>

                    {foundStudent && (
                        <div className="employee-notice" style={{ marginBottom: 14 }}>
                            <strong>{foundStudent.name}</strong>
                            <p>Student {foundStudent.student_number}</p>
                        </div>
                    )}

                    <div className="form-group" style={{ marginBottom: 16 }}>
                        <label className="form-label" htmlFor="add-purpose">What are they here for? (optional)</label>
                        <input
                            id="add-purpose"
                            className="form-input"
                            value={purpose}
                            onChange={(e) => setPurpose(e.target.value)}
                            placeholder="e.g. Claiming TOR"
                            disabled={adding}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: 10 }}>
                        <button className="employee-primary-button" onClick={addWalkIn} disabled={adding || !foundStudent}>
                            {adding ? 'Adding...' : 'Add to Queue'}
                        </button>
                        <button className="employee-secondary-button" onClick={() => setShowAddModal(false)} disabled={adding}>
                            Cancel
                        </button>
                    </div>
                </Modal>
            )}

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
                                            <h3>{formatQueueNumber(t.queue_number)} — {t.studentName}</h3>
                                            <p>
                                                Student {t.studentNumber}
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
                                            <h3>{formatQueueNumber(t.queue_number)} — {t.studentName}</h3>
                                            <p>
                                                Student {t.studentNumber}
                                                {t.requestNumber ? ` · ${t.requestNumber}` : ''}
                                                {t.purpose ? ` · ${t.purpose}` : ''}
                                            </p>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: 16 }}>
                                        <button className="employee-primary-button" onClick={() => callTicket(t)} disabled={acting === t.queue_id}>
                                            {acting === t.queue_id ? 'Calling...' : 'Call'}
                                        </button>
                                        <button className="employee-link-button" style={{ color: 'var(--red)' }} onClick={() => cancelTicket(t)} disabled={acting === t.queue_id}>
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
                                            <h3>{formatQueueNumber(t.queue_number)} — {t.studentName}</h3>
                                            <p>Student {t.studentNumber}</p>
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
