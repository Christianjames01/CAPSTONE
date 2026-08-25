import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

function ClaimSchedule() {
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

    // ==========================================
    // LOAD PAGE
    // ==========================================

    useEffect(() => {
        if (!requestId) {
            setErrorMessage('Request ID is missing.')
            setLoading(false)
            return
        }

        loadData()
    }, [requestId])

    // ==========================================
    // LOAD REQUEST + STUDENT + EXISTING SCHEDULE
    // ==========================================

    const loadData = async () => {
        try {
            setLoading(true)
            setErrorMessage('')

            // ==========================================
            // AUTHENTICATED USER
            // ==========================================

            const {
                data: { user },
                error: authError
            } = await supabase.auth.getUser()

            if (authError || !user) {
                throw new Error('You are not logged in.')
            }

            // ==========================================
            // CURRENT EMPLOYEE
            // ==========================================

            const {
                data: employee,
                error: employeeError
            } = await supabase
                .from('employees')
                .select(`
                    employee_id,
                    user_id,
                    employee_number,
                    position_title,
                    status
                `)
                .eq('user_id', user.id)
                .single()

            if (employeeError || !employee) {
                throw new Error(
                    'Employee record could not be found.'
                )
            }

            // ==========================================
            // REQUEST
            // ==========================================

            const {
                data: requestData,
                error: requestError
            } = await supabase
                .from('document_requests')
                .select(`
                    request_id,
                    request_number,
                    student_id,
                    document_type_id,
                    assigned_employee_id,
                    quantity,
                    unit_fee,
                    total_amount,
                    priority,
                    purpose,
                    status,
                    student_remarks,
                    employee_remarks,
                    rejection_reason,
                    requested_at,
                    processed_at,
                    completed_at
                `)
                .eq('request_id', requestId)
                .eq(
                    'assigned_employee_id',
                    employee.employee_id
                )
                .single()

            if (requestError || !requestData) {
                throw new Error(
                    'Request not found or this request is not assigned to you.'
                )
            }

            setRequest(requestData)

            // ==========================================
            // CHECK REQUEST STATUS
            // ==========================================

            if (
                requestData.status !== 'digital_credential' &&
                requestData.status !== 'ready_for_claiming'
            ) {
                throw new Error(
                    `This request cannot be scheduled while its status is "${requestData.status}".`
                )
            }

            // ==========================================
            // STUDENT
            // ==========================================

            const {
                data: studentData,
                error: studentError
            } = await supabase
                .from('students')
                .select(`
                    student_id,
                    student_number,
                    user_id
                `)
                .eq(
                    'student_id',
                    requestData.student_id
                )
                .single()

            if (studentError) {
                console.error(
                    'STUDENT ERROR:',
                    studentError
                )
            }

            setStudent(studentData || null)

            // ==========================================
            // EXISTING CLAIM SCHEDULE
            // ==========================================

            const {
                data: scheduleData,
                error: scheduleError
            } = await supabase
                .from('claim_schedules')
                .select(`
                    claim_schedule_id,
                    request_id,
                    student_id,
                    scheduled_date,
                    scheduled_time,
                    estimated_duration_minutes,
                    status,
                    scheduled_by,
                    scheduled_at,
                    claimed_at,
                    claimed_by,
                    remarks,
                    claim_date,
                    claim_time,
                    created_at,
                    updated_at
                `)
                .eq(
                    'request_id',
                    requestId
                )
                .order(
                    'created_at',
                    {
                        ascending: false
                    }
                )
                .limit(1)
                .maybeSingle()

            if (scheduleError) {
                console.error(
                    'CLAIM SCHEDULE ERROR:',
                    scheduleError
                )
            }

            if (scheduleData) {
                setExistingSchedule(scheduleData)

                setScheduledDate(
                    scheduleData.claim_date ||
                    scheduleData.scheduled_date ||
                    ''
                )

                setScheduledTime(
                    scheduleData.claim_time ||
                    scheduleData.scheduled_time ||
                    ''
                )

                setEstimatedDuration(
                    scheduleData.estimated_duration_minutes ||
                    60
                )

                setRemarks(
                    scheduleData.remarks || ''
                )
            }

        } catch (error) {
            console.error(
                'CLAIM SCHEDULE LOAD ERROR:',
                error
            )

            setErrorMessage(
                error.message ||
                'Failed to load claim schedule.'
            )
        } finally {
            setLoading(false)
        }
    }

    // ==========================================
    // GET CURRENT EMPLOYEE
    // ==========================================

    const getCurrentEmployee = async () => {
        const {
            data: { user },
            error: authError
        } = await supabase.auth.getUser()

        if (authError || !user) {
            throw new Error(
                'You are not logged in.'
            )
        }

        const {
            data: employee,
            error
        } = await supabase
            .from('employees')
            .select('employee_id')
            .eq(
                'user_id',
                user.id
            )
            .single()

        if (error || !employee) {
            throw new Error(
                'Employee record could not be found.'
            )
        }

        return employee
    }

    // ==========================================
    // GET TODAY
    // ==========================================

    const getToday = () => {
        const today = new Date()

        const year = today.getFullYear()
        const month = String(
            today.getMonth() + 1
        ).padStart(2, '0')
        const day = String(
            today.getDate()
        ).padStart(2, '0')

        return `${year}-${month}-${day}`
    }

    // ==========================================
    // VALIDATE FORM
    // ==========================================

    const validateForm = () => {
        if (!scheduledDate) {
            alert(
                'Please select a claiming date.'
            )
            return false
        }

        if (!scheduledTime) {
            alert(
                'Please select a claiming time.'
            )
            return false
        }

        if (!estimatedDuration) {
            alert(
                'Please enter the estimated duration.'
            )
            return false
        }

        if (
            Number(estimatedDuration) <= 0
        ) {
            alert(
                'Estimated duration must be greater than 0 minutes.'
            )
            return false
        }

        // Prevent scheduling in the past
        const today = getToday()

        if (
            scheduledDate < today
        ) {
            alert(
                'The claiming date cannot be in the past.'
            )
            return false
        }

        return true
    }

    // ==========================================
    // CREATE / UPDATE SCHEDULE
    // ==========================================

    const saveSchedule = async () => {
        if (!request) {
            return
        }

        if (!validateForm()) {
            return
        }

        const confirmed = window.confirm(
            existingSchedule
                ? 'Are you sure you want to update this claiming schedule?'
                : 'Are you sure you want to schedule this request for claiming?'
        )

        if (!confirmed) {
            return
        }

        try {
            setSaving(true)

            const employee =
                await getCurrentEmployee()

            const now =
                new Date().toISOString()

            // ==========================================
            // UPDATE EXISTING SCHEDULE
            // ==========================================

            if (existingSchedule) {

                const {
                    data: updatedSchedule,
                    error: updateError
                } = await supabase
                    .from('claim_schedules')
                    .update({
                        scheduled_date:
                            scheduledDate,

                        scheduled_time:
                            scheduledTime,

                        estimated_duration_minutes:
                            Number(
                                estimatedDuration
                            ),

                        claim_date:
                            scheduledDate,

                        claim_time:
                            scheduledTime,

                        remarks:
                            remarks.trim() ||
                            null,

                        status:
                            'scheduled',

                        updated_at:
                            now
                    })
                    .eq(
                        'claim_schedule_id',
                        existingSchedule.claim_schedule_id
                    )
                    .select()
                    .single()

                if (updateError) {
                    throw new Error(
                        'Failed to update claim schedule: ' +
                        updateError.message
                    )
                }

                // ==========================================
                // UPDATE REQUEST STATUS
                // ==========================================

                const {
                    error: requestUpdateError
                } = await supabase
                    .from('document_requests')
                    .update({
                        status:
                            'ready_for_claiming',

                        employee_remarks:
                            'Claiming schedule updated.',

                        updated_at:
                            now
                    })
                    .eq(
                        'request_id',
                        requestId
                    )
                    .eq(
                        'assigned_employee_id',
                        employee.employee_id
                    )

                if (requestUpdateError) {
                    throw new Error(
                        'Schedule was updated but request status could not be updated: ' +
                        requestUpdateError.message
                    )
                }

                setExistingSchedule(
                    updatedSchedule
                )

                alert(
                    'Claiming schedule updated successfully.'
                )

            } else {

                // ==========================================
                // CREATE NEW SCHEDULE
                // ==========================================

                const {
                    data: newSchedule,
                    error: insertError
                } = await supabase
                    .from('claim_schedules')
                    .insert({
                        request_id:
                            request.request_id,

                        student_id:
                            request.student_id,

                        scheduled_date:
                            scheduledDate,

                        scheduled_time:
                            scheduledTime,

                        estimated_duration_minutes:
                            Number(
                                estimatedDuration
                            ),

                        status:
                            'scheduled',

                        scheduled_by:
                            employee.employee_id,

                        scheduled_at:
                            now,

                        claim_date:
                            scheduledDate,

                        claim_time:
                            scheduledTime,

                        remarks:
                            remarks.trim() ||
                            null
                    })
                    .select()
                    .single()

                if (insertError) {
                    throw new Error(
                        'Failed to create claim schedule: ' +
                        insertError.message
                    )
                }

                // ==========================================
                // UPDATE REQUEST STATUS
                // ==========================================

                const {
                    error: requestUpdateError
                } = await supabase
                    .from('document_requests')
                    .update({
                        status:
                            'ready_for_claiming',

                        employee_remarks:
                            'Claiming schedule created.',

                        updated_at:
                            now
                    })
                    .eq(
                        'request_id',
                        requestId
                    )
                    .eq(
                        'assigned_employee_id',
                        employee.employee_id
                    )
                    .eq(
                        'status',
                        'digital_credential'
                    )

                if (requestUpdateError) {
                    throw new Error(
                        'Claim schedule was created but request status could not be updated: ' +
                        requestUpdateError.message
                    )
                }

                setExistingSchedule(
                    newSchedule
                )

                alert(
                    'Claiming schedule created successfully.'
                )
            }

            await loadData()

        } catch (error) {
            console.error(
                'SAVE CLAIM SCHEDULE ERROR:',
                error
            )

            alert(
                error.message ||
                'Failed to save claim schedule.'
            )
        } finally {
            setSaving(false)
        }
    }

    // ==========================================
    // CANCEL SCHEDULE
    // ==========================================

    const cancelSchedule = async () => {
        if (!existingSchedule) {
            return
        }

        const confirmed = window.confirm(
            'Are you sure you want to cancel this claiming schedule?'
        )

        if (!confirmed) {
            return
        }

        try {
            setSaving(true)

            const employee =
                await getCurrentEmployee()

            const now =
                new Date().toISOString()

            const {
                error: scheduleError
            } = await supabase
                .from('claim_schedules')
                .update({
                    status:
                        'cancelled',

                    updated_at:
                        now,

                    remarks:
                        remarks.trim()
                            ? `${remarks.trim()} | Schedule cancelled.`
                            : 'Schedule cancelled.'
                })
                .eq(
                    'claim_schedule_id',
                    existingSchedule.claim_schedule_id
                )
                .eq(
                    'scheduled_by',
                    employee.employee_id
                )

            if (scheduleError) {
                throw new Error(
                    'Failed to cancel schedule: ' +
                    scheduleError.message
                )
            }

            const {
                error: requestError
            } = await supabase
                .from('document_requests')
                .update({
                    status:
                        'digital_credential',

                    employee_remarks:
                        'Claiming schedule cancelled.',

                    updated_at:
                        now
                })
                .eq(
                    'request_id',
                    requestId
                )
                .eq(
                    'assigned_employee_id',
                    employee.employee_id
                )

            if (requestError) {
                throw new Error(
                    'Schedule was cancelled but request status could not be updated: ' +
                    requestError.message
                )
            }

            alert(
                'Claiming schedule cancelled.'
            )

            setExistingSchedule(null)
            setScheduledDate('')
            setScheduledTime('')
            setEstimatedDuration(60)
            setRemarks('')

            await loadData()

        } catch (error) {
            console.error(
                'CANCEL SCHEDULE ERROR:',
                error
            )

            alert(
                error.message ||
                'Failed to cancel schedule.'
            )
        } finally {
            setSaving(false)
        }
    }

    // ==========================================
    // FORMAT DATE
    // ==========================================

    const formatDate = (date) => {
        if (!date) {
            return 'N/A'
        }

        return new Date(
            `${date}T00:00:00`
        ).toLocaleDateString(
            'en-PH',
            {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }
        )
    }

    // ==========================================
    // FORMAT TIME
    // ==========================================

    const formatTime = (time) => {
        if (!time) {
            return 'N/A'
        }

        const [hours, minutes] =
            time.split(':')

        const date = new Date()

        date.setHours(
            Number(hours),
            Number(minutes),
            0,
            0
        )

        return date.toLocaleTimeString(
            'en-PH',
            {
                hour: 'numeric',
                minute: '2-digit'
            }
        )
    }

    // ==========================================
    // LOADING
    // ==========================================

    if (loading) {
        return (
            <div style={styles.page}>
                <div style={styles.container}>
                    <div style={styles.card}>
                        <h2>
                            Loading claim schedule...
                        </h2>
                    </div>
                </div>
            </div>
        )
    }

    // ==========================================
    // ERROR
    // ==========================================

    if (errorMessage) {
        return (
            <div style={styles.page}>
                <div style={styles.container}>

                    <button
                        onClick={() =>
                            navigate(
                                `/employee/requests/${requestId}`
                            )
                        }
                        style={styles.backButton}
                    >
                        ← Back to Request
                    </button>

                    <div style={styles.card}>

                        <h1>
                            Unable to Load Claim Schedule
                        </h1>

                        <p style={styles.error}>
                            {errorMessage}
                        </p>

                        <button
                            onClick={loadData}
                            style={styles.button}
                        >
                            Try Again
                        </button>

                    </div>

                </div>
            </div>
        )
    }

    if (!request) {
        return null
    }

    // ==========================================
    // MAIN
    // ==========================================

    return (
        <div style={styles.page}>

            <div style={styles.container}>

                {/* ==========================================
                    BACK
                ========================================== */}

                <button
                    onClick={() =>
                        navigate(
                            `/employee/requests/${requestId}`
                        )
                    }
                    style={styles.backButton}
                >
                    ← Back to Request
                </button>

                {/* ==========================================
                    PAGE HEADER
                ========================================== */}

                <h1 style={styles.title}>
                    Claim Schedule
                </h1>

                <p style={styles.subtitle}>
                    Schedule the student's date and time
                    for claiming the requested academic
                    document.
                </p>

                {/* ==========================================
                    REQUEST INFORMATION
                ========================================== */}

                <div style={styles.card}>

                    <div style={styles.header}>

                        <div>

                            <p style={styles.label}>
                                Request Number
                            </p>

                            <h2>
                                {request.request_number}
                            </h2>

                        </div>

                        <span
                            style={{
                                ...styles.status,
                                ...getStatusStyle(
                                    request.status
                                )
                            }}
                        >
                            {request.status}
                        </span>

                    </div>

                    <hr />

                    <h3>
                        Student Information
                    </h3>

                    <div style={styles.grid}>

                        <div>
                            <p style={styles.label}>
                                Student Number
                            </p>

                            <p>
                                {student?.student_number ||
                                    'N/A'}
                            </p>
                        </div>

                        <div>
                            <p style={styles.label}>
                                Quantity
                            </p>

                            <p>
                                {request.quantity}
                            </p>
                        </div>

                        <div>
                            <p style={styles.label}>
                                Total Amount
                            </p>

                            <p>
                                ₱
                                {Number(
                                    request.total_amount || 0
                                ).toFixed(2)}
                            </p>
                        </div>

                        <div>
                            <p style={styles.label}>
                                Priority
                            </p>

                            <p>
                                {request.priority ||
                                    'Normal'}
                            </p>
                        </div>

                    </div>

                </div>

                {/* ==========================================
                    EXISTING SCHEDULE
                ========================================== */}

                {existingSchedule &&
                    existingSchedule.status !== 'cancelled' && (
                        <div style={styles.card}>

                            <h2>
                                Current Claim Schedule
                            </h2>

                            <div style={styles.scheduleBox}>

                                <div style={styles.scheduleGrid}>

                                    <div>
                                        <p style={styles.label}>
                                            Claiming Date
                                        </p>

                                        <strong>
                                            {formatDate(
                                                existingSchedule.claim_date ||
                                                existingSchedule.scheduled_date
                                            )}
                                        </strong>
                                    </div>

                                    <div>
                                        <p style={styles.label}>
                                            Claiming Time
                                        </p>

                                        <strong>
                                            {formatTime(
                                                existingSchedule.claim_time ||
                                                existingSchedule.scheduled_time
                                            )}
                                        </strong>
                                    </div>

                                    <div>
                                        <p style={styles.label}>
                                            Duration
                                        </p>

                                        <strong>
                                            {existingSchedule.estimated_duration_minutes ||
                                                60}{' '}
                                            minutes
                                        </strong>
                                    </div>

                                    <div>
                                        <p style={styles.label}>
                                            Status
                                        </p>

                                        <span
                                            style={{
                                                ...styles.status,
                                                ...getScheduleStatusStyle(
                                                    existingSchedule.status
                                                )
                                            }}
                                        >
                                            {existingSchedule.status}
                                        </span>
                                    </div>

                                </div>

                                {existingSchedule.remarks && (
                                    <div style={styles.section}>
                                        <p style={styles.label}>
                                            Remarks
                                        </p>

                                        <p>
                                            {existingSchedule.remarks}
                                        </p>
                                    </div>
                                )}

                            </div>

                        </div>
                    )}

                {/* ==========================================
                    SCHEDULE FORM
                ========================================== */}

                <div style={styles.card}>

                    <h2>
                        {existingSchedule
                            ? 'Update Claim Schedule'
                            : 'Create Claim Schedule'}
                    </h2>

                    <p style={styles.subtitle}>
                        Choose the exact date and time when
                        the student should arrive at the
                        Registrar's Office.
                    </p>

                    <div style={styles.formGrid}>

                        {/* DATE */}

                        <div style={styles.formGroup}>

                            <label style={styles.formLabel}>
                                Claiming Date
                                <span style={styles.required}>
                                    *
                                </span>
                            </label>

                            <input
                                type="date"
                                value={scheduledDate}
                                min={getToday()}
                                onChange={event =>
                                    setScheduledDate(
                                        event.target.value
                                    )
                                }
                                style={styles.input}
                                disabled={saving}
                            />

                            <small style={styles.helpText}>
                                The student will be instructed
                                to claim the document on this date.
                            </small>

                        </div>

                        {/* TIME */}

                        <div style={styles.formGroup}>

                            <label style={styles.formLabel}>
                                Claiming Time
                                <span style={styles.required}>
                                    *
                                </span>
                            </label>

                            <input
                                type="time"
                                value={scheduledTime}
                                onChange={event =>
                                    setScheduledTime(
                                        event.target.value
                                    )
                                }
                                style={styles.input}
                                disabled={saving}
                            />

                            <small style={styles.helpText}>
                                Use the student's assigned
                                claiming time.
                            </small>

                        </div>

                        {/* DURATION */}

                        <div style={styles.formGroup}>

                            <label style={styles.formLabel}>
                                Estimated Duration
                                <span style={styles.required}>
                                    *
                                </span>
                            </label>

                            <select
                                value={estimatedDuration}
                                onChange={event =>
                                    setEstimatedDuration(
                                        Number(
                                            event.target.value
                                        )
                                    )
                                }
                                style={styles.input}
                                disabled={saving}
                            >

                                <option value={30}>
                                    30 minutes
                                </option>

                                <option value={60}>
                                    1 hour
                                </option>

                                <option value={90}>
                                    1 hour 30 minutes
                                </option>

                                <option value={120}>
                                    2 hours
                                </option>

                            </select>

                            <small style={styles.helpText}>
                                Default claiming allocation is
                                60 minutes.
                            </small>

                        </div>

                    </div>

                    {/* REMARKS */}

                    <div style={styles.formGroup}>

                        <label style={styles.formLabel}>
                            Remarks
                        </label>

                        <textarea
                            value={remarks}
                            onChange={event =>
                                setRemarks(
                                    event.target.value
                                )
                            }
                            placeholder="Example: Please bring your official receipt and valid school ID."
                            style={styles.textarea}
                            disabled={saving}
                        />

                    </div>

                    {/* REMINDER */}

                    <div style={styles.reminderBox}>

                        <strong>
                            Claiming Reminder
                        </strong>

                        <p>
                            The student must present their
                            official receipt (OR) from the
                            Finance Office when claiming the
                            academic document.
                        </p>

                        <p>
                            The student should also bring a
                            valid ID for identity verification.
                        </p>

                    </div>

                    {/* ACTIONS */}

                    <div style={styles.actions}>

                        <button
                            onClick={() =>
                                navigate(
                                    `/employee/requests/${requestId}`
                                )
                            }
                            style={styles.cancelButton}
                            disabled={saving}
                        >
                            Cancel
                        </button>

                        <button
                            onClick={saveSchedule}
                            style={styles.scheduleButton}
                            disabled={saving}
                        >
                            {saving
                                ? 'Saving...'
                                : existingSchedule
                                    ? '✓ Update Claim Schedule'
                                    : '📅 Schedule Claiming'}
                        </button>

                    </div>

                    {/* CANCEL EXISTING SCHEDULE */}

                    {existingSchedule &&
                        existingSchedule.status !== 'cancelled' && (
                            <button
                                onClick={cancelSchedule}
                                style={styles.cancelScheduleButton}
                                disabled={saving}
                            >
                                Cancel Existing Schedule
                            </button>
                        )}

                </div>

                {/* ==========================================
                    WORKFLOW INFORMATION
                ========================================== */}

                <div style={styles.card}>

                    <h2>
                        Claiming Workflow
                    </h2>

                    <div style={styles.workflow}>

                        <div style={styles.workflowStep}>
                            <div style={styles.workflowNumber}>
                                1
                            </div>

                            <div>
                                <strong>
                                    Digital Credential Generated
                                </strong>

                                <p>
                                    The requested academic
                                    document has been prepared.
                                </p>
                            </div>
                        </div>

                        <div style={styles.workflowLine} />

                        <div style={styles.workflowStep}>
                            <div style={styles.workflowNumber}>
                                2
                            </div>

                            <div>
                                <strong>
                                    Schedule Claiming
                                </strong>

                                <p>
                                    Select the student's date
                                    and time for claiming.
                                </p>
                            </div>
                        </div>

                        <div style={styles.workflowLine} />

                        <div style={styles.workflowStep}>
                            <div style={styles.workflowNumber}>
                                3
                            </div>

                            <div>
                                <strong>
                                    Student Receives Schedule
                                </strong>

                                <p>
                                    The student's account can
                                    display the claiming date
                                    and time.
                                </p>
                            </div>
                        </div>

                        <div style={styles.workflowLine} />

                        <div style={styles.workflowStep}>
                            <div style={styles.workflowNumber}>
                                4
                            </div>

                            <div>
                                <strong>
                                    Student Claims Document
                                </strong>

                                <p>
                                    Employee verifies identity
                                    and official receipt before
                                    releasing the document.
                                </p>
                            </div>
                        </div>

                    </div>

                </div>

            </div>

        </div>
    )
}

