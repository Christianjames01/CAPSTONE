import { useEffect, useState } from 'react'
import { isShrinkable, MAX_ORIGINAL_IMAGE_MB, shrinkImage } from '../../lib/shrinkImage'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatDisplayDateTime } from '../../lib/formatDate'
import { describeRequest } from '../../lib/studentProgress'
import { TaskSteps } from './StudentUi'
import { SkeletonPage } from '../../components/Skeleton'
import '../auth/Auth.css'
import './StudentPages.css'
import { useLiveRefresh } from '../../lib/useLiveRefresh'

// SHA-256 of the file, so staff are warned when the same photo is uploaded
// for another request.
async function sha256Hex(file) {
    try {
        const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
        return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
    } catch {
        return null
    }
}

// Saves with the receipt number, file fingerprint and group; before the
// receipt-safeguards migration adds file_hash / receipt_group_id, retries
// with just the receipt number.
async function saveWithSafeguards(run, safeguards) {
    const result = await run(safeguards)
    if (result.error && /file_hash|receipt_group_id/i.test(result.error.message || '')) {
        return run({ receipt_number: safeguards.receipt_number })
    }
    return result
}

// Request statuses after the payment was verified.
const PAID_STATUSES = ['receipt_verified', 'processing', 'lacking_requirements', 'ready_for_claiming', 'completed']

