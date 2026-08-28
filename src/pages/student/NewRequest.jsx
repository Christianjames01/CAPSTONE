import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useNavigate, useSearchParams } from 'react-router-dom'
import hcdcLogo from '../../assets/hcdc-logo.png'
import { findAssignedEmployee } from '../../lib/assignEmployee'
import { notify } from '../../lib/notify'
import '../auth/Auth.css'
import './StudentPages.css'

// Maps a document's code to which sample layout best represents it.
// Anything not listed falls back to 'letter' (a formal certification body).
const SAMPLE_LAYOUT_BY_CODE = {
    TOR: 'grades',
    COG: 'grades',
    POG: 'grades',
    CGCE: 'grades',
    CGWA: 'gwa',
    POCS: 'schedule',
    POE: 'evaluation',
    CRUS: 'evaluation',
    CCAR: 'evaluation',
    CUE: 'evaluation',
    DIP: 'diploma',
    COGR: 'diploma',
    HD: 'diploma',
}

function NewRequest() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()

    const [documents, setDocuments] = useState([])
    const [search, setSearch] = useState('')
    const [selectedDocument, setSelectedDocument] = useState('')
    const [quantity, setQuantity] = useState(1)
    const [purpose, setPurpose] = useState('')
    const [loading, setLoading] = useState(false)
    const [loadingDocuments, setLoadingDocuments] = useState(true)
    const [error, setError] = useState('')
    const [studentInfo, setStudentInfo] = useState(null)
    const [selectedRequirements, setSelectedRequirements] = useState([])
    const [loadingRequirements, setLoadingRequirements] = useState(false)

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
                .select('student_number, college_id, program_id, user_id')
                .eq('user_id', user.id)
                .single()

            if (!student) return

            const [{ data: profile }, { data: program }, { data: college }] = await Promise.all([
                supabase.from('profiles').select('first_name, last_name').eq('user_id', user.id).single(),
                student.program_id
                    ? supabase.from('programs').select('program_name').eq('program_id', student.program_id).single()
                    : Promise.resolve({ data: null }),
                student.college_id
                    ? supabase.from('colleges').select('college_name').eq('college_id', student.college_id).single()
                    : Promise.resolve({ data: null }),
            ])

            setStudentInfo({
                fullName: profile ? `${profile.first_name} ${profile.last_name}`.trim() : '',
                studentNumber: student.student_number || '',
                programName: program?.program_name || '',
                collegeName: college?.college_name || '',
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
        processing_days_max
      `)
            .eq('is_available', true)
            .order('document_name')

        if (error) {
            console.error(error)
            setError('Failed to load documents: ' + error.message)
        } else {
            setDocuments(data || [])

            // Pre-select a document type when arriving via a "Request again" link.
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

    const sampleLayout = selectedDocumentDetails
        ? SAMPLE_LAYOUT_BY_CODE[selectedDocumentDetails.document_code] || 'letter'
        : null

    const submitRequest = async (e) => {
        e.preventDefault()

        setError('')

        if (!selectedDocument) {
            setError('Please select a document.')
            return
        }

        if (quantity < 1) {
            setError('Quantity must be at least 1.')
            return
        }

        setLoading(true)

        try {
            // 1. Get logged-in user
            const {
                data: { user },
                error: userError
            } = await supabase.auth.getUser()

            if (userError || !user) {
                throw new Error('You are not logged in.')
            }

            // 2. Get student's record
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

            // 2.5. Enforce request limit: at most 2 active requests per
            // document type at once.
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

            if (activeCountForSameDocument >= 2) {
                throw new Error(
                    "You already have 2 active requests for this document. Please wait for one to finish (or get claimed) before requesting another."
                )
            }

            // 3. Find the registrar assigned to this college/program. If more
            // than one active employee is assigned to the same college/program,
            // this picks whichever currently has the fewest open requests.
            const assignedEmployeeId = await findAssignedEmployee(student.college_id, student.program_id)

            if (!assignedEmployeeId) {
                throw new Error(
                    'No registrar employee is assigned to your college and program.'
                )
            }

            // 4. Get selected document
            const document = documents.find(
                (item) =>
                    item.document_type_id === selectedDocument
            )

            if (!document) {
                throw new Error('Selected document could not be found.')
            }

            // 5. Calculate amount
            const unitFee = Number(document.fee || 0)

            // 6. Generate request number
            const requestNumber =
                'REQ-' + Date.now()

            // 7. Insert request
            const { data: request, error: requestError } =
                await supabase
                    .from('document_requests')
                    .insert({
                        request_number: requestNumber,
                        student_id: student.student_id,
                        document_type_id: document.document_type_id,
                        assigned_employee_id: assignedEmployeeId,
                        quantity: Number(quantity),
                        unit_fee: unitFee,
                        priority: 'normal',
                        purpose: purpose || null,
                        status: 'pending'
                    })
                    .select()
                    .single()

            if (requestError) {
                throw new Error(
                    'Failed to create request: ' +
                    requestError.message
                )
            }

            // 8. Seed the requirements this document type needs so the
            // student can upload them and the registrar can review them.
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

            // 9. Notify the assigned employee that a new request is pending.
            const { data: assignedEmployeeRow } = await supabase
                .from('employees')
                .select('user_id')
                .eq('employee_id', assignedEmployeeId)
                .single()

            if (assignedEmployeeRow) {
                await notify({
                    userId: assignedEmployeeRow.user_id,
                    title: 'New request pending',
                    message: `${document.document_name} request ${requestNumber} is waiting for verification.`,
                    notificationType: 'request_update',
                    relatedRequestId: request.request_id,
                })
            }

            navigate('/student/my-requests', {
                state: { justSubmitted: request.request_number }
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
                            <p className="student-loading" style={{ padding: 0 }}>Loading documents...</p>
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
                                                        border: isSelected ? '1.5px solid var(--blue)' : '1px solid var(--line)',
                                                        background: isSelected ? 'var(--blue-tint)' : 'var(--white)',
                                                    }}
                                                    onClick={() => setSelectedDocument(document.document_type_id)}
                                                    disabled={loading}
                                                >
                                                    <div className="student-list-card-header" style={{ gap: 10 }}>
                                                        <div>
                                                            <h3 style={{ fontSize: 14 }}>{document.document_name}</h3>
                                                            <p>{document.category || 'General'}</p>
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
                            value={quantity}
                            onChange={(e) => setQuantity(Number(e.target.value))}
                            disabled={loading}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Purpose</label>
                        <textarea
                            className="form-input"
                            value={purpose}
                            onChange={(e) => setPurpose(e.target.value)}
                            placeholder="Enter the purpose of your request"
                            rows="4"
                            disabled={loading}
                        />
                    </div>

                    <button
                        type="submit"
                        className="auth-submit"
                        style={{ width: 'auto', padding: '13px 26px' }}
                        disabled={loading || loadingDocuments}
                    >
                        {loading ? 'Submitting...' : 'Submit Request'}
                    </button>

                </form>
            </div>

            <div className="student-card" style={{ position: 'sticky', top: 20 }}>
                <h2 style={{ fontSize: 15, marginBottom: 4 }}>Sample Document Preview</h2>
                <p style={{ fontSize: 12.5, color: 'var(--slate)', marginBottom: 14 }}>
                    Reference layout only — not an official document.
                </p>

                {!selectedDocumentDetails ? (
                    <div className="student-empty" style={{ padding: '32px 16px' }}>
                        Select a document on the left to preview a sample of what it looks like.
                    </div>
                ) : (
                    <DocumentSample layout={sampleLayout} name={selectedDocumentDetails.document_name} student={studentInfo} />
                )}
            </div>
            </div>
        </div>
    )
}

// ==========================================
// SAMPLE DOCUMENT PREVIEW
// Each layout renders a distinct, structured mockup (like TOR's grades
// table) instead of one flat placeholder reused for every document.
// ==========================================

function SealImage({ cx, cy, r, grayscale = false }) {
    const clipId = `seal-clip-${cx}-${cy}-${r}`
    const filterId = `seal-gray-${cx}-${cy}-${r}`

    return (
        <>
            <defs>
                <clipPath id={clipId}>
                    <circle cx={cx} cy={cy} r={r - 1} />
                </clipPath>
                {grayscale && (
                    <filter id={filterId}>
                        <feColorMatrix type="saturate" values="0" />
                    </filter>
                )}
            </defs>
            <image
                href={hcdcLogo}
                x={cx - r}
                y={cy - r}
                width={r * 2}
                height={r * 2}
                clipPath={`url(#${clipId})`}
                filter={grayscale ? `url(#${filterId})` : undefined}
                preserveAspectRatio="xMidYMid slice"
            />
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={grayscale ? 'var(--slate)' : 'var(--red)'} strokeWidth="1.5" />
        </>
    )
}

function SampleHeader({ title }) {
    return (
        <>
            <rect x="0.5" y="0.5" width="559" height="56" rx="8" fill="var(--blue)" />
            <rect x="0.5" y="40" width="559" height="16.5" fill="var(--blue)" />
            <circle cx="34" cy="28" r="16" fill="var(--white)" />
            <SealImage cx={34} cy={28} r={16} />
            <text x="60" y="24" fontSize="13" fontWeight="700" fill="var(--white)">HOLY CROSS OF DAVAO COLLEGE</text>
            <text x="60" y="40" fontSize="11" fill="rgba(255,255,255,0.8)">Office of the Registrar</text>
            <text x="280" y="82" textAnchor="middle" fontSize="13.5" fontWeight="700" fill="var(--ink)" letterSpacing="0.5">
                {title}
            </text>
        </>
    )
}

const REGISTRAR_HEAD_NAME = 'Jen Yee'
const REGISTRAR_HEAD_TITLE = 'Registrar Head'

const truncate = (text, max) =>
    text && text.length > max ? text.slice(0, max - 1) + '…' : text

function SampleFooter() {
    return (
        <>
            <line x1="24" y1="312" x2="536" y2="312" stroke="var(--line)" />
            <line x1="380" y1="340" x2="536" y2="340" stroke="var(--slate)" />
            <text x="458" y="354" textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--ink)">
                {REGISTRAR_HEAD_NAME}
            </text>
            <text x="458" y="366" textAnchor="middle" fontSize="8" fill="var(--slate)">
                {REGISTRAR_HEAD_TITLE}
            </text>
            <SealImage cx={60} cy={345} r={18} grayscale />
        </>
    )
}