// ==========================================
// REQUEST STATUS STYLE
// ==========================================

function getStatusStyle(status) {
    switch (status) {

        case 'digital_credential':
            return {
                background: '#e2d9f3',
                color: '#432874'
            }

        case 'ready_for_claiming':
            return {
                background: '#cff4fc',
                color: '#055160'
            }

        case 'scheduled':
            return {
                background: '#cff4fc',
                color: '#055160'
            }

        case 'completed':
        case 'claimed':
            return {
                background: '#d1e7dd',
                color: '#0f5132'
            }

        case 'cancelled':
            return {
                background: '#f8d7da',
                color: '#842029'
            }

        default:
            return {
                background: '#e9ecef',
                color: '#333'
            }
    }
}

// ==========================================
// SCHEDULE STATUS STYLE
// ==========================================

function getScheduleStatusStyle(status) {
    switch (status) {

        case 'scheduled':
            return {
                background: '#cff4fc',
                color: '#055160'
            }

        case 'completed':
        case 'claimed':
            return {
                background: '#d1e7dd',
                color: '#0f5132'
            }

        case 'cancelled':
            return {
                background: '#f8d7da',
                color: '#842029'
            }

        default:
            return {
                background: '#e9ecef',
                color: '#333'
            }
    }
}

// ==========================================
// STYLES
// ==========================================

