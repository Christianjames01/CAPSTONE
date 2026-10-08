import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activityLog'
import { createEmployeeAccount } from '../../lib/createEmployeeAccount'
import { notifyError, notifySuccess, notifyWarning, confirmModal } from '../../lib/notify'
import { SkeletonList } from '../../components/Skeleton'
import Modal from '../../components/Modal'
import PasswordRequirements from '../../components/PasswordRequirements'
import { passwordMeetsRequirements, passwordRequirementMessage } from '../../lib/passwordStrength'
import PageStats from '../../components/PageStats'
import { IconUsers, IconHourglass, IconFileStack, IconBuilding } from './icons'
import './AdminPages.css'
import { useLiveRefresh } from '../../lib/useLiveRefresh'
import { adminPath } from '../../lib/portalPaths'
import { blockedForReadOnlyViewer } from '../../lib/viewOnlyGuard'
import { friendlyError } from '../../lib/friendlyError'
import { confirmWithPassword } from '../../lib/confirmPassword'
import { digitsOnly, isValidPhMobile } from '../../lib/phoneInput'

const OPEN_STATUSES = ['pending', 'payment_pending', 'receipt_uploaded', 'receipt_verified', 'processing', 'lacking_requirements', 'ready_for_claiming']

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

function Employees() {
    const { role } = useOutletContext() || {}
    const navigate = useNavigate()

    const [employees, setEmployees] = useState([])
    const [colleges, setColleges] = useState([])
    const [programs, setPrograms] = useState([])
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [updating, setUpdating] = useState(null)
    const [removing, setRemoving] = useState(null)

    const [showAddForm, setShowAddForm] = useState(false)
    const [form, setForm] = useState(BLANK_FORM)
    const [creating, setCreating] = useState(false)
    const [addError, setAddError] = useState('')
    const [addMessage, setAddMessage] = useState('')

    useLiveRefresh(['employees', 'employee_assignments'], (options) => loadEmployees(options))

    useEffect(() => {
        loadEmployees()
    }, [])

    const loadEmployees = async ({ silent = false } = {}) => {
        try {
            if (!silent) setLoading(true)
            setError('')

            const { data: employeeRows, error: employeeError } = await supabase
                .from('employees')
                .select('employee_id, user_id, employee_number, position_title, display_name, assigned_college_id, status, can_add_employees, created_at')
                .order('created_at', { ascending: false })

            if (employeeError) {
                throw new Error('Failed to load employees: ' + employeeError.message)
            }

            const data = employeeRows || []
            const userIds = [...new Set(data.map((e) => e.user_id))]
            const collegeIds = [...new Set(data.map((e) => e.assigned_college_id).filter(Boolean))]

            const [{ data: profiles }, { data: colleges }] = await Promise.all([
                userIds.length
                    ? supabase.from('profiles').select('user_id, first_name, last_name, email').in('user_id', userIds)
                    : Promise.resolve({ data: [] }),
                collegeIds.length
                    ? supabase.from('colleges').select('college_id, college_name').in('college_id', collegeIds)
                    : Promise.resolve({ data: [] }),
            ])

            const profileByUserId = Object.fromEntries((profiles || []).map((p) => [p.user_id, p]))
            const collegeNameById = Object.fromEntries((colleges || []).map((c) => [c.college_id, c.college_name]))

            const employeeIds = data.map((e) => e.employee_id)

            const { data: openRequests } = employeeIds.length
                ? await supabase
                    .from('document_requests')
                    .select('assigned_employee_id')
                    .in('assigned_employee_id', employeeIds)
                    .in('status', OPEN_STATUSES)
                : { data: [] }

            const openCountByEmployee = {}
            for (const r of openRequests || []) {
                openCountByEmployee[r.assigned_employee_id] = (openCountByEmployee[r.assigned_employee_id] || 0) + 1
            }

            setEmployees(
                data.map((e) => {
                    const profile = profileByUserId[e.user_id]

                    return {
                        ...e,
                        name: profile ? `${profile.first_name} ${profile.last_name}`.trim() : 'Unknown',
                        displayName: e.display_name || '',
                        email: profile?.email || '',
                        collegeName: collegeNameById[e.assigned_college_id] || 'Unassigned',
                        openCount: openCountByEmployee[e.employee_id] || 0,
                        canAddEmployees: !!e.can_add_employees,
                    }
                })
            )

            const { data: collegeRows } = await supabase
                .from('colleges')
                .select('college_id, college_name')
                .order('college_name')

            setColleges(collegeRows || [])

            const { data: programRows } = await supabase
                .from('programs')
                .select('program_id, program_name, college_id')
                .order('program_name')

            setPrograms(programRows || [])

        } catch (err) {
            console.error('EMPLOYEES ERROR:', err)
            setError(err.message || 'Failed to load employees.')
        } finally {
            setLoading(false)
        }
    }

    const updateForm = (field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }))
    }

    const closeAddForm = () => {
        if (creating) return
        setShowAddForm(false)
        setForm(BLANK_FORM)
        setAddError('')
        setAddMessage('')
    }

    const addEmployee = async (e) => {
        if (blockedForReadOnlyViewer(role)) return
        e.preventDefault()

        setAddError('')
        setAddMessage('')

        if (!form.firstName.trim() || !form.lastName.trim() || !form.employeeNumber.trim() ||
            !form.positionTitle.trim() || !form.email.trim() || !form.password) {
            setAddError('Please fill in all required fields.')
            return
        }

        if (!passwordMeetsRequirements(form.password)) {
            setAddError(passwordRequirementMessage())
            return
        }

        if (form.phoneNumber.trim() && !isValidPhMobile(form.phoneNumber.trim())) {
            setAddError('Contact number must be an 11-digit mobile number starting with 09.')
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
                assignedCollegeId: form.assignedCollegeId || null,
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

            if (form.assignedCollegeId && form.assignedProgramId) {
                const { data: newEmployeeRow, error: newEmployeeLookupError } = await supabase
                    .from('employees')
                    .select('employee_id')
                    .eq('user_id', newUser.id)
                    .single()

                if (newEmployeeLookupError || !newEmployeeRow) {
                    console.error('NEW EMPLOYEE LOOKUP ERROR:', newEmployeeLookupError)
                    assignmentNote = ' The account was created, but the college/program assignment could not be set automatically — add it from the employee\'s page.'
                } else {
                    const { error: assignmentError } = await supabase
                        .from('employee_assignments')
                        .insert({
                            employee_id: newEmployeeRow.employee_id,
                            college_id: form.assignedCollegeId,
                            program_id: form.assignedProgramId,
                            is_primary: true,
                            status: 'active',
                        })

                    if (assignmentError) {
                        console.error('NEW EMPLOYEE ASSIGNMENT ERROR:', assignmentError)
                        assignmentNote = ' The account was created, but the college/program assignment could not be saved: ' + assignmentError.message
                    } else {
                        await logActivity({
                            userId: user.id,
                            action: 'add_employee_assignment',
                            tableName: 'employee_assignments',
                            recordId: newEmployeeRow.employee_id,
                            description: `Assigned new employee "${form.firstName.trim()} ${form.lastName.trim()}" to a college/program on creation.`,
                        })
                    }
                }
            }

            // Done: close the modal and confirm with a toast.
            const createdMessage = `Employee account created for ${form.email.trim()}.${assignmentNote}`
            setShowAddForm(false)
            setForm(BLANK_FORM)
            setAddError('')
            setAddMessage('')
            if (assignmentNote) notifyWarning(createdMessage)
            else notifySuccess(createdMessage)
            await loadEmployees()

        } catch (err) {
            console.error('ADD EMPLOYEE ERROR:', err)
            const message = friendlyError(err, 'Failed to create employee account.')
            setAddError(message)
            notifyError(message)
        } finally {
            setCreating(false)
        }
    }

    const removeEmployee = async (employee) => {
        if (blockedForReadOnlyViewer(role)) return
        const confirmed = await confirmModal(
            `Remove ${employee.name}'s employee record? This does not delete their login account, only their registrar staff profile and access.`
        )
        if (!confirmed) return

        // Deleting an employee is permanent: confirm who is making it.
        const verified = await confirmWithPassword({
            title: 'Confirm with your password',
            text: `Enter your password to remove ${employee.name}'s employee record.`,
        })
        if (!verified) return

        try {
            setRemoving(employee.employee_id)

            const {
                data: { user },
                error: userError
            } = await supabase.auth.getUser()

            if (userError || !user) {
                throw new Error('You are not logged in.')
            }

            const { error: deleteError } = await supabase
                .from('employees')
                .delete()
                .eq('employee_id', employee.employee_id)

            if (deleteError) {
                throw new Error('Failed to remove employee: ' + deleteError.message)
            }

            await logActivity({
                userId: user.id,
                action: 'remove_employee',
                tableName: 'employees',
                recordId: employee.employee_id,
                description: `Removed employee record for "${employee.name}" (${employee.employee_number}).`,
            })

            await loadEmployees()

        } catch (err) {
            console.error('REMOVE EMPLOYEE ERROR:', err)
            notifyError(friendlyError(err, 'Failed to remove employee.'))
        } finally {
            setRemoving(null)
        }
    }

    const toggleStatus = async (employee) => {
        if (blockedForReadOnlyViewer(role)) return
        const nextStatus = employee.status === 'active' ? 'inactive' : 'active'

        const confirmed = await confirmModal(
            `${nextStatus === 'active' ? 'Activate' : 'Deactivate'} ${employee.name}?`
        )
        if (!confirmed) return

        try {
            setUpdating(employee.employee_id)

            const {
                data: { user },
                error: userError
            } = await supabase.auth.getUser()

            if (userError || !user) {
                throw new Error('You are not logged in.')
            }

            const { error: updateError } = await supabase
                .from('employees')
                .update({ status: nextStatus, updated_at: new Date().toISOString() })
                .eq('employee_id', employee.employee_id)

            if (updateError) {
                throw new Error('Failed to update employee status: ' + updateError.message)
            }

            await logActivity({
                userId: user.id,
                action: nextStatus === 'active' ? 'activate_employee' : 'deactivate_employee',
                tableName: 'employees',
                recordId: employee.employee_id,
                description: `${nextStatus === 'active' ? 'Activated' : 'Deactivated'} employee "${employee.name}" (${employee.employee_number}).`,
            })

            await loadEmployees()

        } catch (err) {
            console.error('TOGGLE STATUS ERROR:', err)
            notifyError(friendlyError(err, 'Failed to update employee status.'))
        } finally {
            setUpdating(null)
        }
    }

    const toggleCanAddEmployees = async (employee) => {
        if (blockedForReadOnlyViewer(role)) return
        const next = !employee.canAddEmployees

        const confirmed = await confirmModal(
            next
                ? `${employee.name} will be able to add new employee accounts themselves, from their own portal.`
                : `${employee.name} will no longer be able to add new employee accounts.`,
            { title: next ? 'Allow adding employees?' : 'Revoke adding employees?', confirmButtonText: next ? 'Allow' : 'Revoke' }
        )
        if (!confirmed) return

        // Granting this is a real privilege escalation (the employee can
        // then create more logins themselves) -- confirm it's really you.
        if (next) {
            const verified = await confirmWithPassword({
                title: 'Confirm with your password',
                text: `Enter your password to let ${employee.name} add employee accounts.`,
            })
            if (!verified) return
        }

        try {
            setUpdating(employee.employee_id)

            const {
                data: { user },
                error: userError
            } = await supabase.auth.getUser()

            if (userError || !user) {
                throw new Error('You are not logged in.')
            }

            const { error: updateError } = await supabase
                .from('employees')
                .update({ can_add_employees: next, updated_at: new Date().toISOString() })
                .eq('employee_id', employee.employee_id)

            if (updateError) {
                throw new Error('Failed to update permission: ' + updateError.message)
            }

            await logActivity({
                userId: user.id,
                action: next ? 'grant_add_employees' : 'revoke_add_employees',
                tableName: 'employees',
                recordId: employee.employee_id,
                description: `${next ? 'Allowed' : 'Revoked'} "${employee.name}" (${employee.employee_number}) adding employee accounts.`,
            })

            await loadEmployees()

        } catch (err) {
            console.error('TOGGLE CAN_ADD_EMPLOYEES ERROR:', err)
            notifyError(friendlyError(err, 'Failed to update permission.'))
        } finally {
            setUpdating(null)
        }
    }

    const initialsOf = (name) =>
        (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || '?'

    const activeCount = employees.filter((e) => e.status === 'active').length
    const inactiveCount = employees.length - activeCount
    const openTotal = employees.reduce((sum, e) => sum + e.openCount, 0)
    const collegesCovered = new Set(employees.filter((e) => e.status === 'active' && e.assigned_college_id).map((e) => e.assigned_college_id)).size

    const STATUS_CHIPS = [
        { key: 'all', label: 'All', count: employees.length },
        { key: 'active', label: 'Active', count: activeCount },
        { key: 'inactive', label: 'Inactive', count: inactiveCount },
    ]

    const visibleEmployees = employees.filter((e) => {
        if (statusFilter !== 'all' && e.status !== statusFilter) return false
        if (!search.trim()) return true
        const term = search.trim().toLowerCase()
        return (
            e.name.toLowerCase().includes(term) ||
            e.displayName.toLowerCase().includes(term) ||
            e.employee_number.toLowerCase().includes(term) ||
            e.email.toLowerCase().includes(term)
        )
    })

    return (
        <div>
            <div className="admin-page-header-row">
                <div>
                    <h1 style={{ fontSize: 26, marginBottom: 6 }}>Employees</h1>
                    <p>Registrar staff accounts. New employees register themselves and appear here as inactive until you activate them.</p>
                </div>

                <button
                    className="admin-primary-button"
                    onClick={() => { setShowAddForm(true); setAddError(''); setAddMessage('') }}
                >
                    + Add Employee
                </button>
            </div>

            {showAddForm && (
                <Modal
                    title="Add Employee"
                    subtitle="Creates a login and an active staff account right away."
                    icon={IconUsers}
                    maxWidth={640}
                    onClose={closeAddForm}
                >
                    <form onSubmit={addEmployee} className="app-modal-form" noValidate>
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
                            <small className="app-modal-help">
                                Student requests for this program are routed to this employee. You can also set it later on the employee's page.
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

                        {addError && <div className="admin-error-box" style={{ margin: 0 }}>{addError}</div>}
                        {addMessage && <div className="admin-success-box" style={{ margin: 0 }}>{addMessage}</div>}

                        <div className="app-modal-actions">
                            <button className="admin-secondary-button" type="button" onClick={closeAddForm} disabled={creating}>
                                Cancel
                            </button>
                            <button className="admin-primary-button" type="submit" disabled={creating}>
                                {creating ? 'Creating...' : 'Create Employee Account'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {!loading && (
                <PageStats
                    stats={[
                        { label: 'Active staff', value: activeCount, note: `${employees.length} account${employees.length === 1 ? '' : 's'} in total`, Icon: IconUsers, onClick: () => setStatusFilter('active') },
                        { label: 'Awaiting activation', value: inactiveCount, note: inactiveCount ? 'Inactive — activate to let them log in' : 'Everyone is active', Icon: IconHourglass, warn: inactiveCount > 0, onClick: () => setStatusFilter('inactive') },
                        { label: 'Open requests', value: openTotal, note: 'Assigned to staff right now', Icon: IconFileStack },
                        { label: 'Colleges covered', value: collegesCovered, note: 'By an active employee', Icon: IconBuilding },
                    ]}
                />
            )}

            <div className="admin-toolbar">
                <input
                    className="admin-search-input admin-search-field"
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name, employee number, or email"
                />
                <div className="admin-filter-row">
                    {STATUS_CHIPS.map((chip) => (
                        <button
                            key={chip.key}
                            className={`admin-filter-chip${statusFilter === chip.key ? ' active' : ''}`}
                            onClick={() => setStatusFilter(chip.key)}
                        >
                            {chip.label}<span className="admin-chip-count">{chip.count}</span>
                        </button>
                    ))}
                </div>
            </div>

            {error && <div className="admin-error-box">{error}</div>}

            {loading ? (
                <SkeletonList count={3} />
            ) : visibleEmployees.length === 0 ? (
                <div className="admin-empty">No employees found.</div>
            ) : (
                visibleEmployees.map((employee) => (
                    <div className="admin-list-card" key={employee.employee_id}>
                        <div className="admin-list-card-header">
                            <div className="admin-card-title">
                                <span className={`admin-avatar${employee.status === 'active' ? '' : ' is-muted'}`} aria-hidden="true">{initialsOf(employee.name)}</span>
                                <div>
                                    <h3>
                                        {employee.name}
                                        {employee.displayName && <span className="admin-card-badge">Shown to students as “{employee.displayName}”</span>}
                                        {employee.canAddEmployees && <span className="admin-card-badge">Can add employees</span>}
                                    </h3>
                                    <p>{employee.employee_number} · {employee.position_title} · {employee.email}</p>
                                </div>
                            </div>

                            <span className={`admin-status-pill status-${employee.status}`}>{employee.status}</span>
                        </div>

                        <div className="admin-info-grid">
                            <div className="admin-info-field">
                                <span>Assigned College</span>
                                <strong>{employee.collegeName}</strong>
                            </div>
                            <div className="admin-info-field">
                                <span>Open Requests</span>
                                <strong>{employee.openCount}</strong>
                            </div>
                        </div>

                        <div className="admin-card-actions">
                            <button
                                className={`admin-link-button${employee.canAddEmployees ? ' is-warning' : ' is-success'}`}
                                onClick={() => toggleCanAddEmployees(employee)}
                                disabled={updating === employee.employee_id}
                            >
                                {employee.canAddEmployees ? 'Revoke adding employees' : 'Allow adding employees'}
                            </button>

                            <button
                                className="admin-link-button"
                                onClick={() => navigate(adminPath(`/employees/${employee.employee_id}`))}
                            >
                                Edit & assignments →
                            </button>

                            <button
                                className={`admin-link-button${employee.status === 'active' ? ' is-danger' : ' is-success'}`}
                                style={{ marginLeft: 'auto' }}
                                onClick={() => toggleStatus(employee)}
                                disabled={updating === employee.employee_id}
                            >
                                {updating === employee.employee_id
                                    ? 'Updating...'
                                    : employee.status === 'active' ? 'Deactivate' : 'Activate'}
                            </button>

                            <button
                                className="admin-link-button is-danger"
                                onClick={() => removeEmployee(employee)}
                                disabled={removing === employee.employee_id}
                            >
                                {removing === employee.employee_id ? 'Removing...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                ))
            )}
        </div>
    )
}

export default Employees
