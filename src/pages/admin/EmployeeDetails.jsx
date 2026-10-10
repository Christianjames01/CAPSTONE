import { useEffect, useState } from 'react'
import { IconUsers } from './icons'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import Swal from 'sweetalert2'
import { supabase } from '../../lib/supabase'
import { formatDisplayDateTime } from '../../lib/formatDate'
import { logActivity } from '../../lib/activityLog'
import { describeChanges } from '../../lib/describeChanges'
import { notify, notifyError, notifySuccess, notifyWarning, confirmModal } from '../../lib/notify'
import { confirmWithPassword } from '../../lib/confirmPassword'
import { generateTempPassword } from '../../lib/resetStudentPassword'
import { resetEmployeePassword } from '../../lib/resetEmployeePassword'
import { SkeletonPage } from '../../components/Skeleton'
import Modal from '../../components/Modal'
import '../auth/Auth.css'
import './AdminPages.css'
import { useLiveRefresh } from '../../lib/useLiveRefresh'
import { adminPath } from '../../lib/portalPaths'
import { blockedForReadOnlyViewer } from '../../lib/viewOnlyGuard'
import { friendlyError } from '../../lib/friendlyError'
import { digitsOnly, isValidPhMobile } from '../../lib/phoneInput'

// Same "still open" definition Assignments.jsx uses for workload/coverage.
const OPEN_STATUSES = ['pending', 'payment_pending', 'receipt_uploaded', 'receipt_verified', 'processing', 'lacking_requirements', 'ready_for_claiming']

