import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activityLog'
import { notifyStudentByStudentId, notifySuccess, notifyError, notifyWarning, confirmModal } from '../../lib/notify'
import { SkeletonPageHeader, SkeletonDetailCard } from '../../components/Skeleton'
import DocumentPreviewModal from '../../components/DocumentPreviewModal'
import './EmployeePages.css'

// Statuses where the request is still awaiting something and hasn't been
// flagged yet -- these are the ones eligible for the "overdue" warning.
const OVERDUE_ELIGIBLE_STATUSES = [
    'pending', 'payment_pending', 'receipt_uploaded', 'receipt_verified', 'processing',
]
const OVERDUE_DAYS = 2

function EmployeeRequestDetails() {
    const { requestId } = useParams()
    const navigate = useNavigate()

    const [request, setRequest] = useState(null)
    const [documentName, setDocumentName] = useState('')
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

    const [manualStatus, setManualStatus] = useState('')
    const [statusReason, setStatusReason] = useState('')
    const [changingStatus, setChangingStatus] = useState(false)

    const [previewFile, setPreviewFile] = useState(null)

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
            setManualStatus(requestData.status)

            if (requestData.document_type_id) {
                const { data: doc } = await supabase
                    .from('document_types')
                    .select('document_name')
                    .eq('document_type_id', requestData.document_type_id)
                    .single()

                setDocumentName(doc?.document_name || 'Document')
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
            notifyWarning(
                'There is no official receipt to verify.'
            )
            return
        }

        if (receipt.status !== 'uploaded') {
            notifyWarning(
                'This receipt has already been processed.'
            )
            return
        }

        const confirmed = await confirmModal(
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
                description: `Verified payment for request "${request?.request_number || requestId}".`,
            })

            await notifyStudentByStudentId({
                studentId: request.student_id,
                title: 'Payment verified',
                message: `Your payment for request ${request.request_number} has been verified. Your document is now being processed.`,
                notificationType: 'request_update',
                relatedRequestId: requestId,
            })

            notifySuccess(
                'Payment verified successfully.'
            )

            await loadRequest()

        } catch (error) {
            console.error(
                'VERIFY PAYMENT ERROR:',
                error
            )

            notifyError(
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
            notifyWarning(
                'There is no official receipt to reject.'
            )
            return
        }

        if (!rejectionReason.trim()) {
            notifyWarning(
                'Please enter a rejection reason.'
            )
            return
        }

        const confirmed = await confirmModal(
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
                description: `Rejected payment for request "${request?.request_number || requestId}": "${rejectionReason.trim()}"`,
            })

            await notifyStudentByStudentId({
                studentId: request.student_id,
                title: 'Payment rejected',
                message: `Your payment for request ${request.request_number} was rejected: ${rejectionReason.trim()}`,
                notificationType: 'payment',
                relatedRequestId: requestId,
            })

            notifySuccess(
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

            notifyError(
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
            notifyWarning(
                'Only uploaded requirements can be approved.'
            )
            return
        }

        const confirmed = await confirmModal(
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
                description: `Approved "${requirement.document_requirements?.requirement_name || 'requirement'}" for request "${request?.request_number || requestId}".`,
            })

            notifySuccess(
                'Requirement approved.'
            )

            await loadRequirements(requestId)

        } catch (error) {
            console.error(
                'APPROVE REQUIREMENT ERROR:',
                error
            )

            notifyError(
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
            notifyWarning(
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
                description: `Rejected "${selectedRequirement.document_requirements?.requirement_name || 'requirement'}" for request "${request?.request_number || requestId}": "${rejectionReason.trim()}"`,
            })

            await notifyStudentByStudentId({
                studentId: request.student_id,
                title: 'Requirement rejected',
                message: `"${selectedRequirement.document_requirements?.requirement_name || 'A requirement'}" for request ${request.request_number} was rejected: ${rejectionReason.trim()}. Please re-upload it.`,
                notificationType: 'requirement',
                relatedRequestId: requestId,
            })

            notifySuccess(
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

            notifyError(
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
            notifyWarning(
                'This request is not ready for document processing.'
            )
            return
        }

        const requirementState =
            getRequirementState()

        if (
            !requirementState.hasRequirements
        ) {
            notifyWarning(
                'No required documents have been created for this request yet.'
            )
            return
        }

        if (
            !requirementState.allApproved
        ) {
            if (requirementState.rejected) {
                notifyWarning(
                    'A required document has been rejected. The student must submit a new document before processing can start.'
                )
            } else if (
                requirementState.pending ||
                requirementState.uploaded
            ) {
                notifyWarning(
                    'Not all required documents have been approved yet.'
                )
            } else {
                notifyWarning(
                    'All required documents must be approved before processing.'
                )
            }

            return
        }

        const confirmed = await confirmModal(
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
                description: `Started document processing for request "${request?.request_number || requestId}".`,
            })

            notifySuccess(
                'Document processing has started.'
            )

            await loadRequest()

        } catch (error) {
            console.error(
                'START PROCESSING ERROR:',
                error
            )

            notifyError(
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
            notifyWarning(
                'This request is not currently being processed.'
            )
            return
        }

        const confirmed = await confirmModal(
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
                        'ready_for_claiming',
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
                description: `Generated digital credential "${credentialNumber}" for request "${request?.request_number || requestId}".`,
            })

            await notifyStudentByStudentId({
                studentId: request.student_id,
                title: 'Ready to claim',
                message: `Your document for request ${request.request_number} is ready to claim. You'll be notified separately once a claiming date and time is scheduled.`,
                notificationType: 'request_update',
                relatedRequestId: requestId,
            })

            notifySuccess(
                `Digital credential generated successfully.\n\nCredential Number: ${credentialNumber}`
            )

            await loadRequest()

        } catch (error) {
            console.error(
                'GENERATE DIGITAL CREDENTIAL ERROR:',
                error
            )

            notifyError(
                error.message ||
                'Failed to generate digital credential.'
            )
        } finally {
            setProcessing(false)
        }
    }

    // ==========================================
    // CHANGE STATUS (MANUAL)
    // ==========================================

    const applyStatusChange = async (targetStatus, reasonText) => {
        try {
            setChangingStatus(true)

            const employee = await getCurrentEmployee()
            const reason = (reasonText || '').trim()

            const { error: updateError } = await supabase
                .from('document_requests')
                .update({
                    status: targetStatus,
                    rejection_reason: targetStatus === 'rejected' ? (reason || null) : request.rejection_reason,
                    employee_remarks: reason || request.employee_remarks,
                    updated_at: new Date().toISOString(),
                })
                .eq('request_id', requestId)
                .eq('assigned_employee_id', employee.employee_id)

            if (updateError) {
                throw new Error('Failed to change status: ' + updateError.message)
            }

            await logActivity({
                employeeId: employee.employee_id,
                action: 'change_status',
                tableName: 'document_requests',
                recordId: requestId,
                description: `Changed request "${request?.request_number || requestId}" status from "${request.status}" to "${targetStatus}".${reason ? ' "' + reason + '"' : ''}`,
            })

            await notifyStudentByStudentId({
                studentId: request.student_id,
                title: targetStatus === 'ready_for_claiming' ? 'Ready to claim' : 'Request status updated',
                message: targetStatus === 'ready_for_claiming'
                    ? `Your document for request ${request.request_number} is ready to claim. You'll be notified separately once a claiming date and time is scheduled.`
                    : `Your request ${request.request_number} status was updated to "${targetStatus.replace(/_/g, ' ')}".${reason ? ' ' + reason : ''}`,
                notificationType: 'request_update',
                relatedRequestId: requestId,
            })

            setStatusReason('')
            notifySuccess('Status updated.')
            await loadRequest()

        } catch (error) {
            console.error('CHANGE STATUS ERROR:', error)
            notifyError(error.message || 'Failed to change status.')
        } finally {
            setChangingStatus(false)
        }
    }

    const changeStatus = async () => {
        if (!manualStatus || manualStatus === request.status) {
            return
        }

        const confirmed = await confirmModal(
            `Change this request's status from "${request.status.replace(/_/g, ' ')}" to "${manualStatus.replace(/_/g, ' ')}"?`
        )

        if (!confirmed) {
            return
        }

        await applyStatusChange(manualStatus, statusReason)
    }

    // Quick action from the "overdue" warning banner -- skips the generic
    // dropdown and asks directly for what's missing.
    const flagLackingRequirements = async () => {
        const { value: reason } = await Swal.fire({
            title: 'Flag as Lacking Requirements',
            input: 'text',
            inputLabel: 'What is missing? (shown to the student)',
            inputPlaceholder: 'e.g. Certificate of Registration not yet uploaded',
            showCancelButton: true,
            confirmButtonText: 'Flag Request',
            confirmButtonColor: '#eda100',
        })

        if (!reason) return

        await applyStatusChange('lacking_requirements', reason)
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
                <button className="employee-link-button" style={{ marginBottom: 16 }} onClick={() => navigate('/employee/dashboard')}>
                    ← Back to Dashboard
                </button>

                <div className="employee-card">
                    <h2 style={{ fontSize: 16, marginBottom: 12 }}>Unable to Load Request</h2>
                    <div className="employee-error-box">{errorMessage}</div>
                    <button className="employee-primary-button" onClick={loadRequest}>
                        Try Again
                    </button>
                </div>
            </div>
        )
    }

    if (!request) {
        return null
    }

    const requirementState =
        getRequirementState()

    const daysSinceRequested = request.requested_at
        ? Math.floor((Date.now() - new Date(request.requested_at).getTime()) / (1000 * 60 * 60 * 24))
        : 0

    const isOverdue = daysSinceRequested >= OVERDUE_DAYS && OVERDUE_ELIGIBLE_STATUSES.includes(request.status)

    // ==========================================
    // MAIN
    // ==========================================

    return (
        <div>
            <button className="employee-link-button" style={{ marginBottom: 16 }} onClick={() => navigate('/employee/dashboard')}>
                ← Back to Dashboard
            </button>

            <div className="employee-page-header">
                <h1>{documentName || 'Request Details'}</h1>
                <p>Review the student's document request, payment, and requirements.</p>
            </div>

            {isOverdue && (
                <div className="employee-notice tone-warning" style={{ marginBottom: 20 }}>
                    <strong>Pending for {daysSinceRequested} days</strong>
                    <p style={{ marginBottom: 12 }}>
                        This request hasn't moved in {daysSinceRequested} days. If the student is missing something, flag it as Lacking Requirements to let them know what's needed.
                    </p>
                    <button
                        className="employee-primary-button"
                        style={{ background: '#856404' }}
                        onClick={flagLackingRequirements}
                        disabled={changingStatus}
                    >
                        Flag as Lacking Requirements
                    </button>
                </div>
            )}

            {/* ==========================================
                REQUEST INFORMATION
            ========================================== */}

            <div className="employee-card">
                <div className="employee-list-card-header" style={{ marginBottom: 16 }}>
                    <div>
                        <p style={{ fontSize: 12, color: 'var(--slate)', marginBottom: 4 }}>Request Number</p>
                        <h2 style={{ fontSize: 18 }}>{request.request_number}</h2>
                    </div>

                    <span className={`employee-status-pill status-${request.status}`}>
                        {request.status.replace(/_/g, ' ')}
                    </span>
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '16px 0' }} />

                <h3 style={{ fontSize: 15, marginBottom: 14 }}>Student Information</h3>

                <div className="employee-info-grid">
                    <div className="employee-info-field">
                        <span>Document Requested</span>
                        <strong>{documentName || 'N/A'}</strong>
                    </div>

                    <div className="employee-info-field">
                        <span>Student Number</span>
                        <strong>{student?.student_number || 'N/A'}</strong>
                    </div>

                    <div className="employee-info-field">
                        <span>Quantity</span>
                        <strong>{request.quantity}</strong>
                    </div>

                    <div className="employee-info-field">
                        <span>Unit Fee</span>
                        <strong>₱{Number(request.unit_fee || 0).toFixed(2)}</strong>
                    </div>

                    <div className="employee-info-field">
                        <span>Total Amount</span>
                        <strong>₱{Number(request.total_amount || 0).toFixed(2)}</strong>
                    </div>
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '20px 0 16px' }} />

                <h3 style={{ fontSize: 15, marginBottom: 14 }}>Request Information</h3>

                <div className="employee-info-field" style={{ marginBottom: 16 }}>
                    <span>Purpose</span>
                    <strong>{request.purpose || 'No purpose specified'}</strong>
                </div>

                {request.student_remarks && (
                    <div className="employee-info-field" style={{ marginBottom: 16 }}>
                        <span>Student Remarks</span>
                        <strong>{request.student_remarks}</strong>
                    </div>
                )}

                <div className="employee-info-field">
                    <span>Requested At</span>
                    <strong>{new Date(request.requested_at).toLocaleString()}</strong>
                </div>
            </div>

                {/* ==========================================
                    OFFICIAL RECEIPT
                ========================================== */}

                <div className="employee-card">
                    <h2 style={{ fontSize: 16, marginBottom: 16 }}>Official Receipt</h2>

                    {!receipt ? (
                        <div className="employee-notice tone-warning">
                            <strong>No Receipt Uploaded</strong>
                            <p>The student has not uploaded an official receipt yet.</p>
                        </div>
                    ) : (
                        <>
                            <div className="employee-info-grid">
                                <div className="employee-info-field">
                                    <span>Receipt Number</span>
                                    <strong>{receipt.receipt_number || 'Not provided'}</strong>
                                </div>

                                <div className="employee-info-field">
                                    <span>Amount Paid</span>
                                    <strong>₱{Number(receipt.amount_paid || 0).toFixed(2)}</strong>
                                </div>

                                <div className="employee-info-field">
                                    <span>Uploaded At</span>
                                    <strong>{receipt.uploaded_at ? new Date(receipt.uploaded_at).toLocaleString() : 'N/A'}</strong>
                                </div>

                                <div className="employee-info-field">
                                    <span>Receipt Status</span>
                                    <span className={`employee-status-pill status-${receipt.status}`}>{receipt.status}</span>
                                </div>
                            </div>

                            <div style={{ marginTop: 20 }}>
                                <p style={{ fontSize: 12, color: 'var(--slate)', marginBottom: 8 }}>Receipt File</p>

                                {receiptUrl ? (
                                    <button
                                        className="employee-file-link"
                                        onClick={() => setPreviewFile({ url: receiptUrl, name: receipt.receipt_file_name })}
                                    >
                                        View Official Receipt
                                    </button>
                                ) : (
                                    <div className="employee-notice tone-danger">
                                        <strong>Receipt file could not be opened.</strong>
                                        <p>The receipt record exists, but the Storage file could not be opened.</p>
                                        <code className="employee-code-block">{receipt.receipt_file_path || 'No file path'}</code>
                                        <button className="employee-secondary-button" onClick={loadRequest}>
                                            Retry
                                        </button>
                                    </div>
                                )}
                            </div>

                            {receipt.rejection_reason && (
                                <div className="employee-notice tone-danger" style={{ marginTop: 16 }}>
                                    <strong>Rejection Reason</strong>
                                    <p>{receipt.rejection_reason}</p>
                                </div>
                            )}

                            {receipt.status === 'uploaded' && (
                                <div className="employee-actions-row">
                                    <button onClick={verifyPayment} disabled={processing} className="employee-primary-button">
                                        {processing ? 'Processing...' : '✓ Verify Payment'}
                                    </button>

                                    <button
                                        onClick={() => {
                                            setShowReject(true)
                                            setSelectedRequirement(null)
                                            setRejectionReason('')
                                        }}
                                        disabled={processing}
                                        className="employee-danger-button"
                                    >
                                        ✕ Reject Payment
                                    </button>
                                </div>
                            )}

                            {receipt.status === 'verified' && (
                                <div className="employee-notice tone-success" style={{ marginTop: 16 }}>
                                    <strong>Payment Verified</strong>
                                    <p>This official receipt has already been verified.</p>
                                </div>
                            )}

                            {receipt.status === 'rejected' && (
                                <div className="employee-notice tone-danger" style={{ marginTop: 16 }}>
                                    <strong>Payment Rejected</strong>
                                    <p>This official receipt has been rejected.</p>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* ==========================================
                    REQUIRED DOCUMENTS
                ========================================== */}

                <div className="employee-card">
                    <div className="employee-list-card-header" style={{ marginBottom: 16 }}>
                        <div>
                            <h2 style={{ fontSize: 16, marginBottom: 4 }}>Required Documents</h2>
                            <p style={{ fontSize: 13 }}>Review the student's submitted requirements before processing.</p>
                        </div>

                        <span className="employee-requirement-count">{requirements.length} Requirements</span>
                    </div>

                    {requirements.length === 0 ? (
                        <div className="employee-notice tone-warning">
                            <strong>No requirements found</strong>
                            <p>No request requirements have been created for this request yet.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

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
                                        <div key={requirement.request_requirement_id} className="employee-list-card" style={{ marginBottom: 0 }}>
                                            <div className="employee-list-card-header">
                                                <div>
                                                    <h3 style={{ marginTop: 0 }}>{definition?.requirement_name || 'Requirement'}</h3>
                                                    <p style={{ color: 'var(--slate)', marginTop: 4 }}>
                                                        {definition?.description || 'No description provided.'}
                                                    </p>

                                                    {definition?.is_required && (
                                                        <span className="employee-badge-required">Required</span>
                                                    )}
                                                </div>

                                                <span className={`employee-status-pill status-${requirement.status}`}>
                                                    {requirement.status}
                                                </span>
                                            </div>

                                            <hr style={{ border: 'none', borderTop: '1px solid var(--line)' }} />

                                            <div className="employee-info-grid">
                                                <div className="employee-info-field">
                                                    <span>File Name</span>
                                                    <strong>{requirement.file_name || 'No file uploaded'}</strong>
                                                </div>

                                                <div className="employee-info-field">
                                                    <span>Uploaded At</span>
                                                    <strong>
                                                        {requirement.uploaded_at
                                                            ? new Date(requirement.uploaded_at).toLocaleString()
                                                            : 'Not uploaded'}
                                                    </strong>
                                                </div>
                                            </div>

                                            {requirement.rejection_reason && (
                                                <div className="employee-notice tone-danger">
                                                    <strong>Rejection Reason</strong>
                                                    <p>{requirement.rejection_reason}</p>
                                                </div>
                                            )}

                                            <div className="employee-actions-row" style={{ marginTop: 0 }}>
                                                {fileUrl && (
                                                    <button
                                                        className="employee-file-link"
                                                        onClick={() => setPreviewFile({ url: fileUrl, name: requirement.file_name })}
                                                    >
                                                        View Document
                                                    </button>
                                                )}

                                                {requirement.status === 'uploaded' && (
                                                    <>
                                                        <button
                                                            onClick={() => approveRequirement(requirement)}
                                                            disabled={requirementProcessing}
                                                            className="employee-primary-button"
                                                        >
                                                            {requirementProcessing ? 'Processing...' : '✓ Approve'}
                                                        </button>

                                                        <button
                                                            onClick={() => {
                                                                setSelectedRequirement(requirement)
                                                                setRejectionReason('')
                                                                setShowReject(true)
                                                            }}
                                                            disabled={requirementProcessing}
                                                            className="employee-danger-button"
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
                        <div className={`employee-notice tone-${
                            requirementState.allApproved ? 'success' : requirementState.rejected ? 'danger' : 'warning'
                        }`} style={{ marginTop: 20 }}>
                            <strong>Requirement Review</strong>

                            {requirementState.allApproved ? (
                                <p>✓ All required documents have been approved. This request is ready for document processing.</p>
                            ) : requirementState.rejected ? (
                                <p>✕ One or more required documents have been rejected. The student must submit a replacement.</p>
                            ) : requirementState.pending ? (
                                <p>⚠ Some required documents are still waiting for the student to upload them.</p>
                            ) : (
                                <p>⚠ Some uploaded documents still need to be reviewed.</p>
                            )}
                        </div>
                    )}
                </div>

                {/* ==========================================
                    START PROCESSING
                ========================================== */}

                {request.status === 'receipt_verified' && (
                    <div className="employee-card">
                        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Document Processing</h2>
                        <p style={{ marginBottom: 16 }}>
                            Once the payment and all required documents are verified, you can begin processing
                            the requested academic document.
                        </p>

                        {!requirementState.hasRequirements && (
                            <div className="employee-notice tone-warning">
                                <strong>Requirements are not ready</strong>
                                <p>Create the request's required documents before starting processing.</p>
                            </div>
                        )}

                        {requirementState.hasRequirements && !requirementState.allApproved && (
                            <div className="employee-notice tone-warning">
                                <strong>Processing is not available yet.</strong>
                                <p>All required documents must be approved before processing can begin.</p>
                            </div>
                        )}

                        {requirementState.allApproved && (
                            <div className="employee-notice tone-success">
                                <strong>✓ Ready for Document Processing</strong>
                                <p>Payment is verified and all required documents have been approved.</p>
                                <button onClick={startProcessing} disabled={processing} className="employee-primary-button" style={{ marginTop: 12 }}>
                                    {processing ? 'Starting Processing...' : '▶ Start Document Processing'}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* ==========================================
                    PROCESSING STATUS
                ========================================== */}

                {request.status === 'processing' && (
                    <div className="employee-card">
                        <div className="employee-notice tone-info">
                            <h2 style={{ fontSize: 16, marginBottom: 8 }}>Document Processing</h2>
                            <strong>Processing has started.</strong>
                            <p>The registrar employee can now prepare the student's requested academic document.</p>

                            {request.processed_at && (
                                <p><strong>Processing Started:</strong> {new Date(request.processed_at).toLocaleString()}</p>
                            )}

                            <button onClick={generateDigitalCredential} disabled={processing} className="employee-primary-button" style={{ marginTop: 12 }}>
                                {processing ? 'Generating Credential...' : '📄 Generate Digital Credential'}
                            </button>
                        </div>
                    </div>
                )}

                {/* ==========================================
                    DIGITAL CREDENTIAL
                ========================================== */}

                {request.status === 'ready_for_claiming' && (
                    <div className="employee-card">
                        <h2 style={{ fontSize: 16, marginBottom: 16 }}>Digital Credential</h2>

                        <div className="employee-notice tone-success">
                            <strong>✓ Digital Credential Generated</strong>
                            <p>The requested academic document has been prepared successfully.</p>
                            <p>The next step is to schedule the student's claiming date and time.</p>

                            <button
                                onClick={() => navigate(`/employee/requests/${request.request_id}/claim-schedule`)}
                                className="employee-primary-button"
                                style={{ marginTop: 12 }}
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
                    <div className="employee-card">
                        <h2 style={{ fontSize: 16, marginBottom: 8 }}>
                            {selectedRequirement ? 'Reject Requirement' : 'Reject Payment'}
                        </h2>

                        <p style={{ marginBottom: 12 }}>
                            {selectedRequirement
                                ? `Enter the reason why "${selectedRequirement.document_requirements?.requirement_name || 'this requirement'}" is being rejected.`
                                : 'Enter the reason why the official receipt is being rejected.'}
                        </p>

                        <textarea
                            value={rejectionReason}
                            onChange={(event) => setRejectionReason(event.target.value)}
                            placeholder={
                                selectedRequirement
                                    ? 'Example: School ID is blurry and cannot be verified.'
                                    : 'Enter rejection reason...'
                            }
                            className="employee-textarea"
                        />

                        <div className="employee-actions-row">
                            <button
                                onClick={() => {
                                    setShowReject(false)
                                    setSelectedRequirement(null)
                                    setRejectionReason('')
                                }}
                                className="employee-secondary-button"
                            >
                                Cancel
                            </button>

                            <button
                                onClick={selectedRequirement ? rejectRequirement : rejectPayment}
                                disabled={processing || requirementProcessing}
                                className="employee-danger-button"
                            >
                                {processing || requirementProcessing ? 'Rejecting...' : 'Confirm Rejection'}
                            </button>
                        </div>
                    </div>
                )}

                {/* ==========================================
                    CHANGE STATUS
                ========================================== */}

                <div className="employee-card">
                    <h2 style={{ fontSize: 16, marginBottom: 8 }}>Change Status</h2>

                    <p style={{ marginBottom: 14 }}>
                        Manually set this request's status. Use this for corrections or
                        situations the guided actions above don't cover — the student is
                        notified of the change.
                    </p>

                    <select
                        value={manualStatus}
                        onChange={(event) => setManualStatus(event.target.value)}
                        disabled={changingStatus}
                        className="employee-textarea"
                        style={{ marginBottom: 12 }}
                    >
                        {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                        ))}
                    </select>

                    <textarea
                        value={statusReason}
                        onChange={(event) => setStatusReason(event.target.value)}
                        placeholder="Reason for this change (required if rejecting, optional otherwise)"
                        className="employee-textarea"
                    />

                    <div className="employee-actions-row">
                        <button
                            onClick={changeStatus}
                            disabled={changingStatus || manualStatus === request.status}
                            className="employee-primary-button"
                        >
                            {changingStatus ? 'Saving...' : 'Update Status'}
                        </button>
                    </div>
                </div>

                {previewFile && (
                    <DocumentPreviewModal
                        url={previewFile.url}
                        fileName={previewFile.name}
                        onClose={() => setPreviewFile(null)}
                    />
                )}
        </div>
    )
}

const STATUS_OPTIONS = [
    'pending', 'payment_pending', 'receipt_uploaded', 'receipt_verified',
    'processing', 'lacking_requirements', 'ready_for_claiming', 'completed', 'rejected',
]

export default EmployeeRequestDetails