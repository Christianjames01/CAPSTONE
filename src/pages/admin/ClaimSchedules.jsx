import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activityLog'
import { notifyStudentByStudentId } from '../../lib/notify'
import './AdminPages.css'

const CHIPS = [
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'today', label: 'Today' },
    { key: 'claimed', label: 'Claimed' },
    { key: 'cancelled', label: 'Cancelled' },
    { key: 'all', label: 'All' },
]

function ClaimSchedules() {
    const navigate = useNavigate()

    const [schedules, setSchedules] = useState([])
    const [unclaimed, setUnclaimed] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [activeChip, setActiveChip] = useState('upcoming')
    const [marking, setMarking] = useState(null)

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        try {
            setLoading(true)
            setError('')

            const { data: scheduleRows, error: scheduleError } = await supabase
                .from('claim_schedules')
                .select('claim_schedule_id, request_id, student_id, claim_date, claim_time, scheduled_date, scheduled_time, status, remarks')
                .order('claim_date', { ascending: true })

            if (scheduleError) {
                throw new Error('Failed to load claim schedules: ' + scheduleError.message)
            }

            const rows = scheduleRows || []
            const requestIds = [...new Set(rows.map((s) => s.request_id))]
            const studentIds = [...new Set(rows.map((s) => s.student_id).filter(Boolean))]

            const [{ data: requests }, { data: students }] = await Promise.all([
                requestIds.length
                    ? supabase.from('document_requests').select('request_id, request_number, document_type_id').in('request_id', requestIds)
                    : Promise.resolve({ data: [] }),
                studentIds.length
                    ? supabase.from('students').select('student_id, student_number').in('student_id', studentIds)
                    : Promise.resolve({ data: [] }),
            ])

            const documentTypeIds = [...new Set((requests || []).map((r) => r.document_type_id).filter(Boolean))]

            const { data: documentTypes } = documentTypeIds.length
                ? await supabase.from('document_types').select('document_type_id, document_name').in('document_type_id', documentTypeIds)
                : { data: [] }

            const requestById = Object.fromEntries((requests || []).map((r) => [r.request_id, r]))
            const documentNameById = Object.fromEntries((documentTypes || []).map((d) => [d.document_type_id, d.document_name]))
            const studentNumberById = Object.fromEntries((students || []).map((s) => [s.student_id, s.student_number]))

            setSchedules(
                rows.map((s) => {
                    const request = requestById[s.request_id]
                    return {
                        ...s,
                        requestNumber: request?.request_number || 'N/A',
                        documentName: documentNameById[request?.document_type_id] || 'Document',
                        studentNumber: studentNumberById[s.student_id] || 'N/A',
                    }
                })
            )

            const { data: unclaimedRequests, error: unclaimedError } = await supabase
                .from('document_requests')
                .select('request_id, request_number, student_id, document_type_id')
                .eq('status', 'ready_for_claiming')

            if (unclaimedError) {
                console.error('UNCLAIMED ERROR:', unclaimedError)
            }

            // A request stays "ready_for_claiming" even after a schedule is
            // created, so exclude requests that already have an active schedule.
            const scheduledRequestIds = new Set(
                rows.filter((s) => s.status !== 'cancelled').map((s) => s.request_id)
            )

            const uRows = (unclaimedRequests || []).filter((r) => !scheduledRequestIds.has(r.request_id))
            const uStudentIds = [...new Set(uRows.map((r) => r.student_id).filter(Boolean))]
            const uDocTypeIds = [...new Set(uRows.map((r) => r.document_type_id).filter(Boolean))]

            const [{ data: uStudents }, { data: uDocTypes }] = await Promise.all([
                uStudentIds.length
                    ? supabase.from('students').select('student_id, student_number').in('student_id', uStudentIds)
                    : Promise.resolve({ data: [] }),
                uDocTypeIds.length
                    ? supabase.from('document_types').select('document_type_id, document_name').in('document_type_id', uDocTypeIds)
                    : Promise.resolve({ data: [] }),
            ])

            const uStudentNumberById = Object.fromEntries((uStudents || []).map((s) => [s.student_id, s.student_number]))
            const uDocNameById = Object.fromEntries((uDocTypes || []).map((d) => [d.document_type_id, d.document_name]))

            setUnclaimed(
                uRows.map((r) => ({
                    ...r,
                    studentNumber: uStudentNumberById[r.student_id] || 'N/A',
                    documentName: uDocNameById[r.document_type_id] || 'Document',
                }))
            )

        } catch (err) {
            console.error('CLAIM SCHEDULES ERROR:', err)
            setError(err.message || 'Failed to load claim schedules.')
        } finally {
            setLoading(false)
        }
    }

    const markAsClaimed = async (schedule) => {
        const confirmed = window.confirm(`Mark ${schedule.requestNumber} as claimed?`)
        if (!confirmed) return

        try {
            setMarking(schedule.claim_schedule_id)

            const { data: { user } } = await supabase.auth.getUser()
            const now = new Date().toISOString()

            const { error: scheduleError } = await supabase
                .from('claim_schedules')
                .update({ status: 'claimed', claimed_at: now })
                .eq('claim_schedule_id', schedule.claim_schedule_id)

            if (scheduleError) throw new Error(scheduleError.message)

            const { error: requestError } = await supabase
                .from('document_requests')
                .update({ status: 'completed', completed_at: now })
                .eq('request_id', schedule.request_id)

            if (requestError) throw new Error(requestError.message)

            await logActivity({
                userId: user?.id,
                action: 'mark_claimed',
                tableName: 'document_requests',
                recordId: schedule.request_id,
                description: `Marked ${schedule.requestNumber} as claimed (Registrar Head override).`,
            })

            await notifyStudentByStudentId({
                studentId: schedule.student_id,
                title: 'Document claimed',
                message: `Your document for request ${schedule.requestNumber} has been released. Thank you!`,
                notificationType: 'request_update',
                relatedRequestId: schedule.request_id,
            })

            await loadData()

        } catch (err) {
            console.error('MARK CLAIMED ERROR:', err)
            alert(err.message || 'Failed to mark as claimed.')
        } finally {
            setMarking(null)
        }
    }

    const today = new Date().toISOString().slice(0, 10)

    const visibleSchedules = schedules.filter((s) => {
        const date = s.claim_date || s.scheduled_date
        if (activeChip === 'all') return true
        if (activeChip === 'today') return date === today && s.status !== 'cancelled'
        if (activeChip === 'upcoming') return date >= today && s.status === 'scheduled'
        if (activeChip === 'claimed') return s.status === 'claimed'
        if (activeChip === 'cancelled') return s.status === 'cancelled'
        return true
    })

    return (
        <div>
            <div className="admin-page-header">
                <h1>Claim Schedules</h1>
                <p>All claiming appointments across every employee, plus credentials waiting to be scheduled.</p>
            </div>

            {error && <div className="admin-error-box">{error}</div>}

            <h2 style={{ fontSize: 17, marginBottom: 14 }}>Unclaimed Credentials Needing a Schedule</h2>

            {!loading && unclaimed.length === 0 ? (
                <div className="admin-empty" style={{ marginBottom: 28 }}>Every generated credential has a claim schedule.</div>
            ) : (
                <div style={{ marginBottom: 28 }}>
                    {unclaimed.map((r) => (
                        <div className="admin-list-card" key={r.request_id}>
                            <div className="admin-list-card-header">
                                <div>
                                    <h3>{r.documentName}</h3>
                                    <p>{r.request_number} · Student {r.studentNumber}</p>
                                </div>
                                <span className="admin-status-pill status-ready_for_claiming">Not scheduled</span>
                            </div>

                            <button className="admin-link-button" onClick={() => navigate(`/admin/requests/${r.request_id}`)}>
                                Open request →
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <h2 style={{ fontSize: 17, marginBottom: 14 }}>All Schedules</h2>

            <div className="admin-filter-row">
                {CHIPS.map((chip) => (
                    <button
                        key={chip.key}
                        className={`admin-filter-chip${activeChip === chip.key ? ' active' : ''}`}
                        onClick={() => setActiveChip(chip.key)}
                    >
                        {chip.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <p className="admin-loading">Loading schedules...</p>
            ) : visibleSchedules.length === 0 ? (
                <div className="admin-empty">No schedules match this view.</div>
            ) : (
                visibleSchedules.map((s) => (
                    <div className="admin-list-card" key={s.claim_schedule_id}>
                        <div className="admin-list-card-header">
                            <div>
                                <h3>{s.documentName}</h3>
                                <p>{s.requestNumber} · Student {s.studentNumber}</p>
                            </div>
                            <span className={`admin-status-pill status-${s.status}`}>{s.status}</span>
                        </div>

                        <div className="admin-info-grid">
                            <div className="admin-info-field">
                                <span>Date</span>
                                <strong>{s.claim_date || s.scheduled_date || 'N/A'}</strong>
                            </div>
                            <div className="admin-info-field">
                                <span>Time</span>
                                <strong>{s.claim_time || s.scheduled_time || 'N/A'}</strong>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 16 }}>
                            <button className="admin-link-button" onClick={() => navigate(`/admin/requests/${s.request_id}`)}>
                                Open request →
                            </button>

                            {s.status !== 'claimed' && s.status !== 'cancelled' && (
                                <button className="admin-link-button" onClick={() => markAsClaimed(s)} disabled={marking === s.claim_schedule_id}>
                                    {marking === s.claim_schedule_id ? 'Marking...' : 'Mark as claimed'}
                                </button>
                            )}
                        </div>
                    </div>
                ))
            )}
        </div>
    )
}

export default ClaimSchedules