function StudentInfoRow({ y = 110, student }) {
    return (
        <g fontSize="10" fill="var(--slate)">
            <text x="24" y={y}>Student Name</text>
            <text x="24" y={y + 16} fontSize="11.5" fill="var(--ink)" fontWeight="600">
                {truncate(student?.fullName || 'Juan Dela Cruz', 34)}
            </text>

            <text x="300" y={y}>Student Number</text>
            <text x="300" y={y + 16} fontSize="11.5" fill="var(--ink)" fontWeight="600">
                {student?.studentNumber || '2021-00000'}
            </text>

            <text x="24" y={y + 36}>Program</text>
            <text x="24" y={y + 52} fontSize="11.5" fill="var(--ink)" fontWeight="600">
                {truncate(student?.programName || 'BS Information Technology', 34)}
            </text>

            <text x="300" y={y + 36}>College</text>
            <text x="300" y={y + 52} fontSize="11.5" fill="var(--ink)" fontWeight="600">
                {truncate(student?.collegeName || 'College of Computer Studies', 30)}
            </text>
        </g>
    )
}

function GradesBody({ student }) {
    const rows = [
        ['IT 101', 'Introduction to Computing', '3.0', '1.75', 'Passed'],
        ['IT 102', 'Computer Programming 1', '3.0', '1.50', 'Passed'],
        ['GE 101', 'Understanding the Self', '3.0', '2.00', 'Passed'],
        ['PE 101', 'Physical Fitness', '2.0', '1.25', 'Passed'],
    ]

    return (
        <>
            <StudentInfoRow student={student} />
            <line x1="24" y1="176" x2="536" y2="176" stroke="var(--line)" />

            <g fontSize="9.5" fontWeight="700" fill="var(--slate)">
                <text x="24" y="194">COURSE CODE</text>
                <text x="110" y="194">DESCRIPTIVE TITLE</text>
                <text x="380" y="194">UNITS</text>
                <text x="440" y="194">GRADE</text>
                <text x="490" y="194">REMARKS</text>
            </g>
            <line x1="24" y1="202" x2="536" y2="202" stroke="var(--line)" />

            {rows.map((row, i) => (
                <g key={row[0]} fontSize="9.5" fill="var(--ink)">
                    <text x="24" y={222 + i * 20}>{row[0]}</text>
                    <text x="110" y={222 + i * 20}>{row[1]}</text>
                    <text x="380" y={222 + i * 20}>{row[2]}</text>
                    <text x="440" y={222 + i * 20}>{row[3]}</text>
                    <text x="490" y={222 + i * 20} fill="var(--slate)">{row[4]}</text>
                </g>
            ))}
        </>
    )
}

