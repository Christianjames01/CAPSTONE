import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activityLog'
import { createEmployeeAccount } from '../../lib/createEmployeeAccount'
import { notifyError, notifySuccess, notifyWarning } from '../../lib/notify'
import { friendlyError } from '../../lib/friendlyError'
import Modal from '../../components/Modal'
import PasswordRequirements from '../../components/PasswordRequirements'
import { passwordMeetsRequirements, passwordRequirementMessage } from '../../lib/passwordStrength'
import { IconUsers } from '../admin/icons'
import { digitsOnly, isValidPhMobile } from '../../lib/phoneInput'
import './EmployeePages.css'

const BLANK_FORM = {
    firstName: '',
    lastName: '',
    displayName: '',
    employeeNumber: '',
    positionTitle: '',
    assignedCollegeId: '',
    assignedProgramId: '',
    email: '',
    phoneNumber: '',
    password: '',
}

// A focused version of the Registrar Head's "Add Employee" form, for an
// employee a registrar head/admin has granted can_add_employees. Reuses the
// shared Modal so the form gets the exact same styling as Employees.jsx.
// Creates the login, the employees row, and (if a college/program is
// picked) the assignment too -- the same three steps Employees.jsx does.
function AddEmployee() {
    const navigate = useNavigate()

    const [form, setForm] = useState(BLANK_FORM)
    const [colleges, setColleges] = useState([])
    const [programs, setPrograms] = useState([])
    const [pendingAssignments, setPendingAssignments] = useState([])
    const [creating, setCreating] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        loadCollegesAndPrograms()
    }, [])

    const loadCollegesAndPrograms = async () => {
        const [{ data: collegeRows }, { data: programRows }] = await Promise.all([
            supabase.from('colleges').select('college_id, college_name').order('college_name'),
            supabase.from('programs').select('program_id, program_name, college_id').order('program_name'),
        ])
        setColleges(collegeRows || [])
        setPrograms(programRows || [])
    }

    const updateForm = (field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }))
    }

    const collegeName = (id) => colleges.find((c) => c.college_id === id)?.college_name || 'N/A'
    const programName = (id) => programs.find((p) => p.program_id === id)?.program_name || 'N/A'

    const addPendingAssignment = () => {
        if (!form.assignedCollegeId || !form.assignedProgramId) {
            notifyWarning('Please select a college and program.')
            return
        }
        if (pendingAssignments.some((a) => a.collegeId === form.assignedCollegeId && a.programId === form.assignedProgramId)) {
            notifyWarning('That college and program is already added.')
            return
        }
        setPendingAssignments((prev) => [...prev, { collegeId: form.assignedCollegeId, programId: form.assignedProgramId }])
        setForm((prev) => ({ ...prev, assignedCollegeId: '', assignedProgramId: '' }))
    }

    const removePendingAssignment = (index) => {
        setPendingAssignments((prev) => prev.filter((_, i) => i !== index))
    }

    const close = () => {
        if (creating) return
        navigate('/employee/dashboard')
    }

    const submit = async (e) => {
        e.preventDefault()
        setError('')

        if (!form.firstName.trim() || !form.lastName.trim() || !form.employeeNumber.trim() ||
            !form.positionTitle.trim() || !form.email.trim() || !form.password) {
            setError('Please fill in all required fields.')
            return
        }

        if (!passwordMeetsRequirements(form.password)) {
            setError(passwordRequirementMessage())
            return
        }

        if (form.phoneNumber.trim() && !isValidPhMobile(form.phoneNumber.trim())) {
            setError('Contact number must be an 11-digit mobile number starting with 09.')
            return
        }

        try {
            setCreating(true)

            const {
                data: { user },
                error: userError
            } = await supabase.auth.getUser()

            if (userError || !user) {
                throw new Error('You are not logged in.')
            }

            const newUser = await createEmployeeAccount({
                email: form.email.trim(),
                password: form.password,
                firstName: form.firstName.trim(),
                lastName: form.lastName.trim(),
                employeeNumber: form.employeeNumber.trim(),
                positionTitle: form.positionTitle.trim(),
                assignedCollegeId: pendingAssignments[0]?.collegeId || null,
                displayName: form.displayName.trim() || null,
                phoneNumber: form.phoneNumber.trim() || null,
            })

            await logActivity({
                userId: user.id,
                action: 'add_employee',
                tableName: 'employees',
                recordId: newUser.id,
                description: `Added employee "${form.firstName.trim()} ${form.lastName.trim()}" (${form.employeeNumber.trim()}).`,
            })

            let assignmentNote = ''

            if (pendingAssignments.length > 0) {
                const { data: newEmployeeRow, error: newEmployeeLookupError } = await supabase
                    .from('employees')
                    .select('employee_id')
                    .eq('user_id', newUser.id)
                    .single()

                if (newEmployeeLookupError || !newEmployeeRow) {
                    console.error('NEW EMPLOYEE LOOKUP ERROR:', newEmployeeLookupError)
                    assignmentNote = ' The account was created, but the college/program assignments could not be set automatically — ask a registrar head to add them.'
                } else {
                    const { error: assignmentError } = await supabase
                        .from('employee_assignments')
                        .insert(
                            pendingAssignments.map((a, i) => ({
                                employee_id: newEmployeeRow.employee_id,
                                college_id: a.collegeId,
                                program_id: a.programId,
                                is_primary: i === 0,
                                status: 'active',
                            }))
                        )

                    if (assignmentError) {
                        console.error('NEW EMPLOYEE ASSIGNMENT ERROR:', assignmentError)
                        assignmentNote = ' The account was created, but the college/program assignments could not be saved: ' + assignmentError.message
                    } else {
                        await logActivity({
                            userId: user.id,
                            action: 'add_employee_assignment',
                            tableName: 'employee_assignments',
                            recordId: newEmployeeRow.employee_id,
                            description: `Assigned new employee "${form.firstName.trim()} ${form.lastName.trim()}" to ${pendingAssignments.length} college/program${pendingAssignments.length === 1 ? '' : 's'} on creation.`,
                        })
                    }
                }
            }

            const createdMessage = `Employee account created for ${form.email.trim()}.${assignmentNote}`
            setForm(BLANK_FORM)
            setPendingAssignments([])
            if (assignmentNote) notifyWarning(createdMessage)
            else notifySuccess(createdMessage)
            navigate('/employee/dashboard')

        } catch (err) {
            console.error('ADD EMPLOYEE ERROR:', err)
            const message = friendlyError(err, 'Failed to create employee account.')
            setError(message)
            notifyError(message)
        } finally {
            setCreating(false)
        }
    }

    return (
        <Modal
            title="Add Employee"
            subtitle="Creates a login and an active staff account right away."
            icon={IconUsers}
            maxWidth={640}
            onClose={close}
        >
            <form onSubmit={submit} className="app-modal-form" noValidate>
                <section className="app-modal-section">
                    <h4>Name</h4>
                    <div className="app-modal-grid">
                        <div className="form-group">
                            <label className="form-label" htmlFor="emp-first">First Name</label>
                            <input id="emp-first" className="form-input" type="text" autoComplete="off" value={form.firstName} onChange={(e) => updateForm('firstName', e.target.value)} disabled={creating} />
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="emp-last">Last Name</label>
                            <input id="emp-last" className="form-input" type="text" autoComplete="off" value={form.lastName} onChange={(e) => updateForm('lastName', e.target.value)} disabled={creating} />
                        </div>

                        <div className="form-group is-wide">
                            <label className="form-label" htmlFor="emp-nickname">Nickname <span className="app-modal-optional">optional</span></label>
                            <input id="emp-nickname" className="form-input" type="text" autoComplete="off" value={form.displayName} onChange={(e) => updateForm('displayName', e.target.value)} placeholder="Shown to students instead of the real name" disabled={creating} />
                            <small className="app-modal-help">
                                Students see this name when messaging this employee. Staff still see the real name.
                            </small>
                        </div>
                    </div>
                </section>

                <section className="app-modal-section">
                    <h4>Employment</h4>
                    <div className="app-modal-grid">
                        <div className="form-group">
                            <label className="form-label" htmlFor="emp-number">Employee Number</label>
                            <input id="emp-number" className="form-input" type="text" autoComplete="off" value={form.employeeNumber} onChange={(e) => updateForm('employeeNumber', e.target.value)} placeholder="e.g. EMP-0042" disabled={creating} />
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="emp-position">Position Title</label>
                            <input id="emp-position" className="form-input" type="text" autoComplete="off" value={form.positionTitle} onChange={(e) => updateForm('positionTitle', e.target.value)} placeholder="e.g. Registrar Staff" disabled={creating} />
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="emp-phone">Contact Number <span className="app-modal-optional">optional</span></label>
                            <input id="emp-phone" className="form-input" type="tel" inputMode="numeric" maxLength={11} autoComplete="off" value={form.phoneNumber} onChange={(e) => updateForm('phoneNumber', digitsOnly(e.target.value))} placeholder="09XXXXXXXXX" disabled={creating} />
                        </div>
                    </div>
                </section>

                <section className="app-modal-section">
                    <h4>Assignment <span className="app-modal-optional">optional</span></h4>

                    {pendingAssignments.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                            {pendingAssignments.map((a, i) => (
                                <span
                                    key={`${a.collegeId}-${a.programId}`}
                                    className="employee-status-pill"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                >
                                    {collegeName(a.collegeId)} · {programName(a.programId)}
                                    {i === 0 && <em style={{ fontStyle: 'normal', opacity: 0.7 }}>(primary)</em>}
                                    <button
                                        type="button"
                                        onClick={() => removePendingAssignment(i)}
                                        disabled={creating}
                                        aria-label={`Remove ${collegeName(a.collegeId)} · ${programName(a.programId)}`}
                                        style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}
                                    >
                                        ×
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}

                    <div className="app-modal-grid">
                        <div className="form-group">
                            <label className="form-label" htmlFor="emp-college">College</label>
                            <select
                                id="emp-college"
                                className="form-input"
                                value={form.assignedCollegeId}
                                onChange={(e) => setForm((prev) => ({ ...prev, assignedCollegeId: e.target.value, assignedProgramId: '' }))}
                                disabled={creating}
                            >
                                <option value="">None</option>
                                {colleges.map((c) => (
                                    <option key={c.college_id} value={c.college_id}>{c.college_name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="emp-program">Program</label>
                            <select
                                id="emp-program"
                                className="form-input"
                                value={form.assignedProgramId}
                                onChange={(e) => updateForm('assignedProgramId', e.target.value)}
                                disabled={creating || !form.assignedCollegeId}
                            >
                                <option value="">
                                    {form.assignedCollegeId ? 'None' : 'Select a college first'}
                                </option>
                                {programs.filter((p) => p.college_id === form.assignedCollegeId).map((p) => (
                                    <option key={p.program_id} value={p.program_id}>{p.program_name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <button
                        type="button"
                        className="employee-link-button"
                        onClick={addPendingAssignment}
                        disabled={creating || !form.assignedCollegeId || !form.assignedProgramId}
                        style={{ marginTop: 8 }}
                    >
                        + Add this assignment
                    </button>

                    <small className="app-modal-help" style={{ display: 'block', marginTop: 8 }}>
                        Add as many college/program pairs as this employee is assigned to. Student requests for each program route to them. You can also change this later from their profile.
                    </small>
                </section>

                <section className="app-modal-section">
                    <h4>Login account</h4>
                    <div className="app-modal-grid">
                        <div className="form-group is-wide">
                            <label className="form-label" htmlFor="emp-email">Email</label>
                            <input id="emp-email" className="form-input" type="email" autoComplete="off" value={form.email} onChange={(e) => updateForm('email', e.target.value)} placeholder="employee@hcdc.edu.ph" disabled={creating} />
                        </div>

                        <div className="form-group is-wide">
                            <label className="form-label" htmlFor="emp-password">Temporary Password</label>
                            <input id="emp-password" className="form-input" type="password" autoComplete="new-password" value={form.password} onChange={(e) => updateForm('password', e.target.value)} disabled={creating} />
                            <PasswordRequirements password={form.password} />
                            <small className="app-modal-help">
                                Give this to the employee. They can change it from their Profile after logging in.
                            </small>
                        </div>
                    </div>
                </section>

                {error && <div className="employee-error-box" style={{ margin: 0 }}>{error}</div>}

                <div className="app-modal-actions">
                    <button className="employee-secondary-button" type="button" onClick={close} disabled={creating}>
                        Cancel
                    </button>
                    <button className="employee-primary-button" type="submit" disabled={creating}>
                        {creating ? 'Creating...' : 'Create Employee Account'}
                    </button>
                </div>
            </form>
        </Modal>
    )
}

export default AddEmployee
