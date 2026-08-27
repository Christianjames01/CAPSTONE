import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import './EmployeePages.css'

function StudentHistory() {
    const { studentId } = useParams()
    const navigate = useNavigate()

    const [student, setStudent] = useState(null)
    const [requests, setRequests] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        loadHistory()
    }, [studentId])

    const loadHistory = async () => {
        try {
            setLoading(true)
            setError('')

            const { data: studentData, error: studentError } = await supabase
                .from('students')
                .select('student_id, user_id, student_number, college_id, program_id, year_level, status')
                .eq('student_id', studentId)
                .single()

            if (studentError || !studentData) {
                throw new Error('Student record could not be found.')
            }

            const { data: profile } = await supabase
                .from('profiles')
                .select('first_name, last_name, email, phone_number')
                .eq('user_id', studentData.user_id)
                .single()

            const { data: college } = studentData.college_id
                ? await supabase.from('colleges').select('college_name').eq('college_id', studentData.college_id).single()
                : { data: null }

            const { data: program } = studentData.program_id
                ? await supabase.from('programs').select('program_name').eq('program_id', studentData.program_id).single()
                : { data: null }

            setStudent({
                ...studentData,
                fullName: profile ? `${profile.first_name} ${profile.last_name}`.trim() : 'Unknown',
                email: profile?.email || '',
                phoneNumber: profile?.phone_number || '',
                collegeName: college?.college_name || '',
                programName: program?.program_name || '',
            })

            const { data: requestRows, error: requestError } = await supabase
                .from('document_requests')
                .select('request_id, request_number, document_type_id, total_amount, status, requested_at')
                .eq('student_id', studentId)
                .order('requested_at', { ascending: false })

            if (requestError) {
                throw new Error('Failed to load request history: ' + requestError.message)
            }

            const rows = requestRows || []
            const documentTypeIds = [...new Set(rows.map((r) => r.document_type_id).filter(Boolean))]

            const { data: documentTypes } = documentTypeIds.length
                ? await supabase.from('document_types').select('document_type_id, document_name').in('document_type_id', documentTypeIds)
                : { data: [] }

            const documentNameById = Object.fromEntries(
                (documentTypes || []).map((d) => [d.document_type_id, d.document_name])
            )

            setRequests(rows.map((r) => ({ ...r, documentName: documentNameById[r.document_type_id] || 'Document' })))

        } catch (err) {
            console.error('STUDENT HISTORY ERROR:', err)
            setError(err.message || 'Failed to load student history.')
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return <p className="employee-loading">Loading student record...</p>
    }

    if (error) {
        return <div className="employee-error-box">{error}</div>
    }

    return (
        <div>
            <button className="employee-link-button" style={{ marginBottom: 16 }} onClick={() => navigate('/employee/students')}>
                ← Back to Students
            </button>

            <div className="employee-page-header">
                <h1>{student.fullName}</h1>
                <p>{student.student_number} · {student.email}</p>
            </div>

            <div className="employee-card">
                <h2 style={{ fontSize: 16, marginBottom: 16 }}>Student Information</h2>

                <div className="employee-info-grid">
                    <div className="employee-info-field">
                        <span>Student Number</span>
                        <strong>{student.student_number}</strong>
                    </div>

                    <div className="employee-info-field">
                        <span>College</span>
                        <strong>{student.collegeName || 'N/A'}</strong>
                    </div>

                    <div className="employee-info-field">
                        <span>Program</span>
                        <strong>{student.programName || 'N/A'}</strong>
                    </div>

                    <div className="employee-info-field">
                        <span>Year Level</span>
                        <strong>{student.year_level || 'N/A'}</strong>
                    </div>

                    <div className="employee-info-field">
                        <span>Phone Number</span>
                        <strong>{student.phoneNumber || 'N/A'}</strong>
                    </div>

                    <div className="employee-info-field">
                        <span>Status</span>
                        <strong style={{ textTransform: 'capitalize' }}>{student.status}</strong>
                    </div>
                </div>
            </div>

            <h2 style={{ fontSize: 17, margin: '24px 0 14px' }}>Request History</h2>

            {requests.length === 0 ? (
                <div className="employee-empty">This student has no document requests yet.</div>
            ) : (
                requests.map((request) => (
                    <div className="employee-list-card" key={request.request_id}>
                        <div className="employee-list-card-header">
                            <div>
                                <h3>{request.documentName}</h3>
                                <p>{request.request_number}</p>
                            </div>

                            <span className={`employee-status-pill status-${request.status}`}>
                                {request.status.replace(/_/g, ' ')}
                            </span>
                        </div>

                        <div className="employee-info-grid">
                            <div className="employee-info-field">
                                <span>Total</span>
                                <strong>₱{Number(request.total_amount || 0).toFixed(2)}</strong>
                            </div>

                            <div className="employee-info-field">
                                <span>Requested</span>
                                <strong>
                                    {request.requested_at ? new Date(request.requested_at).toLocaleDateString() : '-'}
                                </strong>
                            </div>
                        </div>

                        <button
                            className="employee-link-button"
                            onClick={() => navigate(`/employee/requests/${request.request_id}`)}
                        >
                            Open request →
                        </button>
                    </div>
                ))
            )}
        </div>
    )
}

export default StudentHistory
