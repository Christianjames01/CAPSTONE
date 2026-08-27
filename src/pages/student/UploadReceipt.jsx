import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

function UploadReceipt() {
    const { requestId } = useParams()
    const navigate = useNavigate()

    const [request, setRequest] = useState(null)
    const [student, setStudent] = useState(null)

    const [receiptNumber, setReceiptNumber] = useState('')
    const [amountPaid, setAmountPaid] = useState('')
    const [receiptFile, setReceiptFile] = useState(null)

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

            if (existingReceipt) {
                setReceiptNumber(
                    existingReceipt.receipt_number || ''
                )

                setAmountPaid(
                    existingReceipt.amount_paid || ''
                )
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

    const handleUpload = async (e) => {
        e.preventDefault()

        setError('')
        setMessage('')

        // ================================
        // VALIDATION
        // ================================

        if (!receiptNumber.trim()) {
            setError(
                'Please enter the official receipt number.'
            )
            return
        }

        if (!amountPaid) {
            setError(
                'Please enter the amount paid.'
            )
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

        const paid = Number(amountPaid)
        const required = Number(
            request.total_amount
        )

        if (paid < required) {
            setError(
                `Amount paid cannot be less than ₱${required.toFixed(2)}.`
            )
            return
        }

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
                        receipt_number:
                            receiptNumber.trim(),

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

                        receipt_number:
                            receiptNumber.trim(),

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
        return (
            <div style={styles.page}>
                <div style={styles.container}>
                    <div style={styles.card}>
                        <h2>
                            Loading...
                        </h2>
                    </div>
                </div>
            </div>
        )
    }

    // ================================
    // ERROR
    // ================================

    if (error && !request) {
        return (
            <div style={styles.page}>
                <div style={styles.container}>

                    <div style={styles.card}>
                        <h1>
                            Unable to Load
                        </h1>

                        <p style={styles.error}>
                            {error}
                        </p>

                        <button
                            onClick={() =>
                                navigate(
                                    '/student/my-requests'
                                )
                            }
                            style={styles.button}
                        >
                            Back to My Requests
                        </button>
                    </div>

                </div>
            </div>
        )
    }

    // ================================
    // MAIN PAGE
    // ================================

    return (
        <div style={styles.page}>

            <div style={styles.container}>

                <button
                    onClick={() =>
                        navigate(
                            `/student/request/${requestId}`
                        )
                    }
                    style={styles.backButton}
                >
                    ← Back to Request
                </button>

                <h1 style={styles.title}>
                    Upload Official Receipt
                </h1>

                <p style={styles.subtitle}>
                    Submit your official receipt
                    for Registrar verification.
                </p>

                {/* REQUEST SUMMARY */}

                <div style={styles.card}>

                    <h2>
                        Request Information
                    </h2>

                    <div style={styles.summary}>

                        <div>
                            <span style={styles.label}>
                                Request Number
                            </span>

                            <strong>
                                {request.request_number}
                            </strong>
                        </div>

                        <div>
                            <span style={styles.label}>
                                Amount Due
                            </span>

                            <strong>
                                ₱
                                {Number(
                                    request.total_amount ||
                                    0
                                ).toFixed(2)}
                            </strong>
                        </div>

                        <div>
                            <span style={styles.label}>
                                Request Status
                            </span>

                            <strong>
                                {request.status}
                            </strong>
                        </div>

                    </div>

                </div>

                {/* UPLOAD FORM */}

                <div style={styles.card}>

                    <h2>
                        Official Receipt
                    </h2>

                    {error && (
                        <div
                            style={
                                styles.errorBox
                            }
                        >
                            {error}
                        </div>
                    )}

                    {message && (
                        <div
                            style={
                                styles.successBox
                            }
                        >
                            {message}
                        </div>
                    )}

                    <form
                        onSubmit={handleUpload}
                    >

                        {/* OR NUMBER */}

                        <div
                            style={
                                styles.formGroup
                            }
                        >

                            <label
                                style={
                                    styles.formLabel
                                }
                            >
                                Official Receipt
                                Number
                            </label>

                            <input
                                type="text"
                                value={
                                    receiptNumber
                                }
                                onChange={(e) =>
                                    setReceiptNumber(
                                        e.target.value
                                    )
                                }
                                placeholder="Enter OR number"
                                style={
                                    styles.input
                                }
                                disabled={
                                    uploading
                                }
                            />

                        </div>

                        {/* AMOUNT */}

                        <div
                            style={
                                styles.formGroup
                            }
                        >

                            <label
                                style={
                                    styles.formLabel
                                }
                            >
                                Amount Paid
                            </label>

                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={
                                    amountPaid
                                }
                                onChange={(e) =>
                                    setAmountPaid(
                                        e.target.value
                                    )
                                }
                                placeholder="0.00"
                                style={
                                    styles.input
                                }
                                disabled={
                                    uploading
                                }
                            />

                            <small
                                style={
                                    styles.help
                                }
                            >
                                Amount due:
                                {' '}
                                ₱
                                {Number(
                                    request.total_amount ||
                                    0
                                ).toFixed(2)}
                            </small>

                        </div>

                        {/* FILE */}

                        <div
                            style={
                                styles.formGroup
                            }
                        >

                            <label
                                style={
                                    styles.formLabel
                                }
                            >
                                Receipt File
                            </label>

                            <input
                                id="receipt-file"
                                type="file"
                                accept=".jpg,.jpeg,.png,.webp,.pdf"
                                onChange={(e) =>
                                    setReceiptFile(
                                        e.target.files?.[0] ||
                                        null
                                    )
                                }
                                style={
                                    styles.fileInput
                                }
                                disabled={
                                    uploading
                                }
                            />

                            <small
                                style={
                                    styles.help
                                }
                            >
                                Accepted:
                                JPG, PNG, WEBP,
                                PDF.
                                Maximum 5 MB.
                            </small>

                            {receiptFile && (
                                <p
                                    style={
                                        styles.fileName
                                    }
                                >
                                    Selected:
                                    {' '}
                                    {receiptFile.name}
                                </p>
                            )}

                        </div>

                        {/* SUBMIT */}

                        <button
                            type="submit"
                            disabled={uploading}
                            style={
                                styles.submitButton
                            }
                        >
                            {uploading
                                ? 'Uploading...'
                                : 'Upload Official Receipt'}
                        </button>

                    </form>

                </div>

            </div>

        </div>
    )
}

// ==========================================
// STYLES
// ==========================================

const styles = {

    page: {
        minHeight: '100vh',
        background: '#f5f7fb',
        padding: '40px 20px',
        color: '#222'
    },

    container: {
        maxWidth: '900px',
        margin: '0 auto'
    },

    card: {
        background: '#fff',
        border: '1px solid #ddd',
        borderRadius: '12px',
        padding: '30px',
        marginTop: '25px',
        boxShadow:
            '0 2px 8px rgba(0,0,0,0.05)'
    },

    backButton: {
        padding: '10px 16px',
        border: '1px solid #ddd',
        background: '#fff',
        borderRadius: '6px',
        cursor: 'pointer'
    },

    title: {
        marginTop: '25px',
        marginBottom: '5px'
    },

    subtitle: {
        color: '#666'
    },

    summary: {
        display: 'grid',
        gridTemplateColumns:
            'repeat(3, 1fr)',
        gap: '20px',
        marginTop: '20px'
    },

    label: {
        display: 'block',
        fontSize: '13px',
        color: '#777',
        marginBottom: '6px'
    },

    formGroup: {
        marginTop: '22px'
    },

    formLabel: {
        display: 'block',
        fontWeight: '600',
        marginBottom: '8px'
    },

    input: {
        width: '100%',
        boxSizing: 'border-box',
        padding: '12px',
        border: '1px solid #ccc',
        borderRadius: '7px',
        fontSize: '15px'
    },

    fileInput: {
        width: '100%',
        padding: '10px',
        border: '1px solid #ccc',
        borderRadius: '7px',
        boxSizing: 'border-box'
    },

    help: {
        display: 'block',
        marginTop: '6px',
        color: '#777'
    },

    fileName: {
        marginTop: '10px',
        color: '#444'
    },

    submitButton: {
        marginTop: '25px',
        padding: '13px 20px',
        background: '#222',
        color: '#fff',
        border: 'none',
        borderRadius: '7px',
        cursor: 'pointer',
        fontSize: '15px',
        fontWeight: '600'
    },

    button: {
        marginTop: '20px',
        padding: '11px 18px',
        background: '#222',
        color: '#fff',
        border: 'none',
        borderRadius: '7px',
        cursor: 'pointer'
    },

    error: {
        color: '#b00020'
    },

    errorBox: {
        padding: '14px',
        marginTop: '15px',
        background: '#f8d7da',
        color: '#842029',
        borderRadius: '7px'
    },

    successBox: {
        padding: '14px',
        marginTop: '15px',
        background: '#d1e7dd',
        color: '#0f5132',
        borderRadius: '7px'
    }
}

export default UploadReceipt