import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import './AdminPages.css'

function StudentDetails() {
    const { studentId } = useParams()
    const navigate = useNavigate()

    const [student, setStudent] = useState(null)
    const [requests, setRequests] = useState([])
    const [requirements, setRequirements] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        loadDetails()
    }, [studentId])

    const loadDetails = async () => {
        try {
            setLoading(true)
            setError('')

            const { data: studentData, error: studentError } = await supabase
                .from('students')
                .select('student_id, user_id, student_number, college_id, program_id, year_level, enrollment_status, status, address, emergency_contact_name, emergency_contact_number')
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

            const [{ data: college }, { data: program }] = await Promise.all([
                studentData.college_id
                    ? supabase.from('colleges').select('college_name').eq('college_id', studentData.college_id).single()
                    : Promise.resolve({ data: null }),
                studentData.program_id
                    ? supabase.from('programs').select('program_name').eq('program_id', studentData.program_id).single()
                    : Promise.resolve({ data: null }),
            ])

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

            const documentNameById = Object.fromEntries((documentTypes || []).map((d) => [d.document_type_id, d.document_name]))

            setRequests(rows.map((r) => ({ ...r, documentName: documentNameById[r.document_type_id] || 'Document' })))

            const requestIds = rows.map((r) => r.request_id)

            const { data: requirementRows } = requestIds.length
                ? await supabase
                    .from('request_requirements')
                    .select(`
                        request_requirement_id, request_id, status, uploaded_at, file_name,
                        document_requirements ( requirement_name, is_required )
                    `)
                    .in('request_id', requestIds)
                : { data: [] }

            setRequirements(
                (requirementRows || []).map((r) => ({
                    ...r,
                    requestNumber: rows.find((req) => req.request_id === r.request_id)?.request_number || 'N/A',
                }))
            )

        } catch (err) {
            console.error('ADMIN STUDENT DETAILS ERROR:', err)
            setError(err.message || 'Failed to load student.')
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return <p className="admin-loading">Loading student record...</p>
    }

    if (error) {
        return <div className="admin-error-box">{error}</div>
    }

    return (
        <div>
            <button className="admin-link-button" style={{ marginBottom: 16 }} onClick={() => navigate('/admin/students')}>
                ← Back to Students
            </button>

            <div className="admin-page-header">
                <h1>{student.fullName}</h1>
                <p>{student.student_number} · {student.email}</p>
            </div>

            <div className="admin-card">
                <h2 style={{ fontSize: 16, marginBottom: 16 }}>Student Information</h2>

                <div className="admin-info-grid">
                    <div className="admin-info-field"><span>Student Number</span><strong>{student.student_number}</strong></div>
                    <div className="admin-info-field"><span>College</span><strong>{student.collegeName || 'N/A'}</strong></div>
                    <div className="admin-info-field"><span>Program</span><strong>{student.programName || 'N/A'}</strong></div>
                    <div className="admin-info-field"><span>Year Level</span><strong>{student.year_level || 'N/A'}</strong></div>
                    <div className="admin-info-field"><span>Phone Number</span><strong>{student.phoneNumber || 'N/A'}</strong></div>
                    <div className="admin-info-field"><span>Status</span><strong style={{ textTransform: 'capitalize' }}>{student.status}</strong></div>
                    <div className="admin-info-field"><span>Address</span><strong>{student.address || 'N/A'}</strong></div>
                    <div className="admin-info-field"><span>Emergency Contact</span><strong>{student.emergency_contact_name || 'N/A'} {student.emergency_contact_number ? `(${student.emergency_contact_number})` : ''}</strong></div>
                </div>
            </div>

            <h2 style={{ fontSize: 17, margin: '24px 0 14px' }}>Request History</h2>

            {requests.length === 0 ? (
                <div className="admin-empty">This student has no document requests yet.</div>
            ) : (
                requests.map((request) => (
                    <div className="admin-list-card" key={request.request_id}>
                        <div className="admin-list-card-header">
                            <div>
                                <h3>{request.documentName}</h3>
                                <p>{request.request_number}</p>
                            </div>
                            <span className={`admin-status-pill status-${request.status}`}>
                                {request.status.replace(/_/g, ' ')}
                            </span>
                        </div>

                        <button className="admin-link-button" onClick={() => navigate(`/admin/requests/${request.request_id}`)}>
                            Open request →
                        </button>
                    </div>
                ))
            )}

            <h2 style={{ fontSize: 17, margin: '24px 0 14px' }}>Submitted Requirements</h2>

            {requirements.length === 0 ? (
                <div className="admin-empty">No requirements have been submitted by this student.</div>
            ) : (
                <div className="admin-table-wrapper">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Requirement</th>
                                <th>Request</th>
                                <th>Status</th>
                                <th>Uploaded</th>
                            </tr>
                        </thead>
                        <tbody>
                            {requirements.map((r) => (
                                <tr key={r.request_requirement_id}>
                                    <td>{r.document_requirements?.requirement_name || 'Requirement'}</td>
                                    <td>{r.requestNumber}</td>
                                    <td style={{ textTransform: 'capitalize' }}>{r.status}</td>
                                    <td>{r.uploaded_at ? new Date(r.uploaded_at).toLocaleDateString() : '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

export default StudentDetails
