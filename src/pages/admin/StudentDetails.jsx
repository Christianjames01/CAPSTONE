import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activityLog'
import { notifyError, notifySuccess, notifyWarning } from '../../lib/notify'
import '../auth/Auth.css'
import './AdminPages.css'

function StudentDetails() {
    const { studentId } = useParams()
    const navigate = useNavigate()

    const [student, setStudent] = useState(null)
    const [requests, setRequests] = useState([])
    const [requirements, setRequirements] = useState([])
    const [colleges, setColleges] = useState([])
    const [programs, setPrograms] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const [editing, setEditing] = useState(false)
    const [form, setForm] = useState(null)
    const [saving, setSaving] = useState(false)

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

            const [{ data: college }, { data: program }, { data: collegeRows }] = await Promise.all([
                studentData.college_id
                    ? supabase.from('colleges').select('college_name').eq('college_id', studentData.college_id).single()
                    : Promise.resolve({ data: null }),
                studentData.program_id
                    ? supabase.from('programs').select('program_name').eq('program_id', studentData.program_id).single()
                    : Promise.resolve({ data: null }),
                supabase.from('colleges').select('college_id, college_name').order('college_name'),
            ])

            setColleges(collegeRows || [])

            if (studentData.college_id) {
                const { data: programRows } = await supabase
                    .from('programs')
                    .select('program_id, program_name')
                    .eq('college_id', studentData.college_id)
                    .order('program_name')

                setPrograms(programRows || [])
            }

            setStudent({
                ...studentData,
                firstName: profile?.first_name || '',
                lastName: profile?.last_name || '',
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

    const startEditing = () => {
        setForm({
            firstName: student.firstName,
            lastName: student.lastName,
            phoneNumber: student.phoneNumber,
            studentNumber: student.student_number,
            collegeId: student.college_id || '',
            programId: student.program_id || '',
            yearLevel: student.year_level || '',
            address: student.address || '',
            emergencyContactName: student.emergency_contact_name || '',
            emergencyContactNumber: student.emergency_contact_number || '',
        })
        setEditing(true)
    }

    const onCollegeChange = async (collegeId) => {
        setForm((prev) => ({ ...prev, collegeId, programId: '' }))

        if (!collegeId) {
            setPrograms([])
            return
        }

        const { data: programRows } = await supabase
            .from('programs')
            .select('program_id, program_name')
            .eq('college_id', collegeId)
            .order('program_name')

        setPrograms(programRows || [])
    }

    const saveEdits = async () => {
        if (!form.firstName.trim() || !form.lastName.trim() || !form.studentNumber.trim()) {
            notifyWarning('First name, last name, and student number are required.')
            return
        }

        try {
            setSaving(true)

            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser()

            if (userError || !user) {
                throw new Error('You are not logged in.')
            }

            const { error: profileError } = await supabase
                .from('profiles')
                .update({
                    first_name: form.firstName.trim(),
                    last_name: form.lastName.trim(),
                    phone_number: form.phoneNumber.trim() || null,
                })
                .eq('user_id', student.user_id)

            if (profileError) {
                throw new Error('Failed to update profile: ' + profileError.message)
            }

            const { error: studentError } = await supabase
                .from('students')
                .update({
                    student_number: form.studentNumber.trim(),
                    college_id: form.collegeId || null,
                    program_id: form.programId || null,
                    year_level: form.yearLevel || null,
                    address: form.address.trim() || null,
                    emergency_contact_name: form.emergencyContactName.trim() || null,
                    emergency_contact_number: form.emergencyContactNumber.trim() || null,
                })
                .eq('student_id', student.student_id)

            if (studentError) {
                throw new Error('Failed to update student record: ' + studentError.message)
            }

            await logActivity({
                userId: user.id,
                action: 'edit_student',
                tableName: 'students',
                recordId: student.student_id,
                description: `Updated student information for ${form.firstName} ${form.lastName} (${form.studentNumber}).`,
            })

            notifySuccess('Student information updated.')
            setEditing(false)
            await loadDetails()

        } catch (err) {
            console.error('SAVE STUDENT EDIT ERROR:', err)
            notifyError(err.message || 'Failed to save changes.')
        } finally {
            setSaving(false)
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
                <div className="admin-page-header-row" style={{ marginBottom: 16 }}>
                    <h2 style={{ fontSize: 16 }}>Student Information</h2>
                    {!editing && (
                        <button className="admin-link-button" onClick={startEditing}>
                            Edit →
                        </button>
                    )}
                </div>

                {editing ? (
                    <>
                        <div className="admin-info-grid" style={{ marginBottom: 14 }}>
                            <div className="form-group">
                                <label className="form-label">First Name</label>
                                <input className="admin-search-input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} disabled={saving} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Last Name</label>
                                <input className="admin-search-input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} disabled={saving} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Student Number</label>
                                <input className="admin-search-input" inputMode="numeric" value={form.studentNumber} onChange={(e) => setForm({ ...form, studentNumber: e.target.value.replace(/\D/g, '').slice(0, 8) })} disabled={saving} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Phone Number</label>
                                <input className="admin-search-input" value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} disabled={saving} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">College</label>
                                <select className="admin-search-input" value={form.collegeId} onChange={(e) => onCollegeChange(e.target.value)} disabled={saving}>
                                    <option value="">-- None --</option>
                                    {colleges.map((c) => (
                                        <option key={c.college_id} value={c.college_id}>{c.college_name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Program</label>
                                <select className="admin-search-input" value={form.programId} onChange={(e) => setForm({ ...form, programId: e.target.value })} disabled={saving || !form.collegeId}>
                                    <option value="">{form.collegeId ? '-- None --' : 'Select a college first'}</option>
                                    {programs.map((p) => (
                                        <option key={p.program_id} value={p.program_id}>{p.program_name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Year Level</label>
                                <select className="admin-search-input" value={form.yearLevel} onChange={(e) => setForm({ ...form, yearLevel: e.target.value })} disabled={saving}>
                                    <option value="">-- None --</option>
                                    <option value="1">1st Year</option>
                                    <option value="2">2nd Year</option>
                                    <option value="3">3rd Year</option>
                                    <option value="4">4th Year</option>
                                    <option value="5">5th Year</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Address</label>
                                <input className="admin-search-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} disabled={saving} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Emergency Contact Name</label>
                                <input className="admin-search-input" value={form.emergencyContactName} onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })} disabled={saving} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Emergency Contact Number</label>
                                <input className="admin-search-input" value={form.emergencyContactNumber} onChange={(e) => setForm({ ...form, emergencyContactNumber: e.target.value })} disabled={saving} />
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 10 }}>
                            <button className="admin-primary-button" onClick={saveEdits} disabled={saving}>
                                {saving ? 'Saving...' : 'Save'}
                            </button>
                            <button className="admin-link-button" style={{ color: 'var(--slate)' }} onClick={() => setEditing(false)} disabled={saving}>
                                Cancel
                            </button>
                        </div>
                    </>
                ) : (
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
                )}
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