const styles = {

    page: {
        minHeight: '100vh',
        background: '#f5f7fb',
        padding: '40px 20px'
    },

    container: {
        maxWidth: '1000px',
        margin: '0 auto'
    },

    card: {
        background: '#fff',
        border: '1px solid #ddd',
        borderRadius: '10px',
        padding: '30px',
        marginTop: '25px',
        boxShadow:
            '0 2px 8px rgba(0,0,0,0.05)'
    },

    backButton: {
        padding: '10px 16px',
        border: '1px solid #ddd',
        background: '#fff',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '14px'
    },

    title: {
        marginTop: '25px',
        marginBottom: '5px'
    },

    subtitle: {
        color: '#666',
        lineHeight: '1.6'
    },

    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '20px',
        flexWrap: 'wrap'
    },

    status: {
        display: 'inline-block',
        padding: '7px 12px',
        borderRadius: '20px',
        fontWeight: 'bold',
        fontSize: '13px',
        textTransform: 'capitalize'
    },

    grid: {
        display: 'grid',
        gridTemplateColumns:
            'repeat(4, 1fr)',
        gap: '20px'
    },

    scheduleGrid: {
        display: 'grid',
        gridTemplateColumns:
            'repeat(4, 1fr)',
        gap: '20px'
    },

    formGrid: {
        display: 'grid',
        gridTemplateColumns:
            'repeat(3, 1fr)',
        gap: '20px',
        marginTop: '25px'
    },

    label: {
        fontSize: '13px',
        color: '#777',
        marginBottom: '5px'
    },

    section: {
        marginTop: '20px'
    },

    formGroup: {
        marginTop: '20px'
    },

    formLabel: {
        display: 'block',
        fontWeight: '600',
        marginBottom: '8px',
        color: '#333'
    },

    required: {
        color: '#dc3545',
        marginLeft: '4px'
    },

    input: {
        width: '100%',
        padding: '12px',
        border: '1px solid #ccc',
        borderRadius: '7px',
        boxSizing: 'border-box',
        fontSize: '14px',
        background: '#fff'
    },

    textarea: {
        width: '100%',
        minHeight: '120px',
        padding: '12px',
        border: '1px solid #ccc',
        borderRadius: '7px',
        resize: 'vertical',
        boxSizing: 'border-box',
        fontSize: '14px',
        marginTop: '5px'
    },

    helpText: {
        display: 'block',
        marginTop: '7px',
        color: '#777',
        fontSize: '12px',
        lineHeight: '1.5'
    },

    scheduleBox: {
        marginTop: '20px',
        padding: '20px',
        borderRadius: '8px',
        background: '#f0f9ff',
        border: '1px solid #bae6fd'
    },

    reminderBox: {
        marginTop: '25px',
        padding: '18px',
        borderRadius: '8px',
        background: '#fff3cd',
        color: '#664d03',
        border: '1px solid #ffecb5'
    },

    actions: {
        display: 'flex',
        gap: '10px',
        marginTop: '25px',
        flexWrap: 'wrap'
    },

    scheduleButton: {
        padding: '13px 22px',
        border: 'none',
        background: '#0d6efd',
        color: '#fff',
        borderRadius: '7px',
        cursor: 'pointer',
        fontWeight: '600',
        fontSize: '15px'
    },

    cancelButton: {
        padding: '13px 22px',
        border: '1px solid #ddd',
        background: '#fff',
        color: '#333',
        borderRadius: '7px',
        cursor: 'pointer',
        fontWeight: '600',
        fontSize: '15px'
    },

    cancelScheduleButton: {
        marginTop: '15px',
        padding: '11px 18px',
        border: 'none',
        background: '#dc3545',
        color: '#fff',
        borderRadius: '7px',
        cursor: 'pointer',
        fontWeight: '600'
    },

    button: {
        padding: '10px 18px',
        border: 'none',
        background: '#222',
        color: '#fff',
        borderRadius: '6px',
        cursor: 'pointer'
    },

    error: {
        color: '#b00020',
        lineHeight: '1.6'
    },

    workflow: {
        marginTop: '25px'
    },

    workflowStep: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '15px'
    },

    workflowNumber: {
        minWidth: '35px',
        height: '35px',
        borderRadius: '50%',
        background: '#0d6efd',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold'
    },

    workflowLine: {
        width: '2px',
        height: '30px',
        background: '#ddd',
        marginLeft: '17px',
        marginTop: '5px',
        marginBottom: '5px'
    }
}

export default ClaimSchedule