import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activityLog'
import { notifyStudentByStudentId } from '../../lib/notify'
import './AdminPages.css'

const STATUS_OPTIONS = [
    'pending', 'payment_pending', 'receipt_uploaded', 'receipt_verified',
    'processing', 'digital_credential', 'ready_for_claiming', 'completed', 'rejected',
]

function AdminRequestDetails() {
    const { requestId } = useParams()
    const navigate = useNavigate()

    const [request, setRequest] = useState(null)
    const [student, setStudent] = useState(null)
    const [documentName, setDocumentName] = useState('')
    const [receipt, setReceipt] = useState(null)
    const [employees, setEmployees] = useState([])
    const [currentEmployeeName, setCurrentEmployeeName] = useState('Unassigned')

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)

    const [reassignTo, setReassignTo] = useState('')
    const [newStatus, setNewStatus] = useState('')
    const [overrideReason, setOverrideReason] = useState('')

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
                .select('receipt_id, receipt_number, amount_paid, status, uploaded_at, rejection_reason')
                .eq('request_id', requestId)
                .order('uploaded_at', { ascending: false })
                .limit(1)
                .maybeSingle()

            setReceipt(receiptData || null)

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

    const reassignEmployee = async () => {
        if (!reassignTo) {
            alert('Please select an employee.')
            return
        }

        const confirmed = window.confirm('Reassign this request to the selected employee?')
        if (!confirmed) return

        try {
            setSaving(true)

            const user = await getAdminUser()

            const { error: updateError } = await supabase
                .from('document_requests')
                .update({ assigned_employee_id: reassignTo, updated_at: new Date().toISOString() })
                .eq('request_id', requestId)

            if (updateError) {
                throw new Error('Failed to reassign request: ' + updateError.message)
            }

            const newEmployee = employees.find((e) => e.employee_id === reassignTo)

            await logActivity({
                userId: user.id,
                action: 'reassign_request',
                tableName: 'document_requests',
                recordId: requestId,
                description: `Reassigned request ${request.request_number} to ${newEmployee?.name || reassignTo}.`,
            })

            alert('Request reassigned.')
            await loadRequest()

        } catch (err) {
            console.error('REASSIGN ERROR:', err)
            alert(err.message || 'Failed to reassign request.')
        } finally {
            setSaving(false)
        }
    }

    const overrideStatus = async () => {
        if (!newStatus) return

        if (newStatus === 'rejected' && !overrideReason.trim()) {
            alert('Please enter a reason for this override.')
            return
        }

        const confirmed = window.confirm(
            `Override this request's status to "${newStatus.replace(/_/g, ' ')}"? This bypasses the normal workflow.`
        )
        if (!confirmed) return

        try {
            setSaving(true)

            const user = await getAdminUser()

            const { error: updateError } = await supabase
                .from('document_requests')
                .update({
                    status: newStatus,
                    rejection_reason: newStatus === 'rejected' ? overrideReason.trim() : request.rejection_reason,
                    employee_remarks: overrideReason.trim()
                        ? `Registrar Head override: ${overrideReason.trim()}`
                        : request.employee_remarks,
                    updated_at: new Date().toISOString(),
                })
                .eq('request_id', requestId)

            if (updateError) {
                throw new Error('Failed to override status: ' + updateError.message)
            }

            await logActivity({
                userId: user.id,
                action: 'override_status',
                tableName: 'document_requests',
                recordId: requestId,
                description: `Overrode request ${request.request_number} status to "${newStatus}". ${overrideReason.trim()}`,
            })

            await notifyStudentByStudentId({
                studentId: request.student_id,
                title: 'Request status updated',
                message: `Your request ${request.request_number} status was updated to "${newStatus.replace(/_/g, ' ')}".${overrideReason.trim() ? ' ' + overrideReason.trim() : ''}`,
                notificationType: 'request_update',
                relatedRequestId: requestId,
            })

            alert('Status updated.')
            setOverrideReason('')
            await loadRequest()

        } catch (err) {
            console.error('OVERRIDE STATUS ERROR:', err)
            alert(err.message || 'Failed to override status.')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return <p className="admin-loading">Loading request...</p>
    }

    if (error) {
        return <div className="admin-error-box">{error}</div>
    }

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

            <div className="admin-card" style={{ marginTop: 24 }}>
                <h2 style={{ fontSize: 16, marginBottom: 16 }}>Request Information</h2>

                <div className="admin-info-grid">
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
                    <div className="admin-error-box" style={{ marginTop: 16, marginBottom: 0 }}>
                        Rejection reason: {request.rejection_reason}
                    </div>
                )}
            </div>

            {receipt && (
                <div className="admin-card">
                    <h2 style={{ fontSize: 16, marginBottom: 16 }}>Official Receipt</h2>

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
        </div>
    )
}

export default AdminRequestDetails
