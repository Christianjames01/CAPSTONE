import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { exportToExcel } from '../../lib/excelExport'
import { notifyError, notifyWarning } from '../../lib/notify'
import { SkeletonPageHeader, SkeletonStatGrid } from '../../components/Skeleton'
import './AdminPages.css'

// Days between a request being submitted and marked completed, or null
// if either timestamp is missing (not yet completed).
const turnaroundDays = (r) => {
    if (!r.completed_at || !r.requested_at) return null
    const ms = new Date(r.completed_at).getTime() - new Date(r.requested_at).getTime()
    return ms / (1000 * 60 * 60 * 24)
}

const average = (nums) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null)

// Shows the smallest sensible unit -- minutes/hours for fast turnarounds
// instead of a confusing fraction of a day like "0.3d".
const formatTurnaround = (days) => {
    if (days === null) return 'N/A'

    const totalMinutes = days * 24 * 60

    if (totalMinutes < 60) return `${Math.round(totalMinutes)}m`
    if (days < 1) return `${(totalMinutes / 60).toFixed(1)}h`
    return `${days.toFixed(1)}d`
}

function Reports() {
    const [requests, setRequests] = useState([])
    const [schedules, setSchedules] = useState([])
    const [employeePerformance, setEmployeePerformance] = useState([])
    const [documentBreakdown, setDocumentBreakdown] = useState([])
    const [documentTurnaround, setDocumentTurnaround] = useState([])
    const [avgTurnaroundDays, setAvgTurnaroundDays] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [exporting, setExporting] = useState(false)

    useEffect(() => {
        loadReports()
    }, [])

    const loadReports = async () => {
        try {
            setLoading(true)
            setError('')

            const { data: requestRows, error: requestError } = await supabase
                .from('document_requests')
                .select('request_id, document_type_id, assigned_employee_id, status, total_amount, requested_at, completed_at')

            if (requestError) {
                throw new Error('Failed to load requests: ' + requestError.message)
            }

            setRequests(requestRows || [])

            const { data: scheduleRows, error: scheduleError } = await supabase
                .from('claim_schedules')
                .select('claim_schedule_id, status')

            if (scheduleError) {
                throw new Error('Failed to load claim schedules: ' + scheduleError.message)
            }

            setSchedules(scheduleRows || [])

            const { data: employeeRows } = await supabase
                .from('employees')
                .select('employee_id, user_id, employee_number, status')
                .eq('status', 'active')

            const userIds = [...new Set((employeeRows || []).map((e) => e.user_id))]

            const { data: profiles } = userIds.length
                ? await supabase.from('profiles').select('user_id, first_name, last_name').in('user_id', userIds)
                : { data: [] }

            const profileByUserId = Object.fromEntries((profiles || []).map((p) => [p.user_id, p]))

            const performance = (employeeRows || []).map((e) => {
                const assigned = (requestRows || []).filter((r) => r.assigned_employee_id === e.employee_id)
                const completed = assigned.filter((r) => r.status === 'completed')
                const rejected = assigned.filter((r) => r.status === 'rejected')

                return {
                    employee_id: e.employee_id,
                    name: profileByUserId[e.user_id]
                        ? `${profileByUserId[e.user_id].first_name} ${profileByUserId[e.user_id].last_name}`.trim()
                        : e.employee_number,
                    assignedCount: assigned.length,
                    completedCount: completed.length,
                    rejectedCount: rejected.length,
                    avgTurnaroundDays: average(completed.map(turnaroundDays).filter((d) => d !== null)),
                }
            })

            setEmployeePerformance(performance.sort((a, b) => b.completedCount - a.completedCount))

            const documentTypeIds = [...new Set((requestRows || []).map((r) => r.document_type_id).filter(Boolean))]

            const { data: documentTypes } = documentTypeIds.length
                ? await supabase.from('document_types').select('document_type_id, document_name').in('document_type_id', documentTypeIds)
                : { data: [] }

            const documentNameById = Object.fromEntries((documentTypes || []).map((d) => [d.document_type_id, d.document_name]))

            const counts = {}
            for (const r of requestRows || []) {
                const name = documentNameById[r.document_type_id] || 'Unknown'
                counts[name] = (counts[name] || 0) + 1
            }

            setDocumentBreakdown(
                Object.entries(counts)
                    .map(([name, count]) => ({ name, count }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 10)
            )

            const completedRequests = (requestRows || []).filter((r) => r.status === 'completed')

            setAvgTurnaroundDays(average(completedRequests.map(turnaroundDays).filter((d) => d !== null)))

            const turnaroundByDoc = {}
            for (const r of completedRequests) {
                const days = turnaroundDays(r)
                if (days === null) continue

                const name = documentNameById[r.document_type_id] || 'Unknown'
                if (!turnaroundByDoc[name]) turnaroundByDoc[name] = []
                turnaroundByDoc[name].push(days)
            }

            setDocumentTurnaround(
                Object.entries(turnaroundByDoc)
                    .map(([name, days]) => ({ name, count: days.length, avgDays: average(days) }))
                    .sort((a, b) => b.avgDays - a.avgDays)
            )

        } catch (err) {
            console.error('REPORTS ERROR:', err)
            setError(err.message || 'Failed to load reports.')
        } finally {
            setLoading(false)
        }
    }

    // Shared loader: pulls every request plus the student/document/employee
    // details needed to build a detail row, used by both export buttons.
    const loadDetailedRequestRows = async () => {
        const { data: fullRequests, error: requestError } = await supabase
            .from('document_requests')
            .select(`
                request_id, request_number, document_type_id, student_id,
                assigned_employee_id, status, priority, total_amount,
                requested_at, completed_at
            `)
            .order('requested_at', { ascending: false })

        if (requestError) {
            throw new Error('Failed to load requests for export: ' + requestError.message)
        }

        const rows = fullRequests || []

        const documentTypeIds = [...new Set(rows.map((r) => r.document_type_id).filter(Boolean))]
        const studentIds = [...new Set(rows.map((r) => r.student_id).filter(Boolean))]
        const employeeIds = [...new Set(rows.map((r) => r.assigned_employee_id).filter(Boolean))]

        const [{ data: documentTypes }, { data: students }, { data: employees }] = await Promise.all([
            documentTypeIds.length
                ? supabase.from('document_types').select('document_type_id, document_name').in('document_type_id', documentTypeIds)
                : Promise.resolve({ data: [] }),
            studentIds.length
                ? supabase.from('students').select('student_id, user_id, student_number').in('student_id', studentIds)
                : Promise.resolve({ data: [] }),
            employeeIds.length
                ? supabase.from('employees').select('employee_id, user_id, employee_number').in('employee_id', employeeIds)
                : Promise.resolve({ data: [] }),
        ])

        const studentUserIds = [...new Set((students || []).map((s) => s.user_id))]
        const employeeUserIds = [...new Set((employees || []).map((e) => e.user_id))]
        const allProfileUserIds = [...new Set([...studentUserIds, ...employeeUserIds])]

        const { data: profiles } = allProfileUserIds.length
            ? await supabase.from('profiles').select('user_id, first_name, last_name').in('user_id', allProfileUserIds)
            : { data: [] }

        const profileByUserId = Object.fromEntries((profiles || []).map((p) => [p.user_id, p]))
        const documentNameById = Object.fromEntries((documentTypes || []).map((d) => [d.document_type_id, d.document_name]))
        const studentById = Object.fromEntries((students || []).map((s) => [s.student_id, s]))
        const employeeById = Object.fromEntries((employees || []).map((e) => [e.employee_id, e]))

        const profileName = (userId) => {
            const p = profileByUserId[userId]
            return p ? `${p.first_name} ${p.last_name}`.trim() : ''
        }

        const detailRows = rows.map((r) => {
            const student = studentById[r.student_id]
            const employee = employeeById[r.assigned_employee_id]

            return {
                documentName: documentNameById[r.document_type_id] || 'Unknown',
                requestNumber: r.request_number,
                studentNumber: student?.student_number || '',
                studentName: student ? profileName(student.user_id) : '',
                status: (r.status || '').replace(/_/g, ' '),
                priority: r.priority || '',
                assignedEmployee: employee ? profileName(employee.user_id) : 'Unassigned',
                totalAmount: Number(r.total_amount || 0).toFixed(2),
                requestedAt: r.requested_at ? new Date(r.requested_at).toLocaleString('en-PH') : '',
                completedAt: r.completed_at ? new Date(r.completed_at).toLocaleString('en-PH') : '',
                rawStatus: r.status,
                documentNameRaw: documentNameById[r.document_type_id] || 'Unknown',
            }
        })

        return detailRows
    }

    const exportRequestsToExcel = async () => {
        try {
            setExporting(true)

            const detailRows = await loadDetailedRequestRows()

            const summaryCounts = {}
            for (const r of detailRows) {
                summaryCounts[r.documentNameRaw] = (summaryCounts[r.documentNameRaw] || 0) + 1
            }

            const summaryRows = Object.entries(summaryCounts)
                .map(([documentName, count]) => ({ documentName, count }))
                .sort((a, b) => b.count - a.count)

            const turnaroundRows = documentTurnaround.map((d) => ({
                documentName: d.name,
                completedCount: d.count,
                avgTurnaroundDays: d.avgDays.toFixed(1),
            }))

            await exportToExcel(`certichain-requests-${new Date().toISOString().slice(0, 10)}`, [
                {
                    name: 'By Document (Summary)',
                    columns: [
                        { header: 'Document', key: 'documentName', width: 42 },
                        { header: 'Requests', key: 'count', width: 14 },
                    ],
                    rows: summaryRows,
                },
                {
                    name: 'Turnaround by Document',
                    columns: [
                        { header: 'Document', key: 'documentName', width: 42 },
                        { header: 'Completed', key: 'completedCount', width: 14 },
                        { header: 'Avg Turnaround (days)', key: 'avgTurnaroundDays', width: 20 },
                    ],
                    rows: turnaroundRows,
                },
                {
                    name: 'All Requests',
                    columns: [
                        { header: 'Document', key: 'documentName', width: 32 },
                        { header: 'Request Number', key: 'requestNumber', width: 20 },
                        { header: 'Student Number', key: 'studentNumber', width: 18 },
                        { header: 'Student Name', key: 'studentName', width: 24 },
                        { header: 'Status', key: 'status', width: 16 },
                        { header: 'Priority', key: 'priority', width: 12 },
                        { header: 'Assigned Employee', key: 'assignedEmployee', width: 24 },
                        { header: 'Total Amount (PHP)', key: 'totalAmount', width: 18 },
                        { header: 'Requested At', key: 'requestedAt', width: 20 },
                    ],
                    rows: detailRows,
                },
            ])

        } catch (err) {
            console.error('EXPORT ERROR:', err)
            notifyError(err.message || 'Failed to export requests.')
        } finally {
            setExporting(false)
        }
    }

    const exportCompletedRequestsToExcel = async () => {
        try {
            setExporting(true)

            const allRows = await loadDetailedRequestRows()
            const completedRows = allRows.filter((r) => r.rawStatus === 'completed')

            if (completedRows.length === 0) {
                notifyWarning('There are no completed requests yet.')
                return
            }

            const { getHcdcLogoBase64 } = await import('../../lib/hcdcLogoBase64')
            const logoBase64 = await getHcdcLogoBase64()

            await exportToExcel(`orrm-hcdc-completed-requests-${new Date().toISOString().slice(0, 10)}`, [
                {
                    name: 'Completed Requests',
                    letterhead: {
                        logoBase64,
                        title: 'ORRM-HCDC',
                        subtitle: 'Holy Cross of Davao College — Completed Document Requests',
                    },
                    columns: [
                        { header: 'Document', key: 'documentName', width: 32 },
                        { header: 'Request Number', key: 'requestNumber', width: 20 },
                        { header: 'Student Number', key: 'studentNumber', width: 18 },
                        { header: 'Student Name', key: 'studentName', width: 24 },
                        { header: 'Assigned Employee', key: 'assignedEmployee', width: 24 },
                        { header: 'Total Amount (PHP)', key: 'totalAmount', width: 18 },
                        { header: 'Completed At', key: 'completedAt', width: 20 },
                    ],
                    rows: completedRows,
                },
            ])

        } catch (err) {
            console.error('EXPORT COMPLETED ERROR:', err)
            notifyError(err.message || 'Failed to export completed requests.')
        } finally {
            setExporting(false)
        }
    }

    const countByStatus = (statuses) => requests.filter((r) => statuses.includes(r.status)).length
    const totalRevenue = requests
        .filter((r) => r.status === 'completed')
        .reduce((sum, r) => sum + Number(r.total_amount || 0), 0)

    const scheduleCounts = {
        scheduled: schedules.filter((s) => s.status === 'scheduled').length,
        claimed: schedules.filter((s) => s.status === 'claimed').length,
        cancelled: schedules.filter((s) => s.status === 'cancelled').length,
    }

    if (loading) {
        return (
            <div>
                <SkeletonPageHeader />
                <SkeletonStatGrid count={4} />
            </div>
        )
    }

    if (error) {
        return <div className="admin-error-box">{error}</div>
    }

    return (
        <div>
            <div className="admin-page-header-row">
                <div>
                    <h1 style={{ fontSize: 26, marginBottom: 6 }}>Reports</h1>
                    <p>Request statistics, employee performance, and claiming statistics.</p>
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button className="admin-secondary-button" onClick={exportCompletedRequestsToExcel} disabled={exporting}>
                        {exporting ? 'Exporting...' : '⬇ Export Completed (ORRM-HCDC)'}
                    </button>

                    <button className="admin-primary-button" onClick={exportRequestsToExcel} disabled={exporting}>
                        {exporting ? 'Exporting...' : '⬇ Export to Excel'}
                    </button>
                </div>
            </div>

            <p style={{ fontSize: 12.5, color: 'var(--slate)', marginTop: 12, marginBottom: 24 }}>
                "Export Completed" downloads a branded ORRM-HCDC report of only finished requests — the document
                requested, student, and completion date. "Export to Excel" downloads every request regardless of
                status, plus a document-count summary. Both open directly in Excel.
            </p>

            <h2 style={{ fontSize: 17, marginBottom: 14 }}>Document Request Statistics</h2>

            <div className="admin-info-grid" style={{ marginBottom: 28 }}>
                <div className="admin-card" style={{ margin: 0 }}>
                    <span style={{ display: 'block', fontSize: 24, fontWeight: 700, color: 'var(--blue)' }}>{requests.length}</span>
                    <span style={{ fontSize: 12.5, color: 'var(--slate)' }}>Total Requests</span>
                </div>
                <div className="admin-card" style={{ margin: 0 }}>
                    <span style={{ display: 'block', fontSize: 24, fontWeight: 700, color: 'var(--blue)' }}>{countByStatus(['completed'])}</span>
                    <span style={{ fontSize: 12.5, color: 'var(--slate)' }}>Completed</span>
                </div>
                <div className="admin-card" style={{ margin: 0 }}>
                    <span style={{ display: 'block', fontSize: 24, fontWeight: 700, color: 'var(--blue)' }}>{countByStatus(['rejected'])}</span>
                    <span style={{ fontSize: 12.5, color: 'var(--slate)' }}>Rejected</span>
                </div>
                <div className="admin-card" style={{ margin: 0 }}>
                    <span style={{ display: 'block', fontSize: 24, fontWeight: 700, color: 'var(--blue)' }}>₱{totalRevenue.toFixed(2)}</span>
                    <span style={{ fontSize: 12.5, color: 'var(--slate)' }}>Revenue (Completed)</span>
                </div>
                <div className="admin-card" style={{ margin: 0 }}>
                    <span style={{ display: 'block', fontSize: 24, fontWeight: 700, color: 'var(--blue)' }}>
                        {formatTurnaround(avgTurnaroundDays)}
                    </span>
                    <span style={{ fontSize: 12.5, color: 'var(--slate)' }}>Avg Turnaround</span>
                </div>
            </div>

            <h2 style={{ fontSize: 17, marginBottom: 14 }}>Turnaround Time by Document</h2>
            <p style={{ fontSize: 12.5, color: 'var(--slate)', marginTop: -10, marginBottom: 14 }}>
                Average days from request to completion, for completed requests only.
            </p>

            <div className="admin-table-wrapper" style={{ marginBottom: 28 }}>
                <table className="admin-table">
                    <thead><tr><th>Document</th><th>Completed</th><th>Avg Turnaround</th></tr></thead>
                    <tbody>
                        {documentTurnaround.length === 0 ? (
                            <tr><td colSpan={3} style={{ color: 'var(--slate)' }}>No completed requests yet.</td></tr>
                        ) : (
                            documentTurnaround.map((d) => (
                                <tr key={d.name}>
                                    <td>{d.name}</td>
                                    <td>{d.count}</td>
                                    <td>{formatTurnaround(d.avgDays)}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <h2 style={{ fontSize: 17, marginBottom: 14 }}>Top Requested Documents</h2>

            <div className="admin-table-wrapper" style={{ marginBottom: 28 }}>
                <table className="admin-table">
                    <thead><tr><th>Document</th><th>Requests</th></tr></thead>
                    <tbody>
                        {documentBreakdown.map((d) => (
                            <tr key={d.name}><td>{d.name}</td><td>{d.count}</td></tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <h2 style={{ fontSize: 17, marginBottom: 14 }}>Employee Performance</h2>

            <div className="admin-table-wrapper" style={{ marginBottom: 28 }}>
                <table className="admin-table">
                    <thead>
                        <tr><th>Employee</th><th>Assigned</th><th>Completed</th><th>Rejected</th><th>Avg Turnaround</th></tr>
                    </thead>
                    <tbody>
                        {employeePerformance.map((e) => (
                            <tr key={e.employee_id}>
                                <td>{e.name}</td>
                                <td>{e.assignedCount}</td>
                                <td>{e.completedCount}</td>
                                <td>{e.rejectedCount}</td>
                                <td>{formatTurnaround(e.avgTurnaroundDays)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <h2 style={{ fontSize: 17, marginBottom: 14 }}>Claiming Statistics</h2>

            <div className="admin-info-grid">
                <div className="admin-card" style={{ margin: 0 }}>
                    <span style={{ display: 'block', fontSize: 24, fontWeight: 700, color: 'var(--blue)' }}>{scheduleCounts.scheduled}</span>
                    <span style={{ fontSize: 12.5, color: 'var(--slate)' }}>Scheduled</span>
                </div>
                <div className="admin-card" style={{ margin: 0 }}>
                    <span style={{ display: 'block', fontSize: 24, fontWeight: 700, color: 'var(--blue)' }}>{scheduleCounts.claimed}</span>
                    <span style={{ fontSize: 12.5, color: 'var(--slate)' }}>Claimed</span>
                </div>
                <div className="admin-card" style={{ margin: 0 }}>
                    <span style={{ display: 'block', fontSize: 24, fontWeight: 700, color: 'var(--blue)' }}>{scheduleCounts.cancelled}</span>
                    <span style={{ fontSize: 12.5, color: 'var(--slate)' }}>Cancelled</span>
                </div>
            </div>
        </div>
    )
}

export default Reports
