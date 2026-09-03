import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Swal from 'sweetalert2'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activityLog'
import { describeChanges } from '../../lib/describeChanges'
import { notifyStudentByStudentId, notifyError, notifyWarning, notifySuccess, confirmModal } from '../../lib/notify'
import { SkeletonPageHeader, SkeletonDetailCard } from '../../components/Skeleton'
import DocumentPreviewModal from '../../components/DocumentPreviewModal'
import HighlightedText from '../../components/HighlightedText'
import './AdminPages.css'

const STATUS_OPTIONS = [
    'pending', 'payment_pending', 'receipt_uploaded', 'receipt_verified',
    'processing', 'lacking_requirements', 'ready_for_claiming', 'completed', 'rejected',
]

const OVERDUE_ELIGIBLE_STATUSES = [
    'pending', 'payment_pending', 'receipt_uploaded', 'receipt_verified', 'processing',
]
const OVERDUE_DAYS = 2

function formatTime(time) {
    if (!time) return ''
    const [hours, minutes] = time.split(':')
    const date = new Date()
    date.setHours(Number(hours), Number(minutes), 0, 0)
    return date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
}

function AdminRequestDetails() {
    const { requestId } = useParams()
    const navigate = useNavigate()

    const [request, setRequest] = useState(null)
    const [student, setStudent] = useState(null)
    const [documentName, setDocumentName] = useState('')
    const [receipt, setReceipt] = useState(null)
    const [receiptUrl, setReceiptUrl] = useState('')
    const [requirements, setRequirements] = useState([])
    const [requirementUrls, setRequirementUrls] = useState({})
    const [previewFile, setPreviewFile] = useState(null)
    const [requestActivity, setRequestActivity] = useState([])
    const [claimSchedule, setClaimSchedule] = useState(null)
    const [rating, setRating] = useState(null)
    const [employees, setEmployees] = useState([])
    const [currentEmployeeName, setCurrentEmployeeName] = useState('Unassigned')

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)
    const [processing, setProcessing] = useState(false)
    const [requirementProcessing, setRequirementProcessing] = useState(false)

    const [reassignTo, setReassignTo] = useState('')
    const [newStatus, setNewStatus] = useState('')
    const [overrideReason, setOverrideReason] = useState('')

    const [rejectionReason, setRejectionReason] = useState('')
    const [showReject, setShowReject] = useState(false)
    const [selectedRequirement, setSelectedRequirement] = useState(null)

    useEffect(() => {
        loadRequest()
    }, [requestId])

    const loadRequest = async () => {
        try {
            setLoading(true)
            setError('')

            const { data: requestData, error: requestError } = await supabase
                .from('document_requests')
                .select(`
                    request_id, request_number, student_id, document_type_id,
                    assigned_employee_id, quantity, unit_fee, total_amount, priority,
                    purpose, status, student_remarks, employee_remarks, rejection_reason,
                    cancellation_reason, cancelled_at,
                    requested_at, processed_at, completed_at
                `)
                .eq('request_id', requestId)
                .single()

            if (requestError || !requestData) {
                throw new Error('Request could not be found.')
            }

            setRequest(requestData)
            setNewStatus(requestData.status)
            setReassignTo(requestData.assigned_employee_id || '')

            const { data: studentData } = await supabase
                .from('students')
                .select('student_id, user_id, student_number')
                .eq('student_id', requestData.student_id)
                .single()

            setStudent(studentData || null)

            if (requestData.document_type_id) {
                const { data: doc } = await supabase
                    .from('document_types')
                    .select('document_name')
                    .eq('document_type_id', requestData.document_type_id)
                    .single()

                setDocumentName(doc?.document_name || 'Document')
            }

            const { data: receiptData } = await supabase
                .from('official_receipts')
                .select('receipt_id, receipt_number, amount_paid, status, uploaded_at, rejection_reason, receipt_file_name, receipt_file_path')
                .eq('request_id', requestId)
                .order('uploaded_at', { ascending: false })
                .limit(1)
                .maybeSingle()

            setReceipt(receiptData || null)
            setReceiptUrl('')

            if (receiptData?.receipt_file_path) {
                const { data: signedUrlData, error: signedUrlError } = await supabase.storage
                    .from('official-receipts')
                    .createSignedUrl(receiptData.receipt_file_path, 3600)

                if (!signedUrlError) {
                    setReceiptUrl(signedUrlData?.signedUrl || '')
                }
            }

            const { data: requirementRows } = await supabase
                .from('request_requirements')
                .select(`
                    request_requirement_id,
                    file_name,
                    file_path,
                    status,
                    uploaded_at,
                    rejection_reason,
                    document_requirements (
                        requirement_id,
                        requirement_name,
                        description,
                        is_required
                    )
                `)
                .eq('request_id', requestId)
                .order('created_at', { ascending: true })

            setRequirements(requirementRows || [])

            const urls = {}

            for (const requirement of requirementRows || []) {
                if (requirement.file_path && ['uploaded', 'approved', 'rejected'].includes(requirement.status)) {
                    const { data: signedData, error: signedError } = await supabase.storage
                        .from('student-requirements')
                        .createSignedUrl(requirement.file_path, 3600)

                    if (!signedError) {
                        urls[requirement.request_requirement_id] = signedData?.signedUrl || ''
                    }
                }
            }

            setRequirementUrls(urls)

            const { data: employeeRows } = await supabase
                .from('employees')
                .select('employee_id, user_id, employee_number, status')
                .eq('status', 'active')

            const userIds = [...new Set((employeeRows || []).map((e) => e.user_id))]

            const { data: profiles } = userIds.length
                ? await supabase.from('profiles').select('user_id, first_name, last_name').in('user_id', userIds)
                : { data: [] }

            const profileByUserId = Object.fromEntries((profiles || []).map((p) => [p.user_id, p]))

            const employeeList = (employeeRows || []).map((e) => ({
                ...e,
                name: profileByUserId[e.user_id]
                    ? `${profileByUserId[e.user_id].first_name} ${profileByUserId[e.user_id].last_name}`.trim()
                    : e.employee_number,
            }))

            setEmployees(employeeList)

            const current = employeeList.find((e) => e.employee_id === requestData.assigned_employee_id)
            setCurrentEmployeeName(current ? current.name : 'Unassigned')

            const { data: scheduleRow, error: scheduleError } = await supabase
                .from('claim_schedules')
                .select('claim_schedule_id, status, scheduled_date, scheduled_time, claim_date, claim_time, claimed_at, reschedule_requested_at, reschedule_reason')
                .eq('request_id', requestId)
                .neq('status', 'cancelled')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()

            if (scheduleError) {
                console.error('CLAIM SCHEDULE LOAD ERROR:', scheduleError)
            } else {
                setClaimSchedule(scheduleRow || null)
            }

            const { data: ratingRow } = await supabase
                .from('request_ratings')
                .select('rating, comment')
                .eq('request_id', requestId)
                .maybeSingle()

            setRating(ratingRow || null)

            const { data: activityRows, error: activityError } = await supabase
                .from('activity_logs')
                .select('activity_log_id, employee_id, user_id, action, description, created_at')
                .ilike('description', `%"${requestData.request_number}"%`)
                .order('created_at', { ascending: false })

            if (activityError) {
                console.error('REQUEST ACTIVITY ERROR:', activityError)
            } else {
                const activityLogRows = activityRows || []
                const activityEmployeeIds = [...new Set(activityLogRows.map((r) => r.employee_id).filter(Boolean))]

                const { data: activityEmployees } = activityEmployeeIds.length
                    ? await supabase.from('employees').select('employee_id, user_id, employee_number').in('employee_id', activityEmployeeIds)
                    : { data: [] }

                const activityUserIds = [...new Set([
                    ...(activityEmployees || []).map((e) => e.user_id),
                    ...activityLogRows.map((r) => r.user_id).filter(Boolean),
                ])]

                const { data: activityProfiles } = activityUserIds.length
                    ? await supabase.from('profiles').select('user_id, first_name, last_name').in('user_id', activityUserIds)
                    : { data: [] }

                const activityProfileByUserId = Object.fromEntries((activityProfiles || []).map((p) => [p.user_id, p]))
                const activityEmployeeById = Object.fromEntries((activityEmployees || []).map((e) => [e.employee_id, e]))

                setRequestActivity(
                    activityLogRows.map((r) => {
                        const emp = r.employee_id ? activityEmployeeById[r.employee_id] : null
                        const profile = emp ? activityProfileByUserId[emp.user_id] : (r.user_id ? activityProfileByUserId[r.user_id] : null)

                        return {
                            ...r,
                            actorName: profile ? `${profile.first_name} ${profile.last_name}`.trim() : 'System',
                        }
                    })
                )
            }

        } catch (err) {
            console.error('ADMIN REQUEST DETAILS ERROR:', err)
            setError(err.message || 'Failed to load request.')
        } finally {
            setLoading(false)
        }
    }

    const getAdminUser = async () => {
        const {
            data: { user },
            error: authError
        } = await supabase.auth.getUser()

        if (authError || !user) {
            throw new Error('You are not logged in.')
        }

        return user
    }

    const getAdminActor = async () => {
        const user = await getAdminUser()

        // Best-effort -- a registrar head/admin may or may not also have an
        // employees row. verified_by/reviewed_by/generated_by have no NOT
        // NULL constraint, so this is allowed to come back null.
        const { data: employee } = await supabase
            .from('employees')
            .select('employee_id')
            .eq('user_id', user.id)
            .maybeSingle()

        return { userId: user.id, employeeId: employee?.employee_id || null }
    }

    const getRequirementState = () => {
        const requiredRequirements = requirements.filter(
            (requirement) => requirement.document_requirements?.is_required === true
        )

        if (requiredRequirements.length === 0) {
            return { hasRequirements: false, allApproved: false, pending: false, rejected: false, uploaded: false }
        }

        const pending = requiredRequirements.some((requirement) => requirement.status === 'pending')
        const uploaded = requiredRequirements.some((requirement) => requirement.status === 'uploaded')
        const rejected = requiredRequirements.some((requirement) => requirement.status === 'rejected')
        const allApproved = requiredRequirements.every(
            (requirement) => requirement.status === 'approved' || requirement.status === 'not_applicable'
        )

        return { hasRequirements: true, allApproved, pending, rejected, uploaded }
    }

    const verifyPayment = async () => {
        if (!receipt) {
            notifyWarning('There is no official receipt to verify.')
            return
        }

        if (receipt.status !== 'uploaded') {
            notifyWarning('This receipt has already been processed.')
            return
        }

        const confirmed = await confirmModal('Are you sure you want to verify this payment?')
        if (!confirmed) return

        try {
            setProcessing(true)

            const actor = await getAdminActor()

            const { error: receiptUpdateError } = await supabase
                .from('official_receipts')
                .update({
                    status: 'verified',
                    verified_by: actor.employeeId,
                    verified_at: new Date().toISOString(),
                    rejection_reason: null,
                })
                .eq('receipt_id', receipt.receipt_id)
                .eq('request_id', requestId)

            if (receiptUpdateError) {
                throw new Error('Failed to verify receipt: ' + receiptUpdateError.message)
            }

            const { error: requestUpdateError } = await supabase
                .from('document_requests')
                .update({
                    status: 'receipt_verified',
                    rejection_reason: null,
                    updated_at: new Date().toISOString(),
                })
                .eq('request_id', requestId)

            if (requestUpdateError) {
                throw new Error('Receipt was verified but request status could not be updated: ' + requestUpdateError.message)
            }

            await logActivity({
                userId: actor.userId,
                employeeId: actor.employeeId,
                action: 'verify_payment',
                tableName: 'document_requests',
                recordId: requestId,
                description: `Verified payment for request "${request?.request_number || requestId}" (Registrar Head).`,
            })

            await notifyStudentByStudentId({
                studentId: request.student_id,
                title: 'Payment verified',
                message: `Your payment for request ${request.request_number} has been verified. Your document is now being processed.`,
                notificationType: 'request_update',
                relatedRequestId: requestId,
            })

            notifySuccess('Payment verified successfully.')
            await loadRequest()

        } catch (err) {
            console.error('VERIFY PAYMENT ERROR:', err)
            notifyError(err.message || 'Failed to verify payment.')
        } finally {
            setProcessing(false)
        }
    }

    const rejectPayment = async () => {
        if (!receipt) {
            notifyWarning('There is no official receipt to reject.')
            return
        }

        if (!rejectionReason.trim()) {
            notifyWarning('Please enter a rejection reason.')
            return
        }

        const confirmed = await confirmModal('Are you sure you want to reject this payment?')
        if (!confirmed) return

        try {
            setProcessing(true)

            const actor = await getAdminActor()

            const { error: receiptUpdateError } = await supabase
                .from('official_receipts')
                .update({
                    status: 'rejected',
                    verified_by: actor.employeeId,
                    verified_at: new Date().toISOString(),
                    rejection_reason: rejectionReason.trim(),
                })
                .eq('receipt_id', receipt.receipt_id)
                .eq('request_id', requestId)

            if (receiptUpdateError) {
                throw new Error('Failed to reject receipt: ' + receiptUpdateError.message)
            }

            const { error: requestUpdateError } = await supabase
                .from('document_requests')
                .update({
                    status: 'rejected',
                    rejection_reason: rejectionReason.trim(),
                    employee_remarks: rejectionReason.trim(),
                    updated_at: new Date().toISOString(),
                })
                .eq('request_id', requestId)

            if (requestUpdateError) {
                throw new Error('Receipt was rejected but request status could not be updated: ' + requestUpdateError.message)
            }

            await logActivity({
                userId: actor.userId,
                employeeId: actor.employeeId,
                action: 'reject_payment',
                tableName: 'document_requests',
                recordId: requestId,
                description: `Rejected payment for request "${request?.request_number || requestId}": "${rejectionReason.trim()}" (Registrar Head).`,
            })

            await notifyStudentByStudentId({
                studentId: request.student_id,
                title: 'Payment rejected',
                message: `Your payment for request ${request.request_number} was rejected: ${rejectionReason.trim()}`,
                notificationType: 'payment',
                relatedRequestId: requestId,
            })

            notifySuccess('Payment rejected successfully.')
            setShowReject(false)
            setRejectionReason('')
            await loadRequest()

        } catch (err) {
            console.error('REJECT PAYMENT ERROR:', err)
            notifyError(err.message || 'Failed to reject payment.')
        } finally {
            setProcessing(false)
        }
    }

    const approveRequirement = async (requirement) => {
        if (requirement.status !== 'uploaded') {
            notifyWarning('Only uploaded requirements can be approved.')
            return
        }

        const confirmed = await confirmModal(
            `Approve "${requirement.document_requirements?.requirement_name || 'this requirement'}"?`
        )
        if (!confirmed) return

        try {
            setRequirementProcessing(true)

            const actor = await getAdminActor()

            const { error: reqError } = await supabase
                .from('request_requirements')
                .update({
                    status: 'approved',
                    reviewed_by: actor.employeeId,
                    reviewed_at: new Date().toISOString(),
                    rejection_reason: null,
                })
                .eq('request_requirement_id', requirement.request_requirement_id)
                .eq('request_id', requestId)

            if (reqError) {
                throw new Error('Failed to approve requirement: ' + reqError.message)
            }

            await logActivity({
                userId: actor.userId,
                employeeId: actor.employeeId,
                action: 'approve_requirement',
                tableName: 'request_requirements',
                recordId: requirement.request_requirement_id,
                description: `Approved "${requirement.document_requirements?.requirement_name || 'requirement'}" for request "${request?.request_number || requestId}" (Registrar Head).`,
            })

            notifySuccess('Requirement approved.')
            await loadRequest()

        } catch (err) {
            console.error('APPROVE REQUIREMENT ERROR:', err)
            notifyError(err.message || 'Failed to approve requirement.')
        } finally {
            setRequirementProcessing(false)
        }
    }

    const rejectRequirement = async () => {
        if (!selectedRequirement) return

        if (!rejectionReason.trim()) {
            notifyWarning('Please enter a rejection reason.')
            return
        }

        try {
            setRequirementProcessing(true)

            const actor = await getAdminActor()

            const { error: reqError } = await supabase
                .from('request_requirements')
                .update({
                    status: 'rejected',
                    reviewed_by: actor.employeeId,
                    reviewed_at: new Date().toISOString(),
                    rejection_reason: rejectionReason.trim(),
                })
                .eq('request_requirement_id', selectedRequirement.request_requirement_id)
                .eq('request_id', requestId)

            if (reqError) {
                throw new Error('Failed to reject requirement: ' + reqError.message)
            }

            await logActivity({
                userId: actor.userId,
                employeeId: actor.employeeId,
                action: 'reject_requirement',
                tableName: 'request_requirements',
                recordId: selectedRequirement.request_requirement_id,
                description: `Rejected "${selectedRequirement.document_requirements?.requirement_name || 'requirement'}" for request "${request?.request_number || requestId}": "${rejectionReason.trim()}" (Registrar Head).`,
            })

            await notifyStudentByStudentId({
                studentId: request.student_id,
                title: 'Requirement rejected',
                message: `"${selectedRequirement.document_requirements?.requirement_name || 'A requirement'}" for request ${request.request_number} was rejected: ${rejectionReason.trim()}. Please re-upload it.`,
                notificationType: 'requirement',
                relatedRequestId: requestId,
            })

            notifySuccess('Requirement rejected.')
            setSelectedRequirement(null)
            setShowReject(false)
            setRejectionReason('')
            await loadRequest()

        } catch (err) {
            console.error('REJECT REQUIREMENT ERROR:', err)
            notifyError(err.message || 'Failed to reject requirement.')
        } finally {
            setRequirementProcessing(false)
        }
    }

    const startProcessing = async () => {
        if (!request) return

        if (request.status !== 'receipt_verified') {
            notifyWarning('This request is not ready for document processing.')
            return
        }

        const requirementState = getRequirementState()

        if (!requirementState.hasRequirements) {
            notifyWarning('No required documents have been created for this request yet.')
            return
        }

        if (!requirementState.allApproved) {
            if (requirementState.rejected) {
                notifyWarning('A required document has been rejected. The student must submit a new document before processing can start.')
            } else if (requirementState.pending || requirementState.uploaded) {
                notifyWarning('Not all required documents have been approved yet.')
            } else {
                notifyWarning('All required documents must be approved before processing.')
            }
            return
        }

        const confirmed = await confirmModal('All required documents are approved. Start document processing for this request?')
        if (!confirmed) return

        try {
            setProcessing(true)

            const actor = await getAdminActor()

            const { error: updateError } = await supabase
                .from('document_requests')
                .update({
                    status: 'processing',
                    processed_at: new Date().toISOString(),
                    rejection_reason: null,
                    employee_remarks: 'Document processing started (Registrar Head).',
                    updated_at: new Date().toISOString(),
                })
                .eq('request_id', requestId)
                .eq('status', 'receipt_verified')

            if (updateError) {
                throw new Error('Failed to start document processing: ' + updateError.message)
            }

            await logActivity({
                userId: actor.userId,
                employeeId: actor.employeeId,
                action: 'start_processing',
                tableName: 'document_requests',
                recordId: requestId,
                description: `Started document processing for request "${request?.request_number || requestId}" (Registrar Head).`,
            })

            notifySuccess('Document processing has started.')
            await loadRequest()

        } catch (err) {
            console.error('START PROCESSING ERROR:', err)
            notifyError(err.message || 'Failed to start document processing.')
        } finally {
            setProcessing(false)
        }
    }

    const generateDigitalCredential = async () => {
        if (!request) return

        if (request.status !== 'processing') {
            notifyWarning('This request is not currently being processed.')
            return
        }

        const confirmed = await confirmModal('Have you verified the student record and prepared the requested academic document?')
        if (!confirmed) return

        try {
            setProcessing(true)

            const actor = await getAdminActor()

            const { data: credential, error: credentialError } = await supabase
                .from('credentials')
                .insert({
                    request_id: request.request_id,
                    student_id: request.student_id,
                    document_type_id: request.document_type_id,
                    status: 'generated',
                    generated_by: actor.employeeId,
                    generated_at: new Date().toISOString(),
                })
                .select()
                .single()

            if (credentialError) {
                throw new Error('Failed to create credential record: ' + credentialError.message)
            }

            const { error: requestError } = await supabase
                .from('document_requests')
                .update({
                    status: 'ready_for_claiming',
                    employee_remarks: 'Digital credential generated and recorded (Registrar Head).',
                    updated_at: new Date().toISOString(),
                })
                .eq('request_id', requestId)
                .eq('status', 'processing')

            if (requestError) {
                throw new Error('Credential was created but request status could not be updated: ' + requestError.message)
            }

            await logActivity({
                userId: actor.userId,
                employeeId: actor.employeeId,
                action: 'generate_credential',
                tableName: 'credentials',
                recordId: credential.credential_id,
                description: `Generated digital credential "${credential.credential_number}" for request "${request?.request_number || requestId}" (Registrar Head).`,
            })

            await notifyStudentByStudentId({
                studentId: request.student_id,
                title: 'Ready to claim',
                message: `Your document for request ${request.request_number} is ready to claim. You'll be notified separately once a claiming date and time is scheduled.`,
                notificationType: 'request_update',
                relatedRequestId: requestId,
            })

            notifySuccess(`Digital credential generated successfully.\n\nCredential Number: ${credential.credential_number}`)
            await loadRequest()

        } catch (err) {
            console.error('GENERATE DIGITAL CREDENTIAL ERROR:', err)
            notifyError(err.message || 'Failed to generate digital credential.')
        } finally {
            setProcessing(false)
        }
    }

    const reassignEmployee = async () => {
        if (!reassignTo) {
            notifyWarning('Please select an employee.')
            return
        }

        const confirmed = await confirmModal('Reassign this request to the selected employee?')
        if (!confirmed) return

        try {
            setSaving(true)

            const user = await getAdminUser()

            const { data: updatedRows, error: updateError } = await supabase
                .from('document_requests')
                .update({ assigned_employee_id: reassignTo, updated_at: new Date().toISOString() })
                .eq('request_id', requestId)
                .select('request_id')

            if (updateError) {
                throw new Error('Failed to reassign request: ' + updateError.message)
            }

            if (!updatedRows || updatedRows.length === 0) {
                throw new Error(
                    'The reassignment was not saved. Your account may not have permission to update this request (a database access policy may be blocking it) — this needs to be fixed in Supabase, not the app.'
                )
            }

            const newEmployee = employees.find((e) => e.employee_id === reassignTo)

            await logActivity({
                userId: user.id,
                action: 'reassign_request',
                tableName: 'document_requests',
                recordId: requestId,
                description: `Reassigned request "${request.request_number}" ${describeChanges([['assigned employee', currentEmployeeName, newEmployee?.name || reassignTo]]) || `to "${newEmployee?.name || reassignTo}"`}.`,
            })

            notifySuccess('Request reassigned.')
            await loadRequest()

        } catch (err) {
            console.error('REASSIGN ERROR:', err)
            notifyError(err.message || 'Failed to reassign request.')
        } finally {
            setSaving(false)
        }
    }

    const applyOverride = async (targetStatus, reasonText) => {
        try {
            setSaving(true)

            const user = await getAdminUser()
            const reason = (reasonText || '').trim()

            const { data: updatedRows, error: updateError } = await supabase
                .from('document_requests')
                .update({
                    status: targetStatus,
                    rejection_reason: targetStatus === 'rejected' ? reason : request.rejection_reason,
                    employee_remarks: reason
                        ? `Registrar Head override: ${reason}`
                        : request.employee_remarks,
                    updated_at: new Date().toISOString(),
                })
                .eq('request_id', requestId)
                .select('request_id')

            if (updateError) {
                throw new Error('Failed to override status: ' + updateError.message)
            }

            if (!updatedRows || updatedRows.length === 0) {
                throw new Error(
                    'The status change was not saved. Your account may not have permission to update this request (a database access policy may be blocking it) — this needs to be fixed in Supabase, not the app.'
                )
            }

            await logActivity({
                userId: user.id,
                action: 'override_status',
                tableName: 'document_requests',
                recordId: requestId,
                description: `Overrode request "${request.request_number}" status from "${request.status}" to "${targetStatus}".${reason ? ' "' + reason + '"' : ''}`,
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

            notifySuccess('Status updated.')
            setOverrideReason('')
            await loadRequest()

        } catch (err) {
            console.error('OVERRIDE STATUS ERROR:', err)
            notifyError(err.message || 'Failed to override status.')
        } finally {
            setSaving(false)
        }
    }

    const overrideStatus = async () => {
        if (!newStatus) return

        if (newStatus === 'rejected' && !overrideReason.trim()) {
            notifyWarning('Please enter a reason for this override.')
            return
        }

        const confirmed = await confirmModal(
            `Override this request's status to "${newStatus.replace(/_/g, ' ')}"? This bypasses the normal workflow.`
        )
        if (!confirmed) return

        await applyOverride(newStatus, overrideReason)
    }

    const dismissMissedClaim = async () => {
        if (!claimSchedule || claimSchedule.status !== 'missed') return

        const confirmed = await confirmModal(
            'Dismiss this missed claiming appointment? The student will need a new schedule if they still want to claim it.'
        )
        if (!confirmed) return

        try {
            setSaving(true)

            const user = await getAdminUser()
            const now = new Date().toISOString()

            const { error: scheduleError } = await supabase
                .from('claim_schedules')
                .update({ status: 'cancelled', updated_at: now, remarks: 'Dismissed by Registrar Head.' })
                .eq('claim_schedule_id', claimSchedule.claim_schedule_id)

            if (scheduleError) {
                throw new Error('Failed to dismiss schedule: ' + scheduleError.message)
            }

            const { error: requestError } = await supabase
                .from('document_requests')
                .update({
                    status: 'ready_for_claiming',
                    employee_remarks: 'Missed claiming appointment dismissed by Registrar Head.',
                    updated_at: now,
                })
                .eq('request_id', requestId)

            if (requestError) {
                throw new Error('Schedule was dismissed but request status could not be updated: ' + requestError.message)
            }

            await logActivity({
                userId: user.id,
                action: 'dismiss_missed_claim',
                tableName: 'claim_schedules',
                recordId: claimSchedule.claim_schedule_id,
                description: `Dismissed missed claiming appointment for request "${request?.request_number || requestId}" (Registrar Head).`,
            })

            notifySuccess('Missed claiming appointment dismissed.')
            await loadRequest()

        } catch (err) {
            console.error('DISMISS MISSED CLAIM ERROR:', err)
            notifyError(err.message || 'Failed to dismiss schedule.')
        } finally {
            setSaving(false)
        }
    }

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

        await applyOverride('lacking_requirements', reason)
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

    if (error) {
        return <div className="admin-error-box">{error}</div>
    }

    const daysSinceRequested = request.requested_at
        ? Math.floor((Date.now() - new Date(request.requested_at).getTime()) / (1000 * 60 * 60 * 24))
        : 0

    const isOverdue = daysSinceRequested >= OVERDUE_DAYS && OVERDUE_ELIGIBLE_STATUSES.includes(request.status)

    return (
        <div>
            <button className="admin-link-button" style={{ marginBottom: 16 }} onClick={() => navigate('/admin/requests')}>
                ← Back to All Requests
            </button>

            <div className="admin-page-header-row">
                <div>
                    <h1 style={{ fontSize: 26, marginBottom: 6 }}>{documentName}</h1>
                    <p>{request.request_number} · Student {student?.student_number || 'N/A'}</p>
                </div>

                <span className={`admin-status-pill status-${request.status}`}>
                    {request.status.replace(/_/g, ' ')}
                </span>
            </div>

            {isOverdue && (
                <div className="admin-notice tone-warning" style={{ marginTop: 16 }}>
                    <strong>Pending for {daysSinceRequested} days</strong>
                    <p style={{ marginBottom: 12 }}>
                        This request hasn't moved in {daysSinceRequested} days. If the student is missing something, flag it as Lacking Requirements to let them know what's needed.
                    </p>
                    <button
                        className="admin-primary-button"
                        style={{ background: '#856404' }}
                        onClick={flagLackingRequirements}
                        disabled={saving}
                    >
                        Flag as Lacking Requirements
                    </button>
                </div>
            )}

            <div className="admin-card" style={{ marginTop: 24 }}>
                <h2 style={{ fontSize: 16, marginBottom: 16 }}>Request Information</h2>

                <div className="admin-info-grid">
                    <div className="admin-info-field">
                        <span>Document Requested</span>
                        <strong>{documentName}</strong>
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
                        <strong style={{ textTransform: 'capitalize' }}>{request.priority}</strong>
                    </div>

                    <div className="admin-info-field">
                        <span>Assigned Employee</span>
                        <strong>{currentEmployeeName}</strong>
                    </div>

                    <div className="admin-info-field">
                        <span>Requested</span>
                        <strong>{request.requested_at ? new Date(request.requested_at).toLocaleString() : 'N/A'}</strong>
                    </div>

                    <div className="admin-info-field">
                        <span>Purpose</span>
                        <strong>{request.purpose || 'Not specified'}</strong>
                    </div>
                </div>

                {request.rejection_reason && (
                    <div className="admin-notice tone-danger" style={{ marginTop: 16 }}>
                        <strong>Rejection Reason</strong>
                        <p style={{ margin: 0 }}>{request.rejection_reason}</p>
                    </div>
                )}

                {request.cancellation_reason && (
                    <div className="admin-notice tone-danger" style={{ marginTop: 16 }}>
                        <strong>Cancellation Reason</strong>
                        <p style={{ margin: 0 }}>{request.cancellation_reason}</p>
                        {request.cancelled_at && (
                            <p style={{ margin: '6px 0 0', fontSize: 12.5, opacity: 0.8 }}>
                                Cancelled on {new Date(request.cancelled_at).toLocaleString()}
                            </p>
                        )}
                    </div>
                )}
            </div>

            {rating && (
                <div className="admin-card">
                    <h2 style={{ fontSize: 16, marginBottom: 12 }}>Student Rating</h2>
                    <p style={{ fontSize: 20, letterSpacing: 2, color: 'var(--blue)' }}>
                        {'★'.repeat(rating.rating)}{'☆'.repeat(5 - rating.rating)}
                    </p>
                    {rating.comment && (
                        <p style={{ fontSize: 13.5, color: 'var(--slate)', marginTop: 4 }}>"{rating.comment}"</p>
                    )}
                </div>
            )}

            <div className="admin-card">
                <h2 style={{ fontSize: 16, marginBottom: 16 }}>Official Receipt</h2>

                {!receipt ? (
                    <div className="admin-notice tone-warning">
                        <strong>No Receipt Uploaded</strong>
                        <p>The student has not uploaded an official receipt yet.</p>
                    </div>
                ) : (
                    <>
                        <div className="admin-info-grid">
                            <div className="admin-info-field">
                                <span>Receipt Number</span>
                                <strong>{receipt.receipt_number}</strong>
                            </div>

                            <div className="admin-info-field">
                                <span>Amount Paid</span>
                                <strong>₱{Number(receipt.amount_paid || 0).toFixed(2)}</strong>
                            </div>

                            <div className="admin-info-field">
                                <span>Status</span>
                                <strong style={{ textTransform: 'capitalize' }}>{receipt.status}</strong>
                            </div>
                        </div>

                        {receipt.rejection_reason && (
                            <div className="admin-error-box" style={{ marginTop: 16, marginBottom: 0 }}>
                                Rejection reason: {receipt.rejection_reason}
                            </div>
                        )}

                        <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            {receiptUrl ? (
                                <button
                                    className="admin-primary-button"
                                    onClick={() => setPreviewFile({ url: receiptUrl, name: receipt.receipt_file_name })}
                                >
                                    View Official Receipt
                                </button>
                            ) : (
                                <p style={{ fontSize: 13, color: 'var(--slate)' }}>Receipt file could not be opened.</p>
                            )}

                            {receipt.status === 'uploaded' && (
                                <>
                                    <button className="admin-primary-button" onClick={verifyPayment} disabled={processing}>
                                        {processing ? 'Processing...' : '✓ Verify Payment'}
                                    </button>

                                    <button
                                        className="admin-danger-button"
                                        onClick={() => {
                                            setShowReject(true)
                                            setSelectedRequirement(null)
                                            setRejectionReason('')
                                        }}
                                        disabled={processing}
                                    >
                                        ✕ Reject Payment
                                    </button>
                                </>
                            )}
                        </div>
                    </>
                )}
            </div>

            <div className="admin-card">
                <h2 style={{ fontSize: 16, marginBottom: 16 }}>Required Documents</h2>

                {requirements.length === 0 ? (
                    <div className="admin-notice tone-warning">
                        <strong>No requirements found</strong>
                        <p>No request requirements have been created for this request yet.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {requirements.map((requirement) => {
                            const definition = requirement.document_requirements
                            const fileUrl = requirementUrls[requirement.request_requirement_id]

                            return (
                                <div key={requirement.request_requirement_id} className="admin-list-card" style={{ marginBottom: 0 }}>
                                    <div className="admin-list-card-header">
                                        <div>
                                            <h3>{definition?.requirement_name || 'Requirement'}{definition?.is_required && <span style={{ color: 'var(--red)' }}> *</span>}</h3>
                                            <p>{definition?.description || 'No description provided.'}</p>
                                        </div>

                                        <span className={`admin-status-pill status-${requirement.status}`}>{requirement.status}</span>
                                    </div>

                                    <div className="admin-info-grid">
                                        <div className="admin-info-field">
                                            <span>File Name</span>
                                            <strong>{requirement.file_name || 'No file uploaded'}</strong>
                                        </div>

                                        <div className="admin-info-field">
                                            <span>Uploaded At</span>
                                            <strong>{requirement.uploaded_at ? new Date(requirement.uploaded_at).toLocaleString() : 'Not uploaded'}</strong>
                                        </div>
                                    </div>

                                    {requirement.rejection_reason && (
                                        <div className="admin-error-box" style={{ marginTop: 12, marginBottom: 0 }}>
                                            Rejection reason: {requirement.rejection_reason}
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                                        {fileUrl && (
                                            <button
                                                className="admin-link-button"
                                                onClick={() => setPreviewFile({ url: fileUrl, name: requirement.file_name })}
                                            >
                                                View Document →
                                            </button>
                                        )}

                                        {requirement.status === 'uploaded' && (
                                            <>
                                                <button
                                                    className="admin-primary-button"
                                                    onClick={() => approveRequirement(requirement)}
                                                    disabled={requirementProcessing}
                                                >
                                                    {requirementProcessing ? 'Processing...' : '✓ Approve'}
                                                </button>

                                                <button
                                                    className="admin-danger-button"
                                                    onClick={() => {
                                                        setSelectedRequirement(requirement)
                                                        setRejectionReason('')
                                                        setShowReject(true)
                                                    }}
                                                    disabled={requirementProcessing}
                                                >
                                                    ✕ Reject
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                {requirements.length > 0 && (() => {
                    const requirementState = getRequirementState()
                    return (
                        <div className={`admin-notice tone-${requirementState.allApproved ? 'success' : requirementState.rejected ? 'danger' : 'warning'}`} style={{ marginTop: 20 }}>
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
                    )
                })()}
            </div>

            {request.status === 'receipt_verified' && (() => {
                const requirementState = getRequirementState()
                return (
                    <div className="admin-card">
                        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Document Processing</h2>
                        <p style={{ fontSize: 13, marginBottom: 16 }}>
                            Once the payment and all required documents are verified, you can begin processing
                            the requested academic document.
                        </p>

                        {!requirementState.hasRequirements && (
                            <div className="admin-notice tone-warning">
                                <strong>Requirements are not ready</strong>
                                <p>Create the request's required documents before starting processing.</p>
                            </div>
                        )}

                        {requirementState.hasRequirements && !requirementState.allApproved && (
                            <div className="admin-notice tone-warning">
                                <strong>Processing is not available yet.</strong>
                                <p>All required documents must be approved before processing can begin.</p>
                            </div>
                        )}

                        {requirementState.allApproved && (
                            <div className="admin-notice tone-success">
                                <strong>✓ Ready for Document Processing</strong>
                                <p>Payment is verified and all required documents have been approved.</p>
                                <button onClick={startProcessing} disabled={processing} className="admin-primary-button" style={{ marginTop: 12 }}>
                                    {processing ? 'Starting Processing...' : '▶ Start Document Processing'}
                                </button>
                            </div>
                        )}
                    </div>
                )
            })()}

            {request.status === 'processing' && (
                <div className="admin-card">
                    <div className="admin-notice tone-info">
                        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Document Processing</h2>
                        <strong>Processing has started.</strong>
                        <p>Prepare the student's requested academic document, then generate the digital credential.</p>

                        {request.processed_at && (
                            <p><strong>Processing Started:</strong> {new Date(request.processed_at).toLocaleString()}</p>
                        )}

                        <button onClick={generateDigitalCredential} disabled={processing} className="admin-primary-button" style={{ marginTop: 12 }}>
                            {processing ? 'Generating Credential...' : '📄 Generate Digital Credential'}
                        </button>
                    </div>
                </div>
            )}

            {showReject && (
                <div className="admin-card">
                    <h2 style={{ fontSize: 16, marginBottom: 8 }}>
                        {selectedRequirement ? 'Reject Requirement' : 'Reject Payment'}
                    </h2>

                    <p style={{ fontSize: 13, marginBottom: 12 }}>
                        {selectedRequirement
                            ? `Enter the reason why "${selectedRequirement.document_requirements?.requirement_name || 'this requirement'}" is being rejected.`
                            : 'Enter the reason why the official receipt is being rejected.'}
                    </p>

                    <textarea
                        className="admin-search-input"
                        style={{ width: '100%', minHeight: 90, marginBottom: 12 }}
                        value={rejectionReason}
                        onChange={(event) => setRejectionReason(event.target.value)}
                        placeholder={
                            selectedRequirement
                                ? 'Example: School ID is blurry and cannot be verified.'
                                : 'Enter rejection reason...'
                        }
                    />

                    <div style={{ display: 'flex', gap: 10 }}>
                        <button
                            className="admin-secondary-button"
                            onClick={() => {
                                setShowReject(false)
                                setSelectedRequirement(null)
                                setRejectionReason('')
                            }}
                        >
                            Cancel
                        </button>

                        <button
                            className="admin-danger-button"
                            onClick={selectedRequirement ? rejectRequirement : rejectPayment}
                            disabled={processing || requirementProcessing}
                        >
                            {processing || requirementProcessing ? 'Rejecting...' : 'Confirm Rejection'}
                        </button>
                    </div>
                </div>
            )}

            {requestActivity.length > 0 && (
                <div className="admin-card">
                    <h2 style={{ fontSize: 16, marginBottom: 16 }}>Activity History</h2>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {requestActivity.map((log) => (
                            <div key={log.activity_log_id} style={{ paddingBottom: 12, borderBottom: '1px solid var(--line)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
                                    <strong style={{ fontSize: 13, textTransform: 'capitalize' }}>{log.action.replace(/_/g, ' ')}</strong>
                                    <span style={{ fontSize: 12, color: 'var(--slate)', whiteSpace: 'nowrap' }}>
                                        {new Date(log.created_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                    </span>
                                </div>
                                <p style={{ fontSize: 13, color: 'var(--slate)', marginBottom: 4 }}>
                                    <HighlightedText text={log.description} />
                                </p>
                                <span style={{ fontSize: 11.5, color: 'var(--slate)' }}>{log.actorName}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {claimSchedule && (
                <div className="admin-card">
                    <h2 style={{ fontSize: 16, marginBottom: 12 }}>Claiming Schedule</h2>

                    {claimSchedule.status === 'missed' ? (
                        <div className="admin-notice tone-danger">
                            <strong>✕ Claiming Appointment Missed</strong>
                            <p>
                                The student did not claim this document on{' '}
                                {claimSchedule.claim_date || claimSchedule.scheduled_date}.
                            </p>
                            {claimSchedule.reschedule_requested_at && (
                                <p><strong>Student requested a reschedule:</strong> {claimSchedule.reschedule_reason}</p>
                            )}
                        </div>
                    ) : claimSchedule.status === 'claimed' ? (
                        <div className="admin-notice tone-success">
                            <strong>✓ Document Claimed</strong>
                            <p>
                                Claimed on{' '}
                                {claimSchedule.claimed_at
                                    ? new Date(claimSchedule.claimed_at).toLocaleString()
                                    : (claimSchedule.claim_date || claimSchedule.scheduled_date)}.
                            </p>
                        </div>
                    ) : (
                        <div className="admin-info-grid">
                            <div className="admin-info-field">
                                <span>Scheduled Date</span>
                                <strong>{claimSchedule.claim_date || claimSchedule.scheduled_date || 'N/A'}</strong>
                            </div>
                            <div className="admin-info-field">
                                <span>Scheduled Time</span>
                                <strong>{formatTime(claimSchedule.claim_time || claimSchedule.scheduled_time) || 'N/A'}</strong>
                            </div>
                            {claimSchedule.reschedule_requested_at && (
                                <div className="admin-info-field">
                                    <span>Reschedule Requested</span>
                                    <strong>{claimSchedule.reschedule_reason}</strong>
                                </div>
                            )}
                        </div>
                    )}

                    {claimSchedule.status !== 'claimed' && (
                        <div style={{ display: 'flex', gap: 16, marginTop: 14, flexWrap: 'wrap' }}>
                            <button
                                className="admin-link-button"
                                onClick={() => navigate(`/admin/requests/${requestId}/claim-schedule`)}
                            >
                                {claimSchedule.status === 'missed' || claimSchedule.reschedule_requested_at
                                    ? 'Reschedule claiming →'
                                    : 'Edit claiming schedule →'}
                            </button>

                            {claimSchedule.status === 'missed' && (
                                <button
                                    className="admin-link-button"
                                    style={{ color: 'var(--red-dark)' }}
                                    onClick={dismissMissedClaim}
                                    disabled={saving}
                                >
                                    {saving ? 'Dismissing...' : 'Dismiss'}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {!claimSchedule && request?.status === 'ready_for_claiming' && (
                <div className="admin-card">
                    <h2 style={{ fontSize: 16, marginBottom: 6 }}>Claiming Schedule</h2>
                    <p style={{ fontSize: 13, marginBottom: 14 }}>
                        This document is ready but has not been scheduled for claiming yet.
                    </p>
                    <button
                        className="admin-primary-button"
                        onClick={() => navigate(`/admin/requests/${requestId}/claim-schedule`)}
                    >
                        📅 Schedule Claiming
                    </button>
                </div>
            )}

            <div className="admin-card">
                <h2 style={{ fontSize: 16, marginBottom: 6 }}>Reassign Employee</h2>
                <p style={{ fontSize: 13, marginBottom: 14 }}>Move this request to a different active employee.</p>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <select
                        className="admin-search-input"
                        style={{ maxWidth: 280 }}
                        value={reassignTo}
                        onChange={(e) => setReassignTo(e.target.value)}
                        disabled={saving}
                    >
                        <option value="">-- Select employee --</option>
                        {employees.map((e) => (
                            <option key={e.employee_id} value={e.employee_id}>
                                {e.name} ({e.employee_number})
                            </option>
                        ))}
                    </select>

                    <button className="admin-primary-button" onClick={reassignEmployee} disabled={saving}>
                        {saving ? 'Saving...' : 'Reassign'}
                    </button>
                </div>
            </div>

            <div className="admin-card">
                <h2 style={{ fontSize: 16, marginBottom: 6 }}>Override Status</h2>
                <p style={{ fontSize: 13, marginBottom: 14 }}>
                    Force this request into a different status. This bypasses the normal verification/processing
                    workflow — use only when authorized.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 420 }}>
                    <select
                        className="admin-search-input"
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value)}
                        disabled={saving}
                    >
                        {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                        ))}
                    </select>

                    <input
                        className="admin-search-input"
                        type="text"
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        placeholder="Reason for override (required if rejecting)"
                        disabled={saving}
                    />

                    <button
                        className="admin-danger-button"
                        style={{ width: 'fit-content' }}
                        onClick={overrideStatus}
                        disabled={saving || newStatus === request.status}
                    >
                        {saving ? 'Saving...' : 'Apply Override'}
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

export default AdminRequestDetails
