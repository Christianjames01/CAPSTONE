import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activityLog'
import { describeChanges } from '../../lib/describeChanges'
import { notify, notifyError, notifyWarning, confirmModal } from '../../lib/notify'
import { SkeletonPageHeader, SkeletonDetailCard } from '../../components/Skeleton'
import Modal from '../../components/Modal'
import '../auth/Auth.css'
import './AdminPages.css'

function EmployeeDetails() {
    const { employeeId } = useParams()
    const navigate = useNavigate()

    const [employee, setEmployee] = useState(null)
    const [colleges, setColleges] = useState([])
    const [programs, setPrograms] = useState([])
    const [assignments, setAssignments] = useState([])
    const [requests, setRequests] = useState([])

    const [employeeNumber, setEmployeeNumber] = useState('')
    const [positionTitle, setPositionTitle] = useState('')
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

    useEffect(() => {
        loadEmployee()
    }, [employeeId])

    const loadEmployee = async () => {
        try {
            setLoading(true)
            setError('')

            const { data: employeeData, error: employeeError } = await supabase
                .from('employees')
                .select('employee_id, user_id, employee_number, position_title, assigned_college_id, status')
                .eq('employee_id', employeeId)
                .single()

            if (employeeError || !employeeData) {
                throw new Error('Employee could not be found.')
            }

            const { data: profile } = await supabase
                .from('profiles')
                .select('first_name, last_name, email, phone_number')
                .eq('user_id', employeeData.user_id)
                .single()

            setEmployee({ ...employeeData, ...profile })
            setEmployeeNumber(employeeData.employee_number)
            setPositionTitle(employeeData.position_title)
            setAssignedCollegeId(employeeData.assigned_college_id || '')

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
                        ? supabase.from('students').select('student_id, student_number').in('student_id', studentIds)
                        : Promise.resolve({ data: [] }),
                    documentTypeIds.length
                        ? supabase.from('document_types').select('document_type_id, document_name').in('document_type_id', documentTypeIds)
                        : Promise.resolve({ data: [] }),
                ])

                const studentNumberById = Object.fromEntries((studentRows || []).map((s) => [s.student_id, s.student_number]))
                const documentNameById = Object.fromEntries((documentTypeRows || []).map((d) => [d.document_type_id, d.document_name]))

                setRequests(
                    rows.map((r) => ({
                        ...r,
                        studentNumber: studentNumberById[r.student_id] || 'N/A',
                        documentName: documentNameById[r.document_type_id] || 'Document',
                    }))
                )
            }

        } catch (err) {
            console.error('EMPLOYEE DETAILS ERROR:', err)
            setError(err.message || 'Failed to load employee.')
        } finally {
            setLoading(false)
        }
    }

    const startEditing = () => {
        setForm({
            employeeNumber,
            positionTitle,
            assignedCollegeId,
        })
        setEditing(true)
    }

    const saveEmployee = async () => {
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
                    assigned_college_id: form.assignedCollegeId || null,
                    updated_at: new Date().toISOString(),
                })
                .eq('employee_id', employeeId)

            if (updateError) {
                throw new Error('Failed to update employee: ' + updateError.message)
            }

            const changes = describeChanges([
                ['employee number', employee.employee_number, form.employeeNumber.trim()],
                ['position', employee.position_title, form.positionTitle.trim()],
                ['assigned college', collegeName(employee.assigned_college_id), collegeName(form.assignedCollegeId || null)],
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
            setError(err.message || 'Failed to save employee.')
        } finally {
            setSaving(false)
        }
    }

    const addAssignment = async () => {
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
            notifyError(err.message || 'Failed to add assignment.')
        }
    }

    const removeAssignment = async (assignment) => {
        const confirmed = await confirmModal('Remove this assignment?')
        if (!confirmed) return

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

            await loadEmployee()

        } catch (err) {
            console.error('REMOVE ASSIGNMENT ERROR:', err)
            notifyError(err.message || 'Failed to remove assignment.')
        }
    }

    const collegeName = (id) => colleges.find((c) => c.college_id === id)?.college_name || 'N/A'
    const programName = (id) => programs.find((p) => p.program_id === id)?.program_name || 'N/A'
    const filteredPrograms = programs.filter((p) => !newCollegeId || p.college_id === newCollegeId)

    if (loading) {
        return (
            <div>
                <SkeletonPageHeader />
                <SkeletonDetailCard fields={6} />
                <SkeletonDetailCard fields={4} />
            </div>
        )
    }

    if (error && !employee) {
        return <div className="admin-error-box">{error}</div>
    }

    return (
        <div>
            <button className="admin-link-button" style={{ marginBottom: 16 }} onClick={() => navigate('/admin/employees')}>
                ← Back to Employees
            </button>

            <div className="admin-page-header">
                <h1>{employee.first_name} {employee.last_name}</h1>
                <p>{employee.email} · {employee.phone_number || 'No phone on file'}</p>
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
                    <div className="admin-info-field"><span>Assigned College</span><strong>{collegeName(assignedCollegeId || null)}</strong></div>
                </div>
            </div>

            {editing && form && (
                <Modal title="Edit Employment Information" onClose={() => !saving && setEditing(false)}>
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

                        <div style={{ display: 'flex', gap: 10 }}>
                            <button className="admin-primary-button" onClick={saveEmployee} disabled={saving}>
                                {saving ? 'Saving...' : 'Save changes'}
                            </button>
                            <button className="admin-link-button" style={{ color: 'var(--slate)' }} onClick={() => setEditing(false)} disabled={saving}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

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
                                    <strong>{r.requested_at ? new Date(r.requested_at).toLocaleDateString() : 'N/A'}</strong>
                                </div>
                            </div>

                            <button className="admin-link-button" onClick={() => navigate(`/admin/requests/${r.request_id}`)}>
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
