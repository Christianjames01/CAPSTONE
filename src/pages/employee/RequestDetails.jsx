import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activityLog'
import { notifyStudentByStudentId } from '../../lib/notify'

function EmployeeRequestDetails() {
    const { requestId } = useParams()
    const navigate = useNavigate()

    const [request, setRequest] = useState(null)
    const [receipt, setReceipt] = useState(null)
    const [receiptUrl, setReceiptUrl] = useState('')
    const [student, setStudent] = useState(null)

    const [requirements, setRequirements] = useState([])
    const [requirementUrls, setRequirementUrls] = useState({})

    const [loading, setLoading] = useState(true)
    const [processing, setProcessing] = useState(false)
    const [requirementProcessing, setRequirementProcessing] = useState(false)

    const [rejectionReason, setRejectionReason] = useState('')
    const [showReject, setShowReject] = useState(false)

    const [selectedRequirement, setSelectedRequirement] = useState(null)

    const [errorMessage, setErrorMessage] = useState('')

    useEffect(() => {
        if (!requestId) {
            setErrorMessage('Request ID is missing.')
            setLoading(false)
            return
        }

        loadRequest()
    }, [requestId])

    // ==========================================
    // LOAD REQUEST
    // ==========================================

    const loadRequest = async () => {
        try {
            setLoading(true)
            setErrorMessage('')
            setReceiptUrl('')
            setRequirementUrls({})

            const {
                data: { user },
                error: authError
            } = await supabase.auth.getUser()

            if (authError || !user) {
                throw new Error('You are not logged in.')
            }

            // ==========================================
            // EMPLOYEE
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
            // OFFICIAL RECEIPT
            // ==========================================

            const {
                data: receiptData,
                error: receiptError
            } = await supabase
                .from('official_receipts')
                .select(`
                    receipt_id,
                    request_id,
                    student_id,
                    receipt_number,
                    amount_paid,
                    receipt_file_name,
                    receipt_file_path,
                    receipt_file_url,
                    status,
                    uploaded_at,
                    verified_by,
                    verified_at,
                    rejection_reason,
                    remarks
                `)
                .eq(
                    'request_id',
                    requestId
                )
                .order(
                    'uploaded_at',
                    {
                        ascending: false
                    }
                )
                .limit(1)
                .maybeSingle()

            if (receiptError) {
                console.error(
                    'RECEIPT DATABASE ERROR:',
                    receiptError
                )
            }

            setReceipt(
                receiptData || null
            )

            // ==========================================
            // RECEIPT STORAGE URL
            // ==========================================

            if (
                receiptData &&
                receiptData.receipt_file_path
            ) {
                const {
                    data: signedUrlData,
                    error: signedUrlError
                } = await supabase.storage
                    .from('official-receipts')
                    .createSignedUrl(
                        receiptData.receipt_file_path,
                        3600
                    )

                if (signedUrlError) {
                    console.error(
                        'SIGNED RECEIPT URL ERROR:',
                        signedUrlError
                    )

                    setReceiptUrl('')
                } else {
                    setReceiptUrl(
                        signedUrlData?.signedUrl || ''
                    )
                }
            }

            // ==========================================
            // LOAD REQUIREMENTS
            // ==========================================

            await loadRequirements(requestId)

        } catch (error) {
            console.error(
                'EMPLOYEE REQUEST ERROR:',
                error
            )

            setErrorMessage(
                error.message ||
                'Failed to load request.'
            )
        } finally {
            setLoading(false)
        }
    }

    // ==========================================
    // LOAD REQUIREMENTS
    // ==========================================

    const loadRequirements = async (currentRequestId) => {
        try {
            const {
                data,
                error
            } = await supabase
                .from('request_requirements')
                .select(`
                    request_requirement_id,
                    request_id,
                    requirement_id,
                    file_name,
                    file_path,
                    file_url,
                    status,
                    uploaded_at,
                    reviewed_by,
                    reviewed_at,
                    rejection_reason,
                    created_at,
                    document_requirements (
                        requirement_id,
                        document_type_id,
                        requirement_name,
                        description,
                        is_required,
                        accepted_file_types,
                        max_file_size_mb
                    )
                `)
                .eq(
                    'request_id',
                    currentRequestId
                )
                .order(
                    'created_at',
                    {
                        ascending: true
                    }
                )

            if (error) {
                console.error(
                    'REQUIREMENTS ERROR:',
                    error
                )

                setRequirements([])
                return
            }

            setRequirements(data || [])

            // ==========================================
            // CREATE SIGNED URL FOR EACH FILE
            // ==========================================

            const urls = {}

            for (const requirement of data || []) {
                if (
                    requirement.file_path &&
                    ['uploaded', 'approved', 'rejected'].includes(
                        requirement.status
                    )
                ) {
                    const {
                        data: signedData,
                        error: signedError
                    } = await supabase.storage
                        .from('student-requirements')
                        .createSignedUrl(
                            requirement.file_path,
                            3600
                        )

                    if (
                        !signedError &&
                        signedData?.signedUrl
                    ) {
                        urls[
                            requirement.request_requirement_id
                        ] = signedData.signedUrl
                    }
                }
            }

            setRequirementUrls(urls)

        } catch (error) {
            console.error(
                'LOAD REQUIREMENTS ERROR:',
                error
            )

            setRequirements([])
        }
    }

    // ==========================================
    // VERIFY PAYMENT
    // ==========================================

    const verifyPayment = async () => {
        if (!receipt) {
            alert(
                'There is no official receipt to verify.'
            )
            return
        }

        if (receipt.status !== 'uploaded') {
            alert(
                'This receipt has already been processed.'
            )
            return
        }

        const confirmed = window.confirm(
            'Are you sure you want to verify this payment?'
        )

        if (!confirmed) {
            return
        }

        try {
            setProcessing(true)

            const employee = await getCurrentEmployee()

            const {
                error: receiptUpdateError
            } = await supabase
                .from('official_receipts')
                .update({
                    status: 'verified',
                    verified_by:
                        employee.employee_id,
                    verified_at:
                        new Date().toISOString(),
                    rejection_reason: null
                })
                .eq(
                    'receipt_id',
                    receipt.receipt_id
                )
                .eq(
                    'request_id',
                    requestId
                )

            if (receiptUpdateError) {
                throw new Error(
                    'Failed to verify receipt: ' +
                    receiptUpdateError.message
                )
            }

            const {
                error: requestUpdateError
            } = await supabase
                .from('document_requests')
                .update({
                    status: 'receipt_verified',
                    rejection_reason: null,
                    updated_at:
                        new Date().toISOString()
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
                    'Receipt was verified but request status could not be updated: ' +
                    requestUpdateError.message
                )
            }

            await logActivity({
                employeeId: employee.employee_id,
                action: 'verify_payment',
                tableName: 'document_requests',
                recordId: requestId,
                description: `Verified payment for request ${request?.request_number || requestId}.`,
            })

            await notifyStudentByStudentId({
                studentId: request.student_id,
                title: 'Payment verified',
                message: `Your payment for request ${request.request_number} has been verified. Your document is now being processed.`,
                notificationType: 'request_update',
                relatedRequestId: requestId,
            })

            alert(
                'Payment verified successfully.'
            )

            await loadRequest()

        } catch (error) {
            console.error(
                'VERIFY PAYMENT ERROR:',
                error
            )

            alert(
                error.message ||
                'Failed to verify payment.'
            )
        } finally {
            setProcessing(false)
        }
    }

    // ==========================================
    // REJECT PAYMENT
    // ==========================================

    const rejectPayment = async () => {
        if (!receipt) {
            alert(
                'There is no official receipt to reject.'
            )
            return
        }

        if (!rejectionReason.trim()) {
            alert(
                'Please enter a rejection reason.'
            )
            return
        }

        const confirmed = window.confirm(
            'Are you sure you want to reject this payment?'
        )

        if (!confirmed) {
            return
        }

        try {
            setProcessing(true)

            const employee = await getCurrentEmployee()

            const {
                error: receiptUpdateError
            } = await supabase
                .from('official_receipts')
                .update({
                    status: 'rejected',
                    verified_by:
                        employee.employee_id,
                    verified_at:
                        new Date().toISOString(),
                    rejection_reason:
                        rejectionReason.trim()
                })
                .eq(
                    'receipt_id',
                    receipt.receipt_id
                )
                .eq(
                    'request_id',
                    requestId
                )

            if (receiptUpdateError) {
                throw new Error(
                    'Failed to reject receipt: ' +
                    receiptUpdateError.message
                )
            }

            const {
                error: requestUpdateError
            } = await supabase
                .from('document_requests')
                .update({
                    status: 'rejected',
                    rejection_reason:
                        rejectionReason.trim(),
                    employee_remarks:
                        rejectionReason.trim(),
                    updated_at:
                        new Date().toISOString()
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
                    'Receipt was rejected but request status could not be updated: ' +
                    requestUpdateError.message
                )
            }

            await logActivity({
                employeeId: employee.employee_id,
                action: 'reject_payment',
                tableName: 'document_requests',
                recordId: requestId,
                description: `Rejected payment for request ${request?.request_number || requestId}: ${rejectionReason.trim()}`,
            })

            await notifyStudentByStudentId({
                studentId: request.student_id,
                title: 'Payment rejected',
                message: `Your payment for request ${request.request_number} was rejected: ${rejectionReason.trim()}`,
                notificationType: 'payment',
                relatedRequestId: requestId,
            })

            alert(
                'Payment rejected successfully.'
            )

            setShowReject(false)
            setRejectionReason('')

            await loadRequest()

        } catch (error) {
            console.error(
                'REJECT PAYMENT ERROR:',
                error
            )

            alert(
                error.message ||
                'Failed to reject payment.'
            )
        } finally {
            setProcessing(false)
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
                'Employee record not found.'
            )
        }

        return employee
    }

    // ==========================================
    // APPROVE REQUIREMENT
    // ==========================================

    const approveRequirement = async (
        requirement
    ) => {
        if (
            requirement.status !== 'uploaded'
        ) {
            alert(
                'Only uploaded requirements can be approved.'
            )
            return
        }

        const confirmed = window.confirm(
            `Approve "${requirement.document_requirements?.requirement_name || 'this requirement'}"?`
        )

        if (!confirmed) {
            return
        }

        try {
            setRequirementProcessing(true)

            const employee =
                await getCurrentEmployee()

            const {
                error
            } = await supabase
                .from('request_requirements')
                .update({
                    status: 'approved',
                    reviewed_by:
                        employee.employee_id,
                    reviewed_at:
                        new Date().toISOString(),
                    rejection_reason: null
                })
                .eq(
                    'request_requirement_id',
                    requirement.request_requirement_id
                )
                .eq(
                    'request_id',
                    requestId
                )

            if (error) {
                throw new Error(
                    'Failed to approve requirement: ' +
                    error.message
                )
            }

            await logActivity({
                employeeId: employee.employee_id,
                action: 'approve_requirement',
                tableName: 'request_requirements',
                recordId: requirement.request_requirement_id,
                description: `Approved "${requirement.document_requirements?.requirement_name || 'requirement'}" for request ${request?.request_number || requestId}.`,
            })

            alert(
                'Requirement approved.'
            )

            await loadRequirements(requestId)

        } catch (error) {
            console.error(
                'APPROVE REQUIREMENT ERROR:',
                error
            )

            alert(
                error.message ||
                'Failed to approve requirement.'
            )
        } finally {
            setRequirementProcessing(false)
        }
    }

    // ==========================================
    // REJECT REQUIREMENT
    // ==========================================

    const rejectRequirement = async () => {
        if (!selectedRequirement) {
            return
        }

        if (!rejectionReason.trim()) {
            alert(
                'Please enter a rejection reason.'
            )
            return
        }

        try {
            setRequirementProcessing(true)

            const employee =
                await getCurrentEmployee()

            const {
                error
            } = await supabase
                .from('request_requirements')
                .update({
                    status: 'rejected',
                    reviewed_by:
                        employee.employee_id,
                    reviewed_at:
                        new Date().toISOString(),
                    rejection_reason:
                        rejectionReason.trim()
                })
                .eq(
                    'request_requirement_id',
                    selectedRequirement.request_requirement_id
                )
                .eq(
                    'request_id',
                    requestId
                )

            if (error) {
                throw new Error(
                    'Failed to reject requirement: ' +
                    error.message
                )
            }

            await logActivity({
                employeeId: employee.employee_id,
                action: 'reject_requirement',
                tableName: 'request_requirements',
                recordId: selectedRequirement.request_requirement_id,
                description: `Rejected "${selectedRequirement.document_requirements?.requirement_name || 'requirement'}" for request ${request?.request_number || requestId}: ${rejectionReason.trim()}`,
            })

            await notifyStudentByStudentId({
                studentId: request.student_id,
                title: 'Requirement rejected',
                message: `"${selectedRequirement.document_requirements?.requirement_name || 'A requirement'}" for request ${request.request_number} was rejected: ${rejectionReason.trim()}. Please re-upload it.`,
                notificationType: 'requirement',
                relatedRequestId: requestId,
            })

            alert(
                'Requirement rejected.'
            )

            setSelectedRequirement(null)
            setShowReject(false)
            setRejectionReason('')

            await loadRequirements(requestId)

        } catch (error) {
            console.error(
                'REJECT REQUIREMENT ERROR:',
                error
            )

            alert(
                error.message ||
                'Failed to reject requirement.'
            )
        } finally {
            setRequirementProcessing(false)
        }
    }

    // ==========================================
    // CHECK REQUIREMENTS
    // ==========================================

    const getRequirementState = () => {
        const requiredRequirements =
            requirements.filter(
                requirement =>
                    requirement
                        .document_requirements
                        ?.is_required === true
            )

        if (requiredRequirements.length === 0) {
            return {
                hasRequirements: false,
                allApproved: false,
                pending: false,
                rejected: false,
                uploaded: false
            }
        }

        const pending =
            requiredRequirements.some(
                requirement =>
                    requirement.status === 'pending'
            )

        const uploaded =
            requiredRequirements.some(
                requirement =>
                    requirement.status === 'uploaded'
            )

        const rejected =
            requiredRequirements.some(
                requirement =>
                    requirement.status === 'rejected'
            )

        const allApproved =
            requiredRequirements.every(
                requirement =>
                    requirement.status === 'approved' ||
                    requirement.status === 'not_applicable'
            )

        return {
            hasRequirements: true,
            allApproved,
            pending,
            rejected,
            uploaded
        }
    }

    // ==========================================
    // START DOCUMENT PROCESSING
    // ==========================================

    const startProcessing = async () => {
        if (!request) {
            return
        }

        if (
            request.status !== 'receipt_verified'
        ) {
            alert(
                'This request is not ready for document processing.'
            )
            return
        }

        const requirementState =
            getRequirementState()

        if (
            !requirementState.hasRequirements
        ) {
            alert(
                'No required documents have been created for this request yet.'
            )
            return
        }

        if (
            !requirementState.allApproved
        ) {
            if (requirementState.rejected) {
                alert(
                    'A required document has been rejected. The student must submit a new document before processing can start.'
                )
            } else if (
                requirementState.pending ||
                requirementState.uploaded
            ) {
                alert(
                    'Not all required documents have been approved yet.'
                )
            } else {
                alert(
                    'All required documents must be approved before processing.'
                )
            }

            return
        }

        const confirmed = window.confirm(
            'All required documents are approved. Start document processing for this request?'
        )

        if (!confirmed) {
            return
        }

        try {
            setProcessing(true)

            const employee =
                await getCurrentEmployee()

            const {
                error
            } = await supabase
                .from('document_requests')
                .update({
                    status: 'processing',
                    processed_at:
                        new Date().toISOString(),
                    rejection_reason: null,
                    employee_remarks:
                        'Document processing started.',
                    updated_at:
                        new Date().toISOString()
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
                    'receipt_verified'
                )

            if (error) {
                throw new Error(
                    'Failed to start document processing: ' +
                    error.message
                )
            }

            await logActivity({
                employeeId: employee.employee_id,
                action: 'start_processing',
                tableName: 'document_requests',
                recordId: requestId,
                description: `Started document processing for request ${request?.request_number || requestId}.`,
            })

            alert(
                'Document processing has started.'
            )

            await loadRequest()

        } catch (error) {
            console.error(
                'START PROCESSING ERROR:',
                error
            )

            alert(
                error.message ||
                'Failed to start document processing.'
            )
        } finally {
            setProcessing(false)
        }
    }

    // ==========================================
    // GENERATE DIGITAL CREDENTIAL
    // ==========================================

    const generateDigitalCredential = async () => {
        if (!request) {
            return
        }

        if (request.status !== 'processing') {
            alert(
                'This request is not currently being processed.'
            )
            return
        }

        const confirmed = window.confirm(
            'Have you verified the student record and prepared the requested academic document?'
        )

        if (!confirmed) {
            return
        }

        try {
            setProcessing(true)

            const employee =
                await getCurrentEmployee()

            const credentialNumber =
                `CERT-${Date.now()}-${Math.floor(
                    Math.random() * 10000
                )}`

            // ==========================================
            // CREATE CREDENTIAL RECORD
            // ==========================================

            const {
                data: credential,
                error: credentialError
            } = await supabase
                .from('credentials')
                .insert({
                    request_id:
                        request.request_id,
                    student_id:
                        request.student_id,
                    document_type_id:
                        request.document_type_id,
                    credential_number:
                        credentialNumber,
                    status: 'generated',
                    generated_by:
                        employee.employee_id,
                    generated_at:
                        new Date().toISOString()
                })
                .select()
                .single()

            if (credentialError) {
                throw new Error(
                    'Failed to create credential record: ' +
                    credentialError.message
                )
            }

            // ==========================================
            // UPDATE REQUEST STATUS
            // ==========================================

            const {
                error: requestError
            } = await supabase
                .from('document_requests')
                .update({
                    status:
                        'digital_credential',
                    employee_remarks:
                        'Digital credential generated and recorded.',
                    updated_at:
                        new Date().toISOString()
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
                    'processing'
                )

            if (requestError) {
                throw new Error(
                    'Credential was created but request status could not be updated: ' +
                    requestError.message
                )
            }

            await logActivity({
                employeeId: employee.employee_id,
                action: 'generate_credential',
                tableName: 'credentials',
                recordId: credential.credential_id,
                description: `Generated digital credential ${credentialNumber} for request ${request?.request_number || requestId}.`,
            })

            await notifyStudentByStudentId({
                studentId: request.student_id,
                title: 'Document ready',
                message: `Your document for request ${request.request_number} has been prepared. It will be scheduled for claiming shortly.`,
                notificationType: 'request_update',
                relatedRequestId: requestId,
            })

            alert(
                `Digital credential generated successfully.\n\nCredential Number: ${credentialNumber}`
            )

            await loadRequest()

        } catch (error) {
            console.error(
                'GENERATE DIGITAL CREDENTIAL ERROR:',
                error
            )

            alert(
                error.message ||
                'Failed to generate digital credential.'
            )
        } finally {
            setProcessing(false)
        }
    }

    // ==========================================
    // LOADING
    // ==========================================

    if (loading) {
        return (
            <div style={styles.page}>
                <div style={styles.card}>
                    <h2>
                        Loading request...
                    </h2>
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
                                '/employee/dashboard'
                            )
                        }
                        style={styles.backButton}
                    >
                        ← Back to Dashboard
                    </button>

                    <div style={styles.card}>

                        <h1>
                            Unable to Load Request
                        </h1>

                        <p style={styles.error}>
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

    if (!request) {
        return null
    }

    const requirementState =
        getRequirementState()

    // ==========================================
    // MAIN
    // ==========================================

    return (
        <div style={styles.page}>

            <div style={styles.container}>

                {/* BACK BUTTON */}

                <button
                    onClick={() =>
                        navigate(
                            '/employee/dashboard'
                        )
                    }
                    style={styles.backButton}
                >
                    ← Back to Dashboard
                </button>

                <h1 style={styles.title}>
                    Request Details
                </h1>

                <p style={styles.subtitle}>
                    Review the student's document request,
                    payment, and requirements.
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
                                Unit Fee
                            </p>

                            <p>
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

                            <p>
                                ₱
                                {Number(
                                    request.total_amount || 0
                                ).toFixed(2)}
                            </p>
                        </div>

                    </div>

                    <hr />

                    <h3>
                        Request Information
                    </h3>

                    <div style={styles.section}>

                        <p style={styles.label}>
                            Purpose
                        </p>

                        <p>
                            {request.purpose ||
                                'No purpose specified'}
                        </p>

                    </div>

                    {request.student_remarks && (
                        <div style={styles.section}>

                            <p style={styles.label}>
                                Student Remarks
                            </p>

                            <p>
                                {request.student_remarks}
                            </p>

                        </div>
                    )}

                    <div style={styles.section}>

                        <p style={styles.label}>
                            Requested At
                        </p>

                        <p>
                            {new Date(
                                request.requested_at
                            ).toLocaleString()}
                        </p>

                    </div>

                </div>

                {/* ==========================================
                    OFFICIAL RECEIPT
                ========================================== */}

                <div style={styles.card}>

                    <h2>
                        Official Receipt
                    </h2>

                    {!receipt ? (

                        <div style={styles.warning}>

                            <strong>
                                No Receipt Uploaded
                            </strong>

                            <p>
                                The student has not uploaded
                                an official receipt yet.
                            </p>

                        </div>

                    ) : (

                        <>

                            <div style={styles.receiptGrid}>

                                <div>
                                    <p style={styles.label}>
                                        Receipt Number
                                    </p>

                                    <p>
                                        {receipt.receipt_number ||
                                            'Not provided'}
                                    </p>
                                </div>

                                <div>
                                    <p style={styles.label}>
                                        Amount Paid
                                    </p>

                                    <p>
                                        ₱
                                        {Number(
                                            receipt.amount_paid || 0
                                        ).toFixed(2)}
                                    </p>
                                </div>

                                <div>
                                    <p style={styles.label}>
                                        Uploaded At
                                    </p>

                                    <p>
                                        {receipt.uploaded_at
                                            ? new Date(
                                                receipt.uploaded_at
                                            ).toLocaleString()
                                            : 'N/A'}
                                    </p>
                                </div>

                                <div>
                                    <p style={styles.label}>
                                        Receipt Status
                                    </p>

                                    <span
                                        style={{
                                            ...styles.status,
                                            ...getReceiptStatusStyle(
                                                receipt.status
                                            )
                                        }}
                                    >
                                        {receipt.status}
                                    </span>
                                </div>

                            </div>

                            <div style={styles.section}>

                                <p style={styles.label}>
                                    Receipt File
                                </p>

                                {receiptUrl ? (

                                    <a
                                        href={receiptUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={styles.fileButton}
                                    >
                                        View Official Receipt
                                    </a>

                                ) : (

                                    <div
                                        style={
                                            styles.dangerBox
                                        }
                                    >

                                        <strong>
                                            Receipt file could not
                                            be opened.
                                        </strong>

                                        <p>
                                            The receipt record exists,
                                            but the Storage file could
                                            not be opened.
                                        </p>

                                        <code
                                            style={
                                                styles.filePath
                                            }
                                        >
                                            {receipt.receipt_file_path ||
                                                'No file path'}
                                        </code>

                                        <button
                                            onClick={
                                                loadRequest
                                            }
                                            style={{
                                                ...styles.button,
                                                marginTop: '15px'
                                            }}
                                        >
                                            Retry
                                        </button>

                                    </div>

                                )}

                            </div>

                            {receipt.rejection_reason && (
                                <div
                                    style={
                                        styles.dangerBox
                                    }
                                >
                                    <strong>
                                        Rejection Reason
                                    </strong>

                                    <p>
                                        {
                                            receipt.rejection_reason
                                        }
                                    </p>
                                </div>
                            )}

                            {receipt.status === 'uploaded' && (
                                <div style={styles.actions}>

                                    <button
                                        onClick={
                                            verifyPayment
                                        }
                                        disabled={processing}
                                        style={
                                            styles.verifyButton
                                        }
                                    >
                                        {processing
                                            ? 'Processing...'
                                            : '✓ Verify Payment'}
                                    </button>

                                    <button
                                        onClick={() => {
                                            setShowReject(true)
                                            setSelectedRequirement(null)
                                            setRejectionReason('')
                                        }}
                                        disabled={processing}
                                        style={
                                            styles.rejectButton
                                        }
                                    >
                                        ✕ Reject Payment
                                    </button>

                                </div>
                            )}

                            {receipt.status === 'verified' && (
                                <div
                                    style={
                                        styles.success
                                    }
                                >
                                    <strong>
                                        Payment Verified
                                    </strong>

                                    <p>
                                        This official receipt
                                        has already been verified.
                                    </p>
                                </div>
                            )}

                            {receipt.status === 'rejected' && (
                                <div
                                    style={
                                        styles.dangerBox
                                    }
                                >
                                    <strong>
                                        Payment Rejected
                                    </strong>

                                    <p>
                                        This official receipt
                                        has been rejected.
                                    </p>
                                </div>
                            )}

                        </>

                    )}

                </div>

                {/* ==========================================
                    REQUIRED DOCUMENTS
                ========================================== */}

                <div style={styles.card}>

                    <div style={styles.requirementHeader}>

                        <div>

                            <h2>
                                Required Documents
                            </h2>

                            <p style={styles.subtitle}>
                                Review the student's submitted
                                requirements before processing.
                            </p>

                        </div>

                        <span
                            style={
                                styles.requirementCount
                            }
                        >
                            {requirements.length}
                            {' '}
                            Requirements
                        </span>

                    </div>

                    {requirements.length === 0 ? (

                        <div style={styles.warning}>

                            <strong>
                                No requirements found
                            </strong>

                            <p>
                                No request requirements have
                                been created for this request yet.
                            </p>

                        </div>

                    ) : (

                        <div style={styles.requirementList}>

                            {requirements.map(
                                requirement => {

                                    const definition =
                                        requirement
                                            .document_requirements

                                    const fileUrl =
                                        requirementUrls[
                                        requirement
                                            .request_requirement_id
                                        ]

                                    return (

                                        <div
                                            key={
                                                requirement
                                                    .request_requirement_id
                                            }
                                            style={
                                                styles.requirementCard
                                            }
                                        >

                                            <div
                                                style={
                                                    styles.requirementTop
                                                }
                                            >

                                                <div>

                                                    <h3
                                                        style={{
                                                            marginTop: 0
                                                        }}
                                                    >
                                                        {definition
                                                            ?.requirement_name ||
                                                            'Requirement'}
                                                    </h3>

                                                    <p
                                                        style={
                                                            styles.requirementDescription
                                                        }
                                                    >
                                                        {definition
                                                            ?.description ||
                                                            'No description provided.'}
                                                    </p>

                                                    {definition
                                                        ?.is_required && (
                                                            <span
                                                                style={
                                                                    styles.requiredBadge
                                                                }
                                                            >
                                                                Required
                                                            </span>
                                                        )}

                                                </div>

                                                <span
                                                    style={{
                                                        ...styles.status,
                                                        ...getRequirementStatusStyle(
                                                            requirement.status
                                                        )
                                                    }}
                                                >
                                                    {
                                                        requirement.status
                                                    }
                                                </span>

                                            </div>

                                            <hr />

                                            <div
                                                style={
                                                    styles.requirementInfo
                                                }
                                            >

                                                <div>

                                                    <p
                                                        style={
                                                            styles.label
                                                        }
                                                    >
                                                        File Name
                                                    </p>

                                                    <p>
                                                        {requirement.file_name ||
                                                            'No file uploaded'}
                                                    </p>

                                                </div>

                                                <div>

                                                    <p
                                                        style={
                                                            styles.label
                                                        }
                                                    >
                                                        Uploaded At
                                                    </p>

                                                    <p>
                                                        {requirement.uploaded_at
                                                            ? new Date(
                                                                requirement.uploaded_at
                                                            ).toLocaleString()
                                                            : 'Not uploaded'}
                                                    </p>

                                                </div>

                                            </div>

                                            {requirement.rejection_reason && (
                                                <div
                                                    style={
                                                        styles.dangerBox
                                                    }
                                                >

                                                    <strong>
                                                        Rejection Reason
                                                    </strong>

                                                    <p>
                                                        {
                                                            requirement.rejection_reason
                                                        }
                                                    </p>

                                                </div>
                                            )}

                                            <div
                                                style={
                                                    styles.actions
                                                }
                                            >

                                                {fileUrl && (
                                                    <a
                                                        href={fileUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={
                                                            styles.fileButton
                                                        }
                                                    >
                                                        View Document
                                                    </a>
                                                )}

                                                {requirement.status ===
                                                    'uploaded' && (
                                                        <>

                                                            <button
                                                                onClick={() =>
                                                                    approveRequirement(
                                                                        requirement
                                                                    )
                                                                }
                                                                disabled={
                                                                    requirementProcessing
                                                                }
                                                                style={
                                                                    styles.verifyButton
                                                                }
                                                            >
                                                                {requirementProcessing
                                                                    ? 'Processing...'
                                                                    : '✓ Approve'}
                                                            </button>

                                                            <button
                                                                onClick={() => {
                                                                    setSelectedRequirement(
                                                                        requirement
                                                                    )
                                                                    setRejectionReason(
                                                                        ''
                                                                    )
                                                                    setShowReject(
                                                                        true
                                                                    )
                                                                }}
                                                                disabled={
                                                                    requirementProcessing
                                                                }
                                                                style={
                                                                    styles.rejectButton
                                                                }
                                                            >
                                                                ✕ Reject
                                                            </button>

                                                        </>
                                                    )}

                                            </div>

                                        </div>

                                    )
                                }
                            )}

                        </div>

                    )}

                    {/* REQUIREMENT SUMMARY */}

                    {requirements.length > 0 && (
                        <div
                            style={
                                styles.requirementSummary
                            }
                        >

                            <strong>
                                Requirement Review
                            </strong>

                            {requirementState.allApproved ? (

                                <p style={styles.successText}>
                                    ✓ All required documents
                                    have been approved.
                                    This request is ready
                                    for document processing.
                                </p>

                            ) : requirementState.rejected ? (

                                <p style={styles.errorText}>
                                    ✕ One or more required
                                    documents have been rejected.
                                    The student must submit
                                    a replacement.
                                </p>

                            ) : requirementState.pending ? (

                                <p style={styles.warningText}>
                                    ⚠ Some required documents
                                    are still waiting for the
                                    student to upload them.
                                </p>

                            ) : (

                                <p style={styles.warningText}>
                                    ⚠ Some uploaded documents
                                    still need to be reviewed.
                                </p>

                            )}

                        </div>
                    )}

                </div>

                {/* ==========================================
                    START PROCESSING
                ========================================== */}

                {request.status === 'receipt_verified' && (
                    <div style={styles.card}>

                        <h2>
                            Document Processing
                        </h2>

                        <p>
                            Once the payment and all required
                            documents are verified, you can
                            begin processing the requested
                            academic document.
                        </p>

                        {!requirementState.hasRequirements && (
                            <div style={styles.warning}>

                                <strong>
                                    Requirements are not ready
                                </strong>

                                <p>
                                    Create the request's required
                                    documents before starting
                                    processing.
                                </p>

                            </div>
                        )}

                        {requirementState.hasRequirements &&
                            !requirementState.allApproved && (
                                <div style={styles.warning}>

                                    <strong>
                                        Processing is not available yet.
                                    </strong>

                                    <p>
                                        All required documents must
                                        be approved before processing
                                        can begin.
                                    </p>

                                </div>
                            )}

                        {requirementState.allApproved && (
                            <div style={styles.readyBox}>

                                <strong>
                                    ✓ Ready for Document Processing
                                </strong>

                                <p>
                                    Payment is verified and all
                                    required documents have been
                                    approved.
                                </p>

                                <button
                                    onClick={
                                        startProcessing
                                    }
                                    disabled={processing}
                                    style={
                                        styles.processButton
                                    }
                                >
                                    {processing
                                        ? 'Starting Processing...'
                                        : '▶ Start Document Processing'}
                                </button>

                            </div>
                        )}

                    </div>
                )}

                {/* ==========================================
                    PROCESSING STATUS
                ========================================== */}

                {request.status === 'processing' && (
                    <div style={styles.card}>

                        <div style={styles.processingBox}>

                            <h2>
                                Document Processing
                            </h2>

                            <strong>
                                Processing has started.
                            </strong>

                            <p>
                                The registrar employee can now
                                prepare the student's requested
                                academic document.
                            </p>

                            {request.processed_at && (
                                <p>
                                    <strong>
                                        Processing Started:
                                    </strong>
                                    {' '}
                                    {new Date(
                                        request.processed_at
                                    ).toLocaleString()}
                                </p>
                            )}

                            <button
                                onClick={
                                    generateDigitalCredential
                                }
                                disabled={processing}
                                style={
                                    styles.processButton
                                }
                            >
                                {processing
                                    ? 'Generating Credential...'
                                    : '📄 Generate Digital Credential'}
                            </button>

                        </div>

                    </div>
                )}

                {/* ==========================================
                    DIGITAL CREDENTIAL
                ========================================== */}

                {request.status === 'digital_credential' && (
                    <div style={styles.card}>

                        <h2>
                            Digital Credential
                        </h2>

                        <div style={styles.readyBox}>

                            <strong>
                                ✓ Digital Credential Generated
                            </strong>

                            <p>
                                The requested academic document
                                has been prepared successfully.
                            </p>

                            <p>
                                The next step is to schedule the
                                student's claiming date and time.
                            </p>

                            <button
                                onClick={() =>
                                    navigate(
                                        `/employee/requests/${request.request_id}/claim-schedule`
                                    )
                                }
                                style={styles.processButton}
                            >
                                📅 Schedule Claiming
                            </button>

                        </div>

                    </div>
                )}

                {/* ==========================================
                    REJECTION FORM
                ========================================== */}

                {showReject && (
                    <div style={styles.card}>

                        <h2>
                            {selectedRequirement
                                ? 'Reject Requirement'
                                : 'Reject Payment'}
                        </h2>

                        <p>
                            {selectedRequirement
                                ? `Enter the reason why "${selectedRequirement.document_requirements?.requirement_name || 'this requirement'}" is being rejected.`
                                : 'Enter the reason why the official receipt is being rejected.'}
                        </p>

                        <textarea
                            value={rejectionReason}
                            onChange={event =>
                                setRejectionReason(
                                    event.target.value
                                )
                            }
                            placeholder={
                                selectedRequirement
                                    ? 'Example: School ID is blurry and cannot be verified.'
                                    : 'Enter rejection reason...'
                            }
                            style={styles.textarea}
                        />

                        <div style={styles.actions}>

                            <button
                                onClick={() => {
                                    setShowReject(false)
                                    setSelectedRequirement(null)
                                    setRejectionReason('')
                                }}
                                style={
                                    styles.cancelButton
                                }
                            >
                                Cancel
                            </button>

                            <button
                                onClick={
                                    selectedRequirement
                                        ? rejectRequirement
                                        : rejectPayment
                                }
                                disabled={
                                    processing ||
                                    requirementProcessing
                                }
                                style={
                                    styles.rejectButton
                                }
                            >
                                {processing ||
                                    requirementProcessing
                                    ? 'Rejecting...'
                                    : 'Confirm Rejection'}
                            </button>

                        </div>

                    </div>
                )}

            </div>

        </div>
    )
}

// ==========================================
// REQUEST STATUS STYLE
// ==========================================

function getStatusStyle(status) {
    switch (status) {

        case 'receipt_uploaded':
        case 'uploaded':
            return {
                background: '#fff3cd',
                color: '#856404'
            }

        case 'receipt_verified':
        case 'verified':
            return {
                background: '#d1e7dd',
                color: '#0f5132'
            }

        case 'processing':
            return {
                background: '#cfe2ff',
                color: '#084298'
            }

        case 'digital_credential':
            return {
                background: '#e2d9f3',
                color: '#432874'
            }

        case 'ready_for_claiming':
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

// ==========================================
// RECEIPT STATUS STYLE
// ==========================================

function getReceiptStatusStyle(status) {
    switch (status) {

        case 'uploaded':
            return {
                background: '#fff3cd',
                color: '#856404'
            }

        case 'verified':
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

// ==========================================
// REQUIREMENT STATUS STYLE
// ==========================================

function getRequirementStatusStyle(status) {
    switch (status) {

        case 'pending':
            return {
                background: '#fff3cd',
                color: '#856404'
            }

        case 'uploaded':
            return {
                background: '#cfe2ff',
                color: '#084298'
            }

        case 'approved':
            return {
                background: '#d1e7dd',
                color: '#0f5132'
            }

        case 'rejected':
            return {
                background: '#f8d7da',
                color: '#842029'
            }

        case 'not_applicable':
            return {
                background: '#e9ecef',
                color: '#333'
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
        cursor: 'pointer'
    },

    title: {
        marginTop: '25px',
        marginBottom: '5px'
    },

    subtitle: {
        color: '#666'
    },

    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '20px'
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

    receiptGrid: {
        display: 'grid',
        gridTemplateColumns:
            'repeat(4, 1fr)',
        gap: '20px'
    },

    label: {
        fontSize: '13px',
        color: '#777',
        marginBottom: '5px'
    },

    section: {
        marginTop: '20px'
    },

    actions: {
        display: 'flex',
        gap: '10px',
        marginTop: '25px',
        flexWrap: 'wrap'
    },

    verifyButton: {
        padding: '12px 20px',
        border: 'none',
        background: '#198754',
        color: '#fff',
        borderRadius: '7px',
        cursor: 'pointer',
        fontWeight: '600'
    },

    rejectButton: {
        padding: '12px 20px',
        border: 'none',
        background: '#dc3545',
        color: '#fff',
        borderRadius: '7px',
        cursor: 'pointer',
        fontWeight: '600'
    },

    cancelButton: {
        padding: '12px 20px',
        border: '1px solid #ddd',
        background: '#fff',
        borderRadius: '7px',
        cursor: 'pointer'
    },

    fileButton: {
        display: 'inline-block',
        padding: '10px 16px',
        background: '#2563eb',
        color: '#fff',
        textDecoration: 'none',
        borderRadius: '6px',
        fontWeight: '600'
    },

    filePath: {
        display: 'block',
        background: '#f1f3f5',
        padding: '10px',
        borderRadius: '6px',
        wordBreak: 'break-all',
        fontSize: '12px'
    },

    textarea: {
        width: '100%',
        minHeight: '120px',
        padding: '12px',
        border: '1px solid #ccc',
        borderRadius: '7px',
        resize: 'vertical',
        boxSizing: 'border-box',
        marginTop: '10px'
    },

    warning: {
        padding: '15px',
        background: '#fff3cd',
        borderRadius: '7px',
        color: '#664d03'
    },

    success: {
        padding: '15px',
        background: '#d1e7dd',
        color: '#0f5132',
        borderRadius: '7px',
        marginTop: '20px'
    },

    dangerBox: {
        padding: '15px',
        background: '#f8d7da',
        color: '#842029',
        borderRadius: '7px',
        marginTop: '20px'
    },

    error: {
        color: '#b00020'
    },

    button: {
        padding: '10px 18px',
        border: 'none',
        background: '#222',
        color: '#fff',
        borderRadius: '6px',
        cursor: 'pointer'
    },

    requirementHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '20px',
        flexWrap: 'wrap'
    },

    requirementCount: {
        padding: '8px 14px',
        borderRadius: '20px',
        background: '#e9ecef',
        fontWeight: '600',
        fontSize: '13px'
    },

    requirementList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '15px',
        marginTop: '20px'
    },

    requirementCard: {
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '20px',
        background: '#fafafa'
    },

    requirementTop: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '20px'
    },

    requirementDescription: {
        color: '#666',
        marginTop: '5px'
    },

    requiredBadge: {
        display: 'inline-block',
        background: '#f8d7da',
        color: '#842029',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '11px',
        fontWeight: '600'
    },

    requirementInfo: {
        display: 'grid',
        gridTemplateColumns:
            'repeat(2, 1fr)',
        gap: '20px'
    },

    requirementSummary: {
        marginTop: '25px',
        padding: '20px',
        borderRadius: '8px',
        background: '#f8f9fa',
        border: '1px solid #ddd'
    },

    successText: {
        color: '#0f5132'
    },

    warningText: {
        color: '#856404'
    },

    errorText: {
        color: '#842029'
    },

    readyBox: {
        marginTop: '20px',
        padding: '20px',
        borderRadius: '8px',
        background: '#d1e7dd',
        color: '#0f5132',
        border: '1px solid #a3cfbb'
    },

    processButton: {
        marginTop: '15px',
        padding: '13px 22px',
        border: 'none',
        background: '#0d6efd',
        color: '#fff',
        borderRadius: '7px',
        cursor: 'pointer',
        fontWeight: '600',
        fontSize: '15px'
    },

    processingBox: {
        padding: '20px',
        borderRadius: '8px',
        background: '#cfe2ff',
        color: '#084298',
        border: '1px solid #9ec5fe'
    }
}

export default EmployeeRequestDetails