function GwaBody({ student }) {
    return (
        <>
            <StudentInfoRow student={student} />
            <line x1="24" y1="176" x2="536" y2="176" stroke="var(--line)" />

            <rect x="24" y="196" width="512" height="80" rx="6" fill="var(--blue-tint)" />
            <text x="280" y="222" textAnchor="middle" fontSize="10" fill="var(--blue-dark)">GENERAL WEIGHTED AVERAGE</text>
            <text x="280" y="260" textAnchor="middle" fontSize="30" fontWeight="700" fill="var(--blue)">1.75</text>
        </>
    )
}

function ScheduleBody({ student }) {
    const rows = [
        ['MON / WED', '8:00 – 9:30 AM', 'Data Structures', 'Rm 301'],
        ['TUE / THU', '9:30 – 11:00 AM', 'Web Development', 'Lab 2'],
        ['MON / WED', '1:00 – 2:30 PM', 'Database Systems', 'Rm 205'],
        ['FRIDAY', '3:00 – 5:00 PM', 'Physical Education', 'Gym'],
    ]

    return (
        <>
            <StudentInfoRow student={student} />
            <line x1="24" y1="176" x2="536" y2="176" stroke="var(--line)" />

            <g fontSize="9.5" fontWeight="700" fill="var(--slate)">
                <text x="24" y="194">DAY</text>
                <text x="150" y="194">TIME</text>
                <text x="300" y="194">SUBJECT</text>
                <text x="470" y="194">ROOM</text>
            </g>
            <line x1="24" y1="202" x2="536" y2="202" stroke="var(--line)" />

            {rows.map((row, i) => (
                <g key={row[0] + i} fontSize="9.5" fill="var(--ink)">
                    <text x="24" y={222 + i * 20}>{row[0]}</text>
                    <text x="150" y={222 + i * 20}>{row[1]}</text>
                    <text x="300" y={222 + i * 20}>{row[2]}</text>
                    <text x="470" y={222 + i * 20}>{row[3]}</text>
                </g>
            ))}
        </>
    )
}

