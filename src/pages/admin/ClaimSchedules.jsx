import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import RepresentativeBadge from '../../components/RepresentativeBadge'
import { loadRepresentativesByRequestIds } from '../../lib/claimRepresentatives'
import { useLiveRefresh } from '../../lib/useLiveRefresh'
import { formatDisplayDateTime } from '../../lib/formatDate'
import { logActivity } from '../../lib/activityLog'
import { notifyStudentByStudentId, notifyError, confirmModal } from '../../lib/notify'
import { SkeletonList } from '../../components/Skeleton'
import './AdminPages.css'

const CHIPS = [
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'today', label: 'Today' },
    { key: 'missed', label: 'Missed' },
    { key: 'reschedule', label: 'Reschedule Requests' },
    { key: 'claimed', label: 'Claimed' },
    { key: 'cancelled', label: 'Cancelled' },
    { key: 'all', label: 'All' },
]

function formatDate(dateStr) {
    if (!dateStr) return ''
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-PH', {
        weekday: 'short',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    })
}

function formatTime(time) {
    if (!time) return ''
    const [hours, minutes] = time.split(':')
    const date = new Date()
    date.setHours(Number(hours), Number(minutes), 0, 0)
    return date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
}

function ClaimSchedules() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()

    const [schedules, setSchedules] = useState([])
    const [unclaimed, setUnclaimed] = useState([])
    // request_id -> authorized representative, for the release window.
    const [representatives, setRepresentatives] = useState({})
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [activeChip, setActiveChip] = useState(searchParams.get('status') || 'upcoming')
    const [marking, setMarking] = useState(null)

    const listedRequestIds = [...schedules.map((s) => s.request_id), ...unclaimed.map((r) => r.request_id)].sort().join(',')

    useEffect(() => {
        if (!listedRequestIds) return
        loadRepresentativesByRequestIds(listedRequestIds.split(',')).then(setRepresentatives)
    }, [listedRequestIds])

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async ({ silent = false } = {}) => {
        try {
            if (!silent) setLoading(true)
            setError('')

            const { data: scheduleRows, error: scheduleError } = await supabase
                .from('claim_schedules')
                .select('claim_schedule_id, request_id, student_id, claim_date, claim_time, scheduled_date, scheduled_time, status, remarks, reschedule_requested_at, reschedule_reason')
                .order('claim_date', { ascending: true })

            if (scheduleError) {
                throw new Error('Failed to load claim schedules: ' + scheduleError.message)
            }

            const rows = scheduleRows || []
            const requestIds = [...new Set(rows.map((s) => s.request_id))]
            const studentIds = [...new Set(rows.map((s) => s.student_id).filter(Boolean))]

            const [{ data: requests }, { data: students }] = await Promise.all([
                requestIds.length
                    ? supabase.from('document_requests').select('request_id, request_number, document_type_id, requested_at').in('request_id', requestIds)
                    : Promise.resolve({ data: [] }),
                studentIds.length
                    ? supabase.from('students').select('student_id, user_id, student_number').in('student_id', studentIds)
                    : Promise.resolve({ data: [] }),
            ])

            const documentTypeIds = [...new Set((requests || []).map((r) => r.document_type_id).filter(Boolean))]
            const studentUserIds = (students || []).map((s) => s.user_id).filter(Boolean)

            const [{ data: documentTypes }, { data: studentProfiles }] = await Promise.all([
                documentTypeIds.length
                    ? supabase.from('document_types').select('document_type_id, document_name').in('document_type_id', documentTypeIds)
                    : Promise.resolve({ data: [] }),
                studentUserIds.length
                    ? supabase.from('profiles').select('user_id, first_name, last_name').in('user_id', studentUserIds)
                    : Promise.resolve({ data: [] }),
            ])

            const requestById = Object.fromEntries((requests || []).map((r) => [r.request_id, r]))
            const documentNameById = Object.fromEntries((documentTypes || []).map((d) => [d.document_type_id, d.document_name]))
            const studentById = Object.fromEntries((students || []).map((s) => [s.student_id, s]))
            const studentProfileByUserId = Object.fromEntries((studentProfiles || []).map((p) => [p.user_id, p]))

            setSchedules(
                rows.map((s) => {
                    const request = requestById[s.request_id]
                    const student = studentById[s.student_id]
                    const studentProfile = student ? studentProfileByUserId[student.user_id] : null

                    return {
                        ...s,
                        requestNumber: request?.request_number || 'N/A',
                        requestedAt: request?.requested_at || null,
                        documentName: documentNameById[request?.document_type_id] || 'Document',
                        studentNumber: student?.student_number || 'N/A',
                        studentName: studentProfile ? `${studentProfile.first_name} ${studentProfile.last_name}`.trim() : '',
                    }
                })
            )

            const { data: unclaimedRequests, error: unclaimedError } = await supabase
                .from('document_requests')
                .select('request_id, request_number, student_id, document_type_id, requested_at')
                .eq('status', 'ready_for_claiming')

            if (unclaimedError) {
                console.error('UNCLAIMED ERROR:', unclaimedError)
            }

            const scheduledRequestIds = new Set(
                rows.filter((s) => s.status !== 'cancelled').map((s) => s.request_id)
            )

            const uRows = (unclaimedRequests || []).filter((r) => !scheduledRequestIds.has(r.request_id))
            const uStudentIds = [...new Set(uRows.map((r) => r.student_id).filter(Boolean))]
            const uDocTypeIds = [...new Set(uRows.map((r) => r.document_type_id).filter(Boolean))]

            const [{ data: uStudents }, { data: uDocTypes }] = await Promise.all([
                uStudentIds.length
                    ? supabase.from('students').select('student_id, user_id, student_number').in('student_id', uStudentIds)
                    : Promise.resolve({ data: [] }),
                uDocTypeIds.length
                    ? supabase.from('document_types').select('document_type_id, document_name').in('document_type_id', uDocTypeIds)
                    : Promise.resolve({ data: [] }),
            ])

            const uStudentUserIds = (uStudents || []).map((s) => s.user_id).filter(Boolean)

            const { data: uStudentProfiles } = uStudentUserIds.length
                ? await supabase.from('profiles').select('user_id, first_name, last_name').in('user_id', uStudentUserIds)
                : { data: [] }

            const uStudentById = Object.fromEntries((uStudents || []).map((s) => [s.student_id, s]))
            const uStudentProfileByUserId = Object.fromEntries((uStudentProfiles || []).map((p) => [p.user_id, p]))
            const uDocNameById = Object.fromEntries((uDocTypes || []).map((d) => [d.document_type_id, d.document_name]))

            setUnclaimed(
                uRows.map((r) => {
                    const student = uStudentById[r.student_id]
                    const studentProfile = student ? uStudentProfileByUserId[student.user_id] : null

                    return {
                        ...r,
                        studentNumber: student?.student_number || 'N/A',
                        studentName: studentProfile ? `${studentProfile.first_name} ${studentProfile.last_name}`.trim() : '',
                        documentName: uDocNameById[r.document_type_id] || 'Document',
                    }
                })
            )

        } catch (err) {
            console.error('CLAIM SCHEDULES ERROR:', err)
            setError(err.message || 'Failed to load claim schedules.')
        } finally {
            setLoading(false)
        }
    }

    // Update in place when requests change -- no manual refresh needed.
    useLiveRefresh(['claim_schedules', 'document_requests'], loadData)

    const dismissSchedule = async (schedule) => {
        const confirmed = await confirmModal(
            `Dismiss the missed claiming appointment for ${schedule.requestNumber}? The student will need a new schedule if they still want to claim it.`
        )
        if (!confirmed) return

        try {
            setMarking(schedule.claim_schedule_id)

            const { data: { user } } = await supabase.auth.getUser()
            const now = new Date().toISOString()

            const { error: scheduleError } = await supabase
                .from('claim_schedules')
                .update({
                    status: 'cancelled',
                    updated_at: now,
                    remarks: schedule.remarks ? `${schedule.remarks} | Dismissed by Registrar Head.` : 'Dismissed by Registrar Head.',
                })
                .eq('claim_schedule_id', schedule.claim_schedule_id)

            if (scheduleError) throw new Error(scheduleError.message)

            const { error: requestError } = await supabase
                .from('document_requests')
                .update({
                    status: 'ready_for_claiming',
                    employee_remarks: 'Missed claiming appointment dismissed by Registrar Head.',
                    updated_at: now,
                })
                .eq('request_id', schedule.request_id)

            if (requestError) throw new Error(requestError.message)

            await logActivity({
                userId: user?.id,
                action: 'dismiss_missed_claim',
                tableName: 'claim_schedules',
                recordId: schedule.claim_schedule_id,
                description: `Dismissed missed claiming appointment for "${schedule.requestNumber}" (Registrar Head).`,
            })

            await notifyStudentByStudentId({
                studentId: schedule.student_id,
                title: 'Missed claiming appointment',
                message: `You missed your claiming appointment for request ${schedule.requestNumber}. Please schedule a new claiming date.`,
                notificationType: 'request_update',
                relatedRequestId: schedule.request_id,
            })

            await loadData()

        } catch (err) {
            console.error('DISMISS SCHEDULE ERROR:', err)
            notifyError(err.message || 'Failed to dismiss schedule.')
        } finally {
            setMarking(null)
        }
    }

    const markAsClaimed = async (schedule) => {
        const confirmed = await confirmModal(`Mark ${schedule.requestNumber} as claimed?`)
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
                description: `Marked "${schedule.requestNumber}" as claimed (Registrar Head override).`,
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
            notifyError(err.message || 'Failed to mark as claimed.')
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
        if (activeChip === 'missed') return s.status === 'missed'
        if (activeChip === 'reschedule') return !!s.reschedule_requested_at && s.status !== 'cancelled'
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
                                    <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--slate)', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 2 }}>
                                        {r.studentName || `Student ${r.studentNumber}`}
                                    </p>
                                    <h3>{r.documentName}</h3>
                                    <p>{r.request_number} · Student {r.studentNumber}{r.requested_at && ` · Requested ${formatDisplayDateTime(r.requested_at)}`}</p>
                                    <RepresentativeBadge representative={representatives[r.request_id]} />
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
                <SkeletonList count={3} />
            ) : visibleSchedules.length === 0 ? (
                <div className="admin-empty">No schedules match this view.</div>
            ) : (
                visibleSchedules.map((s) => (
                    <div className="admin-list-card" key={s.claim_schedule_id}>
                        <div className="admin-list-card-header">
                            <div>
                                <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--slate)', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 2 }}>
                                    {s.studentName || `Student ${s.studentNumber}`}
                                </p>
                                <h3>{s.documentName}</h3>
                                <p>{s.requestNumber} · Student {s.studentNumber}{s.requestedAt && ` · Requested ${formatDisplayDateTime(s.requestedAt)}`}</p>
                                <RepresentativeBadge representative={representatives[s.request_id]} />
                            </div>
                            <span className={`admin-status-pill status-${s.status}`}>{s.status}</span>
                        </div>

                        <div className="admin-info-grid">
                            <div className="admin-info-field">
                                <span>Date</span>
                                <strong>{formatDate(s.claim_date || s.scheduled_date) || 'N/A'}</strong>
                            </div>
                            <div className="admin-info-field">
                                <span>Time</span>
                                <strong>{formatTime(s.claim_time || s.scheduled_time) || 'N/A'}</strong>
                            </div>
                        </div>

                        {s.reschedule_requested_at && (
                            <div className="admin-notice tone-warning" style={{ marginBottom: 12 }}>
                                <strong>Student requested a reschedule</strong>
                                <p>{s.reschedule_reason}</p>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: 16 }}>
                            <button className="admin-link-button" onClick={() => navigate(`/admin/requests/${s.request_id}`)}>
                                Open request →
                            </button>

                            {s.status !== 'claimed' && s.status !== 'cancelled' && (
                                <button className="admin-link-button" onClick={() => markAsClaimed(s)} disabled={marking === s.claim_schedule_id}>
                                    {marking === s.claim_schedule_id ? 'Marking...' : 'Mark as claimed'}
                                </button>
                            )}

                            {s.status === 'missed' && (
                                <button className="admin-link-button" style={{ color: 'var(--red-dark)' }} onClick={() => dismissSchedule(s)} disabled={marking === s.claim_schedule_id}>
                                    {marking === s.claim_schedule_id ? 'Dismissing...' : 'Dismiss'}
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
