import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Swal from 'sweetalert2'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activityLog'
import { describeChanges } from '../../lib/describeChanges'
import { notifyError, notifySuccess, notifyWarning } from '../../lib/notify'
import { generateTempPassword, resetStudentPassword } from '../../lib/resetStudentPassword'
import { SkeletonPageHeader, SkeletonDetailCard } from '../../components/Skeleton'
import '../auth/Auth.css'
import './EmployeePages.css'

function StudentHistory() {
    const { studentId } = useParams()
    const navigate = useNavigate()

    const [student, setStudent] = useState(null)
    const [requests, setRequests] = useState([])
    const [colleges, setColleges] = useState([])
    const [programs, setPrograms] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const [editing, setEditing] = useState(false)
    const [form, setForm] = useState(null)
    const [saving, setSaving] = useState(false)
    const [resettingPassword, setResettingPassword] = useState(false)

    useEffect(() => {
        loadHistory()
    }, [studentId])

    const loadHistory = async () => {
        try {
            setLoading(true)
            setError('')

            const { data: studentData, error: studentError } = await supabase
                .from('students')
                .select('student_id, user_id, student_number, college_id, program_id, year_level, status, address, emergency_contact_name, emergency_contact_number')
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

            const { data: collegeRows } = await supabase.from('colleges').select('college_id, college_name').order('college_name')
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

            const { data: employee } = await supabase
                .from('employees')
                .select('employee_id')
                .eq('user_id', user.id)
                .maybeSingle()

            const newCollegeName = colleges.find((c) => c.college_id === form.collegeId)?.college_name || ''
            const newProgramName = programs.find((p) => p.program_id === form.programId)?.program_name || ''

            const changes = describeChanges([
                ['name', `${student.firstName} ${student.lastName}`.trim(), `${form.firstName.trim()} ${form.lastName.trim()}`],
                ['student number', student.student_number, form.studentNumber.trim()],
                ['college', student.collegeName, newCollegeName],
                ['program', student.programName, newProgramName],
                ['year level', student.year_level, form.yearLevel],
                ['phone number', student.phoneNumber, form.phoneNumber.trim()],
            ])

            await logActivity({
                employeeId: employee?.employee_id,
                userId: employee ? null : user.id,
                action: 'edit_student',
                tableName: 'students',
                recordId: student.student_id,
                description: `Updated student information for ${form.firstName} ${form.lastName} (${form.studentNumber}).${changes ? ' ' + changes + '.' : ''}`,
            })

            notifySuccess('Student information updated.')
            setEditing(false)
            await loadHistory()

        } catch (err) {
            console.error('SAVE STUDENT EDIT ERROR:', err)
            notifyError(err.message || 'Failed to save changes.')
        } finally {
            setSaving(false)
        }
    }

    const handleResetPassword = async () => {
        const confirmed = await Swal.fire({
            icon: 'warning',
            title: 'Reset student password?',
            text: `This immediately sets a new login password for ${student.fullName}. Use this only if they can't use the email-based Forgot Password link.`,
            showCancelButton: true,
            confirmButtonText: 'Reset password',
            confirmButtonColor: '#C8102E',
        })

        if (!confirmed.isConfirmed) return

        try {
            setResettingPassword(true)

            const tempPassword = generateTempPassword()

            await resetStudentPassword({
                studentUserId: student.user_id,
                newPassword: tempPassword,
            })

            await Swal.fire({
                icon: 'success',
                title: 'Password reset',
                html: `
                    <p style="margin-bottom:12px;">Share this new password with ${student.fullName} directly (in person, by phone, etc). It will not be shown again.</p>
                    <code style="display:block;padding:10px 14px;background:#F3F4F6;border-radius:8px;font-size:16px;font-weight:700;letter-spacing:1px;">${tempPassword}</code>
                `,
                confirmButtonText: 'Done',
                confirmButtonColor: '#123B78',
            })

        } catch (err) {
            console.error('RESET STUDENT PASSWORD ERROR:', err)
            notifyError(err.message || 'Failed to reset password.')
        } finally {
            setResettingPassword(false)
        }
    }

    if (loading) {
        return (
            <div>
                <SkeletonPageHeader />
                <SkeletonDetailCard fields={6} />
                <SkeletonDetailCard fields={4} />
            </div>
        )
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
                <div className="employee-page-header-row" style={{ marginBottom: 16 }}>
                    <h2 style={{ fontSize: 16 }}>Student Information</h2>
                    {!editing && (
                        <button className="employee-link-button" onClick={startEditing}>
                            Edit →
                        </button>
                    )}
                </div>

                {editing ? (
                    <>
                        <div className="employee-info-grid" style={{ marginBottom: 14 }}>
                            <div className="form-group">
                                <label className="form-label">First Name</label>
                                <input className="employee-search-input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} disabled={saving} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Last Name</label>
                                <input className="employee-search-input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} disabled={saving} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Student Number</label>
                                <input className="employee-search-input" inputMode="numeric" value={form.studentNumber} onChange={(e) => setForm({ ...form, studentNumber: e.target.value.replace(/\D/g, '').slice(0, 8) })} disabled={saving} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Phone Number</label>
                                <input className="employee-search-input" value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} disabled={saving} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">College</label>
                                <select className="employee-search-input" value={form.collegeId} onChange={(e) => onCollegeChange(e.target.value)} disabled={saving}>
                                    <option value="">-- None --</option>
                                    {colleges.map((c) => (
                                        <option key={c.college_id} value={c.college_id}>{c.college_name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Program</label>
                                <select className="employee-search-input" value={form.programId} onChange={(e) => setForm({ ...form, programId: e.target.value })} disabled={saving || !form.collegeId}>
                                    <option value="">{form.collegeId ? '-- None --' : 'Select a college first'}</option>
                                    {programs.map((p) => (
                                        <option key={p.program_id} value={p.program_id}>{p.program_name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Year Level</label>
                                <select className="employee-search-input" value={form.yearLevel} onChange={(e) => setForm({ ...form, yearLevel: e.target.value })} disabled={saving}>
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
                                <input className="employee-search-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} disabled={saving} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Emergency Contact Name</label>
                                <input className="employee-search-input" value={form.emergencyContactName} onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })} disabled={saving} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Emergency Contact Number</label>
                                <input className="employee-search-input" value={form.emergencyContactNumber} onChange={(e) => setForm({ ...form, emergencyContactNumber: e.target.value })} disabled={saving} />
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 10 }}>
                            <button className="employee-primary-button" onClick={saveEdits} disabled={saving}>
                                {saving ? 'Saving...' : 'Save'}
                            </button>
                            <button className="employee-link-button" style={{ color: 'var(--slate)' }} onClick={() => setEditing(false)} disabled={saving}>
                                Cancel
                            </button>
                        </div>
                    </>
                ) : (
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

                        <div className="employee-info-field">
                            <span>Address</span>
                            <strong>{student.address || 'N/A'}</strong>
                        </div>

                        <div className="employee-info-field">
                            <span>Emergency Contact</span>
                            <strong>{student.emergency_contact_name || 'N/A'} {student.emergency_contact_number ? `(${student.emergency_contact_number})` : ''}</strong>
                        </div>
                    </div>
                )}
            </div>

            <div className="employee-card">
                <h2 style={{ fontSize: 16, marginBottom: 6 }}>Account</h2>
                <p style={{ fontSize: 13, color: 'var(--slate)', marginBottom: 14 }}>
                    Set a new login password for this student if they can't use the email-based Forgot Password link.
                </p>
                <button
                    className="employee-danger-button"
                    onClick={handleResetPassword}
                    disabled={resettingPassword}
                >
                    {resettingPassword ? 'Resetting...' : 'Reset Password'}
                </button>
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
