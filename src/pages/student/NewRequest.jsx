import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'
import '../auth/Auth.css'
import './StudentPages.css'

function NewRequest() {
    const navigate = useNavigate()

    const [documents, setDocuments] = useState([])
    const [selectedDocument, setSelectedDocument] = useState('')
    const [quantity, setQuantity] = useState(1)
    const [purpose, setPurpose] = useState('')
    const [loading, setLoading] = useState(false)
    const [loadingDocuments, setLoadingDocuments] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        loadDocuments()
    }, [])

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
        }

        setLoadingDocuments(false)
    }

    const selectedDocumentDetails = documents.find(
        (item) => item.document_type_id === selectedDocument
    )

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

            // 3. Find the registrar assigned to this college/program
            const { data: assignment, error: assignmentError } = await supabase
                .from('employee_assignments')
                .select(`
          employee_id,
          college_id,
          program_id,
          is_primary,
          status
        `)
                .eq('college_id', student.college_id)
                .eq('program_id', student.program_id)
                .eq('is_primary', true)
                .eq('status', 'active')
                .limit(1)
                .maybeSingle()

            if (assignmentError) {
                throw new Error(
                    'Failed to find registrar assignment: ' +
                    assignmentError.message
                )
            }

            if (!assignment) {
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
                        assigned_employee_id: assignment.employee_id,
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

            <div className="student-card" style={{ maxWidth: 560 }}>
                <form className="auth-form" onSubmit={submitRequest}>

                    <div className="form-group">
                        <label className="form-label">Document</label>

                        {loadingDocuments ? (
                            <p className="student-loading" style={{ padding: 0 }}>Loading documents...</p>
                        ) : (
                            <select
                                className="form-input"
                                value={selectedDocument}
                                onChange={(e) => setSelectedDocument(e.target.value)}
                                disabled={loading}
                            >
                                <option value="">-- Select Document --</option>

                                {documents.map((document) => (
                                    <option
                                        key={document.document_type_id}
                                        value={document.document_type_id}
                                    >
                                        {document.document_name} — ₱
                                        {Number(document.fee || 0).toFixed(2)}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {selectedDocumentDetails && (
                        <div className="student-info-grid" style={{ background: 'var(--paper)', padding: 16, borderRadius: 8 }}>
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
        </div>
    )
}

export default NewRequest
