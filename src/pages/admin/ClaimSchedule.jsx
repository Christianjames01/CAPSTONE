import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activityLog'
import { describeChanges } from '../../lib/describeChanges'
import { notifyStudentByStudentId, notifySuccess, notifyError, notifyWarning, confirmModal } from '../../lib/notify'
import { SkeletonPageHeader, SkeletonDetailCard } from '../../components/Skeleton'
import '../auth/Auth.css'
import './AdminPages.css'

const DEFAULT_REMARKS =
    'Please bring your official receipt (OR) and a valid ID when claiming your document. ' +
    'Kindly arrive on time for your scheduled slot.'

function AdminClaimSchedule() {
    const { requestId } = useParams()
    const navigate = useNavigate()

    const [request, setRequest] = useState(null)
    const [student, setStudent] = useState(null)
    const [existingSchedule, setExistingSchedule] = useState(null)

    const [scheduledDate, setScheduledDate] = useState('')
    const [scheduledTime, setScheduledTime] = useState('')
    const [estimatedDuration, setEstimatedDuration] = useState(60)
    const [remarks, setRemarks] = useState('')

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')

    useEffect(() => {
        if (!requestId) {
            setErrorMessage('Request ID is missing.')
            setLoading(false)
            return
        }

        loadData()
    }, [requestId])

    const loadData = async () => {
        try {
            setLoading(true)
            setErrorMessage('')

            const { data: requestData, error: requestError } = await supabase
                .from('document_requests')
                .select(`
                    request_id, request_number, student_id, document_type_id,
                    assigned_employee_id, quantity, unit_fee, total_amount, priority,
                    purpose, status, student_remarks, employee_remarks, rejection_reason,
                    requested_at, processed_at, completed_at
                `)
                .eq('request_id', requestId)
                .single()

            if (requestError || !requestData) {
                throw new Error('Request could not be found.')
            }

            setRequest(requestData)

            if (requestData.status !== 'ready_for_claiming') {
                throw new Error(`This request cannot be scheduled while its status is "${requestData.status}".`)
            }

            const { data: studentData } = await supabase
                .from('students')
                .select('student_id, student_number, user_id')
                .eq('student_id', requestData.student_id)
                .single()

            setStudent(studentData || null)

            const { data: scheduleData, error: scheduleError } = await supabase
                .from('claim_schedules')
                .select(`
                    claim_schedule_id, request_id, student_id, scheduled_date, scheduled_time,
                    estimated_duration_minutes, status, scheduled_by, scheduled_at, claimed_at,
                    claimed_by, remarks, claim_date, claim_time, reschedule_requested_at,
                    reschedule_reason, created_at, updated_at
                `)
                .eq('request_id', requestId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()

            if (scheduleError) {
                console.error('CLAIM SCHEDULE ERROR:', scheduleError)
            }

            if (scheduleData) {
                setExistingSchedule(scheduleData)
                setScheduledDate(scheduleData.claim_date || scheduleData.scheduled_date || '')
                setScheduledTime(scheduleData.claim_time || scheduleData.scheduled_time || '')
                setEstimatedDuration(scheduleData.estimated_duration_minutes || 60)
                setRemarks(scheduleData.remarks || '')
            } else {
                setRemarks(DEFAULT_REMARKS)
            }

        } catch (error) {
            console.error('CLAIM SCHEDULE LOAD ERROR:', error)
            setErrorMessage(error.message || 'Failed to load claim schedule.')
        } finally {
            setLoading(false)
        }
    }

    const getAdminUser = async () => {
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            throw new Error('You are not logged in.')
        }

        // Best-effort -- a registrar head may or may not also have an
        // employees row. scheduled_by has no FK/NOT NULL constraint, so
        // this is allowed to come back null.
        const { data: employee } = await supabase
            .from('employees')
            .select('employee_id')
            .eq('user_id', user.id)
            .maybeSingle()

        return { userId: user.id, employeeId: employee?.employee_id || null }
    }

    const getToday = () => {
        const today = new Date()
        const year = today.getFullYear()
        const month = String(today.getMonth() + 1).padStart(2, '0')
        const day = String(today.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
    }

    const validateForm = () => {
        if (!scheduledDate) {
            notifyWarning('Please select a claiming date.')
            return false
        }

        if (!scheduledTime) {
            notifyWarning('Please select a claiming time.')
            return false
        }

        if (!estimatedDuration || Number(estimatedDuration) <= 0) {
            notifyWarning('Please enter a valid estimated duration.')
            return false
        }

        if (scheduledDate < getToday()) {
            notifyWarning('The claiming date cannot be in the past.')
            return false
        }

        return true
    }

    const saveSchedule = async () => {
        if (!request) return
        if (!validateForm()) return

        const confirmed = await confirmModal(
            existingSchedule
                ? 'Are you sure you want to update this claiming schedule?'
                : 'Are you sure you want to schedule this request for claiming?'
        )

        if (!confirmed) return

        try {
            setSaving(true)

            const admin = await getAdminUser()
            const now = new Date().toISOString()

            if (existingSchedule) {
                const { data: updatedSchedule, error: updateError } = await supabase
                    .from('claim_schedules')
                    .update({
                        scheduled_date: scheduledDate,
                        scheduled_time: scheduledTime,
                        estimated_duration_minutes: Number(estimatedDuration),
                        claim_date: scheduledDate,
                        claim_time: scheduledTime,
                        remarks: remarks.trim() || null,
                        status: 'scheduled',
                        reschedule_requested_at: null,
                        reschedule_reason: null,
                        updated_at: now,
                    })
                    .eq('claim_schedule_id', existingSchedule.claim_schedule_id)
                    .select()
                    .single()

                if (updateError) {
                    throw new Error('Failed to update claim schedule: ' + updateError.message)
                }

                const { error: requestUpdateError } = await supabase
                    .from('document_requests')
                    .update({
                        status: 'ready_for_claiming',
                        employee_remarks: 'Claiming schedule updated by Registrar Head.',
                        updated_at: now,
                    })
                    .eq('request_id', requestId)

                if (requestUpdateError) {
                    throw new Error('Schedule was updated but request status could not be updated: ' + requestUpdateError.message)
                }

                setExistingSchedule(updatedSchedule)

                const scheduleChanges = describeChanges([
                    ['date', existingSchedule.scheduled_date, scheduledDate],
                    ['time', existingSchedule.scheduled_time, scheduledTime],
                ])

                await logActivity({
                    userId: admin.userId,
                    employeeId: admin.employeeId,
                    action: 'update_claim_schedule',
                    tableName: 'claim_schedules',
                    recordId: existingSchedule.claim_schedule_id,
                    description: `Updated claiming schedule for request "${request?.request_number || requestId}" (Registrar Head).${scheduleChanges ? ' ' + scheduleChanges + '.' : ''}`,
                })

                await notifyStudentByStudentId({
                    studentId: request.student_id,
                    title: 'Claiming schedule updated',
                    message: `Your updated claiming date for request ${request.request_number} is ${formatDate(scheduledDate)} at ${formatTime(scheduledTime)}.`,
                    notificationType: 'claim_schedule',
                    relatedRequestId: requestId,
                })

                notifySuccess('Claiming schedule updated successfully.')

            } else {
                const { data: newSchedule, error: insertError } = await supabase
                    .from('claim_schedules')
                    .insert({
                        request_id: request.request_id,
                        student_id: request.student_id,
                        scheduled_date: scheduledDate,
                        scheduled_time: scheduledTime,
                        estimated_duration_minutes: Number(estimatedDuration),
                        status: 'scheduled',
                        scheduled_by: admin.employeeId,
                        scheduled_at: now,
                        claim_date: scheduledDate,
                        claim_time: scheduledTime,
                        remarks: remarks.trim() || null,
                    })
                    .select()
                    .single()

                if (insertError) {
                    throw new Error('Failed to create claim schedule: ' + insertError.message)
                }

                const { error: requestUpdateError } = await supabase
                    .from('document_requests')
                    .update({
                        status: 'ready_for_claiming',
                        employee_remarks: 'Claiming schedule created by Registrar Head.',
                        updated_at: now,
                    })
                    .eq('request_id', requestId)
                    .eq('status', 'ready_for_claiming')

                if (requestUpdateError) {
                    throw new Error('Claim schedule was created but request status could not be updated: ' + requestUpdateError.message)
                }

                setExistingSchedule(newSchedule)

                await logActivity({
                    userId: admin.userId,
                    employeeId: admin.employeeId,
                    action: 'create_claim_schedule',
                    tableName: 'claim_schedules',
                    recordId: newSchedule.claim_schedule_id,
                    description: `Created claiming schedule for request "${request?.request_number || requestId}" on "${scheduledDate}" at "${scheduledTime}" (Registrar Head).`,
                })

                await notifyStudentByStudentId({
                    studentId: request.student_id,
                    title: 'Claiming scheduled',
                    message: `Your document for request ${request.request_number} is ready to claim on ${formatDate(scheduledDate)} at ${formatTime(scheduledTime)}. Bring your official receipt and a valid ID.`,
                    notificationType: 'claim_schedule',
                    relatedRequestId: requestId,
                })

                notifySuccess('Claiming schedule created successfully.')
            }

            await loadData()

        } catch (error) {
            console.error('SAVE CLAIM SCHEDULE ERROR:', error)
            notifyError(error.message || 'Failed to save claim schedule.')
        } finally {
            setSaving(false)
        }
    }

    const cancelSchedule = async () => {
        if (!existingSchedule) return

        const confirmed = await confirmModal('Are you sure you want to cancel this claiming schedule?')
        if (!confirmed) return

        try {
            setSaving(true)

            const admin = await getAdminUser()
            const now = new Date().toISOString()

            const { error: scheduleError } = await supabase
                .from('claim_schedules')
                .update({
                    status: 'cancelled',
                    updated_at: now,
                    remarks: remarks.trim() ? `${remarks.trim()} | Schedule cancelled.` : 'Schedule cancelled.',
                })
                .eq('claim_schedule_id', existingSchedule.claim_schedule_id)

            if (scheduleError) {
                throw new Error('Failed to cancel schedule: ' + scheduleError.message)
            }

            const { error: requestError } = await supabase
                .from('document_requests')
                .update({
                    status: 'ready_for_claiming',
                    employee_remarks: 'Claiming schedule cancelled by Registrar Head.',
                    updated_at: now,
                })
                .eq('request_id', requestId)

            if (requestError) {
                throw new Error('Schedule was cancelled but request status could not be updated: ' + requestError.message)
            }

            await logActivity({
                userId: admin.userId,
                employeeId: admin.employeeId,
                action: 'cancel_claim_schedule',
                tableName: 'claim_schedules',
                recordId: existingSchedule.claim_schedule_id,
                description: `Cancelled claiming schedule for request "${request?.request_number || requestId}" (Registrar Head).`,
            })

            await notifyStudentByStudentId({
                studentId: request.student_id,
                title: 'Claiming schedule cancelled',
                message: `Your claiming schedule for request ${request.request_number} has been cancelled. Contact the Registrar's Office for a new schedule.`,
                notificationType: 'claim_schedule',
                relatedRequestId: requestId,
            })

            notifySuccess('Claiming schedule cancelled.')

            setExistingSchedule(null)
            setScheduledDate('')
            setScheduledTime('')
            setEstimatedDuration(60)
            setRemarks('')

            await loadData()

        } catch (error) {
            console.error('CANCEL SCHEDULE ERROR:', error)
            notifyError(error.message || 'Failed to cancel schedule.')
        } finally {
            setSaving(false)
        }
    }

    const formatDate = (date) => {
        if (!date) return 'N/A'
        return new Date(`${date}T00:00:00`).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
    }

    const formatTime = (time) => {
        if (!time) return 'N/A'
        const [hours, minutes] = time.split(':')
        const date = new Date()
        date.setHours(Number(hours), Number(minutes), 0, 0)
        return date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
    }

    if (loading) {
        return (
            <div>
                <SkeletonPageHeader />
                <SkeletonDetailCard fields={6} />
                <SkeletonDetailCard fields={4} />
            </div>
        )
    }

    if (errorMessage) {
        return (
            <div>
                <button className="admin-link-button" style={{ marginBottom: 16 }} onClick={() => navigate(`/admin/requests/${requestId}`)}>
                    ← Back to Request
                </button>

                <div className="admin-card">
                    <h2 style={{ fontSize: 16, marginBottom: 12 }}>Unable to Load Claim Schedule</h2>
                    <div className="admin-error-box">{errorMessage}</div>
                    <button className="admin-primary-button" onClick={loadData}>
                        Try Again
                    </button>
                </div>
            </div>
        )
    }

    if (!request) return null

    return (
        <div>
            <button className="admin-link-button" style={{ marginBottom: 16 }} onClick={() => navigate(`/admin/requests/${requestId}`)}>
                ← Back to Request
            </button>

            <div className="admin-page-header">
                <h1>Claim Schedule</h1>
                <p>Schedule the student's date and time for claiming the requested academic document.</p>
            </div>

            <div className="admin-card">
                <div className="admin-list-card-header" style={{ marginBottom: 16 }}>
                    <div>
                        <p style={{ fontSize: 12, color: 'var(--slate)', marginBottom: 4 }}>Request Number</p>
                        <h2 style={{ fontSize: 18 }}>{request.request_number}</h2>
                    </div>

                    <span className={`admin-status-pill status-${request.status}`}>{request.status.replace(/_/g, ' ')}</span>
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '16px 0' }} />

                <h3 style={{ fontSize: 15, marginBottom: 14 }}>Student Information</h3>

                <div className="admin-info-grid">
                    <div className="admin-info-field">
                        <span>Student Number</span>
                        <strong>{student?.student_number || 'N/A'}</strong>
                    </div>

                    <div className="admin-info-field">
                        <span>Quantity</span>
                        <strong>{request.quantity}</strong>
                    </div>

                    <div className="admin-info-field">
                        <span>Total Amount</span>
                        <strong>₱{Number(request.total_amount || 0).toFixed(2)}</strong>
                    </div>

                    <div className="admin-info-field">
                        <span>Priority</span>
                        <strong style={{ textTransform: 'capitalize' }}>{request.priority || 'Normal'}</strong>
                    </div>
                </div>
            </div>

            <div className="admin-card">
                <h2 style={{ fontSize: 16, marginBottom: 6 }}>
                    {existingSchedule ? 'Update Claim Schedule' : 'Create Claim Schedule'}
                </h2>

                <p style={{ marginBottom: 18 }}>
                    Choose the exact date and time when the student should arrive at the Registrar's Office.
                </p>

                {existingSchedule?.reschedule_requested_at && (
                    <div className="admin-notice tone-warning" style={{ marginBottom: 18 }}>
                        <strong>Student Requested a Reschedule</strong>
                        <p>{existingSchedule.reschedule_reason}</p>
                    </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 18, marginBottom: 18 }}>
                    <div className="form-group">
                        <label className="form-label">Claiming Date</label>
                        <input
                            type="date"
                            value={scheduledDate}
                            min={getToday()}
                            onChange={(event) => setScheduledDate(event.target.value)}
                            className="form-input"
                            disabled={saving}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Claiming Time</label>
                        <input
                            type="time"
                            value={scheduledTime}
                            onChange={(event) => setScheduledTime(event.target.value)}
                            className="form-input"
                            disabled={saving}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Estimated Duration</label>
                        <select
                            value={estimatedDuration}
                            onChange={(event) => setEstimatedDuration(Number(event.target.value))}
                            className="form-input"
                            disabled={saving}
                        >
                            <option value={30}>30 minutes</option>
                            <option value={60}>1 hour</option>
                            <option value={90}>1 hour 30 minutes</option>
                            <option value={120}>2 hours</option>
                        </select>
                    </div>
                </div>

                <div className="form-group" style={{ marginBottom: 18 }}>
                    <label className="form-label">Remarks</label>
                    <textarea
                        value={remarks}
                        onChange={(event) => setRemarks(event.target.value)}
                        placeholder="Example: Please bring your official receipt and valid school ID."
                        className="form-input"
                        rows={3}
                        disabled={saving}
                    />
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                    {existingSchedule && existingSchedule.status !== 'cancelled' && (
                        <button className="admin-danger-button" onClick={cancelSchedule} disabled={saving}>
                            Cancel Existing Schedule
                        </button>
                    )}

                    <button className="admin-primary-button" onClick={saveSchedule} disabled={saving}>
                        {saving ? 'Saving...' : existingSchedule ? '✓ Update Claim Schedule' : '📅 Schedule Claiming'}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default AdminClaimSchedule
