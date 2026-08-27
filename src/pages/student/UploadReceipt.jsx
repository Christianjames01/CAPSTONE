import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import '../auth/Auth.css'
import './StudentPages.css'

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

    useEffect(() => {
        if (!requestId) {
            setError('Request ID is missing.')
            setLoading(false)
            return
        }

        loadRequest()
    }, [requestId])

    const loadRequest = async () => {
        try {
            setLoading(true)
            setError('')

            // ================================
            // GET CURRENT USER
            // ================================

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

            // ================================
            // FIND STUDENT
            // ================================

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

            // ================================
            // FIND REQUEST
            // ================================

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
                    status
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

            // ================================
            // CHECK EXISTING RECEIPT
            // ================================

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

    const handleUpload = async (e) => {
        e.preventDefault()

        setError('')
        setMessage('')

        // ================================
        // VALIDATION
        // ================================

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

        // ================================
        // FILE VALIDATION
        // ================================

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

        if (receiptFile.size > maxSize) {
            setError(
                'File size must not exceed 5 MB.'
            )
            return
        }

        try {
            setUploading(true)

            // ================================
            // CREATE UNIQUE FILE NAME
            // ================================

            const fileExtension =
                receiptFile.name
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

            // ================================
            // UPLOAD TO SUPABASE STORAGE
            // ================================

            const {
                error: uploadError
            } = await supabase.storage
                .from('official-receipts')
                .upload(
                    filePath,
                    receiptFile,
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

            // ================================
            // SAVE DATABASE RECORD
            // ================================

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

                // ============================
                // UPDATE EXISTING RECEIPT
                // ============================

                const {
                    error
                } = await supabase
                    .from('official_receipts')
                    .update({
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
                    )

                databaseError = error

            } else {

                // ============================
                // CREATE NEW RECEIPT
                // ============================

                const {
                    error
                } = await supabase
                    .from('official_receipts')
                    .insert({
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
                    })

                databaseError = error
            }

            if (databaseError) {
                // Remove uploaded file if DB insert fails
                await supabase.storage
                    .from('official-receipts')
                    .remove([filePath])

                throw new Error(
                    'Failed to save receipt: ' +
                    databaseError.message
                )
            }

            // ================================
            // MOVE REQUEST TO "RECEIPT UPLOADED"
            // SO IT SHOWS UP IN THE REGISTRAR'S
            // VERIFICATION QUEUE
            // ================================

            const { error: requestStatusError } = await supabase
                .from('document_requests')
                .update({
                    status: 'receipt_uploaded',
                    updated_at: new Date().toISOString()
                })
                .eq('request_id', requestId)
                .in('status', ['pending', 'payment_pending', 'rejected'])

            if (requestStatusError) {
                console.error(
                    'UPDATE REQUEST STATUS ERROR:',
                    requestStatusError
                )
            }

            // ================================
            // SUCCESS
            // ================================

            setMessage(
                'Official receipt uploaded successfully. Please wait for the Registrar to verify your payment.'
            )

            setReceiptFile(null)

            // Clear file input
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

    // ================================
    // LOADING
    // ================================

    if (loading) {
        return <p className="student-loading">Loading...</p>
    }

    // ================================
    // ERROR
    // ================================

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

    // ================================
    // MAIN PAGE
    // ================================

    return (
        <div>
            <button className="student-link-button" style={{ marginBottom: 16 }} onClick={() => navigate(`/student/request/${requestId}`)}>
                ← Back to Request
            </button>

            <div className="student-page-header">
                <h1>Upload Official Receipt</h1>
                <p>Submit your official receipt for Registrar verification.</p>
            </div>

            {/* REQUEST SUMMARY */}

            <div className="student-card">
                <h2 style={{ fontSize: 16, marginBottom: 16 }}>Request Information</h2>

                <div className="student-info-grid">
                    <div className="student-info-field">
                        <span>Request Number</span>
                        <strong>{request.request_number}</strong>
                    </div>

                    <div className="student-info-field">
                        <span>Amount Due</span>
                        <strong>₱{Number(request.total_amount || 0).toFixed(2)}</strong>
                    </div>

                    <div className="student-info-field">
                        <span>Request Status</span>
                        <span className={`student-status-pill status-${request.status}`}>{request.status.replace(/_/g, ' ')}</span>
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

            {/* UPLOAD FORM */}

            <div className="student-card">
                <h2 style={{ fontSize: 16, marginBottom: 16 }}>Official Receipt</h2>

                {error && <div className="student-error-box">{error}</div>}
                {message && <div className="student-success-box">{message}</div>}

                <form onSubmit={handleUpload}>
                    {/* FILE */}
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
                            Accepted: JPG, PNG, WEBP, PDF. Maximum 5 MB.
                        </small>

                        {receiptFile && (
                            <p style={{ marginTop: 10, fontSize: 13.5, color: 'var(--ink)' }}>
                                Selected: {receiptFile.name}
                            </p>
                        )}
                    </div>

                    {/* SUBMIT */}
                    <button type="submit" className="auth-submit" style={{ width: 'auto', padding: '11px 20px', marginTop: 20 }} disabled={uploading}>
                        {uploading ? 'Uploading...' : 'Upload Official Receipt'}
                    </button>
                </form>
            </div>
        </div>
    )
}

export default UploadReceipt