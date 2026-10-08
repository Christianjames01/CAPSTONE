import { useEffect, useState } from 'react'
import { IconIdCard, IconFileStack, IconHourglass, IconCheckCircle, IconClipboardCheck } from './icons'
import { IconUserCircle, IconMail } from '../student/icons'
import { ProfileHero, ProfileSection, ProfileFields, SecurityRow, IconShield, IconKey } from '../../components/ProfileParts'
import PageStats from '../../components/PageStats'
import DocumentThumb from '../../components/DocumentThumb'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import Swal from 'sweetalert2'
import { supabase } from '../../lib/supabase'
import { formatDisplayDateTime } from '../../lib/formatDate'
import { logActivity } from '../../lib/activityLog'
import { describeChanges } from '../../lib/describeChanges'
import { notifyError, notifySuccess, notifyWarning } from '../../lib/notify'
import { generateTempPassword, resetStudentPassword } from '../../lib/resetStudentPassword'
import { updateStudentEmail } from '../../lib/updateStudentEmail'
import Modal from '../../components/Modal'
import { SkeletonPage } from '../../components/Skeleton'
import '../auth/Auth.css'
import './AdminPages.css'
import { useLiveRefresh } from '../../lib/useLiveRefresh'
import { adminPath } from '../../lib/portalPaths'
import { blockedForReadOnlyViewer } from '../../lib/viewOnlyGuard'
import { friendlyError } from '../../lib/friendlyError'
import { digitsOnly, isValidPhMobile } from '../../lib/phoneInput'

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
    const { role } = useOutletContext() || {}
    const { studentId } = useParams()
    const navigate = useNavigate()

    const [student, setStudent] = useState(null)
    const [requests, setRequests] = useState([])
    const [requirements, setRequirements] = useState([])
    const [colleges, setColleges] = useState([])
    const [programs, setPrograms] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    // 'personal' | 'student' | null -- which card is being edited in place.
    const [editingSection, setEditingSection] = useState(null)
    const [form, setForm] = useState(null)
    const [saving, setSaving] = useState(false)
    const [resettingPassword, setResettingPassword] = useState(false)
    const [changingEmail, setChangingEmail] = useState(false)
    const [currentRole, setCurrentRole] = useState('')

    useLiveRefresh(['students', 'document_requests', 'request_requirements'], (options) => loadDetails(options))

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

    const loadDetails = async ({ silent = false } = {}) => {
        try {
            if (!silent) setLoading(true)
            setError('')

            const { data: studentData, error: studentError } = await supabase
                .from('students')
                .select('*')
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
                ? await supabase.from('document_types').select('document_type_id, document_name, preview_image_url').in('document_type_id', documentTypeIds)
                : { data: [] }

            const documentNameById = Object.fromEntries((documentTypes || []).map((d) => [d.document_type_id, d.document_name]))
            const documentPreviewById = Object.fromEntries((documentTypes || []).map((d) => [d.document_type_id, d.preview_image_url || null]))

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
                documentPreview: documentPreviewById[r.document_type_id] || null,
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

    const startEditing = (section) => {
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
        setEditingSection(section)
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
        if (blockedForReadOnlyViewer(role)) return
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

        for (const [label, value] of [
            ['Phone number', form.phoneNumber],
            ['Alternate phone number', form.alternatePhoneNumber],
            ['Emergency contact number', form.emergencyContactNumber],
        ]) {
            if (value.trim() && !isValidPhMobile(value.trim())) {
                notifyWarning(`${label} must be an 11-digit mobile number starting with 09.`)
                return
            }
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
            setEditingSection(null)
            await loadDetails()

        } catch (err) {
            console.error('SAVE STUDENT EDIT ERROR:', err)
            notifyError(friendlyError(err, 'Failed to save changes.'))
        } finally {
            setSaving(false)
        }
    }

    const handleResetPassword = async () => {
        if (blockedForReadOnlyViewer(role)) return
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
            notifyError(friendlyError(err, 'Failed to reset password.'))
        } finally {
            setResettingPassword(false)
        }
    }

    const handleChangeLoginEmail = async () => {
        if (blockedForReadOnlyViewer(role)) return
        const { value: newEmail } = await Swal.fire({
            icon: 'warning',
            title: 'Change login email?',
            text: `Use this only if ${student.fullName}'s HCDC account has been deactivated and they can no longer log in or complete the self-serve email change themselves. This takes effect immediately, no confirmation link needed.`,
            allowOutsideClick: false,
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
            notifyError(friendlyError(err, 'Failed to change login email.'))
        } finally {
            setChangingEmail(false)
        }
    }

    const cancelEditing = () => {
        if (saving) return
        setEditingSection(null)
    }

    const submitEdits = (e) => {
        e.preventDefault()
        saveEdits()
    }

    const editField = (label, control) => (
        <label className="form-group">
            <span className="form-label">{label}</span>
            {control}
        </label>
    )

    const editActions = (
        <div className="app-modal-actions" style={{ marginTop: 18 }}>
            <button type="button" className="admin-secondary-button" onClick={cancelEditing} disabled={saving}>
                Cancel
            </button>
            <button type="submit" className="admin-primary-button" disabled={saving}>
                {saving ? 'Saving...' : 'Save changes'}
            </button>
        </div>
    )

    if (loading) {
        return (
            <SkeletonPage
                portal="admin"
                blocks={[
                    { type: 'back' },
                    { type: 'header', avatar: true },
                    { type: 'card', action: true, fields: 7, titleWidth: 190 },
                    { type: 'card', action: true, fields: 10, titleWidth: 180 },
                    { type: 'card', titleWidth: 90, lines: 1, buttons: 2 },
                    { type: 'list', count: 2, fields: 2, action: false },
                ]}
            />
        )
    }

    if (error) {
        return <div className="admin-error-box">{error}</div>
    }

    const activeRequests = requests.filter((r) => !['completed', 'cancelled', 'rejected'].includes(r.status)).length
    const completedRequests = requests.filter((r) => r.status === 'completed').length
    const pendingRequirements = requirements.filter((r) => !['verified', 'approved'].includes(r.status)).length
    const isAlumni = student.student_type === 'alumni'

    return (
        <div>
            <button className="admin-link-button" style={{ marginBottom: 16 }} onClick={() => navigate(adminPath('/students'))}>
                ← Back to Students
            </button>

            <div className="pf-page">
                <ProfileHero
                    photoUrl={student.photoUrl}
                    name={student.fullName}
                    initials={student.initials || 'ST'}
                    eyebrow={isAlumni ? 'Alumni' : 'Student'}
                    subtitle={[student.student_number, student.email].filter(Boolean).join(' · ')}
                    tags={[
                        student.programName,
                        isAlumni ? `Class of ${student.graduation_year || '—'}` : student.year_level && `Year ${student.year_level}`,
                        student.status && student.status.charAt(0).toUpperCase() + student.status.slice(1),
                    ]}
                />

                <PageStats
                    stats={[
                        { label: 'Requests', value: requests.length, note: 'All time', Icon: IconFileStack },
                        { label: 'In progress', value: activeRequests, note: activeRequests ? 'Not yet completed' : 'Nothing pending', Icon: IconHourglass, warn: activeRequests > 0 },
                        { label: 'Completed', value: completedRequests, note: 'Claimed documents', Icon: IconCheckCircle },
                        { label: 'Requirements', value: requirements.length, note: pendingRequirements ? `${pendingRequirements} to review` : 'All reviewed', Icon: IconClipboardCheck },
                    ]}
                />

                <div className="pf-layout">
                    <div className="pf-column">
                        <ProfileSection
                            icon={IconUserCircle}
                            title="Personal Information"
                            subtitle="Name, birth date and email addresses."
                            actionLabel="Edit"
                            onAction={() => startEditing('personal')}
                        >
                            <ProfileFields
                                fields={[
                                    { label: 'First Name', value: student.firstName },
                                    { label: 'Middle Name', value: student.middleName },
                                    { label: 'Last Name', value: student.lastName },
                                    { label: 'Suffix', value: student.suffix },
                                    { label: 'Birth Date', value: student.birth_date ? formatDate(student.birth_date) : '' },
                                    { label: 'Phone Number', value: student.phoneNumber },
                                    { label: 'Login Email', value: student.email, wide: true },
                                    { label: 'Personal Email', value: student.alternate_email, wide: true },
                                ]}
                            />
                        </ProfileSection>

                        <ProfileSection
                            icon={IconIdCard}
                            title="Student Information"
                            subtitle="School record and contact details."
                            actionLabel="Edit"
                            onAction={() => startEditing('student')}
                        >
                            <ProfileFields
                                fields={[
                                    { label: 'Student Number', value: student.student_number },
                                    { label: 'Status', value: student.status, capitalize: true },
                                    { label: 'College', value: student.collegeName, wide: true },
                                    { label: 'Program', value: student.programName, wide: true },
                                    { label: 'Year Level', value: student.year_level },
                                    { label: 'Graduation Year', value: student.graduation_year },
                                    { label: 'Address', value: student.address, wide: true },
                                    { label: 'Alternate Phone', value: student.alternate_phone_number },
                                    { label: 'Emergency Contact', value: [student.emergency_contact_name, student.emergency_contact_number].filter(Boolean).join(' · ') },
                                ]}
                            />
                        </ProfileSection>
                    </div>

                    <div className="pf-column">
                        <ProfileSection icon={IconShield} title="Account" subtitle="Help this student sign in.">
                            <div className="pf-rows">
                                <SecurityRow
                                    icon={IconKey}
                                    title="Reset password"
                                    text="Sets a new temporary password when the student can't use Forgot Password."
                                    actionLabel={resettingPassword ? 'Resetting...' : 'Reset'}
                                    onAction={handleResetPassword}
                                    actionDisabled={resettingPassword}
                                />

                                {currentRole === 'registrar_head' && (
                                    <SecurityRow
                                        icon={IconMail}
                                        title="Login email"
                                        text={`${student.email || 'No email'}. Change it only if the student's HCDC account was deactivated (e.g. after graduation).`}
                                        actionLabel={changingEmail ? 'Changing...' : 'Change'}
                                        onAction={handleChangeLoginEmail}
                                        actionDisabled={changingEmail}
                                    />
                                )}
                            </div>
                        </ProfileSection>
                    </div>
                </div>
            </div>

            {editingSection && form && (
                <Modal
                    title={editingSection === 'personal' ? 'Edit Personal Information' : 'Edit Student Information'}
                    subtitle="Changes are recorded in the activity log."
                    icon={IconIdCard}
                    maxWidth={editingSection === 'personal' ? 640 : 760}
                    onClose={cancelEditing}
                >
                    {editingSection === 'personal' ? (
                        <form onSubmit={submitEdits}>
                            <div className="admin-info-grid admin-edit-grid">
                                {editField('First Name', <input className="admin-search-input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} disabled={saving} autoFocus />)}
                                {editField('Middle Name', <input className="admin-search-input" value={form.middleName} onChange={(e) => setForm({ ...form, middleName: e.target.value })} disabled={saving} />)}
                                {editField('Last Name', <input className="admin-search-input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} disabled={saving} />)}
                                {editField('Suffix', <input className="admin-search-input" placeholder="e.g. Jr., III" value={form.suffix} onChange={(e) => setForm({ ...form, suffix: e.target.value })} disabled={saving} />)}
                                {editField('Birth Date', <input className="admin-search-input" type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} disabled={saving} />)}
                                <div className="admin-info-field"><span>Login Email</span><strong>{student.email || 'N/A'}</strong></div>
                                {currentRole === 'registrar_head'
                                    ? editField('Personal Email', <input className="admin-search-input" type="email" value={form.alternateEmail} onChange={(e) => setForm({ ...form, alternateEmail: e.target.value })} disabled={saving} />)
                                    : <div className="admin-info-field"><span>Personal Email</span><strong>{student.alternate_email || 'N/A'}</strong></div>}
                            </div>
                            {editActions}
                        </form>
                    ) : (
                        <form onSubmit={submitEdits}>
                            <div className="admin-info-grid admin-edit-grid">
                                {editField('Student Number', <input className="admin-search-input" inputMode="numeric" value={form.studentNumber} onChange={(e) => setForm({ ...form, studentNumber: e.target.value.replace(/\D/g, '').slice(0, 8) })} disabled={saving} autoFocus />)}
                                {editField('College', (
                                    <select className="admin-search-input" value={form.collegeId} onChange={(e) => onCollegeChange(e.target.value)} disabled={saving}>
                                        <option value="">-- None --</option>
                                        {colleges.map((c) => (
                                            <option key={c.college_id} value={c.college_id}>{c.college_name}</option>
                                        ))}
                                    </select>
                                ))}
                                {editField('Program', (
                                    <select className="admin-search-input" value={form.programId} onChange={(e) => setForm({ ...form, programId: e.target.value })} disabled={saving || !form.collegeId}>
                                        <option value="">{form.collegeId ? '-- None --' : 'Select a college first'}</option>
                                        {programs.map((p) => (
                                            <option key={p.program_id} value={p.program_id}>{p.program_name}</option>
                                        ))}
                                    </select>
                                ))}
                                {editField('Year Level', (
                                    <select className="admin-search-input" value={form.yearLevel} onChange={(e) => setForm({ ...form, yearLevel: e.target.value })} disabled={saving}>
                                        <option value="">-- None --</option>
                                        <option value="1">1st Year</option>
                                        <option value="2">2nd Year</option>
                                        <option value="3">3rd Year</option>
                                        <option value="4">4th Year</option>
                                        <option value="5">5th Year</option>
                                    </select>
                                ))}
                                {editField('Graduation Year', <input className="admin-search-input" inputMode="numeric" placeholder="e.g. 2026" value={form.graduationYear} onChange={(e) => setForm({ ...form, graduationYear: e.target.value.replace(/\D/g, '').slice(0, 4) })} disabled={saving} />)}
                                {editField('Phone Number', <input className="admin-search-input" type="tel" inputMode="numeric" maxLength={11} value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: digitsOnly(e.target.value) })} disabled={saving} />)}
                                <div className="admin-info-field"><span>Status</span><strong style={{ textTransform: 'capitalize' }}>{student.status}</strong></div>
                                {editField('Address', <input className="admin-search-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} disabled={saving} />)}
                                {editField('Alternate Phone Number', <input className="admin-search-input" type="tel" inputMode="numeric" maxLength={11} value={form.alternatePhoneNumber} onChange={(e) => setForm({ ...form, alternatePhoneNumber: digitsOnly(e.target.value) })} disabled={saving} />)}
                                {editField('Emergency Contact Name', <input className="admin-search-input" value={form.emergencyContactName} onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })} disabled={saving} />)}
                                {editField('Emergency Contact Number', <input className="admin-search-input" type="tel" inputMode="numeric" maxLength={11} value={form.emergencyContactNumber} onChange={(e) => setForm({ ...form, emergencyContactNumber: digitsOnly(e.target.value) })} disabled={saving} />)}
                            </div>
                            {editActions}
                        </form>
                    )}
                </Modal>
            )}

            <h2 className="admin-section-title">
                Request History
                <span className="admin-chip-count">{requests.length}</span>
            </h2>

            {requests.length === 0 ? (
                <div className="admin-empty">This student has no document requests yet.</div>
            ) : (
                requests.map((request) => {
                    const claim = request.claimSchedule
                    const claimTime = claim && (claim.claim_time || claim.scheduled_time)
                    return (
                        <div className="admin-list-card" key={request.request_id}>
                            <div className="admin-list-card-header">
                                <div className="admin-card-title">
                                    <DocumentThumb url={request.documentPreview} name={request.documentName} size={46} />
                                    <div>
                                        <h3>{request.documentName}</h3>
                                        <p>{request.request_number}</p>
                                    </div>
                                </div>
                                <span className={`admin-status-pill status-${request.status}`}>
                                    {request.status.replace(/_/g, ' ')}
                                </span>
                            </div>

                            <div className="admin-info-grid">
                                <div className="admin-info-field">
                                    <span>Total</span>
                                    <strong>₱{Number(request.total_amount || 0).toFixed(2)}</strong>
                                </div>
                                <div className="admin-info-field">
                                    <span>Requested</span>
                                    <strong>{formatDisplayDateTime(request.requested_at) || '-'}</strong>
                                </div>
                                {claim && (
                                    <div className="admin-info-field">
                                        <span>Claiming</span>
                                        <strong>
                                            {formatDate(claim.claim_date || claim.scheduled_date)}
                                            {claimTime && ` · ${formatTime(claimTime)}`}
                                        </strong>
                                    </div>
                                )}
                            </div>

                            <div className="admin-card-actions">
                                <button className="admin-link-button" onClick={() => navigate(adminPath(`/requests/${request.request_id}`))}>
                                    Open request →
                                </button>
                            </div>
                        </div>
                    )
                })
            )}

            <h2 className="admin-section-title">
                Submitted Requirements
                <span className="admin-chip-count">{requirements.length}</span>
            </h2>

            {requirements.length === 0 ? (
                <div className="admin-empty">No requirements have been submitted by this student.</div>
            ) : (
                <div className="admin-card sd-requirements">
                    {requirements.map((r) => (
                        <div className="sd-requirement" key={r.request_requirement_id}>
                            <span className="admin-avatar" aria-hidden="true"><IconClipboardCheck /></span>
                            <div className="sd-requirement-main">
                                <strong>{r.document_requirements?.requirement_name || 'Requirement'}</strong>
                                <span>
                                    {r.requestNumber}
                                    {r.uploaded_at && ` · Uploaded ${formatDisplayDateTime(r.uploaded_at)}`}
                                </span>
                            </div>
                            <span className={`admin-status-pill status-${r.status}`}>{r.status.replace(/_/g, ' ')}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default StudentDetails
