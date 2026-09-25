import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { findAssignedEmployee } from '../../lib/assignEmployee'
import { insertRequestWithNeededBy } from '../../lib/requestPriority'
import { notify, notifyWarning } from '../../lib/notify'
import { IconX } from './icons'
import { Skeleton } from '../../components/Skeleton'
import { DocumentSample } from '../../components/DocumentSample'
import { useScrollLock } from '../../lib/useScrollLock'
import '../auth/Auth.css'
import './StudentPages.css'

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
    const [neededBy, setNeededBy] = useState('')
    const [neededByReason, setNeededByReason] = useState('')
    const [loading, setLoading] = useState(false)
    const [loadingDocuments, setLoadingDocuments] = useState(true)
    const [error, setError] = useState('')
    const [studentInfo, setStudentInfo] = useState(null)
    const [selectedRequirements, setSelectedRequirements] = useState([])
    const [loadingRequirements, setLoadingRequirements] = useState(false)
    const [previewZoomed, setPreviewZoomed] = useState(false)
    useScrollLock(previewZoomed)

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

    const loadDocuments = async () => {
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
                setSelectedDocument(requestedTypeId)
            }
        }

        setLoadingDocuments(false)
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

    const submitRequest = async (e) => {
        e.preventDefault()

        setError('')

        if (!selectedDocument) {
            setError('Please select a document.')
            return
        }

        const maxQuantity = selectedDocumentDetails?.max_quantity_per_request || 2

        if (quantity < 1 || quantity > maxQuantity) {
            setError(`Quantity must be between 1 and ${maxQuantity}.`)
            return
        }

        if (neededBy && neededBy < new Date().toLocaleDateString('en-CA')) {
            notifyWarning('The "needed by" date can\'t be in the past.')
            return
        }

        if (selectedDocumentDetails?.requires_purpose && !purpose.trim()) {
            notifyWarning('Please state the purpose of this request — it is required for this document.')
            return
        }

        setLoading(true)

        try {
            const {
                data: { user },
                error: userError
            } = await supabase.auth.getUser()

            if (userError || !user) {
                throw new Error('You are not logged in.')
            }

            const { data: student, error: studentError } = await supabase
                .from('students')
                .select(`
          student_id,
          college_id,
          program_id
        `)
                .eq('user_id', user.id)
                .single()

            if (studentError || !student) {
                throw new Error('Student record could not be found.')
            }

            const { data: existingRequests, error: existingError } = await supabase
                .from('document_requests')
                .select('document_type_id, status')
                .eq('student_id', student.student_id)

            if (existingError) {
                throw new Error('Failed to check your existing requests: ' + existingError.message)
            }

            const ACTIVE_STATUSES = [
                'pending', 'payment_pending', 'receipt_uploaded', 'receipt_verified',
                'processing', 'lacking_requirements', 'ready_for_claiming',
            ]

            const activeCountForSameDocument = (existingRequests || []).filter(
                (r) => r.document_type_id === selectedDocument && ACTIVE_STATUSES.includes(r.status)
            ).length

            const maxActiveRequests = selectedDocumentDetails?.max_active_requests || 2

            if (activeCountForSameDocument >= maxActiveRequests) {
                throw new Error(
                    `You already have ${maxActiveRequests} active request${maxActiveRequests === 1 ? '' : 's'} for this document. Please wait for one to finish (or get claimed) before requesting another.`
                )
            }

            // May be null when no employee covers this college/program yet --
            // the request is still saved and waits on the head's Request
            // Assignments page (the database notifies the registrar head).
            const assignedEmployeeId = await findAssignedEmployee(student.college_id, student.program_id)

            const document = documents.find(
                (item) =>
                    item.document_type_id === selectedDocument
            )

            if (!document) {
                throw new Error('Selected document could not be found.')
            }

            const unitFee = Number(document.fee || 0)

            const { data: request, error: requestError } =
                await insertRequestWithNeededBy({
                    student_id: student.student_id,
                    document_type_id: document.document_type_id,
                    assigned_employee_id: assignedEmployeeId,
                    quantity: Number(quantity),
                    unit_fee: unitFee,
                    // Staff set urgent; the student's "needed by" date helps them decide.
                    priority: 'normal',
                    purpose: purpose || null,
                    needed_by: neededBy || null,
                    needed_by_reason: neededBy ? (neededByReason.trim() || null) : null,
                    status: 'pending'
                }, (payload) => supabase
                    .from('document_requests')
                    .insert(payload)
                    .select()
                    .single())

            if (requestError) {
                throw new Error(
                    'Failed to create request: ' +
                    requestError.message
                )
            }

            const { data: requiredDocs, error: requirementsError } = await supabase
                .from('document_requirements')
                .select('requirement_id')
                .eq('document_type_id', document.document_type_id)

            if (requirementsError) {
                console.error('LOAD REQUIREMENTS ERROR:', requirementsError)
            } else if (requiredDocs && requiredDocs.length > 0) {
                const { error: seedError } = await supabase
                    .from('request_requirements')
                    .insert(
                        requiredDocs.map((req) => ({
                            request_id: request.request_id,
                            requirement_id: req.requirement_id,
                            status: 'pending',
                        }))
                    )

                if (seedError) {
                    console.error('SEED REQUIREMENTS ERROR:', seedError)
                }
            }

            const { data: assignedEmployeeRow } = assignedEmployeeId
                ? await supabase
                    .from('employees')
                    .select('user_id')
                    .eq('employee_id', assignedEmployeeId)
                    .single()
                : { data: null }

            if (assignedEmployeeRow) {
                await notify({
                    userId: assignedEmployeeRow.user_id,
                    title: 'New request pending',
                    message: `${document.document_name} request ${request.request_number} is waiting for verification.`,
                    notificationType: 'request_update',
                    relatedRequestId: request.request_id,
                })
            }

            navigate('/student/my-requests', {
                state: {
                    justSubmitted: request.request_number,
                    waitingForAssignment: !assignedEmployeeId,
                }
            })

        } catch (err) {
            console.error(err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div>
            <div className="student-page-header">
                <h1>Request a Document</h1>
                <p>Select the academic document you want to request.</p>
            </div>

            {error && <div className="student-error-box">{error}</div>}

            <div className="student-request-grid">
            <div className="student-card">
                <form className="auth-form" onSubmit={submitRequest}>

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
                        <label className="form-label">Quantity</label>
                        <input
                            className="form-input"
                            type="number"
                            min="1"
                            max={selectedDocumentDetails?.max_quantity_per_request || 2}
                            value={quantity}
                            onChange={(e) => setQuantity(Math.min(selectedDocumentDetails?.max_quantity_per_request || 2, Number(e.target.value)))}
                            disabled={loading}
                        />
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

                    <div className="form-group">
                        <label className="form-label" htmlFor="needed-by">
                            Needed by <span style={{ color: 'var(--slate)', fontWeight: 400 }}>(optional)</span>
                        </label>
                        <input
                            id="needed-by"
                            type="date"
                            className="form-input"
                            value={neededBy}
                            min={new Date().toLocaleDateString('en-CA')}
                            onChange={(e) => setNeededBy(e.target.value)}
                            disabled={loading}
                        />
                        <small style={{ color: 'var(--slate)', fontSize: 12 }}>
                            If you have a deadline (e.g. a scholarship or job application), tell us when you need it.
                            The Registrar may prioritize requests with close deadlines.
                        </small>
                    </div>

                    {neededBy && (
                        <div className="form-group">
                            <label className="form-label" htmlFor="needed-by-reason">Why do you need it by then?</label>
                            <input
                                id="needed-by-reason"
                                type="text"
                                className="form-input"
                                value={neededByReason}
                                onChange={(e) => setNeededByReason(e.target.value)}
                                placeholder="e.g. Scholarship application deadline"
                                maxLength={200}
                                disabled={loading}
                            />
                        </div>
                    )}

                    <button
                        type="submit"
                        className="auth-submit"
                        style={{ width: 'auto', padding: '13px 26px' }}
                        disabled={loading || loadingDocuments}
                    >
                        {loading && <span className="auth-spinner" />}
                        {loading ? 'Submitting...' : 'Submit Request'}
                    </button>

                </form>
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
