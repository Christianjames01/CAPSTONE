import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useLiveRefresh } from '../../lib/useLiveRefresh'
import { formatDisplayDateTime } from '../../lib/formatDate'
import { logActivity } from '../../lib/activityLog'
import { notifyError, notifySuccess, notifyWarning, confirmModal } from '../../lib/notify'
import { SkeletonList } from '../../components/Skeleton'
import { loadStudentsById } from '../../lib/studentNames'
import { MOVABLE_STATUSES, averageLoad, isOverloaded, suggestRebalance } from '../../lib/workloadBalance'
import './AdminPages.css'
import './Assignments.css'

const initialsOf = (name) =>
    (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || '?'

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

    // Rebalancing: open requests that already have an employee, the
    // employee whose requests are expanded, and what's picked to move.
    const [assignedOpen, setAssignedOpen] = useState([])
    const [expandedEmployeeId, setExpandedEmployeeId] = useState(null)
    const [moveSelected, setMoveSelected] = useState(new Set())
    const [moveTargetId, setMoveTargetId] = useState('')
    const [moving, setMoving] = useState(false)

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async ({ silent = false } = {}) => {
        try {
            if (!silent) setLoading(true)
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

            const studentIds = [...new Set(openRequests.map((r) => r.student_id).filter(Boolean))]
            const documentTypeIds = [...new Set(openRequests.map((r) => r.document_type_id).filter(Boolean))]

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

            const assignedRequests = openRequests.filter((r) => r.assigned_employee_id)
            const studentInfo = await loadStudentsById(assignedRequests.map((r) => r.student_id))

            setAssignedOpen(
                assignedRequests
                    .map((r) => ({
                        ...r,
                        studentName: studentInfo[r.student_id]?.name || 'Student',
                        studentNumber: studentInfo[r.student_id]?.number || 'N/A',
                        documentName: documentNameById[r.document_type_id] || 'Document',
                    }))
                    .sort((a, b) => new Date(a.requested_at) - new Date(b.requested_at))
            )

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

    // Update in place when requests change -- no manual refresh needed.
    useLiveRefresh(['document_requests'], loadData)

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

    // ---- Rebalancing -------------------------------------------------------

    const average = averageLoad(workload.map((e) => e.openCount))
    const suggestedMoves = useMemo(() => suggestRebalance(employees, assignedOpen), [employees, assignedOpen])
    const nameOfEmployee = (id) => employees.find((e) => e.employee_id === id)?.name || 'Employee'

    const toggleExpanded = (employeeId) => {
        setExpandedEmployeeId((prev) => (prev === employeeId ? null : employeeId))
        setMoveSelected(new Set())
        setMoveTargetId('')
    }

    const toggleMoveSelected = (requestId) => {
        setMoveSelected((prev) => {
            const next = new Set(prev)
            if (next.has(requestId)) next.delete(requestId)
            else next.add(requestId)
            return next
        })
    }

    // Moves requests to other employees. `moves` is [{ request, toId }].
    // Each update only matches rows still assigned to the employee we saw,
    // so a request someone else reassigned meanwhile is left alone.
    const moveRequests = async (moves) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('You are not logged in.')

        const groups = {}
        for (const m of moves) {
            const key = `${m.request.assigned_employee_id}>${m.toId}`
            if (!groups[key]) groups[key] = { fromId: m.request.assigned_employee_id, toId: m.toId, requests: [] }
            groups[key].requests.push(m.request)
        }

        let movedCount = 0

        for (const g of Object.values(groups)) {
            const { data: updatedRows, error: updateError } = await supabase
                .from('document_requests')
                .update({ assigned_employee_id: g.toId, updated_at: new Date().toISOString() })
                .in('request_id', g.requests.map((r) => r.request_id))
                .eq('assigned_employee_id', g.fromId)
                .select('request_id')

            if (updateError) throw new Error('Failed to move requests: ' + updateError.message)

            const movedIds = new Set((updatedRows || []).map((r) => r.request_id))
            movedCount += movedIds.size

            await Promise.all(
                g.requests
                    .filter((r) => movedIds.has(r.request_id))
                    .map((r) =>
                        logActivity({
                            userId: user.id,
                            action: 'reassign_request',
                            tableName: 'document_requests',
                            recordId: r.request_id,
                            description: `Reassigned request "${r.request_number}" from "${nameOfEmployee(g.fromId)}" to "${nameOfEmployee(g.toId)}" (workload rebalance).`,
                        })
                    )
            )
        }

        return movedCount
    }

    const reportMoved = (movedCount, expected) => {
        if (movedCount === 0) {
            notifyError('No requests were moved. They may have changed in the meantime, or your account may not have permission to reassign them.')
        } else if (movedCount < expected) {
            notifyWarning(`${movedCount} of ${expected} request(s) moved. The rest changed in the meantime.`)
        } else {
            notifySuccess(`${movedCount} request(s) moved.`)
        }
    }

    const moveSelectedRequests = async () => {
        if (!moveTargetId) {
            notifyWarning('Please select the employee to move them to.')
            return
        }

        const targets = assignedOpen.filter((r) => moveSelected.has(r.request_id))
        if (targets.length === 0) return

        const confirmed = await confirmModal(
            `Move ${targets.length} request(s) from ${nameOfEmployee(expandedEmployeeId)} to ${nameOfEmployee(moveTargetId)}?`,
            { title: 'Move requests?', confirmButtonText: 'Move', icon: 'question' }
        )
        if (!confirmed) return

        try {
            setMoving(true)
            const movedCount = await moveRequests(targets.map((request) => ({ request, toId: moveTargetId })))
            reportMoved(movedCount, targets.length)
            setMoveSelected(new Set())
            setMoveTargetId('')
            await loadData()
        } catch (err) {
            console.error('MOVE REQUESTS ERROR:', err)
            notifyError(err.message || 'Failed to move requests.')
        } finally {
            setMoving(false)
        }
    }

    const applySuggestedMoves = async () => {
        if (suggestedMoves.length === 0) return

        const confirmed = await confirmModal(
            `Apply ${suggestedMoves.length} suggested move(s) to even out the workload?`,
            { title: 'Rebalance workload?', confirmButtonText: 'Apply', icon: 'question' }
        )
        if (!confirmed) return

        try {
            setMoving(true)
            const movedCount = await moveRequests(suggestedMoves.map((m) => ({ request: m.request, toId: m.toId })))
            reportMoved(movedCount, suggestedMoves.length)
            await loadData()
        } catch (err) {
            console.error('REBALANCE ERROR:', err)
            notifyError(err.message || 'Failed to rebalance the workload.')
        } finally {
            setMoving(false)
        }
    }

    const expandedRequests = assignedOpen.filter((r) => r.assigned_employee_id === expandedEmployeeId)

    const maxLoad = Math.max(1, ...workload.map((e) => e.openCount))
    const overloadedCount = workload.filter((e) => isOverloaded(e.openCount, average, workload.length)).length

    // Not started (movable) vs already in progress, per employee.
    const breakdownByEmployee = {}
    for (const r of assignedOpen) {
        const b = breakdownByEmployee[r.assigned_employee_id] || (breakdownByEmployee[r.assigned_employee_id] = { notStarted: 0, inProgress: 0 })
        if (MOVABLE_STATUSES.includes(r.status)) b.notStarted += 1
        else b.inProgress += 1
    }

    // Each employee's open count after the suggested moves.
    const afterLoad = Object.fromEntries(workload.map((e) => [e.employee_id, e.openCount]))
    for (const m of suggestedMoves) {
        afterLoad[m.fromId] -= 1
        afterLoad[m.toId] += 1
    }

    const selectNotStarted = () => {
        setMoveSelected(new Set(expandedRequests.filter((r) => MOVABLE_STATUSES.includes(r.status)).map((r) => r.request_id)))
    }

    return (
        <div>
            <div className="admin-page-header">
                <h1>Request Assignments</h1>
                <p>Assign requests to employees and monitor current workloads.</p>
            </div>

            {error && <div className="admin-error-box">{error}</div>}

            {!loading && (
                <div className="rb-summary">
                    <div className="rb-stat">
                        <span>Open requests</span>
                        <strong>{assignedOpen.length + unassigned.length}</strong>
                    </div>
                    <div className={`rb-stat${unassigned.length > 0 ? ' is-warn' : ''}`}>
                        <span>Unassigned</span>
                        <strong>{unassigned.length}</strong>
                    </div>
                    <div className="rb-stat">
                        <span>Team average</span>
                        <strong>{average.toFixed(1)}</strong>
                    </div>
                    <div className={`rb-stat${overloadedCount > 0 ? ' is-danger' : ''}`}>
                        <span>Overloaded</span>
                        <strong>{overloadedCount}</strong>
                    </div>
                </div>
            )}

            <section className="rb-section">
                <div className="rb-section-head">
                    <div>
                        <h2>Employee workload</h2>
                        <p>Open requests per active employee. Open an employee to move some of their requests to someone else.</p>
                    </div>
                </div>

                {loading ? (
                    <SkeletonList count={2} />
                ) : workload.length === 0 ? (
                    <div className="admin-empty">No active employees yet.</div>
                ) : (
                    <div className="rb-grid">
                        {workload.map((e) => {
                            const heavy = isOverloaded(e.openCount, average, workload.length)
                            const light = workload.length > 1 && e.openCount < average - 1
                            const breakdown = breakdownByEmployee[e.employee_id] || { notStarted: 0, inProgress: 0 }
                            const open = expandedEmployeeId === e.employee_id

                            return (
                                <article key={e.employee_id} className={`rb-card${open ? ' is-open' : ''}${heavy ? ' is-heavy' : ''}`}>
                                    <header className="rb-card-head">
                                        <span className="rb-avatar" aria-hidden="true">{initialsOf(e.name)}</span>
                                        <div className="rb-card-title">
                                            <strong>{e.name}</strong>
                                            <span>{e.position_title || 'Employee'}</span>
                                        </div>
                                        {heavy ? (
                                            <span className="rb-badge is-danger">Overloaded</span>
                                        ) : light ? (
                                            <span className="rb-badge is-light">Has capacity</span>
                                        ) : workload.length > 1 ? (
                                            <span className="rb-badge">Balanced</span>
                                        ) : null}
                                    </header>

                                    <div className="rb-load">
                                        <strong>{e.openCount}</strong>
                                        <span>open request{e.openCount === 1 ? '' : 's'}</span>
                                    </div>

                                    <div className="rb-bar" aria-hidden="true">
                                        <span style={{ width: `${(e.openCount / maxLoad) * 100}%` }} />
                                        {workload.length > 1 && average > 0 && (
                                            <i style={{ left: `${Math.min(100, (average / maxLoad) * 100)}%` }} title="Team average" />
                                        )}
                                    </div>

                                    <p className="rb-breakdown">
                                        {breakdown.notStarted} not started · {breakdown.inProgress} in progress
                                    </p>

                                    <button
                                        type="button"
                                        className="rb-card-action"
                                        onClick={() => toggleExpanded(e.employee_id)}
                                        disabled={e.openCount === 0}
                                        aria-expanded={open}
                                    >
                                        {e.openCount === 0 ? 'No open requests' : open ? 'Close' : 'Manage requests'}
                                    </button>
                                </article>
                            )
                        })}
                    </div>
                )}

                {!loading && expandedEmployeeId && (
                    <div className="rb-panel">
                        <div className="rb-panel-head">
                            <div>
                                <h3>{nameOfEmployee(expandedEmployeeId)}’s open requests</h3>
                                <p>Select the requests to move, then choose who takes them.</p>
                            </div>
                            <button type="button" className="rb-close" onClick={() => toggleExpanded(expandedEmployeeId)} aria-label="Close">
                                ×
                            </button>
                        </div>

                        {expandedRequests.length === 0 ? (
                            <p className="rb-muted">No open requests.</p>
                        ) : (
                            <>
                                <div className="rb-select-tools">
                                    <button type="button" onClick={selectNotStarted} disabled={moving}>Select not started</button>
                                    <button type="button" onClick={() => setMoveSelected(new Set())} disabled={moving || moveSelected.size === 0}>Clear</button>
                                </div>

                                <ul className="rb-requests">
                                    {expandedRequests.map((r) => {
                                        const checked = moveSelected.has(r.request_id)
                                        const started = !MOVABLE_STATUSES.includes(r.status)
                                        return (
                                            <li key={r.request_id}>
                                                <label className={`rb-request${checked ? ' is-checked' : ''}`}>
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={() => toggleMoveSelected(r.request_id)}
                                                        disabled={moving}
                                                    />
                                                    <span className="rb-request-main">
                                                        <strong>{r.documentName}</strong>
                                                        <span>
                                                            {r.request_number} · {r.studentName} ({r.studentNumber})
                                                        </span>
                                                        <span>
                                                            {r.requested_at && `Requested ${formatDisplayDateTime(r.requested_at)}`}
                                                            {started && <em> · already in progress</em>}
                                                        </span>
                                                    </span>
                                                    <span className={`admin-status-pill status-${r.status}`}>
                                                        {r.status.replace(/_/g, ' ')}
                                                    </span>
                                                </label>
                                            </li>
                                        )
                                    })}
                                </ul>
                            </>
                        )}

                        {workload.length < 2 ? (
                            <p className="rb-note">There’s no other active employee to move requests to yet.</p>
                        ) : (
                            <div className="rb-movebar">
                                <span className="rb-movebar-count">
                                    <strong>{moveSelected.size}</strong> selected
                                </span>
                                <span className="rb-movebar-arrow" aria-hidden="true">→</span>
                                <select
                                    className="admin-search-input"
                                    value={moveTargetId}
                                    onChange={(e) => setMoveTargetId(e.target.value)}
                                    disabled={moving}
                                    aria-label="Move to employee"
                                >
                                    <option value="">Move to…</option>
                                    {workload
                                        .filter((e) => e.employee_id !== expandedEmployeeId)
                                        .map((e) => (
                                            <option key={e.employee_id} value={e.employee_id}>
                                                {e.name} ({e.openCount} open)
                                            </option>
                                        ))}
                                </select>
                                <button
                                    className="admin-primary-button"
                                    onClick={moveSelectedRequests}
                                    disabled={moving || moveSelected.size === 0 || !moveTargetId}
                                >
                                    {moving ? 'Moving...' : 'Move requests'}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </section>

            {!loading && (
                <section className="rb-section rb-suggest">
                    <div className="rb-section-head">
                        <div>
                            <h2>Suggested rebalance</h2>
                            <p>
                                Moves the newest not-yet-started requests from the busiest employees to the least busy,
                                until everyone is within one request of each other. Requests already in progress stay put.
                            </p>
                        </div>
                        {workload.length > 1 && suggestedMoves.length > 0 && (
                            <button className="admin-primary-button" onClick={applySuggestedMoves} disabled={moving}>
                                {moving ? 'Moving...' : `Apply ${suggestedMoves.length} move${suggestedMoves.length === 1 ? '' : 's'}`}
                            </button>
                        )}
                    </div>

                    {workload.length < 2 ? (
                        <div className="rb-state">
                            <span className="rb-state-icon" aria-hidden="true">i</span>
                            <div>
                                <strong>Only one active employee</strong>
                                <p>Add another employee to share the workload — suggestions will appear here.</p>
                            </div>
                        </div>
                    ) : suggestedMoves.length === 0 ? (
                        <div className="rb-state is-good">
                            <span className="rb-state-icon" aria-hidden="true">✓</span>
                            <div>
                                <strong>The workload is balanced</strong>
                                <p>Nobody has more than one request above anyone else that could be moved.</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="rb-preview">
                                {workload
                                    .filter((e) => (afterLoad[e.employee_id] ?? e.openCount) !== e.openCount)
                                    .map((e) => {
                                        const after = afterLoad[e.employee_id] ?? e.openCount
                                        return (
                                            <div key={e.employee_id} className="rb-preview-item">
                                                <span className="rb-avatar is-small" aria-hidden="true">{initialsOf(e.name)}</span>
                                                <span className="rb-preview-name">{e.name}</span>
                                                <span className="rb-preview-counts">
                                                    {e.openCount} <span aria-hidden="true">→</span> <strong className={after < e.openCount ? 'is-down' : 'is-up'}>{after}</strong>
                                                </span>
                                            </div>
                                        )
                                    })}
                            </div>

                            <ul className="rb-moves">
                                {suggestedMoves.map((m) => (
                                    <li key={m.request.request_id} className="rb-move">
                                        <div className="rb-move-main">
                                            <strong>{m.request.documentName}</strong>
                                            <span>
                                                {m.request.request_number} · {m.request.studentName}
                                                {m.request.requested_at && ` · ${formatDisplayDateTime(m.request.requested_at)}`}
                                            </span>
                                        </div>
                                        <div className="rb-move-route">
                                            <span className="rb-chip">{m.fromName}</span>
                                            <span className="rb-move-arrow" aria-hidden="true">→</span>
                                            <span className="rb-chip is-to">{m.toName}</span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </section>
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
                                    <p>{request.request_number} · Student {request.studentNumber}{request.requested_at && ` · Requested ${formatDisplayDateTime(request.requested_at)}`}</p>
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
