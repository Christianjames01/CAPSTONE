import { useEffect, useState } from 'react'
import DocumentThumb from '../../components/DocumentThumb'
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import Swal from 'sweetalert2'
import { supabase } from '../../lib/supabase'
import { useLiveRefresh } from '../../lib/useLiveRefresh'
import { logActivity } from '../../lib/activityLog'
import { notifyStudentByStudentId, notifyError, notifySuccess, confirmModal } from '../../lib/notify'
import { confirmWithPassword } from '../../lib/confirmPassword'
import { SkeletonList } from '../../components/Skeleton'
import PageStats from '../../components/PageStats'
import { IconFileStack, IconHourglass, IconPackage, IconCheckCircle } from './icons'
import './AdminPages.css'

import { formatDisplayDateTime } from '../../lib/formatDate'
import { adminPath } from '../../lib/portalPaths'
import { blockedForReadOnlyViewer } from '../../lib/viewOnlyGuard'
import { friendlyError } from '../../lib/friendlyError'
import { downloadExcelReport } from '../../lib/reportExport'
import { exportRequestBackup } from '../../lib/requestBackup'

const FINISHED_STATUSES = ['completed', 'rejected', 'cancelled']

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

const BULK_STATUS_OPTIONS = [
    'receipt_verified',
    'processing',
    'lacking_requirements',
    'ready_for_claiming',
    'completed',
    'rejected',
]

