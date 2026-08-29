import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activityLog'
import { notifyStudentByStudentId, notifyError, confirmModal } from '../../lib/notify'
import { SkeletonList } from '../../components/Skeleton'
import './EmployeePages.css'

function ClaimScheduleList() {
    const navigate = useNavigate()

    const [employee, setEmployee] = useState(null)
    const [needsScheduling, setNeedsScheduling] = useState([])
    const [todayAppointments, setTodayAppointments] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [marking, setMarking] = useState(null)

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
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

            const { data: employeeData, error: employeeError } = await supabase
                .from('employees')
                .select('employee_id')
                .eq('user_id', user.id)
                .single()

            if (employeeError || !employeeData) {
                throw new Error('Employee record could not be found.')
            }

            setEmployee(employeeData)

            // Requests ready for claiming that still need a schedule
            const { data: requests, error: requestError } = await supabase
                .from('document_requests')
                .select(`
                    request_id,
                    request_number,
                    student_id,
                    document_type_id,
                    status,
                    completed_at
                `)
                .eq('assigned_employee_id', employeeData.employee_id)
                .eq('status', 'ready_for_claiming')
                .order('processed_at', { ascending: false })

            if (requestError) {
                throw new Error('Failed to load requests: ' + requestError.message)
            }

            const requestIds = (requests || []).map((r) => r.request_id)

            const { data: schedules } = requestIds.length
                ? await supabase
                    .from('claim_schedules')
                    .select('claim_schedule_id, request_id, claim_date, claim_time, scheduled_date, scheduled_time, status')
                    .in('request_id', requestIds)
                : { data: [] }

            const scheduleByRequestId = Object.fromEntries(
                (schedules || [])
                    .filter((s) => s.status !== 'cancelled')
                    .map((s) => [s.request_id, s])
            )

            const documentTypeIds = [...new Set((requests || []).map((r) => r.document_type_id).filter(Boolean))]

            const { data: documentTypes } = documentTypeIds.length
                ? await supabase.from('document_types').select('document_type_id, document_name').in('document_type_id', documentTypeIds)
                : { data: [] }

            const documentNameById = Object.fromEntries(
                (documentTypes || []).map((d) => [d.document_type_id, d.document_name])
            )

            setNeedsScheduling(
                (requests || []).map((r) => ({
                    ...r,
                    documentName: documentNameById[r.document_type_id] || 'Document',
                    schedule: scheduleByRequestId[r.request_id] || null,
                }))
            )

            // Today's appointments
            const today = new Date().toISOString().slice(0, 10)

            const { data: todaySchedules, error: todayError } = await supabase
                .from('claim_schedules')
                .select(`
                    claim_schedule_id,
                    request_id,
                    student_id,
                    claim_date,
                    claim_time,
                    scheduled_date,
                    scheduled_time,
                    status,
                    remarks
                `)
                .eq('scheduled_by', employeeData.employee_id)
                .eq('claim_date', today)
                .neq('status', 'cancelled')
                .order('claim_time', { ascending: true })

            if (todayError) {
                throw new Error('Failed to load today\'s appointments: ' + todayError.message)
            }

            const todayRequestIds = [...new Set((todaySchedules || []).map((s) => s.request_id))]

            const { data: todayRequests } = todayRequestIds.length
                ? await supabase
                    .from('document_requests')
                    .select('request_id, request_number, student_id, document_type_id')
                    .in('request_id', todayRequestIds)
                : { data: [] }

            const todayRequestById = Object.fromEntries(
                (todayRequests || []).map((r) => [r.request_id, r])
            )

            const todayDocTypeIds = [...new Set((todayRequests || []).map((r) => r.document_type_id).filter(Boolean))]

            const { data: todayDocTypes } = todayDocTypeIds.length
                ? await supabase.from('document_types').select('document_type_id, document_name').in('document_type_id', todayDocTypeIds)
                : { data: [] }

            const todayDocNameById = Object.fromEntries(
                (todayDocTypes || []).map((d) => [d.document_type_id, d.document_name])
            )

            const studentIds = [...new Set((todaySchedules || []).map((s) => s.student_id).filter(Boolean))]

            const { data: studentsData } = studentIds.length
                ? await supabase.from('students').select('student_id, student_number').in('student_id', studentIds)
                : { data: [] }

            const studentNumberById = Object.fromEntries(
                (studentsData || []).map((s) => [s.student_id, s.student_number])
            )

            setTodayAppointments(
                (todaySchedules || []).map((s) => {
                    const request = todayRequestById[s.request_id]

                    return {
                        ...s,
                        requestNumber: request?.request_number || 'N/A',
                        documentName: todayDocNameById[request?.document_type_id] || 'Document',
                        studentNumber: studentNumberById[s.student_id] || 'N/A',
                    }
                })
            )

        } catch (err) {
            console.error('CLAIM SCHEDULE LIST ERROR:', err)
            setError(err.message || 'Failed to load claim schedules.')
        } finally {
            setLoading(false)
        }
    }

    const markAsClaimed = async (appointment) => {
        const confirmed = await confirmModal(
            `Mark ${appointment.requestNumber} as claimed? This releases the credential to the student.`
        )

        if (!confirmed) return

        try {
            setMarking(appointment.claim_schedule_id)

            const now = new Date().toISOString()

            const { error: scheduleError } = await supabase
                .from('claim_schedules')
                .update({
                    status: 'claimed',
                    claimed_at: now,
                    claimed_by: employee.employee_id,
                })
                .eq('claim_schedule_id', appointment.claim_schedule_id)

            if (scheduleError) {
                throw new Error('Failed to update claim schedule: ' + scheduleError.message)
            }

            const { error: requestError } = await supabase
                .from('document_requests')
                .update({
                    status: 'completed',
                    completed_at: now,
                    employee_remarks: 'Credential released to student.',
                    updated_at: now,
                })
                .eq('request_id', appointment.request_id)
                .eq('assigned_employee_id', employee.employee_id)

            if (requestError) {
                throw new Error('Schedule was updated but request status could not be updated: ' + requestError.message)
            }

            await logActivity({
                employeeId: employee.employee_id,
                action: 'mark_claimed',
                tableName: 'document_requests',
                recordId: appointment.request_id,
                description: `Marked ${appointment.requestNumber} as claimed and released.`,
            })

            await notifyStudentByStudentId({
                studentId: appointment.student_id,
                title: 'Document claimed',
                message: `Your document for request ${appointment.requestNumber} has been released. Thank you!`,
                notificationType: 'request_update',
                relatedRequestId: appointment.request_id,
            })

            await loadData()

        } catch (err) {
            console.error('MARK AS CLAIMED ERROR:', err)
            notifyError(err.message || 'Failed to mark as claimed.')
        } finally {
            setMarking(null)
        }
    }

    const formatTime = (time) => {
        if (!time) return 'N/A'

        const [hours, minutes] = time.split(':')
        const date = new Date()
        date.setHours(Number(hours), Number(minutes), 0, 0)

        return date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
    }

    return (
        <div>
            <div className="employee-page-header">
                <h1>Claim Schedule</h1>
                <p>Today's appointments and requests ready to be scheduled for claiming.</p>
            </div>

            {error && <div className="employee-error-box">{error}</div>}

            <h2 style={{ fontSize: 17, marginBottom: 14 }}>Today's Appointments</h2>

            {loading ? (
                <SkeletonList count={3} />
            ) : todayAppointments.length === 0 ? (
                <div className="employee-empty" style={{ marginBottom: 28 }}>
                    No claiming appointments scheduled for today.
                </div>
            ) : (
                <div style={{ marginBottom: 28 }}>
                    {todayAppointments.map((appt) => (
                        <div className="employee-list-card" key={appt.claim_schedule_id}>
                            <div className="employee-list-card-header">
                                <div>
                                    <h3>{appt.documentName}</h3>
                                    <p>
                                        {appt.requestNumber} · Student {appt.studentNumber}
                                    </p>
                                </div>

                                <span className={`employee-status-pill status-${appt.status}`}>{appt.status}</span>
                            </div>

                            <div className="employee-info-grid">
                                <div className="employee-info-field">
                                    <span>Time</span>
                                    <strong>{formatTime(appt.claim_time || appt.scheduled_time)}</strong>
                                </div>
                            </div>

                            {appt.status !== 'claimed' && (
                                <button
                                    className="employee-link-button"
                                    onClick={() => markAsClaimed(appt)}
                                    disabled={marking === appt.claim_schedule_id}
                                >
                                    {marking === appt.claim_schedule_id ? 'Marking...' : 'Mark as claimed →'}
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <h2 style={{ fontSize: 17, marginBottom: 14 }}>Ready to Schedule</h2>

            {!loading && needsScheduling.length === 0 ? (
                <div className="employee-empty">No requests are currently ready for claim scheduling.</div>
            ) : (
                needsScheduling.map((request) => (
                    <div className="employee-list-card" key={request.request_id}>
                        <div className="employee-list-card-header">
                            <div>
                                <h3>{request.documentName}</h3>
                                <p>{request.request_number}</p>
                            </div>

                            <span className={`employee-status-pill status-${request.schedule ? request.schedule.status : 'ready_for_claiming'}`}>
                                {request.schedule ? request.schedule.status : 'Not scheduled'}
                            </span>
                        </div>

                        <button
                            className="employee-link-button"
                            onClick={() => navigate(`/employee/requests/${request.request_id}/claim-schedule`)}
                        >
                            {request.schedule ? 'Reschedule →' : 'Create schedule →'}
                        </button>
                    </div>
                ))
            )}
        </div>
    )
}

export default ClaimScheduleList
