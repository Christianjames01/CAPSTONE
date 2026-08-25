import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

function MyRequest() {
    const navigate = useNavigate()

    const [requests, setRequests] = useState([])
    const [loading, setLoading] = useState(true)
    const [errorMessage, setErrorMessage] = useState('')

    useEffect(() => {
        loadRequests()
    }, [])

    const loadRequests = async () => {
        try {
            setLoading(true)
            setErrorMessage('')

            // ==========================================
            // 1. GET CURRENT USER
            // ==========================================

            const {
                data: { user },
                error: userError
            } = await supabase.auth.getUser()

            if (userError) {
                throw new Error(
                    userError.message
                )
            }

            if (!user) {
                throw new Error(
                    'You are not logged in.'
                )
            }

            // ==========================================
            // 2. FIND STUDENT
            // ==========================================

            const {
                data: student,
                error: studentError
            } = await supabase
                .from('students')
                .select(`
                    student_id,
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

            // ==========================================
            // 3. LOAD STUDENT REQUESTS
            // ==========================================

            const {
                data,
                error
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
                .eq(
                    'student_id',
                    student.student_id
                )
                .order(
                    'requested_at',
                    {
                        ascending: false
                    }
                )

            if (error) {
                throw new Error(
                    'Failed to load requests: ' +
                    error.message
                )
            }

            setRequests(data || [])

        } catch (error) {
            console.error(
                'MY REQUESTS ERROR:',
                error
            )

            setErrorMessage(
                error.message ||
                'Failed to load your requests.'
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
                            Loading your requests...
                        </h2>

                        <p>
                            Please wait.
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

                    <div style={styles.card}>
                        <h1>
                            Unable to Load Requests
                        </h1>

                        <p style={styles.error}>
                            {errorMessage}
                        </p>

                        <button
                            onClick={loadRequests}
                            style={styles.button}
                        >
                            Try Again
                        </button>

                        <button
                            onClick={() =>
                                navigate(
                                    '/student/dashboard'
                                )
                            }
                            style={styles.secondaryButton}
                        >
                            Back to Dashboard
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

                {/* HEADER */}

                <div style={styles.topBar}>

                    <div>
                        <h1 style={styles.title}>
                            My Requests
                        </h1>

                        <p style={styles.subtitle}>
                            View and manage your
                            document requests.
                        </p>
                    </div>

                    <button
                        onClick={() =>
                            navigate(
                                '/student/new-request'
                            )
                        }
                        style={styles.newButton}
                    >
                        + New Request
                    </button>

                </div>

                {/* NO REQUESTS */}

                {requests.length === 0 && (
                    <div style={styles.card}>
                        <h2>
                            No Requests Yet
                        </h2>

                        <p>
                            You have not submitted
                            any document requests.
                        </p>

                        <button
                            onClick={() =>
                                navigate(
                                    '/student/new-request'
                                )
                            }
                            style={styles.button}
                        >
                            Create New Request
                        </button>
                    </div>
                )}

                {/* REQUEST LIST */}

                {requests.length > 0 && (
                    <div style={styles.list}>

                        {requests.map((request) => (

                            <div
                                key={request.request_id}
                                style={styles.requestCard}
                            >

                                <div style={styles.requestHeader}>

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

                                    <div
                                        style={{
                                            ...styles.status,
                                            ...(request.status ===
                                                'pending'
                                                ? styles.pending
                                                : {}),
                                            ...(request.status ===
                                                'processing'
                                                ? styles.processing
                                                : {}),
                                            ...(request.status ===
                                                'completed'
                                                ? styles.completed
                                                : {}),
                                            ...(request.status ===
                                                'rejected'
                                                ? styles.rejected
                                                : {})
                                        }}
                                    >
                                        {request.status}
                                    </div>

                                </div>

                                <div style={styles.details}>

                                    <div>
                                        <span
                                            style={
                                                styles.label
                                            }
                                        >
                                            Quantity
                                        </span>

                                        <strong>
                                            {request.quantity}
                                        </strong>
                                    </div>

                                    <div>
                                        <span
                                            style={
                                                styles.label
                                            }
                                        >
                                            Total
                                        </span>

                                        <strong>
                                            ₱
                                            {Number(
                                                request.total_amount ||
                                                0
                                            ).toFixed(2)}
                                        </strong>
                                    </div>

                                    <div>
                                        <span
                                            style={
                                                styles.label
                                            }
                                        >
                                            Priority
                                        </span>

                                        <strong>
                                            {request.priority}
                                        </strong>
                                    </div>

                                    <div>
                                        <span
                                            style={
                                                styles.label
                                            }
                                        >
                                            Requested
                                        </span>

                                        <strong>
                                            {request.requested_at
                                                ? new Date(
                                                    request.requested_at
                                                ).toLocaleDateString()
                                                : '-'}
                                        </strong>
                                    </div>

                                </div>

                                <div style={styles.purpose}>

                                    <span
                                        style={
                                            styles.label
                                        }
                                    >
                                        Purpose
                                    </span>

                                    <p>
                                        {request.purpose ||
                                            'No purpose specified'}
                                    </p>

                                </div>

                                {/* IMPORTANT */}
                                {/* Use request.request_id */}

                                <button
                                    onClick={() => {
                                        console.log(
                                            'OPENING REQUEST:',
                                            request.request_id
                                        )

                                        if (
                                            !request.request_id
                                        ) {
                                            alert(
                                                'This request has no request ID.'
                                            )
                                            return
                                        }

                                        navigate(
                                            `/student/request/${request.request_id}`
                                        )
                                    }}
                                    style={styles.viewButton}
                                >
                                    View Request Details
                                </button>

                            </div>

                        ))}

                    </div>
                )}

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
        maxWidth: '1000px',
        margin: '0 auto'
    },

    topBar: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '20px',
        marginBottom: '30px'
    },

    title: {
        margin: 0
    },

    subtitle: {
        color: '#666',
        marginTop: '8px'
    },

    card: {
        background: '#fff',
        border: '1px solid #ddd',
        borderRadius: '10px',
        padding: '30px',
        boxShadow:
            '0 2px 8px rgba(0,0,0,0.05)'
    },

    list: {
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
    },

    requestCard: {
        background: '#fff',
        border: '1px solid #ddd',
        borderRadius: '10px',
        padding: '25px',
        boxShadow:
            '0 2px 8px rgba(0,0,0,0.05)'
    },

    requestHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '20px'
    },

    requestNumber: {
        margin: 0
    },

    label: {
        display: 'block',
        fontSize: '13px',
        color: '#777',
        marginBottom: '5px'
    },

    status: {
        padding: '8px 15px',
        borderRadius: '20px',
        fontWeight: 'bold',
        textTransform: 'capitalize'
    },

    pending: {
        background: '#fff3cd',
        color: '#856404'
    },

    processing: {
        background: '#cfe2ff',
        color: '#084298'
    },

    completed: {
        background: '#d1e7dd',
        color: '#0f5132'
    },

    rejected: {
        background: '#f8d7da',
        color: '#842029'
    },

    details: {
        display: 'grid',
        gridTemplateColumns:
            'repeat(4, 1fr)',
        gap: '20px',
        marginTop: '25px',
        paddingTop: '20px',
        borderTop: '1px solid #eee'
    },

    purpose: {
        marginTop: '20px'
    },

    viewButton: {
        marginTop: '20px',
        padding: '11px 18px',
        border: 'none',
        background: '#2563eb',
        color: '#fff',
        borderRadius: '7px',
        cursor: 'pointer',
        fontWeight: '600'
    },

    newButton: {
        padding: '12px 18px',
        border: 'none',
        background: '#2563eb',
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
        cursor: 'pointer',
        marginTop: '20px'
    },

    secondaryButton: {
        padding: '10px 18px',
        border: '1px solid #ccc',
        background: '#fff',
        color: '#222',
        borderRadius: '6px',
        cursor: 'pointer',
        marginTop: '20px',
        marginLeft: '10px'
    },

    error: {
        color: '#b00020'
    }
}

export default MyRequest