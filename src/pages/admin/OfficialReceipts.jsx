import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activityLog'
import { notifyStudentByStudentId, notifyError, confirmModal } from '../../lib/notify'
import './AdminPages.css'

const CHIPS = [
    { key: 'uploaded', label: 'Awaiting Verification' },
    { key: 'verified', label: 'Verified' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'all', label: 'All' },
]

function OfficialReceipts() {
    const navigate = useNavigate()

    const [receipts, setReceipts] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [activeChip, setActiveChip] = useState('uploaded')
    const [processing, setProcessing] = useState(null)

    useEffect(() => {
        loadReceipts()
    }, [])

    const loadReceipts = async () => {
        try {
            setLoading(true)
            setError('')

            const { data: rows, error: receiptError } = await supabase
                .from('official_receipts')
                .select('receipt_id, request_id, student_id, receipt_number, amount_paid, status, uploaded_at, rejection_reason')
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
                    ? supabase.from('students').select('student_id, student_number').in('student_id', studentIds)
                    : Promise.resolve({ data: [] }),
            ])

            const requestById = Object.fromEntries((requests || []).map((r) => [r.request_id, r]))
            const studentNumberById = Object.fromEntries((students || []).map((s) => [s.student_id, s.student_number]))

            setReceipts(
                data.map((r) => ({
                    ...r,
                    requestNumber: requestById[r.request_id]?.request_number || 'N/A',
                    requestStatus: requestById[r.request_id]?.status || '',
                    studentNumber: studentNumberById[r.student_id] || 'N/A',
                }))
            )

        } catch (err) {
            console.error('OFFICIAL RECEIPTS ERROR:', err)
            setError(err.message || 'Failed to load receipts.')
        } finally {
            setLoading(false)
        }
    }

    const verifyReceipt = async (receipt) => {
        const confirmed = await confirmModal(`Verify receipt ${receipt.receipt_number}?`)
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
                description: `Verified official receipt ${receipt.receipt_number} for request ${receipt.requestNumber} (Registrar Head).`,
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
            notifyError(err.message || 'Failed to verify receipt.')
        } finally {
            setProcessing(null)
        }
    }

    const rejectReceipt = async (receipt) => {
        const reason = window.prompt('Reason for rejecting this receipt:')
        if (!reason || !reason.trim()) return

        try {
            setProcessing(receipt.receipt_id)

            const { data: { user } } = await supabase.auth.getUser()
            const now = new Date().toISOString()

            const { error: receiptError } = await supabase
                .from('official_receipts')
                .update({ status: 'rejected', verified_at: now, rejection_reason: reason.trim() })
                .eq('receipt_id', receipt.receipt_id)

            if (receiptError) throw new Error(receiptError.message)

            const { error: requestError } = await supabase
                .from('document_requests')
                .update({ status: 'rejected', rejection_reason: reason.trim(), updated_at: now })
                .eq('request_id', receipt.request_id)

            if (requestError) throw new Error(requestError.message)

            await logActivity({
                userId: user?.id,
                action: 'reject_receipt',
                tableName: 'official_receipts',
                recordId: receipt.receipt_id,
                description: `Rejected official receipt ${receipt.receipt_number} for request ${receipt.requestNumber}: ${reason.trim()} (Registrar Head).`,
            })

            await notifyStudentByStudentId({
                studentId: receipt.student_id,
                title: 'Payment rejected',
                message: `Your payment for request ${receipt.requestNumber} was rejected: ${reason.trim()}`,
                notificationType: 'payment',
                relatedRequestId: receipt.request_id,
            })

            await loadReceipts()

        } catch (err) {
            console.error('REJECT RECEIPT ERROR:', err)
            notifyError(err.message || 'Failed to reject receipt.')
        } finally {
            setProcessing(null)
        }
    }

    const visibleReceipts = activeChip === 'all' ? receipts : receipts.filter((r) => r.status === activeChip)

    return (
        <div>
            <div className="admin-page-header">
                <h1>Official Receipts</h1>
                <p>Every official receipt uploaded by students, across all employees.</p>
            </div>

            <div className="admin-filter-row">
                {CHIPS.map((chip) => (
                    <button
                        key={chip.key}
                        className={`admin-filter-chip${activeChip === chip.key ? ' active' : ''}`}
                        onClick={() => setActiveChip(chip.key)}
                    >
                        {chip.label}
                    </button>
                ))}
            </div>

            {error && <div className="admin-error-box">{error}</div>}

            {loading ? (
                <p className="admin-loading">Loading receipts...</p>
            ) : visibleReceipts.length === 0 ? (
                <div className="admin-empty">No receipts match this view.</div>
            ) : (
                visibleReceipts.map((r) => (
                    <div className="admin-list-card" key={r.receipt_id}>
                        <div className="admin-list-card-header">
                            <div>
                                <h3>{r.receipt_number}</h3>
                                <p>{r.requestNumber} · Student {r.studentNumber}</p>
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
                                <strong>{r.uploaded_at ? new Date(r.uploaded_at).toLocaleDateString() : 'N/A'}</strong>
                            </div>
                        </div>

                        {r.rejection_reason && (
                            <div className="admin-error-box" style={{ marginBottom: 0 }}>Rejected: {r.rejection_reason}</div>
                        )}

                        <div style={{ display: 'flex', gap: 16 }}>
                            <button className="admin-link-button" onClick={() => navigate(`/admin/requests/${r.request_id}`)}>
                                Open request →
                            </button>

                            {r.status === 'uploaded' && (
                                <>
                                    <button className="admin-link-button" onClick={() => verifyReceipt(r)} disabled={processing === r.receipt_id}>
                                        {processing === r.receipt_id ? 'Working...' : 'Verify'}
                                    </button>
                                    <button className="admin-link-button" style={{ color: 'var(--red)' }} onClick={() => rejectReceipt(r)} disabled={processing === r.receipt_id}>
                                        Reject
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                ))
            )}
        </div>
    )
}

export default OfficialReceipts
