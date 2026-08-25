import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

function EmployeeDashboard() {
    const navigate = useNavigate()

    const [employee, setEmployee] = useState(null)
    const [requests, setRequests] = useState([])
    const [loading, setLoading] = useState(true)
    const [errorMessage, setErrorMessage] = useState('')

    useEffect(() => {
        loadDashboard()
    }, [])

    const loadDashboard = async () => {
        try {
            setLoading(true)
            setErrorMessage('')

            // ==========================================
            // 1. GET LOGGED-IN USER
            // ==========================================

            const {
                data: { user },
                error: authError
            } = await supabase.auth.getUser()

            if (authError) {
                throw new Error(authError.message)
            }

            if (!user) {
                throw new Error('You are not logged in.')
            }

            // ==========================================
            // 2. FIND EMPLOYEE
            // ==========================================

            const {
                data: employeeData,
                error: employeeError
            } = await supabase
                .from('employees')
                .select(`
                    employee_id,
                    user_id,
                    employee_number,
                    position_title,
                    assigned_college_id,
                    status
                `)
                .eq('user_id', user.id)
                .single()

            if (employeeError) {
                throw new Error(
                    'Employee lookup failed: ' +
                    employeeError.message
                )
            }

            if (!employeeData) {
                throw new Error(
                    'Employee record could not be found.'
                )
            }

            setEmployee(employeeData)

            // ==========================================
            // 3. GET ASSIGNED REQUESTS
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
                .eq(
                    'assigned_employee_id',
                    employeeData.employee_id
                )
                .order(
                    'requested_at',
                    {
                        ascending: false
                    }
                )

            if (requestError) {
                throw new Error(
                    'Failed to load requests: ' +
                    requestError.message
                )
            }

            setRequests(requestData || [])

        } catch (error) {
            console.error(
                'EMPLOYEE DASHBOARD ERROR:',
                error
            )

            setErrorMessage(
                error.message ||
                'Failed to load employee dashboard.'
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
                        <h2>Loading Employee Dashboard...</h2>
                        <p>Please wait.</p>
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
                        <h1>Unable to Load Dashboard</h1>

                        <p style={styles.error}>
                            {errorMessage}
                        </p>

                        <button
                            onClick={loadDashboard}
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
    // COUNTS
    // ==========================================

    const pendingCount = requests.filter(
        request =>
            request.status === 'pending' ||
            request.status === 'payment_pending'
    ).length

    const receiptCount = requests.filter(
        request =>
            request.status === 'receipt_uploaded'
    ).length

    const processingCount = requests.filter(
        request =>
            request.status === 'processing'
    ).length

    const completedCount = requests.filter(
        request =>
            request.status === 'completed'
    ).length

    // ==========================================
    // MAIN
    // ==========================================

    return (
        <div style={styles.page}>

            <div style={styles.container}>

                {/* HEADER */}

                <div style={styles.header}>
                    <div>
                        <h1>
                            Employee Dashboard
                        </h1>

                        <p style={styles.subtitle}>
                            Registrar Request Management
                        </p>
                    </div>

                    <button
                        onClick={async () => {
                            await supabase.auth.signOut()
                            navigate('/login')
                        }}
                        style={styles.logoutButton}
                    >
                        Logout
                    </button>
                </div>

                {/* EMPLOYEE INFORMATION */}

                {employee && (
                    <div style={styles.employeeCard}>

                        <div>
                            <p style={styles.label}>
                                Employee Number
                            </p>

                            <strong>
                                {employee.employee_number}
                            </strong>
                        </div>

                        <div>
                            <p style={styles.label}>
                                Position
                            </p>

                            <strong>
                                {employee.position_title}
                            </strong>
                        </div>

                    </div>
                )}

                {/* STATISTICS */}

                <div style={styles.stats}>

                    <div style={styles.statCard}>
                        <span style={styles.statNumber}>
                            {requests.length}
                        </span>

                        <span style={styles.statLabel}>
                            Total Requests
                        </span>
                    </div>

                    <div style={styles.statCard}>
                        <span style={styles.statNumber}>
                            {pendingCount}
                        </span>

                        <span style={styles.statLabel}>
                            Pending
                        </span>
                    </div>

                    <div style={styles.statCard}>
                        <span style={styles.statNumber}>
                            {receiptCount}
                        </span>

                        <span style={styles.statLabel}>
                            Receipts to Verify
                        </span>
                    </div>

                    <div style={styles.statCard}>
                        <span style={styles.statNumber}>
                            {processingCount}
                        </span>

                        <span style={styles.statLabel}>
                            Processing
                        </span>
                    </div>

                    <div style={styles.statCard}>
                        <span style={styles.statNumber}>
                            {completedCount}
                        </span>

                        <span style={styles.statLabel}>
                            Completed
                        </span>
                    </div>

                </div>

                {/* REQUESTS */}

                <div style={styles.card}>

                    <div style={styles.sectionHeader}>
                        <div>
                            <h2>
                                Assigned Requests
                            </h2>

                            <p style={styles.subtitle}>
                                Requests assigned to you.
                            </p>
                        </div>

                        <button
                            onClick={loadDashboard}
                            style={styles.refreshButton}
                        >
                            Refresh
                        </button>
                    </div>

                    {requests.length === 0 ? (
                        <div style={styles.empty}>
                            <h3>
                                No Assigned Requests
                            </h3>

                            <p>
                                There are currently no
                                requests assigned to you.
                            </p>
                        </div>
                    ) : (
                        <div style={styles.tableWrapper}>

                            <table style={styles.table}>

                                <thead>
                                    <tr>
                                        <th>
                                            Request Number
                                        </th>

                                        <th>
                                            Amount
                                        </th>

                                        <th>
                                            Status
                                        </th>

                                        <th>
                                            Requested At
                                        </th>

                                        <th>
                                            Action
                                        </th>
                                    </tr>
                                </thead>

                                <tbody>

                                    {requests.map(request => (

                                        <tr
                                            key={
                                                request.request_id
                                            }
                                        >

                                            <td>
                                                <strong>
                                                    {
                                                        request.request_number
                                                    }
                                                </strong>
                                            </td>

                                            <td>
                                                ₱
                                                {Number(
                                                    request.total_amount || 0
                                                ).toFixed(2)}
                                            </td>

                                            <td>
                                                <span
                                                    style={{
                                                        ...styles.status,
                                                        ...getStatusStyle(
                                                            request.status
                                                        )
                                                    }}
                                                >
                                                    {
                                                        request.status
                                                    }
                                                </span>
                                            </td>

                                            <td>
                                                {new Date(
                                                    request.requested_at
                                                ).toLocaleString()}
                                            </td>

                                            <td>

                                                <button
                                                    onClick={() =>
                                                        navigate(
                                                            `/employee/requests/${request.request_id}`
                                                        )
                                                    }
                                                    style={
                                                        styles.viewButton
                                                    }
                                                >
                                                    View
                                                </button>

                                            </td>

                                        </tr>

                                    ))}

                                </tbody>

                            </table>

                        </div>
                    )}

                </div>

            </div>

        </div>
    )
}

function getStatusStyle(status) {

    switch (status) {

        case 'receipt_uploaded':
            return {
                background: '#fff3cd',
                color: '#856404'
            }

        case 'receipt_verified':
            return {
                background: '#d1e7dd',
                color: '#0f5132'
            }

        case 'processing':
            return {
                background: '#cfe2ff',
                color: '#084298'
            }

        case 'completed':
            return {
                background: '#d1e7dd',
                color: '#0f5132'
            }

        case 'rejected':
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

const styles = {

    page: {
        minHeight: '100vh',
        background: '#f5f7fb',
        padding: '40px 20px'
    },

    container: {
        maxWidth: '1200px',
        margin: '0 auto'
    },

    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '25px'
    },

    subtitle: {
        color: '#666',
        marginTop: '5px'
    },

    logoutButton: {
        padding: '10px 18px',
        border: 'none',
        background: '#dc3545',
        color: '#fff',
        borderRadius: '6px',
        cursor: 'pointer'
    },

    employeeCard: {
        background: '#fff',
        border: '1px solid #ddd',
        borderRadius: '10px',
        padding: '20px',
        display: 'flex',
        gap: '60px',
        marginBottom: '25px'
    },

    label: {
        fontSize: '13px',
        color: '#777',
        marginBottom: '5px'
    },

    stats: {
        display: 'grid',
        gridTemplateColumns:
            'repeat(5, 1fr)',
        gap: '15px',
        marginBottom: '25px'
    },

    statCard: {
        background: '#fff',
        border: '1px solid #ddd',
        borderRadius: '10px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '5px'
    },

    statNumber: {
        fontSize: '28px',
        fontWeight: 'bold'
    },

    statLabel: {
        color: '#666'
    },

    card: {
        background: '#fff',
        border: '1px solid #ddd',
        borderRadius: '10px',
        padding: '25px',
        boxShadow:
            '0 2px 8px rgba(0,0,0,0.05)'
    },

    sectionHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
    },

    refreshButton: {
        padding: '9px 16px',
        border: '1px solid #ddd',
        background: '#fff',
        borderRadius: '6px',
        cursor: 'pointer'
    },

    tableWrapper: {
        overflowX: 'auto'
    },

    table: {
        width: '100%',
        borderCollapse: 'collapse'
    },

    empty: {
        textAlign: 'center',
        padding: '50px',
        color: '#666'
    },

    status: {
        display: 'inline-block',
        padding: '6px 10px',
        borderRadius: '15px',
        fontSize: '12px',
        fontWeight: 'bold',
        textTransform: 'capitalize'
    },

    viewButton: {
        padding: '8px 14px',
        border: 'none',
        background: '#2563eb',
        color: '#fff',
        borderRadius: '6px',
        cursor: 'pointer'
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
        margin: '15px 0'
    }
}

export default EmployeeDashboard