function EmployeeDetails() {
    const { role } = useOutletContext() || {}
    const { employeeId } = useParams()
    const navigate = useNavigate()

    const [employee, setEmployee] = useState(null)
    const [colleges, setColleges] = useState([])
    const [programs, setPrograms] = useState([])
    const [assignments, setAssignments] = useState([])
    const [requests, setRequests] = useState([])

    const [employeeNumber, setEmployeeNumber] = useState('')
    const [positionTitle, setPositionTitle] = useState('')
    const [displayName, setDisplayName] = useState('')
    const [assignedCollegeId, setAssignedCollegeId] = useState('')

    const [editing, setEditing] = useState(false)
    const [form, setForm] = useState(null)

    const [newCollegeId, setNewCollegeId] = useState('')
    const [newProgramId, setNewProgramId] = useState('')
    const [newIsPrimary, setNewIsPrimary] = useState(true)

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')
    const [resettingPassword, setResettingPassword] = useState(false)

    useLiveRefresh(['employees', 'employee_assignments', 'document_requests'], (options) => loadEmployee(options))

    useEffect(() => {
        loadEmployee()
    }, [employeeId])

    const loadEmployee = async ({ silent = false } = {}) => {
        try {
            if (!silent) setLoading(true)
            setError('')

            const { data: employeeData, error: employeeError } = await supabase
                .from('employees')
                .select('employee_id, user_id, employee_number, position_title, display_name, assigned_college_id, status')
                .eq('employee_id', employeeId)
                .single()

            if (employeeError || !employeeData) {
                throw new Error('Employee could not be found.')
            }

            const { data: profile } = await supabase
                .from('profiles')
                .select('first_name, last_name, email, phone_number, must_change_password')
                .eq('user_id', employeeData.user_id)
                .single()

            setEmployee({ ...employeeData, ...profile })
            if (!silent) setEmployeeNumber(employeeData.employee_number)
            if (!silent) setPositionTitle(employeeData.position_title)
            if (!silent) setDisplayName(employeeData.display_name || '')
            if (!silent) setAssignedCollegeId(employeeData.assigned_college_id || '')

            const { data: collegeRows } = await supabase.from('colleges').select('college_id, college_name').order('college_name')
            setColleges(collegeRows || [])

            const { data: programRows } = await supabase.from('programs').select('program_id, program_name, college_id').order('program_name')
            setPrograms(programRows || [])

            const { data: assignmentRows, error: assignmentError } = await supabase
                .from('employee_assignments')
                .select('assignment_id, college_id, program_id, is_primary, status')
                .eq('employee_id', employeeId)

            if (assignmentError) {
                console.error('ASSIGNMENTS LOAD ERROR:', assignmentError)
            }

            setAssignments(assignmentRows || [])

            const { data: requestRows, error: requestsError } = await supabase
                .from('document_requests')
                .select('request_id, request_number, student_id, document_type_id, status, total_amount, requested_at')
                .eq('assigned_employee_id', employeeId)
                .order('requested_at', { ascending: false })

            if (requestsError) {
                console.error('EMPLOYEE REQUESTS LOAD ERROR:', requestsError)
                setRequests([])
            } else {
                const rows = requestRows || []
                const studentIds = [...new Set(rows.map((r) => r.student_id).filter(Boolean))]
                const documentTypeIds = [...new Set(rows.map((r) => r.document_type_id).filter(Boolean))]

                const [{ data: studentRows }, { data: documentTypeRows }] = await Promise.all([
                    studentIds.length
                        ? supabase.from('students').select('student_id, user_id, student_number').in('student_id', studentIds)
                        : Promise.resolve({ data: [] }),
                    documentTypeIds.length
                        ? supabase.from('document_types').select('document_type_id, document_name').in('document_type_id', documentTypeIds)
                        : Promise.resolve({ data: [] }),
                ])

                const studentUserIds = (studentRows || []).map((s) => s.user_id).filter(Boolean)

                const { data: studentProfiles } = studentUserIds.length
                    ? await supabase.from('profiles').select('user_id, first_name, last_name').in('user_id', studentUserIds)
                    : { data: [] }

                const studentProfileByUserId = Object.fromEntries((studentProfiles || []).map((p) => [p.user_id, p]))
                const studentById = Object.fromEntries((studentRows || []).map((s) => [s.student_id, s]))
                const documentNameById = Object.fromEntries((documentTypeRows || []).map((d) => [d.document_type_id, d.document_name]))

                setRequests(
                    rows.map((r) => {
                        const student = studentById[r.student_id]
                        const studentProfile = student ? studentProfileByUserId[student.user_id] : null

                        return {
                            ...r,
                            studentNumber: student?.student_number || 'N/A',
                            studentName: studentProfile ? `${studentProfile.first_name} ${studentProfile.last_name}`.trim() : '',
                            documentName: documentNameById[r.document_type_id] || 'Document',
                        }
                    })
                )
            }

        } catch (err) {
            console.error('EMPLOYEE DETAILS ERROR:', err)
            setError(err.message || 'Failed to load employee.')
        } finally {
            setLoading(false)
        }
    }

    // Registrar head sets a temporary password; the employee is signed out
    // and must create their own password on next login (ProtectedRoute ->
    // /force-change-password).
    const handleSetTempPassword = async () => {
        if (blockedForReadOnlyViewer(role)) return
        const name = `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || employee.employee_number

        const { value: tempPassword, isConfirmed } = await Swal.fire({
            icon: 'warning',
            title: 'Set a temporary password',
            html: `<p style="margin:0 0 4px;">${name} will be signed out and asked to create a new password the next time they log in.</p>`,
            input: 'text',
            inputLabel: 'Temporary password (you can edit it)',
            inputValue: generateTempPassword(),
            inputAttributes: { autocomplete: 'off', spellcheck: 'false' },
            showCancelButton: true,
            confirmButtonText: 'Set temporary password',
            confirmButtonColor: '#123B78',
            allowOutsideClick: false,
            inputValidator: (value) => {
                if (!value || value.trim().length < 8) return 'Use at least 8 characters.'
                if (/\s/.test(value)) return 'The password cannot contain spaces.'
                return null
            },
        })

        if (!isConfirmed || !tempPassword) return

        const verified = await confirmWithPassword({
            title: 'Confirm with your password',
            text: `Enter your own password to reset ${name}'s password.`,
        })
        if (!verified) return

        try {
            setResettingPassword(true)

            await resetEmployeePassword({ employeeUserId: employee.user_id, tempPassword: tempPassword.trim() })

            const { data: { user } } = await supabase.auth.getUser()
            await logActivity({
                userId: user?.id,
                action: 'reset_employee_password',
                tableName: 'employees',
                recordId: employee.employee_id,
                description: `Set a temporary password for employee "${name}" (${employee.employee_number}).`,
            })

            await notify({
                userId: employee.user_id,
                title: 'Your password was reset',
                message: 'The Registrar Head set a temporary password for your account. You will be asked to create a new password when you log in.',
                notificationType: 'account',
            })

            setEmployee((prev) => ({ ...prev, must_change_password: true }))

            await Swal.fire({
                icon: 'success',
                title: 'Temporary password set',
                html: `
                    <p style="margin-bottom:12px;">Share this with ${name} directly (in person or by phone). It won't be shown again.</p>
                    <code style="display:block;padding:10px 14px;background:#F3F4F6;color:#111;border-radius:8px;font-size:16px;font-weight:700;letter-spacing:1px;">${tempPassword.trim().replace(/[<>&"]/g, '')}</code>
                    <p style="margin-top:12px;font-size:13px;color:#555;">When they log in with it, they'll be asked to create their own password before continuing.</p>
                `,
                confirmButtonText: 'Done',
                confirmButtonColor: '#123B78',
            })
        } catch (err) {
            console.error('RESET EMPLOYEE PASSWORD ERROR:', err)
            notifyError(friendlyError(err, 'Failed to set a temporary password.'))
        } finally {
            setResettingPassword(false)
        }
    }

    const startEditing = () => {
        setForm({
            employeeNumber,
            positionTitle,
            displayName,
            assignedCollegeId,
            phoneNumber: employee.phone_number || '',
        })
        setEditing(true)
    }

    const saveEmployee = async () => {
        if (blockedForReadOnlyViewer(role)) return

        const trimmedPhone = form.phoneNumber.trim()
        if (trimmedPhone && !isValidPhMobile(trimmedPhone)) {
            const message = 'Contact number must be an 11-digit mobile number starting with 09.'
            setError(message)
            notifyError(message)
            return
        }

        try {
            setSaving(true)
            setError('')
            setMessage('')

            const {
                data: { user },
                error: userError
            } = await supabase.auth.getUser()

            if (userError || !user) {
                throw new Error('You are not logged in.')
            }

            const { error: updateError } = await supabase
                .from('employees')
                .update({
                    employee_number: form.employeeNumber.trim(),
                    position_title: form.positionTitle.trim(),
                    display_name: form.displayName.trim() || null,
                    assigned_college_id: form.assignedCollegeId || null,
                    updated_at: new Date().toISOString(),
                })
                .eq('employee_id', employeeId)

            if (updateError) {
                const thrown = new Error('Failed to update employee: ' + updateError.message)
                thrown.details = updateError.details
                throw thrown
            }

            const { error: profileUpdateError } = await supabase
                .from('profiles')
                .update({ phone_number: trimmedPhone || null })
                .eq('user_id', employee.user_id)

            if (profileUpdateError) {
                const thrown = new Error('Employee was updated, but the contact number could not be saved: ' + profileUpdateError.message)
                thrown.details = profileUpdateError.details
                throw thrown
            }

            const changes = describeChanges([
                ['employee number', employee.employee_number, form.employeeNumber.trim()],
                ['position', employee.position_title, form.positionTitle.trim()],
                ['nickname', employee.display_name, form.displayName.trim() || null],
                ['assigned college', collegeName(employee.assigned_college_id), collegeName(form.assignedCollegeId || null)],
                ['contact number', employee.phone_number, trimmedPhone || null],
            ])

            await logActivity({
                userId: user.id,
                action: 'edit_employee',
                tableName: 'employees',
                recordId: employeeId,
                description: `Updated employee ${employee.first_name} ${employee.last_name}.${changes ? ' ' + changes + '.' : ''}`,
            })

            setMessage('Employee information updated.')
            setEditing(false)
            await loadEmployee()

        } catch (err) {
            console.error('SAVE EMPLOYEE ERROR:', err)
            const message = friendlyError(err, 'Failed to save employee.')
            setError(message)
            notifyError(message)
        } finally {
            setSaving(false)
        }
    }

    const addAssignment = async () => {
        if (blockedForReadOnlyViewer(role)) return
        if (!newCollegeId || !newProgramId) {
            notifyWarning('Please select a college and program.')
            return
        }

        const isDuplicate = assignments.some(
            (a) => a.status === 'active' && a.college_id === newCollegeId && a.program_id === newProgramId
        )

        if (isDuplicate) {
            notifyWarning('This employee is already assigned to that college and program.')
            return
        }

        const confirmed = await confirmModal(
            `Assign ${employee.first_name} ${employee.last_name} to "${collegeName(newCollegeId)}" · "${programName(newProgramId)}"?`
        )
        if (!confirmed) return

        try {
            const {
                data: { user },
                error: userError
            } = await supabase.auth.getUser()

            if (userError || !user) {
                throw new Error('You are not logged in.')
            }

            const { error: insertError } = await supabase
                .from('employee_assignments')
                .insert({
                    employee_id: employeeId,
                    college_id: newCollegeId,
                    program_id: newProgramId,
                    is_primary: newIsPrimary,
                    status: 'active',
                })

            if (insertError) {
                throw new Error('Failed to add assignment: ' + insertError.message)
            }

            await logActivity({
                userId: user.id,
                action: 'add_employee_assignment',
                tableName: 'employee_assignments',
                recordId: employeeId,
                description: `Assigned employee ${employee.first_name} ${employee.last_name} to "${collegeName(newCollegeId)}" · "${programName(newProgramId)}".`,
            })

            await notify({
                userId: employee.user_id,
                title: 'New assignment',
                message: `You've been assigned to ${collegeName(newCollegeId)} · ${programName(newProgramId)}. Student requests from this program will now route to you.`,
                notificationType: 'assignment',
            })

            setNewCollegeId('')
            setNewProgramId('')
            await loadEmployee()

        } catch (err) {
            console.error('ADD ASSIGNMENT ERROR:', err)
            notifyError(friendlyError(err, 'Failed to add assignment.'))
        }
    }

    const removeAssignment = async (assignment) => {
        if (blockedForReadOnlyViewer(role)) return
        const confirmed = await confirmModal('Remove this assignment?')
        if (!confirmed) return

        const verified = await confirmWithPassword({
            title: 'Confirm with your password',
            text: 'Enter your password to remove this assignment.',
        })
        if (!verified) return

        try {
            const {
                data: { user },
                error: userError
            } = await supabase.auth.getUser()

            if (userError || !user) {
                throw new Error('You are not logged in.')
            }

            const { error: deleteError } = await supabase
                .from('employee_assignments')
                .update({ status: 'inactive' })
                .eq('assignment_id', assignment.assignment_id)

            if (deleteError) {
                throw new Error('Failed to remove assignment: ' + deleteError.message)
            }

            await logActivity({
                userId: user.id,
                action: 'remove_employee_assignment',
                tableName: 'employee_assignments',
                recordId: assignment.assignment_id,
                description: `Removed employee ${employee.first_name} ${employee.last_name}'s assignment to "${collegeName(assignment.college_id)}" · "${programName(assignment.program_id)}".`,
            })

            // If someone else still actively covers this exact college/program,
            // hand this employee's open requests for it straight to them --
            // otherwise those requests would sit with someone who no longer
            // owns the program.
            const { data: otherAssignments } = await supabase
                .from('employee_assignments')
                .select('employee_id, is_primary')
                .eq('college_id', assignment.college_id)
                .eq('program_id', assignment.program_id)
                .eq('status', 'active')
                .neq('employee_id', employeeId)

            const candidateIds = [...new Set((otherAssignments || []).map((a) => a.employee_id))]

            if (candidateIds.length > 0) {
                const { data: candidates } = await supabase
                    .from('employees')
                    .select('employee_id, user_id')
                    .in('employee_id', candidateIds)
                    .eq('status', 'active')

                if (candidates?.length) {
                    const primaryIds = new Set((otherAssignments || []).filter((a) => a.is_primary).map((a) => a.employee_id))
                    let pick = candidates.find((e) => primaryIds.has(e.employee_id)) || candidates[0]

                    if (!primaryIds.has(pick.employee_id) && candidates.length > 1) {
                        const { data: loadRows } = await supabase
                            .from('document_requests')
                            .select('assigned_employee_id')
                            .in('assigned_employee_id', candidates.map((e) => e.employee_id))
                            .in('status', OPEN_STATUSES)
                        const counts = {}
                        for (const r of loadRows || []) counts[r.assigned_employee_id] = (counts[r.assigned_employee_id] || 0) + 1
                        pick = [...candidates].sort((a, b) => (counts[a.employee_id] || 0) - (counts[b.employee_id] || 0))[0]
                    }

                    const { data: openRequests } = await supabase
                        .from('document_requests')
                        .select('request_id, student_id')
                        .eq('assigned_employee_id', employeeId)
                        .in('status', OPEN_STATUSES)

                    if (openRequests?.length) {
                        const studentIds = [...new Set(openRequests.map((r) => r.student_id))]
                        const { data: matchingStudents } = await supabase
                            .from('students')
                            .select('student_id')
                            .in('student_id', studentIds)
                            .eq('college_id', assignment.college_id)
                            .eq('program_id', assignment.program_id)

                        const matchingStudentIds = new Set((matchingStudents || []).map((s) => s.student_id))
                        const requestIdsToMove = openRequests.filter((r) => matchingStudentIds.has(r.student_id)).map((r) => r.request_id)

                        if (requestIdsToMove.length > 0) {
                            const { error: moveError } = await supabase
                                .from('document_requests')
                                .update({ assigned_employee_id: pick.employee_id, updated_at: new Date().toISOString() })
                                .in('request_id', requestIdsToMove)

                            if (moveError) {
                                console.error('MOVE REQUESTS ON UNASSIGNMENT ERROR:', moveError)
                            } else {
                                await logActivity({
                                    userId: user.id,
                                    action: 'reassign_requests_on_unassignment',
                                    tableName: 'document_requests',
                                    recordId: null,
                                    description: `Moved ${requestIdsToMove.length} request(s) for "${programName(assignment.program_id)}" from ${employee.first_name} ${employee.last_name} to the remaining assigned employee, after removing the assignment.`,
                                })

                                if (pick.user_id) {
                                    await notify({
                                        userId: pick.user_id,
                                        title: 'Requests reassigned to you',
                                        message: `${requestIdsToMove.length} request${requestIdsToMove.length === 1 ? '' : 's'} for ${programName(assignment.program_id)} ${requestIdsToMove.length === 1 ? 'was' : 'were'} moved to you after ${employee.first_name} ${employee.last_name}'s assignment to this program was removed.`,
                                        notificationType: 'assignment',
                                    })
                                }

                                notifySuccess(`Assignment removed. ${requestIdsToMove.length} open request${requestIdsToMove.length === 1 ? '' : 's'} moved to the other assigned employee.`)
                            }
                        }
                    }
                }
            }

            await loadEmployee()

        } catch (err) {
            console.error('REMOVE ASSIGNMENT ERROR:', err)
            notifyError(friendlyError(err, 'Failed to remove assignment.'))
        }
    }

    const collegeName = (id) => colleges.find((c) => c.college_id === id)?.college_name || 'N/A'
    const programName = (id) => programs.find((p) => p.program_id === id)?.program_name || 'N/A'
    const filteredPrograms = programs.filter((p) => !newCollegeId || p.college_id === newCollegeId)

    if (loading) {
        return (
            <SkeletonPage
                portal="admin"
                blocks={[
                    { type: 'back' },
                    { type: 'header' },
                    { type: 'card', action: true, fields: 8, titleWidth: 200 },
                    { type: 'card', lines: 1, rows: 2, titleWidth: 230 },
                    { type: 'card', lines: 1, rows: 3, titleWidth: 170 },
                ]}
            />
        )
    }

    if (error && !employee) {
        return <div className="admin-error-box">{error}</div>
    }

    return (
        <div>
            <button className="admin-link-button" style={{ marginBottom: 16 }} onClick={() => navigate(adminPath('/employees'))}>
                ← Back to Employees
            </button>

            <div className="admin-detail-hero">
                <span className="admin-detail-avatar" aria-hidden="true">
                    {`${(employee.first_name || '?')[0]}${(employee.last_name || '')[0] || ''}`.toUpperCase()}
                </span>
                <div className="admin-detail-main">
                    <span className="admin-detail-eyebrow">Registrar staff</span>
                    <h1>{employee.first_name} {employee.last_name}</h1>
                    <p>{employee.email} · {employee.phone_number || 'No phone on file'}</p>
                    <div className="admin-detail-tags">
                        {employeeNumber && <span>{employeeNumber}</span>}
                        {positionTitle && <span>{positionTitle}</span>}
                        {displayName && <span>Shown to students as “{displayName}”</span>}
                    </div>
                </div>
            </div>

            {error && <div className="admin-error-box">{error}</div>}
            {message && <div className="admin-success-box">{message}</div>}

            <div className="admin-card">
                <div className="admin-page-header-row" style={{ marginBottom: 16 }}>
                    <h2 style={{ fontSize: 16 }}>Employment Information</h2>
                    <button className="admin-link-button" onClick={startEditing}>
                        Edit →
                    </button>
                </div>

                <div className="admin-info-grid">
                    <div className="admin-info-field"><span>Employee Number</span><strong>{employeeNumber}</strong></div>
                    <div className="admin-info-field"><span>Position Title</span><strong>{positionTitle}</strong></div>
                    <div className="admin-info-field"><span>Nickname (shown to students)</span><strong>{displayName || 'None — real name shown'}</strong></div>
                    <div className="admin-info-field"><span>Assigned College</span><strong>{collegeName(assignedCollegeId || null)}</strong></div>
                </div>
            </div>

            {editing && form && (
                <Modal title="Edit Employment Information" subtitle="Employee number, position and nickname." icon={IconUsers} onClose={() => !saving && setEditing(false)}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div className="form-group">
                            <label className="form-label">Employee Number</label>
                            <input
                                className="form-input"
                                type="text"
                                value={form.employeeNumber}
                                onChange={(e) => setForm({ ...form, employeeNumber: e.target.value })}
                                disabled={saving}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Position Title</label>
                            <input
                                className="form-input"
                                type="text"
                                value={form.positionTitle}
                                onChange={(e) => setForm({ ...form, positionTitle: e.target.value })}
                                disabled={saving}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Nickname (optional)</label>
                            <input
                                className="form-input"
                                type="text"
                                value={form.displayName}
                                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                                placeholder="Shown to students instead of the real name"
                                disabled={saving}
                            />
                            <small style={{ display: 'block', marginTop: 6, fontSize: 12, color: 'var(--slate)' }}>
                                If set, students see this name (not the real name) when messaging this employee.
                            </small>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Contact Number (optional)</label>
                            <input
                                className="form-input"
                                type="tel"
                                inputMode="numeric"
                                maxLength={11}
                                value={form.phoneNumber}
                                onChange={(e) => setForm({ ...form, phoneNumber: digitsOnly(e.target.value) })}
                                placeholder="09XXXXXXXXX"
                                disabled={saving}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Assigned College</label>
                            <select
                                className="form-input"
                                value={form.assignedCollegeId}
                                onChange={(e) => setForm({ ...form, assignedCollegeId: e.target.value })}
                                disabled={saving}
                            >
                                <option value="">-- None --</option>
                                {colleges.map((c) => (
                                    <option key={c.college_id} value={c.college_id}>{c.college_name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="app-modal-actions">
                            <button className="admin-primary-button" onClick={saveEmployee} disabled={saving}>
                                {saving ? 'Saving...' : 'Save changes'}
                            </button>
                            <button className="admin-secondary-button" onClick={() => setEditing(false)} disabled={saving}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            <div className="admin-card">
                <h2 style={{ fontSize: 16, marginBottom: 6 }}>Account</h2>
                <p style={{ fontSize: 13, color: 'var(--slate)', marginBottom: 14 }}>
                    Set a temporary password if this employee forgot theirs or needs a reset. They'll be signed out
                    and asked to create a new password the next time they log in.
                </p>

                {employee.must_change_password && (
                    <div className="admin-notice tone-warning" style={{ marginBottom: 14 }}>
                        <strong>Waiting for a new password</strong>
                        <p>This employee still needs to log in with their temporary password and create a new one.</p>
                    </div>
                )}

                <button
                    className="admin-primary-button"
                    onClick={handleSetTempPassword}
                    disabled={resettingPassword}
                >
                    {resettingPassword ? 'Setting password...' : 'Set Temporary Password'}
                </button>
            </div>

            <div className="admin-card">
                <h2 style={{ fontSize: 16, marginBottom: 6 }}>College/Program Assignments</h2>
                <p style={{ fontSize: 13, marginBottom: 16 }}>
                    Determines which student requests get routed to this employee automatically.
                </p>

                {assignments.filter((a) => a.status === 'active').length === 0 ? (
                    <p style={{ fontSize: 13.5, color: 'var(--slate)', marginBottom: 16 }}>No active assignments.</p>
                ) : (
                    <div className="admin-table-wrapper" style={{ marginBottom: 20 }}>
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>College</th>
                                    <th>Program</th>
                                    <th>Primary</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {assignments.filter((a) => a.status === 'active').map((a) => (
                                    <tr key={a.assignment_id}>
                                        <td>{collegeName(a.college_id)}</td>
                                        <td>{programName(a.program_id)}</td>
                                        <td>{a.is_primary ? 'Yes' : 'No'}</td>
                                        <td>
                                            <button className="admin-link-button" style={{ color: 'var(--red)' }} onClick={() => removeAssignment(a)}>
                                                Remove
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <select
                        className="admin-search-input"
                        style={{ maxWidth: 220 }}
                        value={newCollegeId}
                        onChange={(e) => { setNewCollegeId(e.target.value); setNewProgramId('') }}
                    >
                        <option value="">College</option>
                        {colleges.map((c) => (
                            <option key={c.college_id} value={c.college_id}>{c.college_name}</option>
                        ))}
                    </select>

                    <select
                        className="admin-search-input"
                        style={{ maxWidth: 220 }}
                        value={newProgramId}
                        onChange={(e) => setNewProgramId(e.target.value)}
                    >
                        <option value="">Program</option>
                        {filteredPrograms.map((p) => (
                            <option key={p.program_id} value={p.program_id}>{p.program_name}</option>
                        ))}
                    </select>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                        <input type="checkbox" checked={newIsPrimary} onChange={(e) => setNewIsPrimary(e.target.checked)} />
                        Primary
                    </label>

                    <button className="admin-primary-button" onClick={addAssignment}>Add</button>
                </div>
            </div>

            <div className="admin-card">
                <h2 style={{ fontSize: 16, marginBottom: 6 }}>Assigned Requests</h2>
                <p style={{ fontSize: 13, marginBottom: 16 }}>
                    All document requests currently or previously assigned to this employee.
                </p>

                {requests.length === 0 ? (
                    <p style={{ fontSize: 13.5, color: 'var(--slate)' }}>No requests have been assigned to this employee.</p>
                ) : (
                    requests.map((r) => (
                        <div className="admin-list-card" key={r.request_id}>
                            <div className="admin-list-card-header">
                                <div>
                                    <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--slate)', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 2 }}>
                                        {r.studentName || `Student ${r.studentNumber}`}
                                    </p>
                                    <h3>{r.documentName}</h3>
                                    <p>{r.request_number} · Student {r.studentNumber}</p>
                                </div>

                                <span className={`admin-status-pill status-${r.status}`}>
                                    {r.status.replace(/_/g, ' ')}
                                </span>
                            </div>

                            <div className="admin-info-grid">
                                <div className="admin-info-field">
                                    <span>Total</span>
                                    <strong>₱{Number(r.total_amount || 0).toFixed(2)}</strong>
                                </div>

                                <div className="admin-info-field">
                                    <span>Requested</span>
                                    <strong>{r.requested_at ? formatDisplayDateTime(r.requested_at) : 'N/A'}</strong>
                                </div>
                            </div>

                            <button className="admin-link-button" onClick={() => navigate(adminPath(`/requests/${r.request_id}`))}>
                                Open request →
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}

export default EmployeeDetails
