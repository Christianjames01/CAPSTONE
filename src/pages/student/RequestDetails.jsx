import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'
import { supabase } from '../../lib/supabase'
import { notify, notifyError, notifySuccess } from '../../lib/notify'
import { SkeletonPageHeader, SkeletonDetailCard } from '../../components/Skeleton'
import CredentialQr from '../../components/CredentialQr'
import '../auth/Auth.css'
import './StudentPages.css'

const STATUS_META = {
    pending: {
        label: 'Pending',
        tone: 'info',
        title: 'Request Pending',
        message: 'Your request is waiting for Registrar processing. Pay at the Finance Office and upload your official receipt below.',
    },
    payment_pending: {
        label: 'Payment Pending',
        tone: 'info',
        title: 'Payment Pending',
        message: 'Pay at the Finance Office, then upload your official receipt below so the Registrar can verify it.',
    },
    receipt_uploaded: {
        label: 'Receipt Uploaded',
        tone: 'info',
        title: 'Receipt Under Review',
        message: 'Your official receipt has been uploaded and is waiting for the Registrar to verify your payment.',
    },
    receipt_verified: {
        label: 'Payment Verified',
        tone: 'info',
        title: 'Payment Verified',
        message: 'Your payment has been verified. Your request will begin processing soon.',
    },
    processing: {
        label: 'Processing',
        tone: 'info',
        title: 'Request Processing',
        message: 'Your request is currently being processed by the Registrar.',
    },
    lacking_requirements: {
        label: 'Requirements Needed',
        tone: 'info',
        title: 'Requirements Needed',
        message: 'Some required documents are still missing or need to be re-submitted. See Requirements below.',
    },
    ready_for_claiming: {
        label: 'Ready for Claiming',
        tone: 'success',
        title: 'Document Ready',
        message: 'Your document has been prepared. You will be notified once a claiming schedule is set.',
    },
    completed: {
        label: 'Completed',
        tone: 'success',
        title: 'Request Completed',
        message: 'Your document request has been completed and claimed.',
    },
    rejected: {
        label: 'Rejected',
        tone: 'danger',
        title: 'Request Rejected',
        message: 'Your request has been rejected. See the reason below.',
    },
    cancelled: {
        label: 'Cancelled',
        tone: 'danger',
        title: 'Request Cancelled',
        message: 'This request has been cancelled.',
    },
}

const statusMeta = (status) =>
    STATUS_META[status] || { label: status, tone: 'info', title: 'Status Update', message: '' }

