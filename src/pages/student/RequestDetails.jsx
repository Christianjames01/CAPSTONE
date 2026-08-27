import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

function RequestDetails() {
    const { requestId } = useParams()
    const navigate = useNavigate()

    const [request, setRequest] = useState(null)
    const [requirements, setRequirements] = useState([])
    const [loading, setLoading] = useState(true)
    const [errorMessage, setErrorMessage] = useState('')

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

    // ==========================================
    // LOADING
    // ==========================================

    if (loading) {
        return (
            <div style={styles.page}>
                <div style={styles.container}>
                    <div style={styles.card}>
                        <h2>
                            Loading request...
                        </h2>

                        <p>
                            Please wait while we load
                            your request.
                        </p>
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
                                '/student/my-requests'
                            )
                        }
                        style={styles.backButton}
                    >
                        ← Back to My Requests
                    </button>

                    <div style={styles.card}>
                        <h1>
                            Unable to Load Request
                        </h1>

                        <p style={styles.errorText}>
                            {errorMessage}
                        </p>

                        <button
                            onClick={loadRequest}
                            style={styles.button}
                        >
                            Try Again
                        </button>
                    </div>

                </div>
            </div>
        )
    }

    // ==========================================
    // REQUEST NOT FOUND
    // ==========================================

    if (!request) {
        return (
            <div style={styles.page}>
                <div style={styles.container}>

                    <div style={styles.card}>
                        <h1>
                            Request Not Found
                        </h1>

                        <p>
                            This request could not
                            be found.
                        </p>

                        <button
                            onClick={() =>
                                navigate(
                                    '/student/my-requests'
                                )
                            }
                            style={styles.button}
                        >
                            Back to My Requests
                        </button>
                    </div>

                </div>
            </div>
        )
    }

    // ==========================================
    // MAIN PAGE
    // ==========================================

    return (
        <div style={styles.page}>

            <div style={styles.container}>

                {/* BACK */}

                <button
                    onClick={() =>
                        navigate(
                            '/student/my-requests'
                        )
                    }
                    style={styles.backButton}
                >
                    ← Back to My Requests
                </button>

                {/* TITLE */}

                <h1 style={styles.title}>
                    Request Details
                </h1>

                <p style={styles.subtitle}>
                    View the status and details of
                    your document request.
                </p>

                {/* REQUEST CARD */}

                <div style={styles.card}>

                    {/* HEADER */}

                    <div style={styles.header}>

                        <div>
                            <p style={styles.label}>
                                Request Number
                            </p>

                            <h2
                                style={
                                    styles.requestNumber
                                }
                            >
                                {request.request_number}
                            </h2>
                        </div>

                        <div style={styles.status}>
                            {request.status}
                        </div>

                    </div>

                    <hr />

                    {/* BASIC INFORMATION */}

                    <div style={styles.grid}>

                        <div>
                            <p style={styles.label}>
                                Quantity
                            </p>

                            <p style={styles.value}>
                                {request.quantity}
                            </p>
                        </div>

                        <div>
                            <p style={styles.label}>
                                Unit Fee
                            </p>

                            <p style={styles.value}>
                                ₱
                                {Number(
                                    request.unit_fee || 0
                                ).toFixed(2)}
                            </p>
                        </div>

                        <div>
                            <p style={styles.label}>
                                Total Amount
                            </p>

                            <p style={styles.value}>
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

                            <p style={styles.value}>
                                {request.priority}
                            </p>
                        </div>

                    </div>

                    <hr />

                    {/* PURPOSE */}

                    <div>
                        <p style={styles.label}>
                            Purpose
                        </p>

                        <p style={styles.value}>
                            {request.purpose ||
                                'No purpose specified'}
                        </p>
                    </div>

                    {/* STUDENT REMARKS */}

                    {request.student_remarks && (
                        <div style={styles.section}>
                            <p style={styles.label}>
                                Your Remarks
                            </p>

                            <p style={styles.value}>
                                {request.student_remarks}
                            </p>
                        </div>
                    )}

                    {/* EMPLOYEE REMARKS */}

                    {request.employee_remarks && (
                        <div style={styles.section}>
                            <p style={styles.label}>
                                Registrar Remarks
                            </p>

                            <p style={styles.value}>
                                {request.employee_remarks}
                            </p>
                        </div>
                    )}

                    {/* REJECTION */}

                    {request.rejection_reason && (
                        <div style={styles.rejection}>
                            <p style={styles.label}>
                                Rejection Reason
                            </p>

                            <p style={styles.value}>
                                {request.rejection_reason}
                            </p>
                        </div>
                    )}

                    <hr />

                    {/* REQUESTED */}

                    <div style={styles.section}>
                        <p style={styles.label}>
                            Requested At
                        </p>

                        <p style={styles.value}>
                            {request.requested_at
                                ? new Date(
                                    request.requested_at
                                ).toLocaleString()
                                : 'Not available'}
                        </p>
                    </div>

                    {/* PROCESSED */}

                    {request.processed_at && (
                        <div style={styles.section}>
                            <p style={styles.label}>
                                Processed At
                            </p>

                            <p style={styles.value}>
                                {new Date(
                                    request.processed_at
                                ).toLocaleString()}
                            </p>
                        </div>
                    )}

                    {/* COMPLETED */}

                    {request.completed_at && (
                        <div style={styles.section}>
                            <p style={styles.label}>
                                Completed At
                            </p>

                            <p style={styles.value}>
                                {new Date(
                                    request.completed_at
                                ).toLocaleString()}
                            </p>
                        </div>
                    )}

                    {/* STATUS */}

                    <div style={styles.actions}>

                        {request.status === 'pending' && (
                            <div style={styles.info}>
                                <strong>
                                    Request Pending
                                </strong>

                                <p>
                                    Your request is waiting
                                    for Registrar processing.
                                </p>
                            </div>
                        )}

                        {request.status === 'processing' && (
                            <div style={styles.info}>
                                <strong>
                                    Request Processing
                                </strong>

                                <p>
                                    Your request is currently
                                    being processed by the
                                    Registrar.
                                </p>
                            </div>
                        )}

                        {request.status === 'completed' && (
                            <div style={styles.success}>
                                <strong>
                                    Request Completed
                                </strong>

                                <p>
                                    Your document request
                                    has been completed.
                                </p>
                            </div>
                        )}

                        {request.status === 'rejected' && (
                            <div style={styles.danger}>
                                <strong>
                                    Request Rejected
                                </strong>

                                <p>
                                    Your request has been
                                    rejected.
                                </p>
                            </div>
                        )}

                    </div>

                    {/* REQUIREMENTS */}

                    {requirements.length > 0 && (
                        <div style={styles.uploadSection}>

                            <h3>
                                Requirements
                            </h3>

                            <p style={styles.paymentText}>
                                {requirements.filter(r => r.status === 'approved').length} of {requirements.length} approved
                            </p>

                            {requirements.some(r => r.status === 'pending' || r.status === 'rejected') && (
                                <p style={styles.paymentNote}>
                                    Some requirements still need to be uploaded or re-submitted.
                                </p>
                            )}

                            <button
                                onClick={() =>
                                    navigate(
                                        `/student/request/${request.request_id}/requirements`
                                    )
                                }
                                style={styles.uploadButton}
                            >
                                View Requirements
                            </button>

                        </div>
                    )}

                    {/* UPLOAD RECEIPT */}

                    {(request.status === 'pending' ||
                        request.status === 'processing') && (
                            <div style={styles.uploadSection}>

                                <h3>
                                    Payment
                                </h3>

                                <p style={styles.paymentText}>
                                    Total amount to pay:
                                    <strong>
                                        {' '}₱
                                        {Number(
                                            request.total_amount || 0
                                        ).toFixed(2)}
                                    </strong>
                                </p>

                                <p style={styles.paymentNote}>
                                    Pay at the Finance Office,
                                    then upload your official
                                    receipt here.
                                </p>

                                <button
                                    onClick={() =>
                                        navigate(
                                            `/student/request/${request.request_id}/upload-receipt`
                                        )
                                    }
                                    style={styles.uploadButton}
                                >
                                    Upload Official Receipt
                                </button>

                            </div>
                        )}

                </div>

            </div>

        </div>
    )
}

