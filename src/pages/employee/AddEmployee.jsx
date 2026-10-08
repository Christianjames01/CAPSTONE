import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activityLog'
import { createEmployeeAccount } from '../../lib/createEmployeeAccount'
import { notifyError, notifySuccess } from '../../lib/notify'
import { friendlyError } from '../../lib/friendlyError'
import Modal from '../../components/Modal'
import PasswordRequirements from '../../components/PasswordRequirements'
import { passwordMeetsRequirements, passwordRequirementMessage } from '../../lib/passwordStrength'
import { IconUsers } from '../admin/icons'
import './EmployeePages.css'

const PH_MOBILE = /^09\d{9}$/

const BLANK_FORM = {
    firstName: '',
    lastName: '',
    displayName: '',
    employeeNumber: '',
    positionTitle: '',
    email: '',
    phoneNumber: '',
    password: '',
}

// A focused version of the Registrar Head's "Add Employee" form, for an
// employee a registrar head/admin has granted can_add_employees. Reuses the
// shared Modal so the form gets the exact same styling as Employees.jsx.
// Creates the login and employees row only -- college/program assignment is
// left to a registrar head from Employees > Edit & assignments, since that
// insert needs permissions this page's caller doesn't have.
function AddEmployee() {
    const navigate = useNavigate()

    const [form, setForm] = useState(BLANK_FORM)
    const [creating, setCreating] = useState(false)
    const [error, setError] = useState('')

    const updateForm = (field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }))
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

        if (form.phoneNumber.trim() && !PH_MOBILE.test(form.phoneNumber.trim())) {
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

            notifySuccess(`Employee account created for ${form.email.trim()}. A registrar head can set their college/program from Employees.`)
            setForm(BLANK_FORM)
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
                            <input id="emp-phone" className="form-input" type="tel" autoComplete="off" value={form.phoneNumber} onChange={(e) => updateForm('phoneNumber', e.target.value)} placeholder="09XX XXX XXXX" disabled={creating} />
                        </div>
                    </div>
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
