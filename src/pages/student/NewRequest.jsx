import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { findAssignedEmployee } from '../../lib/assignEmployee'
import { notify, notifyWarning } from '../../lib/notify'
import { IconX } from './icons'
import { Skeleton } from '../../components/Skeleton'
import { DocumentSample } from '../../components/DocumentSample'
import { useScrollLock } from '../../lib/useScrollLock'
import { useDraftState, clearDraft } from '../../lib/useDraftState'
import '../auth/Auth.css'
import './StudentPages.css'
import { useLiveRefresh } from '../../lib/useLiveRefresh'
import { digitsOnly } from '../../lib/typedNumber'

// Alphabetical order puts "Fourth Year" right after "First Year" (both
// start with "F"), so year_level needs an explicit chronological order
// rather than relying on a plain SQL `.order('year_level')`.
const YEAR_LEVEL_ORDER = ['First Year', 'Second Year', 'Third Year', 'Fourth Year']
function NewRequest() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()

    const [documents, setDocuments] = useState([])
    const [search, setSearch] = useState('')
    const [selectedDocument, setSelectedDocument] = useState('')
    const [quantity, setQuantity] = useState(1)
    const [purpose, setPurpose] = useState('')
    const [loading, setLoading] = useState(false)
    // Documents picked so far, submitted together (kept across a refresh).
    const [cart, setCart] = useDraftState('newRequest', 'cart', [])
    const [cartNotice, setCartNotice] = useState('')
    const [loadingDocuments, setLoadingDocuments] = useState(true)
    const [error, setError] = useState('')
    const [studentInfo, setStudentInfo] = useState(null)
    const [selectedRequirements, setSelectedRequirements] = useState([])
    const [loadingRequirements, setLoadingRequirements] = useState(false)
    const [previewZoomed, setPreviewZoomed] = useState(false)
    useScrollLock(previewZoomed)

    useLiveRefresh(['document_types', 'document_requirements'], (options) => loadDocuments(options))

    useEffect(() => {
        loadDocuments()
        loadStudentInfo()
    }, [])

    useEffect(() => {
        if (!selectedDocument) {
            setSelectedRequirements([])
            return
        }

        loadRequirementsFor(selectedDocument)
    }, [selectedDocument])

    useEffect(() => {
        document.body.style.overflow = previewZoomed ? 'hidden' : ''
        return () => { document.body.style.overflow = '' }
    }, [previewZoomed])

    const loadRequirementsFor = async (documentTypeId) => {
        try {
            setLoadingRequirements(true)

            const { data, error: reqError } = await supabase
                .from('document_requirements')
                .select('requirement_id, requirement_name, description, is_required')
                .eq('document_type_id', documentTypeId)
                .order('requirement_name')

            if (reqError) {
                console.error('LOAD REQUIREMENTS ERROR:', reqError)
                setSelectedRequirements([])
                return
            }

            setSelectedRequirements(data || [])

        } finally {
            setLoadingRequirements(false)
        }
    }

    const loadStudentInfo = async () => {
        try {
            const {
                data: { user },
            } = await supabase.auth.getUser()

            if (!user) return

            const { data: student } = await supabase
                .from('students')
                .select('student_id, student_number, program_id, year_level, user_id')
                .eq('user_id', user.id)
                .single()

            if (!student) return

            const [{ data: profile }, { data: program }] = await Promise.all([
                supabase.from('profiles').select('first_name, last_name').eq('user_id', user.id).single(),
                student.program_id
                    ? supabase.from('programs').select('program_name').eq('program_id', student.program_id).single()
                    : Promise.resolve({ data: null }),
            ])

            // A TOR covers the student's whole academic history, not just their
            // current year -- fetch every year of their curriculum so the sample
            // preview can show a course from each year instead of only the
            // current one.
            let curriculumCourses = []

            if (student.program_id) {
                const { data: curriculum } = await supabase
                    .from('curricula')
                    .select('curriculum_id')
                    .eq('program_id', student.program_id)
                    .eq('is_active', true)
                    .maybeSingle()

                if (curriculum) {
                    const [{ data: courses }, { data: grades }] = await Promise.all([
                        supabase
                            .from('curriculum_courses')
                            .select('curriculum_course_id, course_code, course_name, units, year_level, term, display_order')
                            .eq('curriculum_id', curriculum.curriculum_id)
                            .order('display_order'),
                        supabase
                            .from('student_grades')
                            .select('curriculum_course_id, grade')
                            .eq('student_id', student.student_id),
                    ])

                    const gradeByCourseId = Object.fromEntries(
                        (grades || []).map((g) => [g.curriculum_course_id, g.grade])
                    )

                    curriculumCourses = (courses || [])
                        .map((c) => ({ ...c, grade: gradeByCourseId[c.curriculum_course_id] || '' }))
                        .sort((a, b) => YEAR_LEVEL_ORDER.indexOf(a.year_level) - YEAR_LEVEL_ORDER.indexOf(b.year_level))
                }
            }

            setStudentInfo({
                fullName: profile ? `${profile.first_name} ${profile.last_name}`.trim() : '',
                studentNumber: student.student_number || '',
                programName: program?.program_name || '',
                yearLevel: student.year_level || '',
                curriculumCourses,
            })

        } catch (err) {
            console.error('LOAD STUDENT INFO ERROR:', err)
        }
    }

    const loadDocuments = async ({ silent = false } = {}) => {
        const { data, error } = await supabase
            .from('document_types')
            .select(`
        document_type_id,
        document_code,
        document_name,
        category,
        description,
        fee,
        processing_days_min,
        processing_days_max,
        requires_purpose,
        preview_image_url,
        max_active_requests,
        max_quantity_per_request
      `)
            .eq('is_available', true)
            .order('document_name')

        if (error) {
            console.error(error)
            setError('Failed to load documents: ' + error.message)
        } else {
            setDocuments(data || [])

            const requestedTypeId = searchParams.get('document')
            if (requestedTypeId && (data || []).some((d) => d.document_type_id === requestedTypeId)) {
                if (!silent) setSelectedDocument(requestedTypeId)
            }
        }

        if (!silent) setLoadingDocuments(false)
    }

    const selectedDocumentDetails = documents.find(
        (item) => item.document_type_id === selectedDocument
    )

    const filteredDocuments = documents.filter((doc) => {
        if (!search.trim()) return true
        const term = search.trim().toLowerCase()
        return (
            doc.document_name.toLowerCase().includes(term) ||
            (doc.category || '').toLowerCase().includes(term) ||
            (doc.document_code || '').toLowerCase().includes(term)
        )
    })

    const ACTIVE_STATUSES = [
        'pending', 'payment_pending', 'receipt_uploaded', 'receipt_verified',
        'processing', 'lacking_requirements', 'ready_for_claiming',
    ]

    const cartTotal = cart.reduce((sum, item) => sum + item.fee * item.quantity, 0)
    const peso = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

    // Adds the selected document (with its copies and purpose) to the list.
    const addToCart = (e) => {
        e.preventDefault()
        setError('')
        setCartNotice('')

        if (!selectedDocument || !selectedDocumentDetails) {
            setError('Please select a document.')
            return
        }

        const maxQuantity = selectedDocumentDetails.max_quantity_per_request || 2

        if (!Number(quantity) || Number(quantity) > maxQuantity) {
            setError(`Quantity must be between 1 and ${maxQuantity}.`)
            return
        }

        if (selectedDocumentDetails.requires_purpose && !purpose.trim()) {
            notifyWarning('Please state the purpose of this request — it is required for this document.')
            return
        }

        if (cart.some((item) => item.document_type_id === selectedDocument)) {
            setError(`${selectedDocumentDetails.document_name} is already in your request list. Remove it first to change it.`)
            return
        }

        setCart([
            ...cart,
            {
                document_type_id: selectedDocument,
                document_name: selectedDocumentDetails.document_name,
                fee: Number(selectedDocumentDetails.fee || 0),
                quantity: Number(quantity),
                purpose: purpose.trim(),
                max_active_requests: selectedDocumentDetails.max_active_requests || 2,
            },
        ])
        setCartNotice(`${selectedDocumentDetails.document_name} added. Add another document, or submit your list below.`)
        setSelectedDocument('')
        setQuantity(1)
        setPurpose('')
    }

    const removeFromCart = (documentTypeId) => {
        setCart(cart.filter((item) => item.document_type_id !== documentTypeId))
        setCartNotice('')
    }

    // Submits every document in the list: one request each, linked by a
    // shared batch_id when there are several so one receipt can cover them.
    const submitCart = async () => {
        setError('')
        setCartNotice('')

        if (cart.length === 0) {
            setError('Add at least one document to your request list.')
            return
        }

        setLoading(true)
        const created = []

        try {
            const { data: { user }, error: userError } = await supabase.auth.getUser()
            if (userError || !user) throw new Error('You are not logged in.')

            const { data: student, error: studentError } = await supabase
                .from('students')
                .select('student_id, college_id, program_id')
                .eq('user_id', user.id)
                .single()

            if (studentError || !student) throw new Error('Student record could not be found.')

            const { data: existingRequests, error: existingError } = await supabase
                .from('document_requests')
                .select('document_type_id, status')
                .eq('student_id', student.student_id)

            if (existingError) throw new Error('Failed to check your existing requests: ' + existingError.message)

            for (const item of cart) {
                const active = (existingRequests || []).filter(
                    (r) => r.document_type_id === item.document_type_id && ACTIVE_STATUSES.includes(r.status)
                ).length
                if (active >= item.max_active_requests) {
                    throw new Error(
                        `You already have ${item.max_active_requests} active request${item.max_active_requests === 1 ? '' : 's'} for ${item.document_name}. Remove it from your list, or wait for one to finish.`
                    )
                }
            }

            // May be null when no employee covers this college/program yet --
            // the requests still save and wait on the head's Request
            // Assignments page (the database notifies the registrar head).
            const assignedEmployeeId = await findAssignedEmployee(student.college_id, student.program_id)
            const batchId = cart.length > 1 ? crypto.randomUUID() : null

            for (const item of cart) {
                const payload = {
                    student_id: student.student_id,
                    document_type_id: item.document_type_id,
                    assigned_employee_id: assignedEmployeeId,
                    quantity: item.quantity,
                    unit_fee: item.fee,
                    priority: 'normal',
                    purpose: item.purpose || null,
                    status: 'pending',
                    ...(batchId ? { batch_id: batchId } : {}),
                }

                let { data: request, error: requestError } = await supabase
                    .from('document_requests').insert(payload).select().single()

                // Before the batch migration is applied: submit unlinked.
                if (requestError && /batch_id/.test(requestError.message || '')) {
                    delete payload.batch_id
                    ;({ data: request, error: requestError } = await supabase
                        .from('document_requests').insert(payload).select().single())
                }

                if (requestError) throw new Error(`Failed to create the request for ${item.document_name}: ${requestError.message}`)

                created.push({ ...request, document_name: item.document_name })

                const { data: requiredDocs, error: requirementsError } = await supabase
                    .from('document_requirements')
                    .select('requirement_id')
                    .eq('document_type_id', item.document_type_id)

                if (requirementsError) {
                    console.error('LOAD REQUIREMENTS ERROR:', requirementsError)
                } else if (requiredDocs && requiredDocs.length > 0) {
                    const { error: seedError } = await supabase
                        .from('request_requirements')
                        .insert(requiredDocs.map((req) => ({
                            request_id: request.request_id,
                            requirement_id: req.requirement_id,
                            status: 'pending',
                        })))
                    if (seedError) console.error('SEED REQUIREMENTS ERROR:', seedError)
                }
            }

            const { data: assignedEmployeeRow } = assignedEmployeeId
                ? await supabase.from('employees').select('user_id').eq('employee_id', assignedEmployeeId).single()
                : { data: null }

            if (assignedEmployeeRow) {
                await notify({
                    userId: assignedEmployeeRow.user_id,
                    title: created.length > 1 ? `${created.length} new requests pending` : 'New request pending',
                    message: created.length > 1
                        ? `Submitted together: ${created.map((r) => `${r.document_name} (${r.request_number})`).join(', ')}.`
                        : `${created[0].document_name} request ${created[0].request_number} is waiting for verification.`,
                    notificationType: 'request_update',
                    relatedRequestId: created[0].request_id,
                })
            }

            clearDraft('newRequest')
            setCart([])

            navigate('/student/my-requests', {
                state: {
                    justSubmitted: created.map((r) => r.request_number).join(', '),
                    submittedCount: created.length,
                    submittedTotal: cartTotal,
                    waitingForAssignment: !assignedEmployeeId,
                },
            })
        } catch (err) {
            console.error(err)
            if (created.length > 0) {
                // Keep only what still needs submitting.
                const done = new Set(created.map((r) => r.document_type_id))
                setCart(cart.filter((item) => !done.has(item.document_type_id)))
                setError(`${created.map((r) => r.request_number).join(', ')} submitted, but the rest could not be: ${err.message}`)
            } else {
                setError(err.message)
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <div>
            <div className="student-page-header">
                <h1>Request a Document</h1>
                <p>Pick one or more documents, then submit them together and pay one total at the Finance Office.</p>
            </div>

            {error && <div className="student-error-box">{error}</div>}

            <div className="student-request-grid">
            <div className="student-card">
                <form className="auth-form" onSubmit={addToCart}>

                    <div className="form-group">
                        <label className="form-label">Document</label>

                        {loadingDocuments ? (
                            <div role="status" aria-busy="true" aria-label="Loading documents">
                                <Skeleton height={42} radius={8} style={{ marginBottom: 10 }} />
                                {[0, 1, 2, 3].map((i) => (
                                    <Skeleton key={i} height={52} radius={8} style={{ marginBottom: 8 }} />
                                ))}
                            </div>
                        ) : (
                            <>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search by document name or category"
                                    disabled={loading}
                                    style={{ marginBottom: 12 }}
                                />

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
                                    {filteredDocuments.length === 0 ? (
                                        <p style={{ fontSize: 13.5, color: 'var(--slate)', padding: '8px 2px' }}>
                                            No documents matched "{search}".
                                        </p>
                                    ) : (
                                        filteredDocuments.map((document) => {
                                            const isSelected = document.document_type_id === selectedDocument

                                            return (
                                                <button
                                                    key={document.document_type_id}
                                                    type="button"
                                                    className="student-list-card"
                                                    style={{
                                                        width: '100%',
                                                        textAlign: 'left',
                                                        marginBottom: 0,
                                                        padding: 14,
                                                        gap: 4,
                                                        cursor: 'pointer',
                                                        border: isSelected ? '1.5px solid var(--blue-accent, var(--blue))' : '1px solid var(--line)',
                                                        background: isSelected ? 'var(--blue-tint)' : 'var(--surface)',
                                                    }}
                                                    onClick={() => setSelectedDocument(document.document_type_id)}
                                                    disabled={loading}
                                                >
                                                    <div className="student-list-card-header" style={{ gap: 10 }}>
                                                        <div>
                                                            <h3 style={{ fontSize: 14 }}>{document.document_name}</h3>
                                                        </div>
                                                        <strong style={{ fontSize: 13.5, whiteSpace: 'nowrap' }}>
                                                            ₱{Number(document.fee || 0).toFixed(2)}
                                                        </strong>
                                                    </div>
                                                </button>
                                            )
                                        })
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    {selectedDocumentDetails && (
                        <div style={{ background: 'var(--paper)', padding: 16, borderRadius: 8 }}>
                            <div className="student-info-grid">
                                <div className="student-info-field">
                                    <span>Fee</span>
                                    <strong>₱{Number(selectedDocumentDetails.fee || 0).toFixed(2)}</strong>
                                </div>

                                <div className="student-info-field">
                                    <span>Processing Time</span>
                                    <strong>
                                        {selectedDocumentDetails.processing_days_min && selectedDocumentDetails.processing_days_max
                                            ? `${selectedDocumentDetails.processing_days_min}–${selectedDocumentDetails.processing_days_max} working days`
                                            : 'Varies'}
                                    </strong>
                                </div>
                            </div>

                            {selectedDocumentDetails.description && (
                                <p style={{ fontSize: 13, color: 'var(--ink)', marginTop: 14, whiteSpace: 'pre-line', lineHeight: 1.5 }}>
                                    {selectedDocumentDetails.description}
                                </p>
                            )}

                            {loadingRequirements ? (
                                <p style={{ fontSize: 12.5, color: 'var(--slate)', marginTop: 14 }}>Checking required documents...</p>
                            ) : selectedRequirements.length > 0 ? (
                                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
                                    <span style={{ fontSize: 12, color: 'var(--slate)', display: 'block', marginBottom: 8 }}>
                                        Required documents for {selectedDocumentDetails.document_name}
                                    </span>

                                    <ul style={{ paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        {selectedRequirements.map((req) => (
                                            <li key={req.requirement_id} style={{ fontSize: 13.5 }}>
                                                {req.requirement_name}
                                                {req.is_required && (
                                                    <span style={{ color: 'var(--red)', fontSize: 11, marginLeft: 6, fontWeight: 600 }}>
                                                        Required
                                                    </span>
                                                )}
                                            </li>
                                        ))}
                                    </ul>

                                    <p style={{ fontSize: 12, color: 'var(--slate)', marginTop: 10 }}>
                                        You'll be able to upload these for this specific request right after you submit it.
                                    </p>
                                </div>
                            ) : (
                                <p style={{ fontSize: 12.5, color: 'var(--slate)', marginTop: 14 }}>
                                    No additional documents are required for this request.
                                </p>
                            )}
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label" htmlFor="request-quantity">Quantity</label>
                        <input
                            id="request-quantity"
                            className="form-input"
                            type="text"
                            inputMode="numeric"
                            autoComplete="off"
                            placeholder="1"
                            maxLength={3}
                            value={quantity}
                            onChange={(e) => setQuantity(digitsOnly(e.target.value))}
                            aria-invalid={quantity !== '' && (!Number(quantity) || Number(quantity) > (selectedDocumentDetails?.max_quantity_per_request || 2))}
                            disabled={loading}
                        />
                        <small style={{ display: 'block', marginTop: 6, fontSize: 12, color: quantity !== '' && (!Number(quantity) || Number(quantity) > (selectedDocumentDetails?.max_quantity_per_request || 2)) ? '#dc2626' : 'var(--slate)' }}>
                            Up to {selectedDocumentDetails?.max_quantity_per_request || 2} {(selectedDocumentDetails?.max_quantity_per_request || 2) === 1 ? 'copy' : 'copies'} per request.
                        </small>
                    </div>

                    <div className="form-group">
                        <label className="form-label">
                            Purpose
                            {selectedDocumentDetails?.requires_purpose && (
                                <span style={{ color: 'var(--red)', marginLeft: 4 }}>*</span>
                            )}
                        </label>
                        <textarea
                            className="form-input"
                            value={purpose}
                            onChange={(e) => setPurpose(e.target.value)}
                            placeholder={
                                selectedDocumentDetails?.requires_purpose
                                    ? 'Required for this document — state what it will be used for'
                                    : 'Enter the purpose of your request'
                            }
                            rows="4"
                            disabled={loading}
                        />
                        {selectedDocumentDetails?.requires_purpose && (
                            <small style={{ color: 'var(--slate)', fontSize: 12 }}>
                                This document requires a stated purpose before it can be requested.
                            </small>
                        )}
                    </div>

                    <button
                        type="submit"
                        className={cart.length ? 'rq-add-button' : 'auth-submit'}
                        style={{ width: 'auto', padding: '13px 26px' }}
                        disabled={loading || loadingDocuments || !selectedDocument}
                    >
                        + Add to request list
                    </button>

                </form>

                <section className="rq-cart" aria-label="Your request list">
                    <div className="rq-cart-head">
                        <h2>Your request list</h2>
                        <span>{cart.length} document{cart.length === 1 ? '' : 's'}</span>
                    </div>

                    {cartNotice && <p className="rq-cart-notice">{cartNotice}</p>}

                    {cart.length === 0 ? (
                        <p className="rq-cart-empty">
                            Pick a document above and add it here. You can request several documents at once — for example a
                            TOR, Certificate of Grades and Good Moral — and pay one total at the Finance Office.
                        </p>
                    ) : (
                        <>
                            <ul className="rq-cart-items">
                                {cart.map((item) => (
                                    <li key={item.document_type_id}>
                                        <div className="rq-cart-item-main">
                                            <strong>{item.document_name}</strong>
                                            <span>
                                                {item.quantity} cop{item.quantity === 1 ? 'y' : 'ies'} × {peso(item.fee)}
                                                {item.purpose && ` · ${item.purpose}`}
                                            </span>
                                        </div>
                                        <strong className="rq-cart-price">{peso(item.fee * item.quantity)}</strong>
                                        <button
                                            type="button"
                                            className="rq-cart-remove"
                                            onClick={() => removeFromCart(item.document_type_id)}
                                            disabled={loading}
                                            aria-label={`Remove ${item.document_name}`}
                                        >
                                            <IconX />
                                        </button>
                                    </li>
                                ))}
                            </ul>

                            <div className="rq-cart-total">
                                <span>Total to pay at the Finance Office</span>
                                <strong>{peso(cartTotal)}</strong>
                            </div>

                            <button
                                type="button"
                                className="auth-submit rq-cart-submit"
                                onClick={submitCart}
                                disabled={loading || loadingDocuments}
                            >
                                {loading && <span className="auth-spinner" />}
                                {loading
                                    ? 'Submitting...'
                                    : cart.length > 1 ? `Submit ${cart.length} requests` : 'Submit request'}
                            </button>
                            <p className="rq-cart-note">Each document is tracked as its own request. You can upload one official receipt for all of them.</p>
                        </>
                    )}
                </section>
            </div>

            <div className="student-card" style={{ position: 'sticky', top: 20 }}>
                <h2 style={{ fontSize: 15, marginBottom: 4 }}>Sample Document Preview</h2>
                <p style={{ fontSize: 12.5, color: 'var(--slate)', marginBottom: 14 }}>
                    {selectedDocumentDetails?.preview_image_url
                        ? 'A real sample of this document, posted by the Registrar.'
                        : 'Reference layout only — not an official document.'}
                </p>

                {!selectedDocumentDetails ? (
                    <div className="student-empty" style={{ padding: '32px 16px' }}>
                        Select a document on the left to preview a sample of what it looks like.
                    </div>
                ) : (
                    <>
                        <button
                            type="button"
                            onClick={() => setPreviewZoomed(true)}
                            style={{ display: 'block', width: '100%', cursor: 'zoom-in' }}
                            aria-label="Enlarge sample document preview"
                        >
                            {selectedDocumentDetails.preview_image_url ? (
                                <img
                                    src={selectedDocumentDetails.preview_image_url}
                                    alt={`Sample ${selectedDocumentDetails.document_name}`}
                                    style={{ width: '100%', borderRadius: 8, border: '1px solid var(--line)', display: 'block' }}
                                />
                            ) : (
                                <DocumentSample name={selectedDocumentDetails.document_name} documentCode={selectedDocumentDetails.document_code} student={studentInfo} />
                            )}
                        </button>
                        <p style={{ fontSize: 11.5, color: 'var(--slate)', marginTop: 8, textAlign: 'center' }}>
                            Tap to enlarge
                        </p>
                    </>
                )}
            </div>
            </div>

            {previewZoomed && selectedDocumentDetails && (
                <div
                    onClick={() => setPreviewZoomed(false)}
                    style={{
                        position: 'fixed', inset: 0, background: 'rgba(10, 15, 30, 0.7)',
                        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
                        overflowY: 'auto', overscrollBehavior: 'contain', padding: '24px 24px 60px',
                        zIndex: 100,
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{ width: '100%', maxWidth: 720, position: 'relative', marginTop: 40 }}
                    >
                        <button
                            type="button"
                            onClick={() => setPreviewZoomed(false)}
                            aria-label="Close preview"
                            style={{
                                position: 'fixed', top: 24, right: 24,
                                width: 32, height: 32, display: 'flex', alignItems: 'center',
                                justifyContent: 'center', color: 'var(--white)', zIndex: 101,
                            }}
                        >
                            <IconX />
                        </button>

                        <div style={{ background: 'var(--white)', borderRadius: 10, padding: 20 }}>
                            {selectedDocumentDetails.preview_image_url ? (
                                <img
                                    src={selectedDocumentDetails.preview_image_url}
                                    alt={`Sample ${selectedDocumentDetails.document_name}`}
                                    style={{ width: '100%', display: 'block', borderRadius: 6 }}
                                />
                            ) : (
                                <DocumentSample name={selectedDocumentDetails.document_name} documentCode={selectedDocumentDetails.document_code} student={studentInfo} />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default NewRequest
