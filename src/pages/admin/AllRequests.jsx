import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Swal from 'sweetalert2'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activityLog'
import { notifyStudentByStudentId, notifyError, notifySuccess, confirmModal } from '../../lib/notify'
import { SkeletonList } from '../../components/Skeleton'
import './AdminPages.css'

const STATUS_CHIPS = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'payment_pending', label: 'Payment Pending' },
    { key: 'receipt_uploaded', label: 'Receipt Uploaded' },
    { key: 'receipt_verified', label: 'Receipt Verified' },
    { key: 'processing', label: 'Processing' },
    { key: 'lacking_requirements', label: 'Lacking Requirements' },
    { key: 'ready_for_claiming', label: 'Ready for Claiming' },
    { key: 'completed', label: 'Completed' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'cancelled', label: 'Cancelled' },
]

// Bulk target statuses -- deliberately a subset of STATUS_CHIPS. "Cancelled"
// is student-initiated only, and "pending"/"payment_pending" aren't things
// staff would ever move a batch of requests backward into.
const BULK_STATUS_OPTIONS = [
    'receipt_verified',
    'processing',
    'lacking_requirements',
    'ready_for_claiming',
    'completed',
    'rejected',
]

function AllRequests() {
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()

    const [requests, setRequests] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [activeChip, setActiveChip] = useState(searchParams.get('status') || 'all')
    const [search, setSearch] = useState('')
    const [selectedIds, setSelectedIds] = useState(new Set())
    const [bulkStatus, setBulkStatus] = useState(BULK_STATUS_OPTIONS[0])
    const [applyingBulk, setApplyingBulk] = useState(false)

    const activeStatuses = activeChip === 'all' ? null : activeChip.split(',')

    const setChip = (key) => {
        setActiveChip(key)
        setSearchParams(key === 'all' ? {} : { status: key })
    }

    useEffect(() => {
        loadRequests()
    }, [])

    const loadRequests = async () => {
        try {
            setLoading(true)
            setError('')

            const { data: rows, error: requestError } = await supabase
                .from('document_requests')
                .select(`
                    request_id,
                    request_number,
                    student_id,
                    document_type_id,
                    assigned_employee_id,
                    total_amount,
                    priority,
                    status,
                    requested_at
                `)
                .order('requested_at', { ascending: false })

            if (requestError) {
                throw new Error('Failed to load requests: ' + requestError.message)
            }

            const data = rows || []

            const studentIds = [...new Set(data.map((r) => r.student_id).filter(Boolean))]
            const documentTypeIds = [...new Set(data.map((r) => r.document_type_id).filter(Boolean))]
            const employeeIds = [...new Set(data.map((r) => r.assigned_employee_id).filter(Boolean))]

            const [{ data: students }, { data: documentTypes }, { data: employees }] = await Promise.all([
                studentIds.length
                    ? supabase.from('students').select('student_id, student_number').in('student_id', studentIds)
                    : Promise.resolve({ data: [] }),
                documentTypeIds.length
                    ? supabase.from('document_types').select('document_type_id, document_name').in('document_type_id', documentTypeIds)
                    : Promise.resolve({ data: [] }),
                employeeIds.length
                    ? supabase.from('employees').select('employee_id, user_id, employee_number').in('employee_id', employeeIds)
                    : Promise.resolve({ data: [] }),
            ])

            const employeeUserIds = [...new Set((employees || []).map((e) => e.user_id))]

            const { data: profiles } = employeeUserIds.length
                ? await supabase.from('profiles').select('user_id, first_name, last_name').in('user_id', employeeUserIds)
                : { data: [] }

            const profileByUserId = Object.fromEntries((profiles || []).map((p) => [p.user_id, p]))
            const employeeById = Object.fromEntries((employees || []).map((e) => [e.employee_id, e]))
            const studentNumberById = Object.fromEntries((students || []).map((s) => [s.student_id, s.student_number]))
            const documentNameById = Object.fromEntries((documentTypes || []).map((d) => [d.document_type_id, d.document_name]))

            setRequests(
                data.map((r) => {
                    const employee = employeeById[r.assigned_employee_id]
                    const profile = employee ? profileByUserId[employee.user_id] : null

                    return {
                        ...r,
                        studentNumber: studentNumberById[r.student_id] || 'N/A',
                        documentName: documentNameById[r.document_type_id] || 'Document',
                        employeeName: profile ? `${profile.first_name} ${profile.last_name}`.trim() : 'Unassigned',
                    }
                })
            )

        } catch (err) {
            console.error('ALL REQUESTS ERROR:', err)
            setError(err.message || 'Failed to load requests.')
        } finally {
            setLoading(false)
        }
    }

    const visibleRequests = requests
        .filter((r) => !activeStatuses || activeStatuses.includes(r.status))
        .filter((r) => {
            if (!search.trim()) return true
            const term = search.trim().toLowerCase()
            return (
                r.request_number.toLowerCase().includes(term) ||
                r.studentNumber.toLowerCase().includes(term) ||
                r.documentName.toLowerCase().includes(term)
            )
        })

    const allVisibleSelected = visibleRequests.length > 0 && visibleRequests.every((r) => selectedIds.has(r.request_id))

    const toggleSelected = (requestId) => {
        setSelectedIds((prev) => {
            const next = new Set(prev)
            if (next.has(requestId)) next.delete(requestId)
            else next.add(requestId)
            return next
        })
    }

    const toggleSelectAllVisible = () => {
        setSelectedIds((prev) => {
            if (allVisibleSelected) {
                const next = new Set(prev)
                visibleRequests.forEach((r) => next.delete(r.request_id))
                return next
            }
            const next = new Set(prev)
            visibleRequests.forEach((r) => next.add(r.request_id))
            return next
        })
    }

    const clearSelection = () => setSelectedIds(new Set())

    const applyBulkStatus = async () => {
        const targets = requests.filter((r) => selectedIds.has(r.request_id))
        if (targets.length === 0) return

        let reason = ''
        if (bulkStatus === 'rejected') {
            const { value } = await Swal.fire({
                title: 'Reject Selected Requests',
                text: `This will reject ${targets.length} request(s). Please provide a reason (shown to every affected student).`,
                input: 'textarea',
                inputLabel: 'Reason for rejection',
                inputValidator: (value) => {
                    if (!value || !value.trim()) return 'A reason is required.'
                },
                showCancelButton: true,
                confirmButtonText: 'Reject all',
                confirmButtonColor: '#dc3545',
            })
            if (!value) return
            reason = value.trim()
        } else {
            const confirmed = await confirmModal(
                `Change ${targets.length} selected request(s) to "${bulkStatus.replace(/_/g, ' ')}"?`,
                { title: 'Bulk Status Change', confirmButtonText: 'Apply' }
            )
            if (!confirmed) return
        }

        try {
            setApplyingBulk(true)

            const {
                data: { user },
            } = await supabase.auth.getUser()

            const requestIds = targets.map((r) => r.request_id)

            const { data: updatedRows, error: updateError } = await supabase
                .from('document_requests')
                .update({
                    status: bulkStatus,
                    rejection_reason: bulkStatus === 'rejected' ? reason : undefined,
                    employee_remarks: reason ? `Registrar Head bulk override: ${reason}` : undefined,
                    updated_at: new Date().toISOString(),
                })
                .in('request_id', requestIds)
                .select('request_id')

            if (updateError) {
                throw new Error('Failed to update requests: ' + updateError.message)
            }

            if (!updatedRows || updatedRows.length === 0) {
                throw new Error(
                    'The status change was not saved. Your account may not have permission to update these requests (a database access policy may be blocking it) — this needs to be fixed in Supabase, not the app.'
                )
            }

            await Promise.all(
                targets.map(async (r) => {
                    await logActivity({
                        userId: user?.id,
                        action: 'override_status',
                        tableName: 'document_requests',
                        recordId: r.request_id,
                        description: `Bulk overrode request "${r.request_number}" status from "${r.status}" to "${bulkStatus}".${reason ? ' "' + reason + '"' : ''}`,
                    })

                    await notifyStudentByStudentId({
                        studentId: r.student_id,
                        title: bulkStatus === 'ready_for_claiming' ? 'Ready to claim' : 'Request status updated',
                        message: bulkStatus === 'ready_for_claiming'
                            ? `Your document for request ${r.request_number} is ready to claim. You'll be notified separately once a claiming date and time is scheduled.`
                            : `Your request ${r.request_number} status was updated to "${bulkStatus.replace(/_/g, ' ')}".${reason ? ' ' + reason : ''}`,
                        notificationType: 'request_update',
                        relatedRequestId: r.request_id,
                    })
                })
            )

            notifySuccess(`${targets.length} request(s) updated.`)
            clearSelection()
            await loadRequests()

        } catch (err) {
            console.error('BULK STATUS CHANGE ERROR:', err)
            notifyError(err.message || 'Failed to update selected requests.')
        } finally {
            setApplyingBulk(false)
        }
    }

    return (
        <div>
            <div className="admin-page-header">
                <h1>All Requests</h1>
                <p>Every document request in the system, across all employees.</p>
            </div>

            <input
                className="admin-search-input"
                style={{ marginBottom: 16 }}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by request number, student number, or document"
            />

            <div className="admin-filter-row">
                {STATUS_CHIPS.map((chip) => (
                    <button
                        key={chip.key}
                        className={`admin-filter-chip${activeChip === chip.key ? ' active' : ''}`}
                        onClick={() => setChip(chip.key)}
                    >
                        {chip.label}
                    </button>
                ))}
            </div>

            {error && <div className="admin-error-box">{error}</div>}

            {!loading && visibleRequests.length > 0 && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--slate)', marginBottom: 12, cursor: 'pointer' }}>
                    <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAllVisible} />
                    Select all {visibleRequests.length} shown
                </label>
            )}

            {loading ? (
                <SkeletonList count={3} />
            ) : visibleRequests.length === 0 ? (
                <div className="admin-empty">No requests match this view.</div>
            ) : (
                visibleRequests.map((request) => (
                    <div className="admin-list-card" key={request.request_id}>
                        <div className="admin-list-card-header">
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                <input
                                    type="checkbox"
                                    checked={selectedIds.has(request.request_id)}
                                    onChange={() => toggleSelected(request.request_id)}
                                    style={{ marginTop: 4 }}
                                />
                                <div>
                                    <h3>{request.documentName}</h3>
                                    <p>
                                        {request.request_number} · Student {request.studentNumber} · Assigned to {request.employeeName}
                                    </p>
                                </div>
                            </div>

                            <span className={`admin-status-pill status-${request.status}`}>
                                {request.status.replace(/_/g, ' ')}
                            </span>
                        </div>

                        <div className="admin-info-grid">
                            <div className="admin-info-field">
                                <span>Total</span>
                                <strong>₱{Number(request.total_amount || 0).toFixed(2)}</strong>
                            </div>

                            <div className="admin-info-field">
                                <span>Priority</span>
                                <strong style={{ textTransform: 'capitalize' }}>{request.priority}</strong>
                            </div>

                            <div className="admin-info-field">
                                <span>Requested</span>
                                <strong>
                                    {request.requested_at ? new Date(request.requested_at).toLocaleDateString() : '-'}
                                </strong>
                            </div>
                        </div>

                        <button
                            className="admin-link-button"
                            onClick={() => navigate(`/admin/requests/${request.request_id}`)}
                        >
                            Open request →
                        </button>
                    </div>
                ))
            )}

            {selectedIds.size > 0 && (
                <div style={{
                    position: 'sticky',
                    bottom: 16,
                    marginTop: 16,
                    background: 'var(--ink)',
                    color: 'var(--white)',
                    borderRadius: 12,
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    flexWrap: 'wrap',
                    boxShadow: '0 12px 32px rgba(16, 24, 39, 0.25)',
                }}>
                    <strong style={{ fontSize: 13.5 }}>{selectedIds.size} selected</strong>

                    <select
                        className="admin-search-input"
                        style={{ maxWidth: 220 }}
                        value={bulkStatus}
                        onChange={(e) => setBulkStatus(e.target.value)}
                        disabled={applyingBulk}
                    >
                        {BULK_STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                                Set to: {status.replace(/_/g, ' ')}
                            </option>
                        ))}
                    </select>

                    <button className="admin-primary-button" onClick={applyBulkStatus} disabled={applyingBulk}>
                        {applyingBulk ? 'Applying...' : 'Apply'}
                    </button>

                    <button
                        className="admin-link-button"
                        style={{ color: 'var(--white)', textDecoration: 'underline' }}
                        onClick={clearSelection}
                        disabled={applyingBulk}
                    >
                        Clear selection
                    </button>
                </div>
            )}
        </div>
    )
}

export default AllRequests