function RequestDetails() {
    const { requestId } = useParams()
    const navigate = useNavigate()

    const [request, setRequest] = useState(null)
    const [documentName, setDocumentName] = useState('')
    const [requirements, setRequirements] = useState([])
    const [credential, setCredential] = useState(null)
    const [claimSchedule, setClaimSchedule] = useState(null)
    const [assignedEmployee, setAssignedEmployee] = useState(null)
    const [loading, setLoading] = useState(true)
    const [errorMessage, setErrorMessage] = useState('')
    const [cancelling, setCancelling] = useState(false)
    const [requestingReschedule, setRequestingReschedule] = useState(false)

    useEffect(() => {
        console.log('URL REQUEST ID:', requestId)

        if (!requestId || requestId === 'undefined') {
            setErrorMessage(
                'Invalid request ID. The request ID is missing from the URL.'
            )
            setLoading(false)
            return
        }

        loadRequest()
    }, [requestId])

    const loadRequest = async () => {
        try {
            setLoading(true)
            setErrorMessage('')

            console.log('================================')
            console.log('LOADING STUDENT REQUEST')
            console.log('REQUEST ID:', requestId)
            console.log('================================')

            // ==========================================
            // 1. CHECK REQUEST ID
            // ==========================================

            if (!requestId || requestId === 'undefined') {
                throw new Error(
                    'Invalid request ID. No request ID was provided.'
                )
            }

            // ==========================================
            // 2. GET CURRENT USER
            // ==========================================

            const {
                data: { user },
                error: userError
            } = await supabase.auth.getUser()

            if (userError) {
                throw new Error(
                    'Authentication error: ' +
                    userError.message
                )
            }

            if (!user) {
                throw new Error(
                    'You are not logged in.'
                )
            }

            console.log('AUTH USER:', user.id)

            // ==========================================
            // 3. FIND STUDENT
            // ==========================================

            const {
                data: student,
                error: studentError
            } = await supabase
                .from('students')
                .select(`
                    student_id,
                    user_id,
                    student_number
                `)
                .eq('user_id', user.id)
                .single()

            if (studentError) {
                throw new Error(
                    'Student lookup failed: ' +
                    studentError.message
                )
            }

            if (!student) {
                throw new Error(
                    'Student record could not be found.'
                )
            }

            console.log(
                'STUDENT ID:',
                student.student_id
            )

            // ==========================================
            // 4. LOAD REQUEST
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
                    cancellation_reason,
                    cancelled_at,
                    requested_at,
                    processed_at,
                    completed_at
                `)
                .eq('request_id', requestId)
                .eq('student_id', student.student_id)
                .maybeSingle()

            if (requestError) {
                throw new Error(
                    'Failed to load request: ' +
                    requestError.message
                )
            }

            if (!requestData) {
                throw new Error(
                    'This request could not be found or does not belong to your student account.'
                )
            }

            console.log(
                'REQUEST FOUND:',
                requestData
            )

            setRequest(requestData)

            if (requestData.document_type_id) {
                const { data: doc } = await supabase
                    .from('document_types')
                    .select('document_name')
                    .eq('document_type_id', requestData.document_type_id)
                    .single()

                setDocumentName(doc?.document_name || 'Document')
            }

            if (requestData.assigned_employee_id) {
                const { data: employeeRow } = await supabase
                    .from('employees')
                    .select('user_id, position_title')
                    .eq('employee_id', requestData.assigned_employee_id)
                    .single()

                if (employeeRow) {
                    const { data: employeeProfile } = await supabase
                        .from('profiles')
                        .select('first_name, last_name')
                        .eq('user_id', employeeRow.user_id)
                        .single()

                    setAssignedEmployee({
                        name: employeeProfile
                            ? `${employeeProfile.first_name} ${employeeProfile.last_name}`.trim()
                            : 'Registrar Staff',
                        positionTitle: employeeRow.position_title,
                    })
                }
            } else {
                setAssignedEmployee(null)
            }

            const {
                data: requirementRows,
                error: requirementError
            } = await supabase
                .from('request_requirements')
                .select('request_requirement_id, status')
                .eq('request_id', requestId)

            if (requirementError) {
                console.error('REQUIREMENTS LOAD ERROR:', requirementError)
            }

            setRequirements(requirementRows || [])

            const {
                data: scheduleRow,
                error: scheduleError
            } = await supabase
                .from('claim_schedules')
                .select('claim_schedule_id, claim_date, claim_time, scheduled_date, scheduled_time, status, remarks, claimed_at')
                .eq('request_id', requestId)
                .neq('status', 'cancelled')
                .order('claim_date', { ascending: false })
                .limit(1)
                .maybeSingle()

            if (scheduleError) {
                console.error('CLAIM SCHEDULE LOAD ERROR:', scheduleError)
            }

            setClaimSchedule(scheduleRow || null)

            const { data: credentialData } = await supabase
                .from('credentials')
                .select('credential_id, credential_number, generated_at, status, revocation_reason')
                .eq('request_id', requestId)
                .order('generated_at', { ascending: false })
                .limit(1)
                .maybeSingle()

            setCredential(credentialData || null)

        } catch (error) {
            console.error(
                'REQUEST DETAILS ERROR:',
                error
            )

            setErrorMessage(
                error.message ||
                'Something went wrong while loading the request.'
            )

        } finally {
            setLoading(false)
        }
    }

    const cancelRequest = async () => {
        const { value: reason } = await Swal.fire({
            title: 'Cancel Request',
            text: 'This cannot be undone. Please tell us why you\'re cancelling.',
            icon: 'warning',
            input: 'textarea',
            inputLabel: 'Reason for cancellation',
            inputPlaceholder: 'e.g. I no longer need this document',
            inputValidator: (value) => {
                if (!value || !value.trim()) return 'A reason is required to cancel this request.'
            },
            showCancelButton: true,
            confirmButtonText: 'Yes, cancel it',
            cancelButtonText: 'Never mind',
            confirmButtonColor: '#dc3545',
        })

        if (!reason) return

        try {
            setCancelling(true)

            const cancelledAt = new Date().toISOString()

            const { error: cancelError } = await supabase
                .from('document_requests')
                .update({
                    status: 'cancelled',
                    cancellation_reason: reason.trim(),
                    cancelled_at: cancelledAt,
                })
                .eq('request_id', request.request_id)
                .eq('status', 'pending')

            if (cancelError) {
                throw new Error('Failed to cancel request: ' + cancelError.message)
            }

            if (request.assigned_employee_id) {
                const { data: employeeRow } = await supabase
                    .from('employees')
                    .select('user_id')
                    .eq('employee_id', request.assigned_employee_id)
                    .single()

                if (employeeRow) {
                    await notify({
                        userId: employeeRow.user_id,
                        title: 'Request cancelled',
                        message: `Request ${request.request_number} was cancelled by the student. Reason: ${reason.trim()}`,
                        notificationType: 'request_update',
                        relatedRequestId: request.request_id,
                    })
                }
            }

            setRequest((prev) => ({
                ...prev,
                status: 'cancelled',
                cancellation_reason: reason.trim(),
                cancelled_at: cancelledAt,
            }))

        } catch (err) {
            console.error('CANCEL REQUEST ERROR:', err)
            notifyError(err.message || 'Failed to cancel request.')
        } finally {
            setCancelling(false)
        }
    }

    const requestReschedule = async () => {
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
            setRequestingReschedule(true)

            if (!request.assigned_employee_id) {
                throw new Error('No registrar employee is assigned to this request yet.')
            }

            const { data: employeeRow, error: employeeError } = await supabase
                .from('employees')
                .select('user_id')
                .eq('employee_id', request.assigned_employee_id)
                .single()

            if (employeeError || !employeeRow) {
                throw new Error('Could not find the assigned employee to notify.')
            }

            await notify({
                userId: employeeRow.user_id,
                title: 'Reschedule requested',
                message: `Student requested to reschedule claiming for request ${request.request_number} (currently ${claimSchedule.claim_date || claimSchedule.scheduled_date || 'N/A'}). Reason: "${reason.trim()}"`,
                notificationType: 'request_update',
                relatedRequestId: request.request_id,
            })

            notifySuccess('Your reschedule request has been sent to the Registrar\'s Office.')

        } catch (err) {
            console.error('REQUEST RESCHEDULE ERROR:', err)
            notifyError(err.message || 'Failed to send your reschedule request.')
        } finally {
            setRequestingReschedule(false)
        }
    }

    // ==========================================
    // LOADING
    // ==========================================

    if (loading) {
        return (
            <div>
                <SkeletonPageHeader />
                <SkeletonDetailCard fields={6} />
                <SkeletonDetailCard fields={4} />
            </div>
        )
    }

    // ==========================================
    // ERROR
    // ==========================================

    if (errorMessage) {
        return (
            <div>
                <button className="student-link-button" style={{ marginBottom: 16 }} onClick={() => navigate('/student/my-requests')}>
                    ← Back to My Requests
                </button>

                <div className="student-card">
                    <h2 style={{ fontSize: 16, marginBottom: 12 }}>Unable to Load Request</h2>
                    <div className="student-error-box">{errorMessage}</div>
                    <button className="student-link-button" onClick={loadRequest}>
                        Try Again
                    </button>
                </div>
            </div>
        )
    }

    // ==========================================
    // REQUEST NOT FOUND
    // ==========================================

    if (!request) {
        return (
            <div>
                <div className="student-card">
                    <h2 style={{ fontSize: 16, marginBottom: 8 }}>Request Not Found</h2>
                    <p style={{ marginBottom: 16 }}>This request could not be found.</p>
                    <button className="student-link-button" onClick={() => navigate('/student/my-requests')}>
                        Back to My Requests
                    </button>
                </div>
            </div>
        )
    }

    // ==========================================
    // MAIN PAGE
    // ==========================================

    return (
        <div>
            <button className="student-link-button" style={{ marginBottom: 16 }} onClick={() => navigate('/student/my-requests')}>
                ← Back to My Requests
            </button>

            <div className="student-page-header">
                <h1>{documentName || 'Request Details'}</h1>
                <p>View the status and details of your document request.</p>
            </div>

            {/* REQUEST CARD */}

            <div className="student-card">
                <div className="student-list-card-header" style={{ marginBottom: 16 }}>
                    <div>
                        <p style={{ fontSize: 12, color: 'var(--slate)', marginBottom: 4 }}>Request Number</p>
                        <h2 style={{ fontSize: 18 }}>{request.request_number}</h2>
                    </div>

                    <span className={`student-status-pill status-${request.status}`}>
                        {statusMeta(request.status).label}
                    </span>
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '16px 0' }} />

                <div className="student-info-grid">
                    <div className="student-info-field">
                        <span>Document Requested</span>
                        <strong>{documentName || 'N/A'}</strong>
                    </div>

                    <div className="student-info-field">
                        <span>Quantity</span>
                        <strong>{request.quantity}</strong>
                    </div>

                    <div className="student-info-field">
                        <span>Unit Fee</span>
                        <strong>₱{Number(request.unit_fee || 0).toFixed(2)}</strong>
                    </div>

                    <div className="student-info-field">
                        <span>Total Amount</span>
                        <strong>₱{Number(request.total_amount || 0).toFixed(2)}</strong>
                    </div>

                    <div className="student-info-field">
                        <span>Priority</span>
                        <strong style={{ textTransform: 'capitalize' }}>{request.priority}</strong>
                    </div>

                    <div className="student-info-field">
                        <span>Handled By</span>
                        <strong>
                            {assignedEmployee
                                ? `${assignedEmployee.name}${assignedEmployee.positionTitle ? ` · ${assignedEmployee.positionTitle}` : ''}`
                                : 'Not yet assigned'}
                        </strong>
                    </div>
                </div>

                {assignedEmployee && (
                    <button
                        className="student-link-button"
                        style={{ marginTop: 12 }}
                        onClick={() => navigate('/student/messages')}
                    >
                        Message {assignedEmployee.name} →
                    </button>
                )}

                <div className="student-info-field student-section">
                    <span>Purpose</span>
                    <strong>{request.purpose || 'No purpose specified'}</strong>
                </div>

                {request.student_remarks && (
                    <div className="student-info-field student-section">
                        <span>Your Remarks</span>
                        <strong>{request.student_remarks}</strong>
                    </div>
                )}

                {request.employee_remarks && (
                    <div className="student-info-field student-section">
                        <span>Registrar Remarks</span>
                        <strong>{request.employee_remarks}</strong>
                    </div>
                )}

                {request.rejection_reason && (
                    <div className="student-notice tone-danger">
                        <strong>Rejection Reason</strong>
                        <p>{request.rejection_reason}</p>
                    </div>
                )}

                {request.cancellation_reason && (
                    <div className="student-notice tone-danger">
                        <strong>Cancellation Reason</strong>
                        <p>{request.cancellation_reason}</p>
                        {request.cancelled_at && (
                            <p style={{ marginTop: 4, fontSize: 12.5 }}>
                                Cancelled on {new Date(request.cancelled_at).toLocaleString()}
                            </p>
                        )}
                    </div>
                )}

                <div className="student-info-field student-section">
                    <span>Requested At</span>
                    <strong>{request.requested_at ? new Date(request.requested_at).toLocaleString() : 'Not available'}</strong>
                </div>

                {request.processed_at && (
                    <div className="student-info-field" style={{ marginTop: 16 }}>
                        <span>Processed At</span>
                        <strong>{new Date(request.processed_at).toLocaleString()}</strong>
                    </div>
                )}

                {request.completed_at && (
                    <div className="student-info-field" style={{ marginTop: 16 }}>
                        <span>Completed At</span>
                        <strong>{new Date(request.completed_at).toLocaleString()}</strong>
                    </div>
                )}

                {credential && (
                    <div className="student-card" style={{ background: 'var(--paper)', marginTop: 16, marginBottom: 0 }}>
                        <h3 style={{ fontSize: 15, marginBottom: 6 }}>Digital Credential</h3>
                        <p style={{ fontSize: 13, color: 'var(--slate)', marginBottom: 4 }}>
                            Share this QR code or credential number so anyone can verify this document is genuine.
                        </p>
                        <CredentialQr
                            credentialNumber={credential.credential_number}
                            status={credential.status}
                            revocationReason={credential.revocation_reason}
                        />
                    </div>
                )}

                {/* STATUS */}

                <div className={`student-notice tone-${statusMeta(request.status).tone}`}>
                    <strong>{statusMeta(request.status).title}</strong>
                    <p>{statusMeta(request.status).message}</p>
                </div>

                {request.status === 'pending' && (
                    <button
                        className="student-link-button"
                        style={{ color: 'var(--red)', marginTop: 12 }}
                        onClick={cancelRequest}
                        disabled={cancelling}
                    >
                        {cancelling ? 'Cancelling...' : 'Cancel this request'}
                    </button>
                )}

                {/* CLAIM SCHEDULE */}

                {claimSchedule && (
                    <div className="student-card" style={{ background: 'var(--paper)', marginTop: 16, marginBottom: 0 }}>
                        <h3 style={{ fontSize: 15, marginBottom: 10 }}>Claiming Schedule</h3>

                        <p style={{ marginBottom: 8 }}>
                            {claimSchedule.status === 'claimed' ? (
                                <>
                                    Claimed on{' '}
                                    <strong>
                                        {claimSchedule.claimed_at
                                            ? new Date(claimSchedule.claimed_at).toLocaleString()
                                            : `${claimSchedule.claim_date || claimSchedule.scheduled_date || 'N/A'} at ${claimSchedule.claim_time || claimSchedule.scheduled_time || 'N/A'}`}
                                    </strong>
                                </>
                            ) : claimSchedule.status === 'missed' ? (
                                <span style={{ color: 'var(--red-dark)' }}>
                                    Missed appointment on{' '}
                                    <strong>{claimSchedule.claim_date || claimSchedule.scheduled_date || 'N/A'}</strong>
                                </span>
                            ) : (
                                <>
                                    Scheduled for{' '}
                                    <strong>
                                        {claimSchedule.claim_date || claimSchedule.scheduled_date || 'N/A'}
                                        {' at '}
                                        {claimSchedule.claim_time || claimSchedule.scheduled_time || 'N/A'}
                                    </strong>
                                </>
                            )}
                        </p>

                        {claimSchedule.status === 'missed' ? (
                            <p style={{ color: 'var(--slate)', fontSize: 13.5 }}>
                                Please contact the Registrar's Office to reschedule your claiming appointment.
                            </p>
                        ) : claimSchedule.status !== 'claimed' && (
                            <p style={{ color: 'var(--slate)', fontSize: 13.5 }}>
                                Bring your official receipt and a valid ID when you claim your document.
                            </p>
                        )}

                        {claimSchedule.remarks && (
                            <p style={{ color: 'var(--slate)', fontSize: 13.5, marginTop: 6 }}>{claimSchedule.remarks}</p>
                        )}

                        {(claimSchedule.status === 'scheduled' || claimSchedule.status === 'missed') && (
                            <button
                                className="student-link-button"
                                style={{ marginTop: 10 }}
                                onClick={requestReschedule}
                                disabled={requestingReschedule}
                            >
                                {requestingReschedule ? 'Sending...' : 'Request reschedule'}
                            </button>
                        )}
                    </div>
                )}

                {/* REQUIREMENTS */}

                {requirements.length > 0 && (
                    <div className="student-card" style={{ background: 'var(--paper)', marginTop: 16, marginBottom: 0 }}>
                        <h3 style={{ fontSize: 15, marginBottom: 10 }}>Requirements</h3>

                        <p style={{ marginBottom: 8 }}>
                            {requirements.filter((r) => r.status === 'approved').length} of {requirements.length} approved
                        </p>

                        {requirements.some((r) => r.status === 'pending' || r.status === 'rejected') && (
                            <p style={{ color: 'var(--slate)', fontSize: 13.5, marginBottom: 12 }}>
                                Some requirements still need to be uploaded or re-submitted.
                            </p>
                        )}

                        <button
                            className="auth-submit"
                            style={{ width: 'auto', padding: '11px 20px' }}
                            onClick={() => navigate(`/student/request/${request.request_id}/requirements`)}
                        >
                            View Requirements
                        </button>
                    </div>
                )}

                {/* UPLOAD RECEIPT */}

                {(request.status === 'pending' || request.status === 'processing') && (
                    <div className="student-card" style={{ background: 'var(--paper)', marginTop: 16, marginBottom: 0 }}>
                        <h3 style={{ fontSize: 15, marginBottom: 10 }}>Payment</h3>

                        <p style={{ marginBottom: 8 }}>
                            Total amount to pay: <strong>₱{Number(request.total_amount || 0).toFixed(2)}</strong>
                        </p>

                        <p style={{ color: 'var(--slate)', fontSize: 13.5, marginBottom: 12 }}>
                            Pay at the Finance Office, then upload your official receipt here.
                        </p>

                        <button
                            className="auth-submit"
                            style={{ width: 'auto', padding: '11px 20px' }}
                            onClick={() => navigate(`/student/request/${request.request_id}/upload-receipt`)}
                        >
                            Upload Official Receipt
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

export default RequestDetails