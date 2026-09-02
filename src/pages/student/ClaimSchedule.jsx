import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'
import { supabase } from '../../lib/supabase'
import { notify, notifyError, notifySuccess } from '../../lib/notify'
import { SkeletonList } from '../../components/Skeleton'
import './StudentPages.css'

function ClaimSchedule() {
    const navigate = useNavigate()

    const [schedules, setSchedules] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [requestingRescheduleId, setRequestingRescheduleId] = useState(null)

    useEffect(() => {
        loadSchedules()
    }, [])

    const loadSchedules = async () => {
        try {
            setLoading(true)
            setError('')

            const {
                data: { user },
                error: userError
            } = await supabase.auth.getUser()

            if (userError || !user) {
                throw new Error('You are not logged in.')
            }

            const { data: student, error: studentError } = await supabase
                .from('students')
                .select('student_id')
                .eq('user_id', user.id)
                .single()

            if (studentError || !student) {
                throw new Error('Student record could not be found.')
            }

            const { data: scheduleRows, error: scheduleError } = await supabase
                .from('claim_schedules')
                .select(`
                    claim_schedule_id,
                    request_id,
                    scheduled_date,
                    scheduled_time,
                    status,
                    claim_date,
                    claim_time,
                    remarks,
                    claimed_at,
                    created_at
                `)
                .eq('student_id', student.student_id)
                .order('created_at', { ascending: false })

            if (scheduleError) {
                throw new Error('Failed to load claim schedules: ' + scheduleError.message)
            }

            if (!scheduleRows || scheduleRows.length === 0) {
                setSchedules([])
                return
            }

            const requestIds = [...new Set(scheduleRows.map((s) => s.request_id))]

            const { data: requests } = await supabase
                .from('document_requests')
                .select('request_id, request_number, document_type_id, assigned_employee_id')
                .in('request_id', requestIds)

            const documentTypeIds = [
                ...new Set((requests || []).map((r) => r.document_type_id).filter(Boolean))
            ]

            const { data: documentTypes } = documentTypeIds.length
                ? await supabase
                    .from('document_types')
                    .select('document_type_id, document_name')
                    .in('document_type_id', documentTypeIds)
                : { data: [] }

            const requestsById = Object.fromEntries(
                (requests || []).map((r) => [r.request_id, r])
            )

            const documentNameById = Object.fromEntries(
                (documentTypes || []).map((d) => [d.document_type_id, d.document_name])
            )

            const merged = scheduleRows.map((schedule) => {
                const request = requestsById[schedule.request_id]

                return {
                    ...schedule,
                    requestNumber: request?.request_number || 'N/A',
                    documentName: documentNameById[request?.document_type_id] || 'Document',
                    assignedEmployeeId: request?.assigned_employee_id || null,
                }
            })

            setSchedules(merged)

        } catch (err) {
            console.error('CLAIM SCHEDULE ERROR:', err)
            setError(err.message || 'Failed to load claim schedules.')
        } finally {
            setLoading(false)
        }
    }

    const formatDate = (date) => {
        if (!date) return 'Not yet scheduled'

        return new Date(`${date}T00:00:00`).toLocaleDateString('en-PH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })
    }

    const formatTime = (time) => {
        if (!time) return ''

        const [hours, minutes] = time.split(':')
        const date = new Date()
        date.setHours(Number(hours), Number(minutes), 0, 0)

        return date.toLocaleTimeString('en-PH', {
            hour: 'numeric',
            minute: '2-digit'
        })
    }

    const formatArriveByTime = (time) => {
        if (!time) return ''

        const [hours, minutes] = time.split(':')
        const date = new Date()
        date.setHours(Number(hours), Number(minutes), 0, 0)
        date.setMinutes(date.getMinutes() - 30)

        return date.toLocaleTimeString('en-PH', {
            hour: 'numeric',
            minute: '2-digit'
        })
    }

    const requestReschedule = async (schedule) => {
        const { value: reason } = await Swal.fire({
            title: 'Request a Reschedule',
            text: 'Tell the Registrar why you need a new date. Mention a preferred date if you have one.',
            input: 'textarea',
            inputLabel: 'Reason',
            inputPlaceholder: 'e.g. I have a class conflict, could I come next Monday instead?',
            inputValidator: (value) => {
                if (!value || !value.trim()) return 'Please enter a reason.'
            },
            showCancelButton: true,
            confirmButtonText: 'Send Request',
            confirmButtonColor: '#123B78',
        })

        if (!reason) return

        try {
            setRequestingRescheduleId(schedule.claim_schedule_id)

            if (!schedule.assignedEmployeeId) {
                throw new Error('No registrar employee is assigned to this request yet.')
            }

            const { data: employeeRow, error: employeeError } = await supabase
                .from('employees')
                .select('user_id')
                .eq('employee_id', schedule.assignedEmployeeId)
                .single()

            if (employeeError || !employeeRow) {
                throw new Error('Could not find the assigned employee to notify.')
            }

            await notify({
                userId: employeeRow.user_id,
                title: 'Reschedule requested',
                message: `Student requested to reschedule claiming for request ${schedule.requestNumber} (currently ${formatDate(schedule.claim_date || schedule.scheduled_date)}). Reason: "${reason.trim()}"`,
                notificationType: 'request_update',
                relatedRequestId: schedule.request_id,
            })

            notifySuccess('Your reschedule request has been sent to the Registrar\'s Office.')

        } catch (err) {
            console.error('REQUEST RESCHEDULE ERROR:', err)
            notifyError(err.message || 'Failed to send your reschedule request.')
        } finally {
            setRequestingRescheduleId(null)
        }
    }

    return (
        <div>
            <div className="student-page-header">
                <h1>Claim Schedule</h1>
                <p>View the date and time you're scheduled to claim your documents.</p>
            </div>

            {error && <div className="student-error-box">{error}</div>}

            {loading ? (
                <SkeletonList count={3} />
            ) : schedules.length === 0 ? (
                <div className="student-empty">
                    You don't have any claim schedules yet. Once the Registrar schedules
                    a document for claiming, it will appear here.
                </div>
            ) : (
                <>
                    {schedules.map((schedule) => (
                        <div className="student-list-card" key={schedule.claim_schedule_id}>

                            <div className="student-list-card-header">
                                <div>
                                    <h3>{schedule.documentName}</h3>
                                    <p>Request {schedule.requestNumber}</p>
                                </div>

                                <span className={`student-status-pill status-${schedule.status}`}>
                                    {schedule.status}
                                </span>
                            </div>

                            {schedule.status === 'claimed' ? (
                                <div className="student-info-grid">
                                    <div className="student-info-field">
                                        <span>Claimed On</span>
                                        <strong>
                                            {schedule.claimed_at
                                                ? new Date(schedule.claimed_at).toLocaleString('en-PH')
                                                : `${formatDate(schedule.claim_date || schedule.scheduled_date)} ${formatTime(schedule.claim_time || schedule.scheduled_time)}`}
                                        </strong>
                                    </div>
                                </div>
                            ) : schedule.status === 'missed' ? (
                                <div className="student-notice tone-danger">
                                    <strong>Missed Appointment</strong>
                                    <p>
                                        You didn't claim this document on {formatDate(schedule.claim_date || schedule.scheduled_date)}.
                                        Please contact the Registrar's Office to reschedule.
                                    </p>
                                </div>
                            ) : (
                                <div className="student-info-grid">
                                    <div className="student-info-field">
                                        <span>Claiming Date</span>
                                        <strong>
                                            {formatDate(schedule.claim_date || schedule.scheduled_date)}
                                        </strong>
                                    </div>

                                    <div className="student-info-field">
                                        <span>Claiming Time</span>
                                        <strong>
                                            {formatTime(schedule.claim_time || schedule.scheduled_time) || 'N/A'}
                                        </strong>
                                    </div>

                                    <div className="student-info-field">
                                        <span>Arrive By</span>
                                        <strong>
                                            {formatArriveByTime(schedule.claim_time || schedule.scheduled_time) || 'N/A'}
                                        </strong>
                                    </div>
                                </div>
                            )}

                            {schedule.remarks && (
                                <div className="student-info-field">
                                    <span>Remarks</span>
                                    <strong>{schedule.remarks}</strong>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                <button
                                    className="student-link-button"
                                    onClick={() => navigate(`/student/request/${schedule.request_id}`)}
                                >
                                    View request details →
                                </button>

                                {(schedule.status === 'scheduled' || schedule.status === 'missed') && (
                                    <button
                                        className="student-link-button"
                                        onClick={() => requestReschedule(schedule)}
                                        disabled={requestingRescheduleId === schedule.claim_schedule_id}
                                    >
                                        {requestingRescheduleId === schedule.claim_schedule_id
                                            ? 'Sending...'
                                            : 'Request reschedule'}
                                    </button>
                                )}
                            </div>

                        </div>
                    ))}

                    <div className="student-reminder-box">
                        <strong>Claiming Reminder</strong>
                        Please arrive at least 30 minutes before your scheduled claiming time.
                        Bring your official receipt (OR) and a valid ID when claiming your
                        document at the Registrar's Office.
                    </div>
                </>
            )}
        </div>
    )
}

export default ClaimSchedule