function EvaluationBody({ student }) {
    const rows = [
        ['General Education Subjects', '39 units', 'Completed'],
        ['Major / Core Subjects', '78 units', 'Completed'],
        ['Elective Subjects', '9 units', '3 units remaining'],
        ['NSTP / PE', '10 units', 'Completed'],
    ]

    return (
        <>
            <StudentInfoRow student={student} />
            <line x1="24" y1="176" x2="536" y2="176" stroke="var(--line)" />

            <g fontSize="9.5" fontWeight="700" fill="var(--slate)">
                <text x="24" y="194">REQUIREMENT</text>
                <text x="330" y="194">UNITS</text>
                <text x="420" y="194">STATUS</text>
            </g>
            <line x1="24" y1="202" x2="536" y2="202" stroke="var(--line)" />

            {rows.map((row, i) => (
                <g key={row[0]} fontSize="9.5">
                    <text x="24" y={222 + i * 20} fill="var(--ink)">{row[0]}</text>
                    <text x="330" y={222 + i * 20} fill="var(--ink)">{row[1]}</text>
                    <text x="420" y={222 + i * 20} fill={row[2] === 'Completed' ? '#1e8a5f' : 'var(--red)'}>
                        {row[2] === 'Completed' ? '✓ ' : '• '}{row[2]}
                    </text>
                </g>
            ))}
        </>
    )
}

