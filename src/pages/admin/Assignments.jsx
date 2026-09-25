import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activityLog'
import { notifyError, notifySuccess, notifyWarning, confirmModal } from '../../lib/notify'
import { SkeletonList } from '../../components/Skeleton'
import './AdminPages.css'

const OPEN_STATUSES = ['pending', 'payment_pending', 'receipt_uploaded', 'receipt_verified', 'processing', 'lacking_requirements', 'ready_for_claiming']

function Assignments() {
    const navigate = useNavigate()

    const [workload, setWorkload] = useState([])
    const [unassigned, setUnassigned] = useState([])
    const [employees, setEmployees] = useState([])
    const [assigning, setAssigning] = useState({})
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const [selectedIds, setSelectedIds] = useState(new Set())
    const [bulkEmployeeId, setBulkEmployeeId] = useState('')
    const [applyingBulk, setApplyingBulk] = useState(false)

    // College/program combos that have waiting requests but no employee
    // covering them, and the employee picked for each.
    const [uncoveredPrograms, setUncoveredPrograms] = useState([])
    const [coverPick, setCoverPick] = useState({})
    const [covering, setCovering] = useState(null)

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        try {
            setLoading(true)
            setError('')

            const { data: employeeRows, error: employeeError } = await supabase
                .from('employees')
                .select('employee_id, user_id, employee_number, position_title, status')
                .eq('status', 'active')

            if (employeeError) {
                throw new Error('Failed to load employees: ' + employeeError.message)
            }

            const userIds = [...new Set((employeeRows || []).map((e) => e.user_id))]

            const { data: profiles } = userIds.length
                ? await supabase.from('profiles').select('user_id, first_name, last_name').in('user_id', userIds)
                : { data: [] }

            const profileByUserId = Object.fromEntries((profiles || []).map((p) => [p.user_id, p]))

            const employeeList = (employeeRows || []).map((e) => ({
                ...e,
                name: profileByUserId[e.user_id]
                    ? `${profileByUserId[e.user_id].first_name} ${profileByUserId[e.user_id].last_name}`.trim()
                    : e.employee_number,
            }))

            setEmployees(employeeList)

            const { data: allRequests, error: requestError } = await supabase
                .from('document_requests')
                .select('request_id, request_number, student_id, document_type_id, assigned_employee_id, status, requested_at')

            if (requestError) {
                throw new Error('Failed to load requests: ' + requestError.message)
            }

            const openRequests = (allRequests || []).filter((r) => OPEN_STATUSES.includes(r.status))

            setWorkload(
                employeeList.map((e) => ({
                    ...e,
                    openCount: openRequests.filter((r) => r.assigned_employee_id === e.employee_id).length,
                }))
            )

            const unassignedRequests = openRequests.filter((r) => !r.assigned_employee_id)

            const studentIds = [...new Set(unassignedRequests.map((r) => r.student_id).filter(Boolean))]
            const documentTypeIds = [...new Set(unassignedRequests.map((r) => r.document_type_id).filter(Boolean))]

            const [{ data: students }, { data: documentTypes }] = await Promise.all([
                studentIds.length
                    ? supabase.from('students').select('student_id, student_number, college_id, program_id').in('student_id', studentIds)
                    : Promise.resolve({ data: [] }),
                documentTypeIds.length
                    ? supabase.from('document_types').select('document_type_id, document_name').in('document_type_id', documentTypeIds)
                    : Promise.resolve({ data: [] }),
            ])

            const studentById = Object.fromEntries((students || []).map((st) => [st.student_id, st]))
            const documentNameById = Object.fromEntries((documentTypes || []).map((d) => [d.document_type_id, d.document_name]))

            const collegeIds = [...new Set((students || []).map((st) => st.college_id).filter(Boolean))]
            const programIds = [...new Set((students || []).map((st) => st.program_id).filter(Boolean))]

            const [{ data: colleges }, { data: programs }, { data: coverRows }] = await Promise.all([
                collegeIds.length
                    ? supabase.from('colleges').select('college_id, college_name').in('college_id', collegeIds)
                    : Promise.resolve({ data: [] }),
                programIds.length
                    ? supabase.from('programs').select('program_id, program_name').in('program_id', programIds)
                    : Promise.resolve({ data: [] }),
                programIds.length
                    ? supabase.from('employee_assignments').select('college_id, program_id').eq('is_primary', true).eq('status', 'active').in('program_id', programIds)
                    : Promise.resolve({ data: [] }),
            ])

            const collegeName = Object.fromEntries((colleges || []).map((c) => [c.college_id, c.college_name]))
            const programName = Object.fromEntries((programs || []).map((p) => [p.program_id, p.program_name]))
            const covered = new Set((coverRows || []).map((a) => `${a.college_id}:${a.program_id}`))

            const unassignedList = unassignedRequests.map((r) => {
                const st = studentById[r.student_id]
                return {
                    ...r,
                    studentNumber: st?.student_number || 'N/A',
                    documentName: documentNameById[r.document_type_id] || 'Document',
                    collegeId: st?.college_id || null,
                    programId: st?.program_id || null,
                    programLabel: [programName[st?.program_id], collegeName[st?.college_id]].filter(Boolean).join(' · ') || 'No program on file',
                    programCovered: !!(st && covered.has(`${st.college_id}:${st.program_id}`)),
                }
            })

            setUnassigned(unassignedList)

            // Group waiting requests whose college/program has no employee yet.
            const groups = {}
            for (const r of unassignedList) {
                if (r.programCovered || !r.collegeId || !r.programId) continue
                const key = `${r.collegeId}:${r.programId}`
                if (!groups[key]) {
                    groups[key] = {
                        key,
                        collegeId: r.collegeId,
                        programId: r.programId,
                        programName: programName[r.programId] || 'Program',
                        collegeName: collegeName[r.collegeId] || 'College',
                        requestIds: [],
                    }
                }
                groups[key].requestIds.push(r.request_id)
            }
            setUncoveredPrograms(Object.values(groups).sort((a, b) => b.requestIds.length - a.requestIds.length))

        } catch (err) {
            console.error('ASSIGNMENTS ERROR:', err)
            setError(err.message || 'Failed to load assignment data.')
        } finally {
            setLoading(false)
        }
    }

    // Makes the picked employee the primary for this college/program (so
    // future requests route to them automatically) and assigns every request
    // that was waiting for it.
    const coverProgram = async (group) => {
        const employeeId = coverPick[group.key]

        if (!employeeId) {
            notifyWarning('Please select an employee first.')
            return
        }

        const employee = employees.find((e) => e.employee_id === employeeId)

        const confirmed = await confirmModal(
            `Assign ${employee?.name || 'this employee'} to ${group.programName} (${group.collegeName})? They'll handle future requests from this program, and the ${group.requestIds.length} waiting request${group.requestIds.length === 1 ? '' : 's'} will be assigned to them now.`,
            { title: 'Assign employee to program?', confirmButtonText: 'Assign', icon: 'question' }
        )
        if (!confirmed) return

        try {
            setCovering(group.key)

            const { data: { user } } = await supabase.auth.getUser()

            const { error: assignmentError } = await supabase
                .from('employee_assignments')
                .insert({
                    employee_id: employeeId,
                    college_id: group.collegeId,
                    program_id: group.programId,
                    is_primary: true,
                    status: 'active',
                })

            if (assignmentError) {
                throw new Error('Failed to assign the program: ' + assignmentError.message)
            }

            const { error: requestError } = await supabase
                .from('document_requests')
                .update({ assigned_employee_id: employeeId, updated_at: new Date().toISOString() })
                .in('request_id', group.requestIds)
                .is('assigned_employee_id', null)

            if (requestError) {
                throw new Error('The program was assigned, but its waiting requests could not be: ' + requestError.message)
            }

            await logActivity({
                userId: user?.id,
                action: 'assign_program_to_employee',
                tableName: 'employee_assignments',
                recordId: null,
                description: `Assigned "${employee?.name || employeeId}" to ${group.programName} (${group.collegeName}) and gave them ${group.requestIds.length} waiting request(s).`,
            })

            notifySuccess(`${employee?.name || 'The employee'} now handles ${group.programName}.`)
            await loadData()
        } catch (err) {
            console.error('COVER PROGRAM ERROR:', err)
            notifyError(err.message || 'Failed to assign the program.')
        } finally {
            setCovering(null)
        }
    }

    const assignRequest = async (request) => {
        const employeeId = assigning[request.request_id]

        if (!employeeId) {
            notifyWarning('Please select an employee first.')
            return
        }

        const employeeName = employees.find((e) => e.employee_id === employeeId)?.name || 'this employee'

        const confirmed = await confirmModal(
            `Assign request "${request.request_number}" to ${employeeName}?`
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

            const { error: updateError } = await supabase
                .from('document_requests')
                .update({ assigned_employee_id: employeeId, updated_at: new Date().toISOString() })
                .eq('request_id', request.request_id)

            if (updateError) {
                throw new Error('Failed to assign request: ' + updateError.message)
            }

            const employee = employees.find((e) => e.employee_id === employeeId)

            await logActivity({
                userId: user.id,
                action: 'assign_request',
                tableName: 'document_requests',
                recordId: request.request_id,
                description: `Assigned request "${request.request_number}" to "${employee?.name || employeeId}".`,
            })

            await loadData()

        } catch (err) {
            console.error('ASSIGN REQUEST ERROR:', err)
            notifyError(err.message || 'Failed to assign request.')
        }
    }

    const allSelected = unassigned.length > 0 && unassigned.every((r) => selectedIds.has(r.request_id))

    const toggleSelected = (requestId) => {
        setSelectedIds((prev) => {
            const next = new Set(prev)
            if (next.has(requestId)) next.delete(requestId)
            else next.add(requestId)
            return next
        })
    }

    const toggleSelectAll = () => {
        setSelectedIds((prev) => {
            if (allSelected) return new Set()
            return new Set(unassigned.map((r) => r.request_id))
        })
    }

    const clearSelection = () => setSelectedIds(new Set())

    const applyBulkAssign = async () => {
        if (!bulkEmployeeId) {
            notifyWarning('Please select an employee first.')
            return
        }

        const targets = unassigned.filter((r) => selectedIds.has(r.request_id))
        if (targets.length === 0) return

        const employee = employees.find((e) => e.employee_id === bulkEmployeeId)

        const confirmed = await confirmModal(
            `Assign ${targets.length} selected request(s) to ${employee?.name || 'this employee'}?`
        )
        if (!confirmed) return

        try {
            setApplyingBulk(true)

            const {
                data: { user },
                error: userError
            } = await supabase.auth.getUser()

            if (userError || !user) {
                throw new Error('You are not logged in.')
            }

            const requestIds = targets.map((r) => r.request_id)

            const { error: updateError } = await supabase
                .from('document_requests')
                .update({ assigned_employee_id: bulkEmployeeId, updated_at: new Date().toISOString() })
                .in('request_id', requestIds)

            if (updateError) {
                throw new Error('Failed to assign requests: ' + updateError.message)
            }

            await Promise.all(
                targets.map((r) =>
                    logActivity({
                        userId: user.id,
                        action: 'assign_request',
                        tableName: 'document_requests',
                        recordId: r.request_id,
                        description: `Bulk-assigned request "${r.request_number}" to "${employee?.name || bulkEmployeeId}".`,
                    })
                )
            )

            notifySuccess(`${targets.length} request(s) assigned to ${employee?.name || 'the employee'}.`)
            clearSelection()
            setBulkEmployeeId('')
            await loadData()

        } catch (err) {
            console.error('BULK ASSIGN ERROR:', err)
            notifyError(err.message || 'Failed to assign selected requests.')
        } finally {
            setApplyingBulk(false)
        }
    }

    return (
        <div>
            <div className="admin-page-header">
                <h1>Request Assignments</h1>
                <p>Assign requests to employees and monitor current workloads.</p>
            </div>

            {error && <div className="admin-error-box">{error}</div>}

            <h2 style={{ fontSize: 17, marginBottom: 14 }}>Employee Workload</h2>

            {loading ? (
                <SkeletonList count={3} />
            ) : (
                <div className="admin-table-wrapper" style={{ marginBottom: 28 }}>
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Employee</th>
                                <th>Position</th>
                                <th>Open Requests</th>
                            </tr>
                        </thead>
                        <tbody>
                            {workload.map((e) => (
                                <tr key={e.employee_id}>
                                    <td>{e.name}</td>
                                    <td>{e.position_title}</td>
                                    <td>{e.openCount}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {!loading && uncoveredPrograms.length > 0 && (
                <>
                    <h2 style={{ fontSize: 17, marginBottom: 6 }}>Programs Without an Employee</h2>
                    <p style={{ fontSize: 13, marginBottom: 14 }}>
                        Students from these programs submitted requests, but no employee is assigned to their college and
                        program. Pick an employee to cover the program — they'll get its waiting requests now and future
                        ones automatically.
                    </p>

                    {uncoveredPrograms.map((group) => (
                        <div className="admin-list-card" key={group.key} style={{ borderLeft: '4px solid var(--warning-text, #B45309)' }}>
                            <div className="admin-list-card-header">
                                <div>
                                    <h3>{group.programName}</h3>
                                    <p>{group.collegeName}</p>
                                </div>
                                <span className="admin-status-pill status-pending">
                                    {group.requestIds.length} waiting
                                </span>
                            </div>

                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                                <select
                                    className="admin-search-input"
                                    style={{ maxWidth: 260 }}
                                    value={coverPick[group.key] || ''}
                                    onChange={(e) => setCoverPick((prev) => ({ ...prev, [group.key]: e.target.value }))}
                                    disabled={covering === group.key}
                                >
                                    <option value="">-- Select employee --</option>
                                    {employees.map((e) => (
                                        <option key={e.employee_id} value={e.employee_id}>
                                            {e.name} ({e.openCount ?? 0} open)
                                        </option>
                                    ))}
                                </select>

                                <button className="admin-primary-button" onClick={() => coverProgram(group)} disabled={covering === group.key}>
                                    {covering === group.key ? 'Assigning...' : 'Assign to program'}
                                </button>
                            </div>
                        </div>
                    ))}

                    <div style={{ marginBottom: 28 }} />
                </>
            )}

            <h2 style={{ fontSize: 17, marginBottom: 14 }}>Unassigned Requests</h2>

            {!loading && unassigned.length > 0 && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--slate)', marginBottom: 12, cursor: 'pointer' }}>
                    <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
                    Select all {unassigned.length} unassigned
                </label>
            )}

            {!loading && unassigned.length === 0 ? (
                <div className="admin-empty">All requests currently have an assigned employee.</div>
            ) : (
                unassigned.map((request) => (
                    <div className="admin-list-card" key={request.request_id}>
                        <div className="admin-list-card-header">
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                <input
                                    type="checkbox"
                                    checked={selectedIds.has(request.request_id)}
                                    onChange={() => toggleSelected(request.request_id)}
                                    style={{ marginTop: 4 }}
                                />
                                <div>
                                    <h3>{request.documentName}</h3>
                                    <p>{request.request_number} · Student {request.studentNumber}</p>
                                    <p style={{ marginTop: 2 }}>
                                        {request.programLabel}
                                        {!request.programCovered && (
                                            <span style={{ marginLeft: 8, fontWeight: 600, color: 'var(--warning-text, #B45309)' }}>
                                                · No employee for this program
                                            </span>
                                        )}
                                    </p>
                                </div>
                            </div>

                            <span className={`admin-status-pill status-${request.status}`}>
                                {request.status.replace(/_/g, ' ')}
                            </span>
                        </div>

                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                            <select
                                className="admin-search-input"
                                style={{ maxWidth: 260 }}
                                value={assigning[request.request_id] || ''}
                                onChange={(e) =>
                                    setAssigning((prev) => ({ ...prev, [request.request_id]: e.target.value }))
                                }
                            >
                                <option value="">-- Select employee --</option>
                                {employees.map((e) => (
                                    <option key={e.employee_id} value={e.employee_id}>
                                        {e.name} ({e.openCount ?? 0} open)
                                    </option>
                                ))}
                            </select>

                            <button className="admin-primary-button" onClick={() => assignRequest(request)}>
                                Assign
                            </button>

                            <button className="admin-link-button" onClick={() => navigate(`/admin/requests/${request.request_id}`)}>
                                Open request →
                            </button>
                        </div>
                    </div>
                ))
            )}

            {selectedIds.size > 0 && (
                <div style={{
                    position: 'sticky',
                    bottom: 16,
                    marginTop: 16,
                    background: 'var(--blue-dark)',
                    color: 'var(--white)',
                    borderRadius: 12,
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    flexWrap: 'wrap',
                    boxShadow: '0 12px 32px rgba(16, 24, 39, 0.25)',
                }}>
                    <strong style={{ fontSize: 13.5 }}>{selectedIds.size} selected</strong>

                    <select
                        className="admin-search-input"
                        style={{ maxWidth: 260 }}
                        value={bulkEmployeeId}
                        onChange={(e) => setBulkEmployeeId(e.target.value)}
                        disabled={applyingBulk}
                    >
                        <option value="">-- Select employee --</option>
                        {employees.map((e) => (
                            <option key={e.employee_id} value={e.employee_id}>
                                {e.name} ({e.openCount ?? 0} open)
                            </option>
                        ))}
                    </select>

                    <button className="admin-primary-button" onClick={applyBulkAssign} disabled={applyingBulk}>
                        {applyingBulk ? 'Assigning...' : 'Assign selected'}
                    </button>

                    <button
                        className="admin-secondary-button admin-bulkbar-button"
                        onClick={clearSelection}
                        disabled={applyingBulk}
                    >
                        Clear selection
                    </button>
                </div>
            )}
        </div>
    )
}

export default Assignments
