import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useLiveRefresh } from '../../lib/useLiveRefresh'
import { formatDisplayDateTime } from '../../lib/formatDate'
import { SkeletonList } from '../../components/Skeleton'
import PageStats from '../../components/PageStats'
import { IconHourglass, IconCheckCircle, IconXCircle } from '../admin/icons'
import { IconReceipt } from './icons'
import './StudentPages.css'

function UploadReceiptList() {
    const navigate = useNavigate()

    const [requests, setRequests] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        loadRequests()
    }, [])

    const loadRequests = async ({ silent = false } = {}) => {
        try {
            if (!silent) setLoading(true)
            setError('')

            const {
                data: { user },
                error: userError
            } = await supabase.auth.getUser()

            if (userError || !user) {
                throw new Error('You are not logged in.')
            }

            const { data: student, error: studentError } = await supabase
                .from('students')
                .select('student_id')
                .eq('user_id', user.id)
                .single()

            if (studentError || !student) {
                throw new Error('Student record could not be found.')
            }

            const { data: requestRows, error: requestError } = await supabase
                .from('document_requests')
                .select(`
                    request_id,
                    request_number,
                    document_type_id,
                    total_amount,
                    status,
                    requested_at
                `)
                .eq('student_id', student.student_id)
                .in('status', ['pending', 'processing'])
                .order('requested_at', { ascending: false })

            if (requestError) {
                throw new Error('Failed to load requests: ' + requestError.message)
            }

            if (!requestRows || requestRows.length === 0) {
                setRequests([])
                return
            }

            const documentTypeIds = [
                ...new Set(requestRows.map((r) => r.document_type_id).filter(Boolean))
            ]

            const { data: documentTypes } = documentTypeIds.length
                ? await supabase
                    .from('document_types')
                    .select('document_type_id, document_name')
                    .in('document_type_id', documentTypeIds)
                : { data: [] }

            const documentNameById = Object.fromEntries(
                (documentTypes || []).map((d) => [d.document_type_id, d.document_name])
            )

            const requestIds = requestRows.map((r) => r.request_id)

            const { data: receipts } = await supabase
                .from('official_receipts')
                .select('request_id, status, uploaded_at, rejection_reason')
                .in('request_id', requestIds)

            const receiptByRequestId = Object.fromEntries(
                (receipts || []).map((r) => [r.request_id, r])
            )

            const merged = requestRows.map((request) => ({
                ...request,
                documentName: documentNameById[request.document_type_id] || 'Document',
                receipt: receiptByRequestId[request.request_id] || null,
            }))

            setRequests(merged)

        } catch (err) {
            console.error('UPLOAD RECEIPT LIST ERROR:', err)
            setError(err.message || 'Failed to load requests.')
        } finally {
            setLoading(false)
        }
    }

    // Update in place when requests change -- no manual refresh needed.
    useLiveRefresh(['document_requests', 'official_receipts'], loadRequests)

    return (
        <div>
            <div className="student-page-header">
                <h1>Payments &amp; Receipts</h1>
                <p>Pay your fees at the HCDC Finance Office, then upload a clear photo of your Official Receipt here. The Registrar will check it and let you know.</p>
            </div>

            {error && <div className="student-error-box">{error}</div>}

            {!loading && requests.length > 0 && (
                <PageStats
                    stats={[
                        { label: 'To upload', value: requests.filter((r) => !r.receipt).length, note: 'Pay at the Finance Office first', Icon: IconReceipt, warn: requests.some((r) => !r.receipt) },
                        { label: 'Waiting for verification', value: requests.filter((r) => r.receipt?.status === 'uploaded').length, note: 'Uploaded receipts', Icon: IconHourglass },
                        { label: 'Needs a new photo', value: requests.filter((r) => r.receipt?.status === 'rejected').length, note: 'Receipt was not accepted', Icon: IconXCircle, warn: requests.some((r) => r.receipt?.status === 'rejected') },
                        { label: 'Amount due', value: `₱${requests.filter((r) => !r.receipt || r.receipt.status === 'rejected').reduce((sum, r) => sum + Number(r.total_amount || 0), 0).toFixed(2)}`, note: 'Not yet uploaded', Icon: IconCheckCircle },
                    ]}
                />
            )}

            {loading ? (
                <SkeletonList count={3} />
            ) : requests.length === 0 ? (
                <div className="student-empty">
                    No requests currently need a receipt. New requests will appear
                    here once submitted.
                </div>
            ) : (
                requests.map((request) => (
                    <div className="student-list-card" key={request.request_id}>

                        <div className="student-list-card-header">
                            <div className="ui-card-title">
                            <span className={`ui-avatar is-square${request.receipt?.status === 'verified' ? '' : request.receipt ? '' : ' is-muted'}`} aria-hidden="true"><IconReceipt /></span>
                            <div>
                                <h3>{request.documentName}</h3>
                                <p>Request {request.request_number}</p>
                                {request.requested_at && <p>Requested {formatDisplayDateTime(request.requested_at)}</p>}
                            </div>
                            </div>

                            <span className={`student-status-pill status-${request.receipt?.status || 'not_uploaded'}`}>
                                {request.receipt?.status
                                    ? request.receipt.status.replace('_', ' ')
                                    : 'Not uploaded'}
                            </span>
                        </div>

                        <div className="student-info-grid">
                            <div className="student-info-field">
                                <span>Amount Due</span>
                                <strong>₱{Number(request.total_amount || 0).toFixed(2)}</strong>
                            </div>

                            <div className="student-info-field">
                                <span>Request Status</span>
                                <strong style={{ textTransform: 'capitalize' }}>{request.status.replace(/_/g, ' ')}</strong>
                            </div>
                        </div>

                        {request.receipt?.rejection_reason && (
                            <div className="student-error-box" style={{ marginBottom: 0 }}>
                                Rejected: {request.receipt.rejection_reason}
                            </div>
                        )}

                        <div className="ui-card-actions">
                            <button
                                className="student-link-button"
                                onClick={() => navigate(`/student/request/${request.request_id}/upload-receipt`)}
                            >
                                {!request.receipt
                                    ? 'Upload receipt →'
                                    : request.receipt.status === 'rejected'
                                        ? 'Upload a clearer receipt →'
                                        : 'View receipt →'}
                            </button>
                        </div>

                    </div>
                ))
            )}
        </div>
    )
}

export default UploadReceiptList