function DiplomaBody({ name, student }) {
    return (
        <>
            <rect x="14" y="94" width="532" height="200" fill="none" stroke="var(--red)" strokeWidth="1" strokeDasharray="1 3" />

            <text x="280" y="130" textAnchor="middle" fontSize="10" fill="var(--slate)">This is to certify that</text>
            <text x="280" y="156" textAnchor="middle" fontSize="16" fontWeight="700" fill="var(--ink)" letterSpacing="0.5">
                {(student?.fullName || 'Juan Dela Cruz').toUpperCase()}
            </text>
            <text x="280" y="180" textAnchor="middle" fontSize="10" fill="var(--slate)">
                has satisfactorily completed the requirements for the degree of
            </text>
            <text x="280" y="204" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--blue)">
                {(student?.programName || 'Bachelor of Science in Information Technology').toUpperCase()}
            </text>
            <text x="280" y="230" textAnchor="middle" fontSize="10" fill="var(--slate)">
                and is hereby awarded this
            </text>
            <text x="280" y="250" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--ink)">
                {name}
            </text>

            <SealImage cx={90} cy={255} r={22} grayscale />
        </>
    )
}

function LetterBody({ student }) {
    return (
        <>
            <line x1="180" y1="94" x2="380" y2="94" stroke="var(--red)" strokeWidth="1.5" />

            <g fontSize="9" fill="var(--slate)">
                <text x="24" y="130">This is to certify that</text>
                <text x="24" y="148" fontSize="12" fill="var(--ink)" fontWeight="600">
                    {student?.fullName || 'Juan Dela Cruz'}
                </text>

                <line x1="24" y1="172" x2="536" y2="172" stroke="var(--line)" />
                <line x1="24" y1="192" x2="536" y2="192" stroke="var(--line)" />
                <line x1="24" y1="212" x2="536" y2="212" stroke="var(--line)" />
                <line x1="24" y1="232" x2="400" y2="232" stroke="var(--line)" />
            </g>

            <StudentInfoRow y={272} student={student} />
        </>
    )
}

const SAMPLE_BODY = {
    grades: GradesBody,
    gwa: GwaBody,
    schedule: ScheduleBody,
    evaluation: EvaluationBody,
    diploma: DiplomaBody,
    letter: LetterBody,
}

function DocumentSample({ layout, name, student }) {
    const Body = SAMPLE_BODY[layout] || LetterBody

    return (
        <svg viewBox="0 0 560 380" style={{ width: '100%', height: 'auto' }} role="img" aria-label={`Sample layout of ${name}`}>
            <rect x="0.5" y="0.5" width="559" height="379" rx="8" fill="var(--white)" stroke="var(--line)" />
            <SampleHeader title={name.toUpperCase()} />
            <Body name={name} student={student} />
            <SampleFooter />
        </svg>
    )
}

export default NewRequest
