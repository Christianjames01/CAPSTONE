import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'

function NewRequest() {
    const navigate = useNavigate()

    const [documents, setDocuments] = useState([])
    const [selectedDocument, setSelectedDocument] = useState('')
    const [quantity, setQuantity] = useState(1)
    const [purpose, setPurpose] = useState('')
    const [loading, setLoading] = useState(false)
    const [loadingDocuments, setLoadingDocuments] = useState(true)

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
            alert('Failed to load documents: ' + error.message)
        } else {
            setDocuments(data || [])
        }

        setLoadingDocuments(false)
    }

    const submitRequest = async (e) => {
        e.preventDefault()

        if (!selectedDocument) {
            alert('Please select a document.')
            return
        }

        if (quantity < 1) {
            alert('Quantity must be at least 1.')
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

            alert(
                `Request ${request.request_number} submitted successfully!`
            )

            navigate('/student/my-requests')

        } catch (error) {
            console.error(error)
            alert(error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div
            style={{
                maxWidth: '900px',
                margin: '0 auto',
                padding: '40px'
            }}
        >
            <h1>Request a Document</h1>

            <p>
                Select the academic document you want to request.
            </p>

            <form onSubmit={submitRequest}>

                <div style={{ marginBottom: '20px' }}>
                    <label>
                        <strong>Document</strong>
                    </label>

                    {loadingDocuments ? (
                        <p>Loading documents...</p>
                    ) : (
                        <select
                            value={selectedDocument}
                            onChange={(e) =>
                                setSelectedDocument(e.target.value)
                            }
                            style={{
                                display: 'block',
                                width: '100%',
                                padding: '10px',
                                marginTop: '5px'
                            }}
                        >
                            <option value="">
                                -- Select Document --
                            </option>

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

                <div style={{ marginBottom: '20px' }}>
                    <label>
                        <strong>Quantity</strong>
                    </label>

                    <input
                        type="number"
                        min="1"
                        value={quantity}
                        onChange={(e) =>
                            setQuantity(Number(e.target.value))
                        }
                        style={{
                            display: 'block',
                            width: '100%',
                            padding: '10px',
                            marginTop: '5px'
                        }}
                    />
                </div>

                <div style={{ marginBottom: '20px' }}>
                    <label>
                        <strong>Purpose</strong>
                    </label>

                    <textarea
                        value={purpose}
                        onChange={(e) =>
                            setPurpose(e.target.value)
                        }
                        placeholder="Enter the purpose of your request"
                        rows="4"
                        style={{
                            display: 'block',
                            width: '100%',
                            padding: '10px',
                            marginTop: '5px'
                        }}
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading || loadingDocuments}
                    style={{
                        padding: '12px 25px',
                        cursor: 'pointer'
                    }}
                >
                    {loading ? 'Submitting...' : 'Submit Request'}
                </button>

            </form>
        </div>
    )
}

export default NewRequest