function UploadReceipt() {
    const { requestId } = useParams()
    const navigate = useNavigate()

    const [request, setRequest] = useState(null)
    const [student, setStudent] = useState(null)

    const [receiptFile, setReceiptFile] = useState(null)
    const [currentReceipt, setCurrentReceipt] = useState(null)

    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')
    // Other requests submitted together with this one that still need
    // payment -- one Finance Office receipt can cover them too.
    const [siblings, setSiblings] = useState([])
    const [includeIds, setIncludeIds] = useState(() => new Set())
    // The number printed on the Finance Office receipt. Required: the same
    // receipt can't be used for another request (checked by the database).
    const [receiptNumber, setReceiptNumber] = useState('')

    useLiveRefresh(['official_receipts', 'document_requests'], (options) => loadRequest(options))

    useEffect(() => {
        if (!requestId) {
            setError('Request ID is missing.')
            setLoading(false)
            return
        }

        loadRequest()
    }, [requestId])

    const loadRequest = async ({ silent = false } = {}) => {
        try {
            if (!silent) setLoading(true)
            setError('')

            const {
                data: { user },
                error: userError
            } = await supabase.auth.getUser()

            if (userError) {
                throw new Error(userError.message)
            }

            if (!user) {
                throw new Error(
                    'You are not logged in.'
                )
            }

            const {
                data: studentData,
                error: studentError
            } = await supabase
                .from('students')
                .select(`
                    student_id,
                    user_id,
                    student_number
                `)
                .eq('user_id', user.id)
                .single()

            if (studentError || !studentData) {
                throw new Error(
                    'Student record could not be found.'
                )
            }

            setStudent(studentData)

            const {
                data: requestData,
                error: requestError
            } = await supabase
                .from('document_requests')
                .select(`
                    request_id,
                    request_number,
                    student_id,
                    quantity,
                    unit_fee,
                    total_amount,
                    status,
                    requested_at
                `)
                .eq(
                    'request_id',
                    requestId
                )
                .eq(
                    'student_id',
                    studentData.student_id
                )
                .single()

            if (requestError || !requestData) {
                throw new Error(
                    'Request could not be found.'
                )
            }

            setRequest(requestData)

            const {
                data: existingReceipt,
                error: receiptError
            } = await supabase
                .from('official_receipts')
                .select(`
                    receipt_id,
                    receipt_number,
                    amount_paid,
                    receipt_file_name,
                    status,
                    uploaded_at,
                    rejection_reason,
                    remarks
                `)
                .eq(
                    'request_id',
                    requestId
                )
                .eq(
                    'student_id',
                    studentData.student_id
                )
                .maybeSingle()

            if (receiptError) {
                console.error(
                    'Receipt lookup error:',
                    receiptError
                )
            }

            setCurrentReceipt(existingReceipt || null)

            // Rejected: keep the same receipt number -- only a clearer photo
            // is needed.
            if (!silent && existingReceipt?.status === 'rejected' && existingReceipt.receipt_number) {
                setReceiptNumber(existingReceipt.receipt_number)
            }

            // Requests submitted together (batch_id; the column may not
            // exist before its migration -- then there are no siblings).
            const { data: batchRow } = await supabase
                .from('document_requests')
                .select('batch_id')
                .eq('request_id', requestId)
                .maybeSingle()

            if (batchRow?.batch_id) {
                const { data: siblingRows } = await supabase
                    .from('document_requests')
                    .select('request_id, request_number, total_amount, status, document_type_id')
                    .eq('batch_id', batchRow.batch_id)
                    .eq('student_id', studentData.student_id)
                    .neq('request_id', requestId)
                    .in('status', ['pending', 'payment_pending', 'rejected'])

                const typeIds = [...new Set((siblingRows || []).map((r) => r.document_type_id))]
                const { data: types } = typeIds.length
                    ? await supabase.from('document_types').select('document_type_id, document_name').in('document_type_id', typeIds)
                    : { data: [] }
                const nameById = Object.fromEntries((types || []).map((t) => [t.document_type_id, t.document_name]))

                const list = (siblingRows || []).map((r) => ({ ...r, documentName: nameById[r.document_type_id] || 'Document' }))
                setSiblings(list)
                if (!silent) setIncludeIds(new Set(list.map((r) => r.request_id)))
            } else {
                setSiblings([])
                if (!silent) setIncludeIds(new Set())
            }

        } catch (error) {
            console.error(
                'LOAD RECEIPT ERROR:',
                error
            )

            setError(
                error.message ||
                'Failed to load request.'
            )

        } finally {
            setLoading(false)
        }
    }

    // One receipt at a time: once uploaded it waits for the Registrar. A new
    // one can be uploaded only if that one is rejected (and never after it's
    // verified or the request is cancelled).
    const receiptStatus = currentReceipt?.status || null
    const verified = receiptStatus === 'verified' || PAID_STATUSES.includes(request?.status)
    const awaitingReview = !!currentReceipt && receiptStatus !== 'rejected' && !verified
    const cancelled = request?.status === 'cancelled'
    const canUpload = !awaitingReview && !verified && !cancelled

    const handleUpload = async (e) => {
        e.preventDefault()

        setError('')
        setMessage('')

        if (!canUpload) {
            setError(awaitingReview
                ? 'Your receipt is still waiting for the Registrar. You can upload a new one only if it is rejected.'
                : 'A receipt can no longer be uploaded for this request.')
            return
        }

        if (!receiptNumber.trim()) {
            setError('Please enter the receipt number printed on your official receipt.')
            return
        }

        if (!receiptFile) {
            setError(
                'Please select your official receipt file.'
            )
            return
        }

        if (!request || !student) {
            setError(
                'Request or student information is missing.'
            )
            return
        }

        const paid = Number(request.total_amount)

        const allowedTypes = [
            'image/jpeg',
            'image/png',
            'image/webp',
            'application/pdf'
        ]

        if (
            !allowedTypes.includes(
                receiptFile.type
            )
        ) {
            setError(
                'Only JPG, PNG, WEBP, and PDF files are allowed.'
            )
            return
        }

        const maxSize =
            5 * 1024 * 1024

        if (isShrinkable(receiptFile) && receiptFile.size > MAX_ORIGINAL_IMAGE_MB * 1024 * 1024) {
            setError(`Photos must not exceed ${MAX_ORIGINAL_IMAGE_MB} MB.`)
            return
        }

        if (!isShrinkable(receiptFile) && receiptFile.size > maxSize) {
            setError(
                'File size must not exceed 5 MB.'
            )
            return
        }

        try {
            setUploading(true)

            // Check the latest state first (another tab or device may have
            // uploaded one in the meantime).
            const { data: latest } = await supabase
                .from('official_receipts')
                .select('status')
                .eq('request_id', requestId)
                .eq('student_id', student.student_id)
                .maybeSingle()

            if (latest && latest.status !== 'rejected') {
                await loadRequest({ silent: true })
                throw new Error(latest.status === 'verified'
                    ? 'Your payment is already verified.'
                    : 'A receipt was already uploaded and is waiting for the Registrar. You can upload a new one only if it is rejected.')
            }

            // Photos are shrunk before upload (a few hundred KB instead of
            // several MB); PDFs go up as they are.
            const uploadFile = await shrinkImage(receiptFile)
            if (uploadFile.size > maxSize) {
                throw new Error('File size must not exceed 5 MB.')
            }

            // One upload = one receipt: link every request it pays for
            // (staff check them together), and fingerprint the file so a
            // reused photo can be spotted.
            const coverSiblings = siblings.filter((sib) => includeIds.has(sib.request_id))
            const groupId = coverSiblings.length > 0 ? crypto.randomUUID() : null
            const fileHash = await sha256Hex(receiptFile)
            const safeguards = { receipt_number: receiptNumber.trim().toUpperCase(), file_hash: fileHash, receipt_group_id: groupId }

            const fileExtension =
                uploadFile.name
                    .split('.')
                    .pop()
                    .toLowerCase()

            const fileName =
                `${requestId}-${Date.now()}.${fileExtension}`

            const filePath =
                `${student.student_id}/${fileName}`

            console.log(
                'Uploading receipt:',
                filePath
            )

            const {
                error: uploadError
            } = await supabase.storage
                .from('official-receipts')
                .upload(
                    filePath,
                    uploadFile,
                    {
                        cacheControl: '3600',
                        upsert: false
                    }
                )

            if (uploadError) {
                throw new Error(
                    'Receipt file upload failed: ' +
                    uploadError.message
                )
            }

            const {
                data: existingReceipt
            } = await supabase
                .from('official_receipts')
                .select('receipt_id')
                .eq(
                    'request_id',
                    requestId
                )
                .eq(
                    'student_id',
                    student.student_id
                )
                .maybeSingle()

            let databaseError = null

            if (existingReceipt) {

                const {
                    error
                } = await saveWithSafeguards((extra) => supabase
                    .from('official_receipts')
                    .update({
                        ...extra,
                        amount_paid: paid,

                        receipt_file_name:
                            receiptFile.name,

                        receipt_file_path:
                            filePath,

                        receipt_file_url:
                            filePath,

                        status: 'uploaded',

                        uploaded_at:
                            new Date().toISOString(),

                        verified_by: null,

                        verified_at: null,

                        rejection_reason: null,

                        remarks: null
                    })
                    .eq(
                        'receipt_id',
                        existingReceipt.receipt_id
                    ), safeguards)

                databaseError = error

            } else {

                const {
                    error
                } = await saveWithSafeguards((extra) => supabase
                    .from('official_receipts')
                    .insert({
                        ...extra,
                        request_id:
                            requestId,

                        student_id:
                            student.student_id,

                        amount_paid:
                            paid,

                        receipt_file_name:
                            receiptFile.name,

                        receipt_file_path:
                            filePath,

                        receipt_file_url:
                            filePath,

                        status:
                            'uploaded',

                        uploaded_at:
                            new Date().toISOString()
                    }), safeguards)

                databaseError = error
            }

            if (databaseError) {
                await supabase.storage
                    .from('official-receipts')
                    .remove([filePath])

                throw new Error(
                    'Failed to save receipt: ' +
                    databaseError.message
                )
            }

            const { data: updatedRequest, error: requestStatusError } = await supabase
                .from('document_requests')
                .update({
                    status: 'receipt_uploaded',
                    updated_at: new Date().toISOString()
                })
                .eq('request_id', requestId)
                .in('status', ['pending', 'payment_pending', 'rejected'])
                .select()
                .maybeSingle()

            if (requestStatusError) {
                console.error(
                    'UPDATE REQUEST STATUS ERROR:',
                    requestStatusError
                )
                setError(
                    'Your receipt was uploaded, but the request status could not be updated automatically. ' +
                    'Please contact the Registrar\'s Office so this doesn\'t sit unnoticed: ' + requestStatusError.message
                )
            } else {
                setMessage(
                    'Official receipt uploaded successfully. Please wait for the Registrar to verify your payment.'
                )
            }

            if (updatedRequest) {
                setRequest(updatedRequest)
            }

            const failed = []

            for (const sib of coverSiblings) {
                const { data: sibReceipt } = await supabase
                    .from('official_receipts')
                    .select('receipt_id')
                    .eq('request_id', sib.request_id)
                    .eq('student_id', student.student_id)
                    .maybeSingle()

                const receiptFields = {
                    amount_paid: Number(sib.total_amount),
                    receipt_file_name: receiptFile.name,
                    receipt_file_path: filePath,
                    receipt_file_url: filePath,
                    status: 'uploaded',
                    uploaded_at: new Date().toISOString(),
                }

                const { error: sibError } = sibReceipt
                    ? await saveWithSafeguards((extra) => supabase
                        .from('official_receipts')
                        .update({ ...extra, ...receiptFields, verified_by: null, verified_at: null, rejection_reason: null, remarks: null })
                        .eq('receipt_id', sibReceipt.receipt_id), safeguards)
                    : await saveWithSafeguards((extra) => supabase
                        .from('official_receipts')
                        .insert({ ...extra, ...receiptFields, request_id: sib.request_id, student_id: student.student_id }), safeguards)

                if (sibError) {
                    failed.push(sib.request_number)
                    continue
                }

                await supabase
                    .from('document_requests')
                    .update({ status: 'receipt_uploaded', updated_at: new Date().toISOString() })
                    .eq('request_id', sib.request_id)
                    .in('status', ['pending', 'payment_pending', 'rejected'])
            }

            if (coverSiblings.length > 0) {
                const covered = coverSiblings.filter((sib) => !failed.includes(sib.request_number)).map((sib) => sib.request_number)
                if (covered.length) {
                    setMessage((prev) => `${prev} It was also applied to ${covered.join(', ')}.`)
                }
                if (failed.length) {
                    setError(`The receipt could not be applied to ${failed.join(', ')}. Upload it from ${failed.length === 1 ? 'that request' : 'those requests'} separately.`)
                }
                setSiblings((prev) => prev.filter((sib) => !includeIds.has(sib.request_id) || failed.includes(sib.request_number)))
            }

            // Lock the form: this receipt now waits for the Registrar.
            setCurrentReceipt({
                ...(currentReceipt || {}),
                status: 'uploaded',
                receipt_number: safeguards.receipt_number,
                receipt_file_name: receiptFile.name,
                uploaded_at: new Date().toISOString(),
                rejection_reason: null,
            })
            setReceiptFile(null)
            setReceiptNumber('')

            const fileInput =
                document.getElementById(
                    'receipt-file'
                )

            if (fileInput) {
                fileInput.value = ''
            }

        } catch (error) {
            console.error(
                'UPLOAD RECEIPT ERROR:',
                error
            )

            setError(
                error.message ||
                'Failed to upload official receipt.'
            )

        } finally {
            setUploading(false)
        }
    }

    if (loading) {
        return (
            <SkeletonPage
                portal="student"
                blocks={[
                    { type: 'back' },
                    { type: 'header', titleWidth: 280 },
                    { type: 'card', fields: 4, titleWidth: 180 },
                    { type: 'card', lines: 2, media: 150, buttons: 1, titleWidth: 160 },
                ]}
            />
        )
    }

    if (error && !request) {
        return (
            <div>
                <div className="student-card">
                    <h2 style={{ fontSize: 16, marginBottom: 12 }}>Unable to Load</h2>
                    <div className="student-error-box">{error}</div>
                    <button className="student-link-button" onClick={() => navigate('/student/my-requests')}>
                        Back to My Requests
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div>
            <button className="student-link-button" style={{ marginBottom: 16 }} onClick={() => navigate(`/student/request/${requestId}`)}>
                ← Back to Request
            </button>

            <div className="student-page-header">
                <h1>Upload Official Receipt</h1>
                <p>Pay the amount below at the HCDC Finance Office first. Then upload a clear photo of your Official Receipt so the Registrar can check your payment.</p>
            </div>

            <TaskSteps
                steps={['Pay at the HCDC Finance Office', 'Upload your Official Receipt', 'The Registrar checks it']}
                current={currentReceipt?.status === 'verified' ? 3 : currentReceipt && currentReceipt.status !== 'rejected' ? 2 : 1}
            />

            <div className="student-card">
                <h2 style={{ fontSize: 16, marginBottom: 16 }}>Request Information</h2>

                <div className="student-info-grid">
                    <div className="student-info-field">
                        <span>Request Number</span>
                        <strong>{request.request_number}</strong>
                    </div>

                    <div className="student-info-field">
                        <span>Requested</span>
                        <strong>{request.requested_at ? formatDisplayDateTime(request.requested_at) : 'N/A'}</strong>
                    </div>

                    <div className="student-info-field">
                        <span>Amount Due</span>
                        <strong>₱{Number(request.total_amount || 0).toFixed(2)}</strong>
                    </div>

                    <div className="student-info-field">
                        <span>Request Status</span>
                        <span className={`sd-status tone-${describeRequest(request).tone}`}>{describeRequest(request).statusLabel}</span>
                    </div>
                </div>

                {currentReceipt && (
                    <div className={`student-notice tone-${
                        currentReceipt.status === 'verified' ? 'success' : currentReceipt.status === 'rejected' ? 'danger' : 'info'
                    }`}>
                        <strong>
                            {currentReceipt.status === 'verified'
                                ? 'Payment Verified'
                                : currentReceipt.status === 'rejected'
                                    ? 'Receipt Rejected'
                                    : 'Receipt Uploaded'}
                        </strong>
                        <p>
                            {currentReceipt.status === 'rejected' && currentReceipt.rejection_reason
                                ? currentReceipt.rejection_reason
                                : currentReceipt.status === 'verified'
                                    ? 'Your payment has been verified. No further action is needed.'
                                    : 'Your receipt is waiting for the Registrar to verify it.'}
                        </p>
                    </div>
                )}
            </div>

            <div className="student-card">
                <h2 style={{ fontSize: 16, marginBottom: 16 }}>Official Receipt</h2>

                {error && <div className="student-error-box">{error}</div>}
                {message && <div className="student-success-box">{message}</div>}

                {!canUpload ? (
                    <div className={`receipt-lock is-${verified ? 'verified' : cancelled ? 'cancelled' : 'waiting'}`}>
                        <span className="receipt-lock-icon" aria-hidden="true">
                            {verified ? '✓' : cancelled ? '×' : <i />}
                        </span>
                        <div>
                            <strong>
                                {verified
                                    ? 'Payment verified'
                                    : cancelled
                                        ? 'This request was cancelled'
                                        : 'Waiting for the Registrar to verify your receipt'}
                            </strong>
                            <p>
                                {verified
                                    ? 'Your receipt was accepted. Nothing more to upload for this request.'
                                    : cancelled
                                        ? 'Receipts can no longer be uploaded for it.'
                                        : 'You can’t upload another receipt while this one is being checked. If the Registrar rejects it, you’ll be notified with the reason and can upload a clearer photo here.'}
                            </p>
                            {currentReceipt && (
                                <dl className="receipt-lock-details">
                                    {currentReceipt.receipt_number && <div><dt>Receipt no.</dt><dd>{currentReceipt.receipt_number}</dd></div>}
                                    {currentReceipt.receipt_file_name && <div><dt>File</dt><dd>{currentReceipt.receipt_file_name}</dd></div>}
                                    {currentReceipt.uploaded_at && <div><dt>Uploaded</dt><dd>{formatDisplayDateTime(currentReceipt.uploaded_at)}</dd></div>}
                                </dl>
                            )}
                        </div>
                    </div>
                ) : (
                <>
                {receiptStatus === 'rejected' && (
                    <div className="student-notice tone-danger" style={{ marginTop: 0, marginBottom: 16 }}>
                        <strong>Upload a clearer photo of the same receipt</strong>
                        <p>
                            {currentReceipt.rejection_reason
                                ? `The Registrar rejected your last upload: ${currentReceipt.rejection_reason}`
                                : 'The Registrar rejected your last upload.'}
                            {' '}You don’t need to pay again — make sure the whole receipt, its number and the amount are clear.
                        </p>
                    </div>
                )}

                <form onSubmit={handleUpload}>
                    <div className="form-group">
                        <label className="form-label" htmlFor="receipt-number">Receipt Number</label>
                        <input
                            id="receipt-number"
                            type="text"
                            className="form-input"
                            value={receiptNumber}
                            onChange={(e) => setReceiptNumber(e.target.value)}
                            placeholder="e.g. 0012345"
                            autoComplete="off"
                            maxLength={40}
                            disabled={uploading}
                            required
                        />
                        <small style={{ display: 'block', marginTop: 8, fontSize: 12, color: 'var(--slate)' }}>
                            The number printed on your Finance Office official receipt. Each receipt can only be used once.
                        </small>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Receipt File</label>

                        <input
                            id="receipt-file"
                            type="file"
                            accept=".jpg,.jpeg,.png,.webp,.pdf"
                            onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                            className="form-input"
                            disabled={uploading}
                        />

                        <small style={{ display: 'block', marginTop: 8, fontSize: 12, color: 'var(--slate)' }}>
                            Accepted: JPG, PNG, WEBP, PDF. Photos are resized automatically; PDFs up to 5 MB.
                        </small>

                        {receiptFile && (
                            <p style={{ marginTop: 10, fontSize: 13.5, color: 'var(--ink)' }}>
                                Selected: {receiptFile.name}
                            </p>
                        )}
                    </div>

                    {siblings.length > 0 && (
                        <div className="rq-cover">
                            <strong>Did one receipt cover your other documents too?</strong>
                            <p>These were submitted together with this request. Tick the ones this same receipt also paid for — the Registrar will check that the receipt shows the total below, and all of them are verified together.</p>
                            <ul>
                                {siblings.map((sib) => (
                                    <li key={sib.request_id}>
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={includeIds.has(sib.request_id)}
                                                onChange={() => setIncludeIds((prev) => {
                                                    const next = new Set(prev)
                                                    if (next.has(sib.request_id)) next.delete(sib.request_id)
                                                    else next.add(sib.request_id)
                                                    return next
                                                })}
                                                disabled={uploading}
                                            />
                                            <span>
                                                <strong>{sib.documentName}</strong>
                                                <small>{sib.request_number} · ₱{Number(sib.total_amount || 0).toFixed(2)}</small>
                                            </span>
                                        </label>
                                    </li>
                                ))}
                            </ul>
                            <div className="rq-cover-total">
                                <span>Total covered by this receipt</span>
                                <strong>
                                    ₱{(Number(request?.total_amount || 0) + siblings.filter((sib) => includeIds.has(sib.request_id)).reduce((sum, sib) => sum + Number(sib.total_amount || 0), 0)).toFixed(2)}
                                </strong>
                            </div>
                        </div>
                    )}

                    <button type="submit" className="auth-submit" style={{ width: 'auto', padding: '11px 20px', marginTop: 20 }} disabled={uploading}>
                        {uploading
                            ? 'Uploading...'
                            : includeIds.size > 0 && siblings.length > 0
                                ? `Upload for ${1 + siblings.filter((sib) => includeIds.has(sib.request_id)).length} requests`
                                : receiptStatus === 'rejected' ? 'Upload New Receipt' : 'Upload Official Receipt'}
                    </button>
                </form>
                </>
                )}
            </div>
        </div>
    )
}

export default UploadReceipt