const styles = {
    page: {
        minHeight: '100vh',
        background: '#f5f7fb',
        padding: '40px 20px',
        color: '#222'
    },

    container: {
        maxWidth: '900px',
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
        cursor: 'pointer'
    },

    button: {
        padding: '10px 18px',
        border: 'none',
        background: '#222',
        color: '#fff',
        borderRadius: '6px',
        cursor: 'pointer',
        marginTop: '20px'
    },

    uploadButton: {
        padding: '12px 20px',
        border: 'none',
        background: '#2563eb',
        color: '#fff',
        borderRadius: '7px',
        cursor: 'pointer',
        fontWeight: '600',
        marginTop: '10px'
    },

    uploadSection: {
        marginTop: '30px',
        padding: '20px',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '8px'
    },

    paymentText: {
        fontSize: '16px'
    },

    paymentNote: {
        color: '#666'
    },

    errorText: {
        color: '#b00020',
        marginTop: '15px'
    },

    title: {
        marginTop: '25px',
        marginBottom: '5px'
    },

    subtitle: {
        color: '#666',
        marginBottom: '25px'
    },

    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '20px'
    },

    requestNumber: {
        margin: 0
    },

    status: {
        padding: '8px 15px',
        borderRadius: '20px',
        background: '#fff3cd',
        color: '#856404',
        fontWeight: 'bold',
        textTransform: 'capitalize'
    },

    grid: {
        display: 'grid',
        gridTemplateColumns:
            'repeat(4, 1fr)',
        gap: '20px',
        margin: '20px 0'
    },

    label: {
        fontSize: '13px',
        color: '#777',
        marginBottom: '5px'
    },

    value: {
        fontSize: '16px',
        marginTop: 0
    },

    section: {
        marginTop: '20px'
    },

    actions: {
        marginTop: '25px'
    },

    info: {
        padding: '15px',
        background: '#e7f1ff',
        borderRadius: '6px'
    },

    success: {
        padding: '15px',
        background: '#d1e7dd',
        borderRadius: '6px'
    },

    danger: {
        padding: '15px',
        background: '#f8d7da',
        borderRadius: '6px'
    },

    rejection: {
        marginTop: '20px',
        padding: '15px',
        background: '#f8d7da',
        borderRadius: '6px'
    }
}

export default RequestDetails