import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Swal from 'sweetalert2'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activityLog'
import { describeChanges } from '../../lib/describeChanges'
import { notifyError, notifySuccess, notifyWarning } from '../../lib/notify'
import { generateTempPassword, resetStudentPassword } from '../../lib/resetStudentPassword'
import { updateStudentEmail } from '../../lib/updateStudentEmail'
import { SkeletonPageHeader, SkeletonDetailCard } from '../../components/Skeleton'
import Modal from '../../components/Modal'
import '../auth/Auth.css'
import './AdminPages.css'

function formatDate(value) {
    if (!value) return '-'
    return new Date(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(time) {
    if (!time) return ''
    const [hours, minutes] = time.split(':')
    const date = new Date()
    date.setHours(Number(hours), Number(minutes), 0, 0)
    return date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
}

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
    const [resettingPassword, setResettingPassword] = useState(false)
    const [changingEmail, setChangingEmail] = useState(false)
    const [currentRole, setCurrentRole] = useState('')

    useEffect(() => {
        loadDetails()
        loadCurrentRole()
    }, [studentId])

    const loadCurrentRole = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('user_id', user.id)
            .single()

        setCurrentRole(profile?.role || '')
    }

    const loadDetails = async () => {
        try {
            setLoading(true)
            setError('')

            const { data: studentData, error: studentError } = await supabase
                .from('students')
                .select('student_id, user_id, student_number, college_id, program_id, year_level, enrollment_status, status, address, alternate_phone_number, alternate_email, emergency_contact_name, emergency_contact_number, graduation_year, birth_date')
                .eq('student_id', studentId)
                .single()

            if (studentError || !studentData) {
                throw new Error('Student record could not be found.')
            }

            const { data: profile } = await supabase
                .from('profiles')
                .select('first_name, middle_name, last_name, suffix, email, phone_number, profile_photo_url')
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
                middleName: profile?.middle_name || '',
                lastName: profile?.last_name || '',
                suffix: profile?.suffix || '',
                fullName: profile
                    ? [profile.first_name, profile.middle_name, profile.last_name, profile.suffix].filter(Boolean).join(' ')
                    : 'Unknown',
                email: profile?.email || '',
                phoneNumber: profile?.phone_number || '',
                photoUrl: profile?.profile_photo_url || '',
                initials: `${profile?.first_name?.[0] || ''}${profile?.last_name?.[0] || ''}`.toUpperCase(),
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

            const requestIds = rows.map((r) => r.request_id)

            const { data: scheduleRows } = requestIds.length
                ? await supabase
                    .from('claim_schedules')
                    .select('request_id, status, scheduled_date, scheduled_time, claim_date, claim_time, created_at')
                    .in('request_id', requestIds)
                    .neq('status', 'cancelled')
                    .order('created_at', { ascending: false })
                : { data: [] }

            // Most recent non-cancelled schedule per request -- a
            // rescheduled request can have more than one row.
            const claimScheduleByRequestId = {}
            for (const s of scheduleRows || []) {
                if (!claimScheduleByRequestId[s.request_id]) {
                    claimScheduleByRequestId[s.request_id] = s
                }
            }

            setRequests(rows.map((r) => ({
                ...r,
                documentName: documentNameById[r.document_type_id] || 'Document',
                claimSchedule: claimScheduleByRequestId[r.request_id] || null,
            })))

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
            middleName: student.middleName,
            lastName: student.lastName,
            suffix: student.suffix,
            birthDate: student.birth_date || '',
            phoneNumber: student.phoneNumber,
            studentNumber: student.student_number,
            collegeId: student.college_id || '',
            programId: student.program_id || '',
            yearLevel: student.year_level || '',
            graduationYear: student.graduation_year ? String(student.graduation_year) : '',
            address: student.address || '',
            alternatePhoneNumber: student.alternate_phone_number || '',
            alternateEmail: student.alternate_email || '',
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

        const graduationYear = form.graduationYear.trim()
        const maxYear = new Date().getFullYear() + 10
        if (graduationYear && (!/^\d{4}$/.test(graduationYear) || Number(graduationYear) < 1950 || Number(graduationYear) > maxYear)) {
            notifyWarning(`Graduation year must be a 4-digit year between 1950 and ${maxYear}.`)
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
                    middle_name: form.middleName.trim() || null,
                    last_name: form.lastName.trim(),
                    suffix: form.suffix.trim() || null,
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
                    graduation_year: graduationYear ? Number(graduationYear) : null,
                    birth_date: form.birthDate || null,
                    address: form.address.trim() || null,
                    alternate_phone_number: form.alternatePhoneNumber.trim() || null,
                    alternate_email: form.alternateEmail.trim() || null,
                    emergency_contact_name: form.emergencyContactName.trim() || null,
                    emergency_contact_number: form.emergencyContactNumber.trim() || null,
                })
                .eq('student_id', student.student_id)

            if (studentError) {
                throw new Error('Failed to update student record: ' + studentError.message)
            }

            const newCollegeName = colleges.find((c) => c.college_id === form.collegeId)?.college_name || ''
            const newProgramName = programs.find((p) => p.program_id === form.programId)?.program_name || ''

            const changes = describeChanges([
                ['name', student.fullName, [form.firstName, form.middleName, form.lastName, form.suffix].map((v) => v.trim()).filter(Boolean).join(' ')],
                ['birth date', student.birth_date || '', form.birthDate],
                ['personal email', student.alternate_email || '', form.alternateEmail.trim()],
                ['student number', student.student_number, form.studentNumber.trim()],
                ['college', student.collegeName, newCollegeName],
                ['program', student.programName, newProgramName],
                ['year level', student.year_level, form.yearLevel],
                ['graduation year', student.graduation_year ? String(student.graduation_year) : '', graduationYear],
                ['phone number', student.phoneNumber, form.phoneNumber.trim()],
            ])

            await logActivity({
                userId: user.id,
                action: 'edit_student',
                tableName: 'students',
                recordId: student.student_id,
                description: `Updated student information for ${form.firstName} ${form.lastName} (${form.studentNumber}).${changes ? ' ' + changes + '.' : ''}`,
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

    const handleResetPassword = async () => {
        const confirmed = await Swal.fire({
            icon: 'warning',
            title: 'Reset student password?',
            text: `This immediately sets a new login password for ${student.fullName}. Use this only if they can't use the email-based Forgot Password link.`,
            showCancelButton: true,
            confirmButtonText: 'Reset password',
            confirmButtonColor: '#123B78',
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

    const handleChangeLoginEmail = async () => {
        const { value: newEmail } = await Swal.fire({
            icon: 'warning',
            title: 'Change login email?',
            text: `Use this only if ${student.fullName}'s HCDC account has been deactivated and they can no longer log in or complete the self-serve email change themselves. This takes effect immediately, no confirmation link needed.`,
            input: 'email',
            inputLabel: 'New login email',
            inputValue: student.alternate_email || '',
            inputPlaceholder: 'you@gmail.com',
            showCancelButton: true,
            confirmButtonText: 'Change email',
            confirmButtonColor: '#123B78',
            inputValidator: (value) => {
                if (!value) return 'Please enter an email address.'
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Please enter a valid email address.'
            },
        })

        if (!newEmail) return

        try {
            setChangingEmail(true)

            await updateStudentEmail({ studentUserId: student.user_id, newEmail })

            const {
                data: { user },
            } = await supabase.auth.getUser()

            await logActivity({
                userId: user?.id,
                action: 'admin_change_student_email',
                tableName: 'students',
                recordId: student.student_id,
                description: `Changed login email for "${student.fullName}" (${student.student_number}) to "${newEmail}" (Registrar Head, HCDC account deactivated).`,
            })

            notifySuccess(`Login email changed to ${newEmail}.`)
            await loadDetails()

        } catch (err) {
            console.error('CHANGE STUDENT LOGIN EMAIL ERROR:', err)
            notifyError(err.message || 'Failed to change login email.')
        } finally {
            setChangingEmail(false)
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
        return <div className="admin-error-box">{error}</div>
    }

    return (
        <div>
            <button className="admin-link-button" style={{ marginBottom: 16 }} onClick={() => navigate('/admin/students')}>
                ← Back to Students
            </button>

            <div className="admin-page-header" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    background: 'var(--red)',
                    color: 'var(--white)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 20,
                    flexShrink: 0,
                    overflow: 'hidden',
                }}>
                    {student.photoUrl ? (
                        <img
                            src={student.photoUrl}
                            alt={student.fullName}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    ) : (
                        student.initials || 'ST'
                    )}
                </div>
                <div>
                    <h1 style={{ marginBottom: 2 }}>{student.fullName}</h1>
                    <p>{student.student_number} · {student.email}</p>
                </div>
            </div>

            <div className="admin-card">
                <div className="admin-page-header-row" style={{ marginBottom: 16 }}>
                    <h2 style={{ fontSize: 16 }}>Personal Information</h2>
                    <button className="admin-link-button" onClick={startEditing}>
                        Edit →
                    </button>
                </div>

                <div className="admin-info-grid">
                    <div className="admin-info-field"><span>First Name</span><strong>{student.firstName || 'N/A'}</strong></div>
                    <div className="admin-info-field"><span>Middle Name</span><strong>{student.middleName || 'N/A'}</strong></div>
                    <div className="admin-info-field"><span>Last Name</span><strong>{student.lastName || 'N/A'}</strong></div>
                    <div className="admin-info-field"><span>Suffix</span><strong>{student.suffix || 'N/A'}</strong></div>
                    <div className="admin-info-field"><span>Birth Date</span><strong>{formatDate(student.birth_date)}</strong></div>
                    <div className="admin-info-field"><span>Login Email</span><strong>{student.email || 'N/A'}</strong></div>
                    <div className="admin-info-field"><span>Personal Email</span><strong>{student.alternate_email || 'N/A'}</strong></div>
                </div>
            </div>

            <div className="admin-card">
                <div className="admin-page-header-row" style={{ marginBottom: 16 }}>
                    <h2 style={{ fontSize: 16 }}>Student Information</h2>
                    <button className="admin-link-button" onClick={startEditing}>
                        Edit →
                    </button>
                </div>

                <div className="admin-info-grid">
                    <div className="admin-info-field"><span>Student Number</span><strong>{student.student_number}</strong></div>
                    <div className="admin-info-field"><span>College</span><strong>{student.collegeName || 'N/A'}</strong></div>
                    <div className="admin-info-field"><span>Program</span><strong>{student.programName || 'N/A'}</strong></div>
                    <div className="admin-info-field"><span>Year Level</span><strong>{student.year_level || 'N/A'}</strong></div>
                    <div className="admin-info-field"><span>Graduation Year</span><strong>{student.graduation_year || 'N/A'}</strong></div>
                    <div className="admin-info-field"><span>Phone Number</span><strong>{student.phoneNumber || 'N/A'}</strong></div>
                    <div className="admin-info-field"><span>Status</span><strong style={{ textTransform: 'capitalize' }}>{student.status}</strong></div>
                    <div className="admin-info-field"><span>Address</span><strong>{student.address || 'N/A'}</strong></div>
                    <div className="admin-info-field"><span>Alternate Phone Number</span><strong>{student.alternate_phone_number || 'N/A'}</strong></div>
                    <div className="admin-info-field"><span>Emergency Contact</span><strong>{student.emergency_contact_name || 'N/A'} {student.emergency_contact_number ? `(${student.emergency_contact_number})` : ''}</strong></div>
                </div>
            </div>

            {editing && form && (
                <Modal title="Edit Student Information" maxWidth={720} onClose={() => !saving && setEditing(false)}>
                    <div className="admin-info-grid" style={{ marginBottom: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
                        <div className="form-group">
                            <label className="form-label">First Name</label>
                            <input className="admin-search-input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} disabled={saving} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Middle Name</label>
                            <input className="admin-search-input" value={form.middleName} onChange={(e) => setForm({ ...form, middleName: e.target.value })} disabled={saving} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Last Name</label>
                            <input className="admin-search-input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} disabled={saving} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Suffix</label>
                            <input className="admin-search-input" placeholder="e.g. Jr., III" value={form.suffix} onChange={(e) => setForm({ ...form, suffix: e.target.value })} disabled={saving} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Birth Date</label>
                            <input className="admin-search-input" type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} disabled={saving} />
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
                            <label className="form-label">Graduation Year</label>
                            <input className="admin-search-input" inputMode="numeric" placeholder="e.g. 2026" value={form.graduationYear} onChange={(e) => setForm({ ...form, graduationYear: e.target.value.replace(/\D/g, '').slice(0, 4) })} disabled={saving} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Address</label>
                            <input className="admin-search-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} disabled={saving} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Alternate Phone Number</label>
                            <input className="admin-search-input" value={form.alternatePhoneNumber} onChange={(e) => setForm({ ...form, alternatePhoneNumber: e.target.value })} disabled={saving} />
                        </div>
                        {currentRole === 'registrar_head' && (
                            <div className="form-group">
                                <label className="form-label">Personal Email</label>
                                <input className="admin-search-input" type="email" value={form.alternateEmail} onChange={(e) => setForm({ ...form, alternateEmail: e.target.value })} disabled={saving} />
                            </div>
                        )}
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
                        <button className="admin-danger-button" onClick={() => setEditing(false)} disabled={saving}>
                            Cancel
                        </button>
                    </div>
                </Modal>
            )}

            <div className="admin-card">
                <h2 style={{ fontSize: 16, marginBottom: 6 }}>Account</h2>
                <p style={{ fontSize: 13, color: 'var(--slate)', marginBottom: 14 }}>
                    Set a new login password for this student if they can't use the email-based Forgot Password link.
                </p>
                <button
                    className="admin-primary-button"
                    onClick={handleResetPassword}
                    disabled={resettingPassword}
                >
                    {resettingPassword ? 'Resetting...' : 'Reset Password'}
                </button>

                {currentRole === 'registrar_head' && (
                    <>
                        <p style={{ fontSize: 13, color: 'var(--slate)', margin: '18px 0 14px' }}>
                            Current login email: <strong>{student.email || 'N/A'}</strong>. Change it if this student's HCDC
                            account has been deactivated (e.g. after graduation) and they can no longer log in or
                            self-serve the change themselves.
                        </p>
                        <button
                            className="admin-primary-button"
                            onClick={handleChangeLoginEmail}
                            disabled={changingEmail}
                        >
                            {changingEmail ? 'Changing...' : 'Change Login Email'}
                        </button>
                    </>
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
                                {request.claimSchedule && (
                                    <p>
                                        Claiming: {formatDate(request.claimSchedule.claim_date || request.claimSchedule.scheduled_date)}
                                        {(request.claimSchedule.claim_time || request.claimSchedule.scheduled_time) &&
                                            ` · ${formatTime(request.claimSchedule.claim_time || request.claimSchedule.scheduled_time)}`}
                                    </p>
                                )}
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
                                    <td>{formatDate(r.uploaded_at)}</td>
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
