import { useEffect, useState } from 'react'
import PageStats from '../../components/PageStats'
import { IconHourglass, IconCheckCircle, IconXCircle, IconBarChart } from './icons'
import { IconReceipt } from '../student/icons'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useLiveRefresh } from '../../lib/useLiveRefresh'
import { logActivity } from '../../lib/activityLog'
import { notifyStudentByStudentId, notifyError, notifyWarning, confirmModal } from '../../lib/notify'
import { SkeletonList } from '../../components/Skeleton'
import Modal from '../../components/Modal'
import './AdminPages.css'
import ReceiptChecks from '../../components/ReceiptChecks'
import { adminPath } from '../../lib/portalPaths'
import { blockedForReadOnlyViewer } from '../../lib/viewOnlyGuard'
import { friendlyError } from '../../lib/friendlyError'

function formatDate(value) {
    if (!value) return ''
    return new Date(value).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

const CHIPS = [
    { key: 'uploaded', label: 'Uploaded' },
    { key: 'verified', label: 'Verified' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'all', label: 'All' },
]

function OfficialReceipts() {
    const { role } = useOutletContext() || {}
    const navigate = useNavigate()

    const [receipts, setReceipts] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [activeChip, setActiveChip] = useState('uploaded')
    const [processing, setProcessing] = useState(null)

    const [rejectTarget, setRejectTarget] = useState(null)
    const [rejectionReason, setRejectionReason] = useState('')

    useEffect(() => {
        loadReceipts()
    }, [])

    const loadReceipts = async ({ silent = false } = {}) => {
        try {
            if (!silent) setLoading(true)
            setError('')

            const { data: rows, error: receiptError } = await supabase
                .from('official_receipts')
                .select('*')
                .order('uploaded_at', { ascending: false })

            if (receiptError) {
                throw new Error('Failed to load receipts: ' + receiptError.message)
            }

            const data = rows || []
            const requestIds = [...new Set(data.map((r) => r.request_id).filter(Boolean))]
            const studentIds = [...new Set(data.map((r) => r.student_id).filter(Boolean))]

            const [{ data: requests }, { data: students }] = await Promise.all([
                requestIds.length
                    ? supabase.from('document_requests').select('request_id, request_number, status').in('request_id', requestIds)
                    : Promise.resolve({ data: [] }),
                studentIds.length
                    ? supabase.from('students').select('student_id, user_id, student_number').in('student_id', studentIds)
                    : Promise.resolve({ data: [] }),
            ])

            const userIds = [...new Set((students || []).map((s) => s.user_id).filter(Boolean))]

            const { data: profiles } = userIds.length
                ? await supabase.from('profiles').select('user_id, first_name, last_name').in('user_id', userIds)
                : { data: [] }

            const profileByUserId = Object.fromEntries((profiles || []).map((p) => [p.user_id, p]))
            const studentById = Object.fromEntries((students || []).map((s) => [s.student_id, s]))

            const requestById = Object.fromEntries((requests || []).map((r) => [r.request_id, r]))

            setReceipts(
                data.map((r) => {
                    const student = studentById[r.student_id]
                    const profile = student ? profileByUserId[student.user_id] : null
                    return {
                        ...r,
                        requestNumber: requestById[r.request_id]?.request_number || 'N/A',
                        requestStatus: requestById[r.request_id]?.status || '',
                        studentNumber: student?.student_number || 'N/A',
                        studentName: profile ? `${profile.first_name} ${profile.last_name}`.trim() : 'Unknown',
                    }
                })
            )

        } catch (err) {
            console.error('OFFICIAL RECEIPTS ERROR:', err)
            setError(err.message || 'Failed to load receipts.')
        } finally {
            setLoading(false)
        }
    }

    // Update in place when requests change -- no manual refresh needed.
    useLiveRefresh(['official_receipts'], loadReceipts)

    const verifyReceipt = async (receipt) => {
        if (blockedForReadOnlyViewer(role)) return
        const confirmed = await confirmModal(`Verify the receipt for ${receipt.requestNumber}?`)
        if (!confirmed) return

        try {
            setProcessing(receipt.receipt_id)

            const { data: { user } } = await supabase.auth.getUser()
            const now = new Date().toISOString()

            const { error: receiptError } = await supabase
                .from('official_receipts')
                .update({ status: 'verified', verified_at: now, rejection_reason: null })
                .eq('receipt_id', receipt.receipt_id)

            if (receiptError) throw new Error(receiptError.message)

            const { error: requestError } = await supabase
                .from('document_requests')
                .update({ status: 'receipt_verified', updated_at: now })
                .eq('request_id', receipt.request_id)

            if (requestError) throw new Error(requestError.message)

            await logActivity({
                userId: user?.id,
                action: 'verify_receipt',
                tableName: 'official_receipts',
                recordId: receipt.receipt_id,
                description: `Verified official receipt for request "${receipt.requestNumber}" (Registrar Head).`,
            })

            await notifyStudentByStudentId({
                studentId: receipt.student_id,
                title: 'Payment verified',
                message: `Your payment for request ${receipt.requestNumber} has been verified. Your document is now being processed.`,
                notificationType: 'request_update',
                relatedRequestId: receipt.request_id,
            })

            await loadReceipts()

        } catch (err) {
            console.error('VERIFY RECEIPT ERROR:', err)
            notifyError(friendlyError(err, 'Failed to verify receipt.'))
        } finally {
            setProcessing(null)
        }
    }

    const openRejectModal = (receipt) => {
        setRejectTarget(receipt)
        setRejectionReason('')
    }

    const closeRejectModal = () => {
        if (processing) return
        setRejectTarget(null)
        setRejectionReason('')
    }

    const confirmRejectReceipt = async () => {
        if (blockedForReadOnlyViewer(role)) return
        if (!rejectionReason.trim()) {
            notifyWarning('Please enter a rejection reason.')
            return
        }

        const receipt = rejectTarget

        try {
            setProcessing(receipt.receipt_id)

            const { data: { user } } = await supabase.auth.getUser()
            const now = new Date().toISOString()
            const reason = rejectionReason.trim()

            const { error: receiptError } = await supabase
                .from('official_receipts')
                .update({ status: 'rejected', verified_at: now, rejection_reason: reason })
                .eq('receipt_id', receipt.receipt_id)

            if (receiptError) throw new Error(receiptError.message)

            const { error: requestError } = await supabase
                .from('document_requests')
                .update({ status: 'rejected', rejection_reason: reason, updated_at: now })
                .eq('request_id', receipt.request_id)

            if (requestError) throw new Error(requestError.message)

            await logActivity({
                userId: user?.id,
                action: 'reject_receipt',
                tableName: 'official_receipts',
                recordId: receipt.receipt_id,
                description: `Rejected official receipt for request "${receipt.requestNumber}": "${reason}" (Registrar Head).`,
            })

            await notifyStudentByStudentId({
                studentId: receipt.student_id,
                title: 'Payment rejected',
                message: `Your payment for request ${receipt.requestNumber} was rejected: ${reason}`,
                notificationType: 'payment',
                relatedRequestId: receipt.request_id,
            })

            setRejectTarget(null)
            setRejectionReason('')
            await loadReceipts()

        } catch (err) {
            console.error('REJECT RECEIPT ERROR:', err)
            notifyError(friendlyError(err, 'Failed to reject receipt.'))
        } finally {
            setProcessing(null)
        }
    }

    const visibleReceipts = activeChip === 'all' ? receipts : receipts.filter((r) => r.status === activeChip)
    const countFor = (key) => (key === 'all' ? receipts.length : receipts.filter((r) => r.status === key).length)
    const verifiedTotal = receipts.filter((r) => r.status === 'verified').reduce((sum, r) => sum + Number(r.amount_paid || 0), 0)
    const peso = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

    return (
        <div>
            <div className="admin-page-header">
                <h1>Official Receipts</h1>
                <p>Every official receipt uploaded by students, across all employees.</p>
            </div>

            {!loading && (
                <PageStats
                    stats={[
                        { label: 'Uploaded', value: countFor('uploaded'), note: countFor('uploaded') ? 'Waiting to be verified' : 'Nothing to verify', Icon: IconHourglass, warn: countFor('uploaded') > 0, onClick: () => setActiveChip('uploaded') },
                        { label: 'Verified', value: countFor('verified'), note: 'Payment confirmed', Icon: IconCheckCircle, onClick: () => setActiveChip('verified') },
                        { label: 'Rejected', value: countFor('rejected'), note: 'Student must re-upload', Icon: IconXCircle, onClick: () => setActiveChip('rejected') },
                        { label: 'Amount verified', value: peso(verifiedTotal), note: 'Paid at the Finance Office', Icon: IconBarChart },
                    ]}
                />
            )}

            <div className="admin-filter-row">
                {CHIPS.map((chip) => (
                    <button
                        key={chip.key}
                        className={`admin-filter-chip${activeChip === chip.key ? ' active' : ''}`}
                        onClick={() => setActiveChip(chip.key)}
                    >
                        {chip.label}<span className="admin-chip-count">{countFor(chip.key)}</span>
                    </button>
                ))}
            </div>

            {error && <div className="admin-error-box">{error}</div>}

            {loading ? (
                <SkeletonList count={3} />
            ) : visibleReceipts.length === 0 ? (
                <div className="admin-empty">No receipts match this view.</div>
            ) : (
                visibleReceipts.map((r) => (
                    <div className="admin-list-card" key={r.receipt_id}>
                        <div className="admin-list-card-header">
                            <div className="admin-card-title">
                                <span className={`admin-avatar is-square${r.status === 'verified' ? '' : r.status === 'rejected' ? ' is-muted' : ''}`} aria-hidden="true"><IconReceipt /></span>
                                <div>
                                    <h3>{r.requestNumber}{r.receipt_number && <span className="admin-card-badge">OR {r.receipt_number}</span>}</h3>
                                    <p>{r.studentName} ({r.studentNumber})</p>
                                </div>
                            </div>
                            <span className={`admin-status-pill status-${r.status}`}>{r.status}</span>
                        </div>

                        <div className="admin-info-grid">
                            <div className="admin-info-field">
                                <span>Amount Paid</span>
                                <strong>₱{Number(r.amount_paid || 0).toFixed(2)}</strong>
                            </div>
                            <div className="admin-info-field">
                                <span>Uploaded</span>
                                <strong>{formatDate(r.uploaded_at) || 'N/A'}</strong>
                            </div>
                        </div>

                        <ReceiptChecks receipt={r} compact />

                        {r.rejection_reason && (
                            <div className="admin-error-box" style={{ marginBottom: 0 }}>Rejected: {r.rejection_reason}</div>
                        )}

                        <div className="admin-card-actions">
                            <button className="admin-link-button" onClick={() => navigate(adminPath(`/requests/${r.request_id}`))}>
                                Open request →
                            </button>

                            {r.status === 'uploaded' && (
                                <>
                                    <button className="admin-link-button is-success" onClick={() => verifyReceipt(r)} disabled={processing === r.receipt_id}>
                                        {processing === r.receipt_id ? 'Working...' : 'Verify'}
                                    </button>
                                    <button className="admin-link-button is-danger" onClick={() => openRejectModal(r)} disabled={processing === r.receipt_id}>
                                        Reject
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                ))
            )}

            {rejectTarget && (
                <Modal title="Reject Receipt" subtitle="The student sees your reason and uploads a new photo." icon={IconXCircle} maxWidth={480} onClose={closeRejectModal}>
                    <p style={{ fontSize: 13.5, marginBottom: 12 }}>
                        Enter the reason why the receipt for <strong>{rejectTarget.requestNumber}</strong> is being rejected.
                    </p>

                    <textarea
                        className="admin-search-input"
                        style={{ width: '100%', minHeight: 90, marginBottom: 16 }}
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Example: Receipt image is blurry and cannot be verified."
                        disabled={processing === rejectTarget.receipt_id}
                    />

                    <div className="app-modal-actions">
                        <button
                            className="admin-secondary-button"
                            onClick={closeRejectModal}
                            disabled={processing === rejectTarget.receipt_id}
                        >
                            Cancel
                        </button>

                        <button
                            className="admin-danger-button"
                            onClick={confirmRejectReceipt}
                            disabled={processing === rejectTarget.receipt_id}
                        >
                            {processing === rejectTarget.receipt_id ? 'Rejecting...' : 'Confirm Rejection'}
                        </button>
                    </div>
                </Modal>
            )}
        </div>
    )
}

export default OfficialReceipts
