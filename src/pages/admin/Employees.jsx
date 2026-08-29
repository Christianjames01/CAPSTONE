import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activityLog'
import { createEmployeeAccount } from '../../lib/createEmployeeAccount'
import { notifyError, confirmModal } from '../../lib/notify'
import { SkeletonList } from '../../components/Skeleton'
import './AdminPages.css'

const OPEN_STATUSES = ['pending', 'payment_pending', 'receipt_uploaded', 'receipt_verified', 'processing', 'lacking_requirements', 'ready_for_claiming']

const BLANK_FORM = {
    firstName: '',
    lastName: '',
    employeeNumber: '',
    positionTitle: '',
    assignedCollegeId: '',
    assignedProgramId: '',
    email: '',
    password: '',
}

function Employees() {
    const navigate = useNavigate()

    const [employees, setEmployees] = useState([])
    const [colleges, setColleges] = useState([])
    const [programs, setPrograms] = useState([])
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [updating, setUpdating] = useState(null)
    const [removing, setRemoving] = useState(null)

    const [showAddForm, setShowAddForm] = useState(false)
    const [form, setForm] = useState(BLANK_FORM)
    const [creating, setCreating] = useState(false)
    const [addError, setAddError] = useState('')
    const [addMessage, setAddMessage] = useState('')

    useEffect(() => {
        loadEmployees()
    }, [])

    const loadEmployees = async () => {
        try {
            setLoading(true)
            setError('')

            const { data: employeeRows, error: employeeError } = await supabase
                .from('employees')
                .select('employee_id, user_id, employee_number, position_title, assigned_college_id, status, created_at')
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
                        email: profile?.email || '',
                        collegeName: collegeNameById[e.assigned_college_id] || 'Unassigned',
                        openCount: openCountByEmployee[e.employee_id] || 0,
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

    const addEmployee = async (e) => {
        e.preventDefault()

        setAddError('')
        setAddMessage('')

        if (!form.firstName.trim() || !form.lastName.trim() || !form.employeeNumber.trim() ||
            !form.positionTitle.trim() || !form.email.trim() || !form.password) {
            setAddError('Please fill in all required fields.')
            return
        }

        if (form.password.length < 6) {
            setAddError('Password must be at least 6 characters.')
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
            })

            await logActivity({
                userId: user.id,
                action: 'add_employee',
                tableName: 'employees',
                recordId: newUser.id,
                description: `Added employee ${form.firstName.trim()} ${form.lastName.trim()} (${form.employeeNumber.trim()}).`,
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
                            description: `Assigned new employee ${form.firstName.trim()} ${form.lastName.trim()} to a college/program on creation.`,
                        })
                    }
                }
            }

            setAddMessage(`Employee account created for ${form.email.trim()}.${assignmentNote}`)
            setForm(BLANK_FORM)
            await loadEmployees()

        } catch (err) {
            console.error('ADD EMPLOYEE ERROR:', err)
            setAddError(err.message || 'Failed to create employee account.')
        } finally {
            setCreating(false)
        }
    }

    const removeEmployee = async (employee) => {
        const confirmed = await confirmModal(
            `Remove ${employee.name}'s employee record? This does not delete their login account, only their registrar staff profile and access.`
        )
        if (!confirmed) return

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
                description: `Removed employee record for ${employee.name} (${employee.employee_number}).`,
            })

            await loadEmployees()

        } catch (err) {
            console.error('REMOVE EMPLOYEE ERROR:', err)
            notifyError(err.message || 'Failed to remove employee.')
        } finally {
            setRemoving(null)
        }
    }

    const toggleStatus = async (employee) => {
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
                description: `${nextStatus === 'active' ? 'Activated' : 'Deactivated'} employee ${employee.name} (${employee.employee_number}).`,
            })

            await loadEmployees()

        } catch (err) {
            console.error('TOGGLE STATUS ERROR:', err)
            notifyError(err.message || 'Failed to update employee status.')
        } finally {
            setUpdating(null)
        }
    }

    const visibleEmployees = employees.filter((e) => {
        if (!search.trim()) return true
        const term = search.trim().toLowerCase()
        return (
            e.name.toLowerCase().includes(term) ||
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
                    onClick={() => { setShowAddForm((v) => !v); setAddError(''); setAddMessage('') }}
                >
                    {showAddForm ? 'Cancel' : '+ Add Employee'}
                </button>
            </div>

            {showAddForm && (
                <div className="admin-card" style={{ marginTop: 20 }}>
                    <h2 style={{ fontSize: 16, marginBottom: 6 }}>Add Employee</h2>
                    <p style={{ fontSize: 13, marginBottom: 16 }}>
                        Creates a login account and an active employee profile immediately — no separate activation step needed.
                    </p>

                    <form onSubmit={addEmployee} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px 20px', maxWidth: 700 }}>
                        <div className="form-group">
                            <label className="form-label">First Name</label>
                            <input className="form-input" type="text" value={form.firstName} onChange={(e) => updateForm('firstName', e.target.value)} disabled={creating} />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Last Name</label>
                            <input className="form-input" type="text" value={form.lastName} onChange={(e) => updateForm('lastName', e.target.value)} disabled={creating} />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Employee Number</label>
                            <input className="form-input" type="text" value={form.employeeNumber} onChange={(e) => updateForm('employeeNumber', e.target.value)} placeholder="e.g. EMP-0042" disabled={creating} />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Position Title</label>
                            <input className="form-input" type="text" value={form.positionTitle} onChange={(e) => updateForm('positionTitle', e.target.value)} placeholder="e.g. Registrar Staff" disabled={creating} />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Assigned College</label>
                            <select
                                className="form-input"
                                value={form.assignedCollegeId}
                                onChange={(e) => setForm((prev) => ({ ...prev, assignedCollegeId: e.target.value, assignedProgramId: '' }))}
                                disabled={creating}
                            >
                                <option value="">-- None --</option>
                                {colleges.map((c) => (
                                    <option key={c.college_id} value={c.college_id}>{c.college_name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Assigned Program</label>
                            <select
                                className="form-input"
                                value={form.assignedProgramId}
                                onChange={(e) => updateForm('assignedProgramId', e.target.value)}
                                disabled={creating || !form.assignedCollegeId}
                            >
                                <option value="">
                                    {form.assignedCollegeId ? '-- None --' : 'Select a college first'}
                                </option>
                                {programs.filter((p) => p.college_id === form.assignedCollegeId).map((p) => (
                                    <option key={p.program_id} value={p.program_id}>{p.program_name}</option>
                                ))}
                            </select>
                            <small style={{ display: 'block', marginTop: 6, fontSize: 12, color: 'var(--slate)' }}>
                                Determines which student requests are routed to this employee automatically. Optional — you can also add this later from the employee's page.
                            </small>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Email</label>
                            <input className="form-input" type="email" value={form.email} onChange={(e) => updateForm('email', e.target.value)} placeholder="employee@hcdc.edu.ph" disabled={creating} />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Temporary Password</label>
                            <input className="form-input" type="password" value={form.password} onChange={(e) => updateForm('password', e.target.value)} placeholder="At least 6 characters" disabled={creating} />
                        </div>

                        {addError && <div className="admin-error-box" style={{ gridColumn: '1 / -1' }}>{addError}</div>}
                        {addMessage && <div className="admin-success-box" style={{ gridColumn: '1 / -1' }}>{addMessage}</div>}

                        <button className="auth-submit" style={{ gridColumn: '1 / -1', width: 'auto', padding: '11px 20px', justifySelf: 'start' }} type="submit" disabled={creating}>
                            {creating ? 'Creating...' : 'Create Employee Account'}
                        </button>
                    </form>
                </div>
            )}

            <input
                className="admin-search-input"
                style={{ margin: '20px 0' }}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, employee number, or email"
            />

            {error && <div className="admin-error-box">{error}</div>}

            {loading ? (
                <SkeletonList count={3} />
            ) : visibleEmployees.length === 0 ? (
                <div className="admin-empty">No employees found.</div>
            ) : (
                visibleEmployees.map((employee) => (
                    <div className="admin-list-card" key={employee.employee_id}>
                        <div className="admin-list-card-header">
                            <div>
                                <h3>{employee.name}</h3>
                                <p>{employee.employee_number} · {employee.position_title} · {employee.email}</p>
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

                        <div style={{ display: 'flex', gap: 16 }}>
                            <button
                                className="admin-link-button"
                                onClick={() => navigate(`/admin/employees/${employee.employee_id}`)}
                            >
                                Edit & assignments →
                            </button>

                            <button
                                className="admin-link-button"
                                style={{ color: employee.status === 'active' ? 'var(--red)' : 'var(--blue)' }}
                                onClick={() => toggleStatus(employee)}
                                disabled={updating === employee.employee_id}
                            >
                                {updating === employee.employee_id
                                    ? 'Updating...'
                                    : employee.status === 'active' ? 'Deactivate' : 'Activate'}
                            </button>

                            <button
                                className="admin-link-button"
                                style={{ color: 'var(--red)' }}
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