function AllRequests() {
    const { role } = useOutletContext() || {}
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
    const [exporting, setExporting] = useState(false)
    const [deletingId, setDeletingId] = useState(null)

    const activeStatuses = activeChip === 'all' ? null : activeChip.split(',')

    const setChip = (key) => {
        setActiveChip(key)
        setSearchParams(key === 'all' ? {} : { status: key })
    }

    useEffect(() => {
        loadRequests()
    }, [])

    const loadRequests = async ({ silent = false } = {}) => {
        try {
            if (!silent) setLoading(true)
            setError('')

            const { data: rows, error: requestError } = await supabase
                .from('document_requests')
                .select('*')
                .order('requested_at', { ascending: false })

            if (requestError) {
                throw new Error('Failed to load requests: ' + requestError.message)
            }

            const data = rows || []

            const studentIds = [...new Set(data.map((r) => r.student_id).filter(Boolean))]
            const documentTypeIds = [...new Set(data.map((r) => r.document_type_id).filter(Boolean))]
            const employeeIds = [...new Set(data.map((r) => r.assigned_employee_id).filter(Boolean))]
            const requestIds = data.map((r) => r.request_id)

            const [{ data: students }, { data: documentTypes }, { data: employees }, { data: credentials }] = await Promise.all([
                studentIds.length
                    ? supabase.from('students').select('student_id, user_id, student_number').in('student_id', studentIds)
                    : Promise.resolve({ data: [] }),
                documentTypeIds.length
                    ? supabase.from('document_types').select('document_type_id, document_name, preview_image_url').in('document_type_id', documentTypeIds)
                    : Promise.resolve({ data: [] }),
                employeeIds.length
                    ? supabase.from('employees').select('employee_id, user_id, employee_number').in('employee_id', employeeIds)
                    : Promise.resolve({ data: [] }),
                requestIds.length
                    ? supabase.from('credentials').select('request_id, credential_number, status, generated_at').in('request_id', requestIds)
                    : Promise.resolve({ data: [] }),
            ])

            const employeeUserIds = (employees || []).map((e) => e.user_id)
            const studentUserIds = (students || []).map((s) => s.user_id)
            const profileUserIds = [...new Set([...employeeUserIds, ...studentUserIds].filter(Boolean))]

            const { data: profiles } = profileUserIds.length
                ? await supabase.from('profiles').select('user_id, first_name, last_name').in('user_id', profileUserIds)
                : { data: [] }

            const profileByUserId = Object.fromEntries((profiles || []).map((p) => [p.user_id, p]))
            const employeeById = Object.fromEntries((employees || []).map((e) => [e.employee_id, e]))
            const studentById = Object.fromEntries((students || []).map((s) => [s.student_id, s]))
            const documentNameById = Object.fromEntries((documentTypes || []).map((d) => [d.document_type_id, d.document_name]))
            const documentPreviewById = Object.fromEntries((documentTypes || []).map((d) => [d.document_type_id, d.preview_image_url || null]))
            const credentialByRequestId = Object.fromEntries((credentials || []).map((c) => [c.request_id, c]))

            setRequests(
                data.map((r) => {
                    const employee = employeeById[r.assigned_employee_id]
                    const employeeProfile = employee ? profileByUserId[employee.user_id] : null
                    const student = studentById[r.student_id]
                    const studentProfile = student ? profileByUserId[student.user_id] : null
                    const credential = credentialByRequestId[r.request_id]

                    return {
                        ...r,
                        studentNumber: student?.student_number || 'N/A',
                        studentName: studentProfile ? `${studentProfile.first_name} ${studentProfile.last_name}`.trim() : '',
                        documentName: documentNameById[r.document_type_id] || 'Document',
                        documentPreview: documentPreviewById[r.document_type_id] || null,
                        employeeName: employeeProfile ? `${employeeProfile.first_name} ${employeeProfile.last_name}`.trim() : 'Unassigned',
                        credentialNumber: credential?.credential_number || '',
                        credentialStatus: credential?.status || '',
                        credentialGeneratedAt: credential?.generated_at || null,
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

    // Update in place when requests change -- no manual refresh needed.
    useLiveRefresh(['document_requests', 'credentials'], loadRequests)

    const visibleRequests = (requests
        .filter((r) => !activeStatuses || activeStatuses.includes(r.status))
        .filter((r) => {
            if (!search.trim()) return true
            const term = search.trim().toLowerCase()
            return (
                r.request_number.toLowerCase().includes(term) ||
                r.studentNumber.toLowerCase().includes(term) ||
                r.studentName.toLowerCase().includes(term) ||
                r.documentName.toLowerCase().includes(term)
            )
        }))

    const exportExcel = async () => {
        try {
            setExporting(true)
            await downloadExcelReport(`CertiChain-Requests-${new Date().toISOString().slice(0, 10)}.xlsx`, [
                {
                    name: 'Requests',
                    columns: [
                        { header: 'Credential #', key: 'credentialNumber', width: 18 },
                        { header: 'Credential Status', key: 'credentialStatusLabel', width: 18 },
                        { header: 'Request #', key: 'request_number', width: 16 },
                        { header: 'Student #', key: 'studentNumber', width: 16 },
                        { header: 'Student Name', key: 'studentName', width: 26 },
                        { header: 'Document', key: 'documentName', width: 28 },
                        { header: 'Quantity', key: 'quantity', width: 10 },
                        { header: 'Total Amount', key: 'total_amount', width: 16, format: 'peso' },
                        { header: 'Status', key: 'statusLabel', width: 20 },
                        { header: 'Assigned Employee', key: 'employeeName', width: 24 },
                        { header: 'Purpose', key: 'purpose', width: 28 },
                        { header: 'Requested At', key: 'requestedAt', width: 20, format: 'datetime' },
                        { header: 'Completed At', key: 'completedAt', width: 20, format: 'datetime' },
                        { header: 'Auto-Deletes On', key: 'autoDeletesOn', width: 20, format: 'datetime' },
                    ],
                    rows: visibleRequests.map((r) => {
                        const resolvedAt = r.completed_at || r.cancelled_at || r.auto_rejected_at || (['rejected', 'cancelled'].includes(r.status) ? r.updated_at : null)
                        const autoDeletesOn = resolvedAt ? new Date(new Date(resolvedAt).getTime() + 30 * 24 * 60 * 60 * 1000) : null
                        return {
                            ...r,
                            statusLabel: r.status.replace(/_/g, ' '),
                            credentialStatusLabel: r.credentialStatus ? r.credentialStatus.replace(/_/g, ' ') : '',
                            requestedAt: r.requested_at ? new Date(r.requested_at) : null,
                            completedAt: r.completed_at ? new Date(r.completed_at) : null,
                            autoDeletesOn,
                        }
                    }),
                },
            ], [
                'CertiChain — All Requests',
                `${activeChip === 'all' ? 'All statuses' : activeChip.replace(/_/g, ' ')} · ${visibleRequests.length} request${visibleRequests.length === 1 ? '' : 's'} · Generated ${new Date().toLocaleString('en-PH')}`,
                'Completed, rejected and cancelled requests are auto-deleted 30 days after they were resolved (not requests still pending/in progress). "Auto-Deletes On" shows that date.',
            ])
        } catch (err) {
            console.error('EXPORT REQUESTS ERROR:', err)
            notifyError(friendlyError(err, 'Failed to export requests.'))
        } finally {
            setExporting(false)
        }
    }

    // Deletes one finished request now instead of waiting for the 30-day
    // auto-purge -- to free up storage sooner. Always backs it up to Excel
    // first, same as the student-deletion flow; nothing is deleted if that
    // export fails. The database function (delete_resolved_request) also
    // deletes the actual receipt/requirement/claim files from storage, and
    // refuses anything not already completed/rejected/cancelled.
    const deleteRequest = async (request) => {
        if (blockedForReadOnlyViewer(role)) return
        if (!FINISHED_STATUSES.includes(request.status)) {
            notifyError('Only completed, rejected or cancelled requests can be deleted this way.')
            return
        }

        const confirmed = await confirmModal(
            `Permanently delete request ${request.request_number}? This removes the request, its receipt and requirement files entirely -- this cannot be undone. Any issued credential stays in the system and verifiable. An Excel backup will download first.`,
            { title: 'Delete this request?', confirmButtonText: 'Back up & delete', icon: 'warning' }
        )
        if (!confirmed) return

        try {
            setDeletingId(request.request_id)
            await exportRequestBackup(request)
        } catch (err) {
            console.error('REQUEST BACKUP ERROR:', err)
            notifyError(friendlyError(err, 'Failed to create the backup, so nothing was deleted.'))
            setDeletingId(null)
            return
        }

        const proceed = await confirmModal(
            `The backup for ${request.request_number} has downloaded. Continue deleting the request now?`,
            { title: 'Backup downloaded', confirmButtonText: 'Delete request', icon: 'warning' }
        )
        if (!proceed) {
            setDeletingId(null)
            return
        }

        const verified = await confirmWithPassword({
            title: 'Confirm with your password',
            text: `Enter your password to permanently delete request ${request.request_number}.`,
        })
        if (!verified) {
            setDeletingId(null)
            return
        }

        try {
            const { error: rpcError } = await supabase.rpc('delete_resolved_request', { p_request_id: request.request_id })
            if (rpcError) throw rpcError

            notifySuccess(`Request ${request.request_number} has been permanently deleted.`)
            setRequests((prev) => prev.filter((r) => r.request_id !== request.request_id))
        } catch (err) {
            console.error('DELETE REQUEST ERROR:', err)
            notifyError(friendlyError(err, 'Failed to delete request.'))
        } finally {
            setDeletingId(null)
        }
    }

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
        if (blockedForReadOnlyViewer(role)) return
        const targets = requests.filter((r) => selectedIds.has(r.request_id))
        if (targets.length === 0) return

        let reason = ''
        if (bulkStatus === 'rejected') {
            const { value } = await Swal.fire({
                title: 'Reject Selected Requests',
                text: `This will reject ${targets.length} request(s). Please provide a reason (shown to every affected student).`,
                allowOutsideClick: false,
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

            const verified = await confirmWithPassword({
                title: 'Confirm with your password',
                text: `Enter your password to reject ${targets.length} request(s).`,
            })
            if (!verified) return
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
            notifyError(friendlyError(err, 'Failed to update selected requests.'))
        } finally {
            setApplyingBulk(false)
        }
    }

    const IN_PROGRESS = ['pending', 'payment_pending', 'receipt_uploaded', 'receipt_verified', 'processing', 'lacking_requirements']
    const countStatus = (statuses) => requests.filter((r) => statuses.includes(r.status)).length
    const chipCount = (key) => (key === 'all' ? requests.length : countStatus(key.split(',')))
    const unassignedCount = requests.filter((r) => r.employeeName === 'Unassigned' && ![...['completed', 'rejected', 'cancelled']].includes(r.status)).length

    return (
        <div>
            <div className="admin-page-header">
                <h1>All Requests</h1>
                <p>Every document request in the system, across all employees.</p>
            </div>

            {!loading && (
                <PageStats
                    stats={[
                        { label: 'All requests', value: requests.length, note: 'Across all employees', Icon: IconFileStack, onClick: () => setChip('all') },
                        { label: 'In progress', value: countStatus(IN_PROGRESS), note: 'Not yet ready to claim', Icon: IconHourglass, onClick: () => setChip(IN_PROGRESS.join(',')) },
                        { label: 'Ready for claiming', value: countStatus(['ready_for_claiming']), note: 'Waiting for the student', Icon: IconPackage, onClick: () => setChip('ready_for_claiming') },
                        { label: 'Completed', value: countStatus(['completed']), note: 'Released to students', Icon: IconCheckCircle, onClick: () => setChip('completed') },
                        { label: 'Unassigned', value: unassignedCount, note: unassignedCount ? 'Need an employee' : 'Every open request has an employee', Icon: IconHourglass, warn: unassignedCount > 0 },
                    ]}
                />
            )}

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
                <input
                    className="admin-search-input admin-search-field"
                    style={{ flex: '1 1 260px', marginBottom: 0 }}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by request number, student number, or document"
                    aria-label="Search requests"
                />
                <button
                    type="button"
                    className="admin-secondary-button"
                    onClick={exportExcel}
                    disabled={exporting || visibleRequests.length === 0}
                >
                    {exporting ? 'Preparing…' : `Export Excel (${visibleRequests.length})`}
                </button>
            </div>

            <div className="admin-filter-row">
                {STATUS_CHIPS.map((chip) => (
                    <button
                        key={chip.key}
                        className={`admin-filter-chip${activeChip === chip.key ? ' active' : ''}`}
                        onClick={() => setChip(chip.key)}
                    >
                        {chip.label}<span className="admin-chip-count">{chipCount(chip.key)}</span>
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
                    <div
                        className="admin-list-card"
                        key={request.request_id}
                    >
                        <div className="admin-list-card-header">
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                <input
                                    type="checkbox"
                                    checked={selectedIds.has(request.request_id)}
                                    onChange={() => toggleSelected(request.request_id)}
                                    style={{ marginTop: 14 }}
                                />
                                <DocumentThumb url={request.documentPreview} name={request.documentName} size={46} />
                                <div>
                                    <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--slate)', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 2 }}>
                                        {request.studentName || `Student ${request.studentNumber}`}
                                    </p>
                                    <h3>{request.documentName}</h3>
                                    <p>
                                        {request.request_number} · Student {request.studentNumber} · {request.employeeName === 'Unassigned' ? <strong style={{ color: 'var(--warning-text, #B45309)' }}>Unassigned</strong> : <>Assigned to {request.employeeName}</>}
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
                                <span>Requested</span>
                                <strong>
                                    {formatDisplayDateTime(request.requested_at) || '-'}
                                </strong>
                            </div>

                            {request.credentialNumber && (
                                <div className="admin-info-field">
                                    <span>Credential</span>
                                    <strong style={{ fontFamily: 'monospace', fontSize: 13 }}>
                                        {request.credentialNumber}
                                        {request.credentialStatus === 'revoked' && (
                                            <span className="admin-status-pill status-rejected" style={{ marginLeft: 6, fontSize: 10.5 }}>Revoked</span>
                                        )}
                                    </strong>
                                </div>
                            )}
                        </div>

                        <div className="admin-card-actions">
                            <button
                                className="admin-link-button"
                                onClick={() => navigate(adminPath(`/requests/${request.request_id}`))}
                            >
                                Open request →
                            </button>

                            {FINISHED_STATUSES.includes(request.status) && (
                                <button
                                    className="admin-link-button is-danger"
                                    style={{ marginLeft: 'auto' }}
                                    onClick={() => deleteRequest(request)}
                                    disabled={deletingId === request.request_id}
                                >
                                    {deletingId === request.request_id ? 'Deleting...' : 'Delete'}
                                </button>
                            )}
                        </div>
                    </div>
                ))
            )}

            {selectedIds.size > 0 && (
                <div style={{
                    position: 'sticky',
                    bottom: 16,
                    marginTop: 16,
                    background: 'var(--blue-dark)',
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
                        className="admin-secondary-button admin-bulkbar-button"
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
