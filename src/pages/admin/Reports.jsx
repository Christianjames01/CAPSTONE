import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { loadStudentsById } from '../../lib/studentNames'
import { downloadExcelReport } from '../../lib/reportExport'
import { notifyError } from '../../lib/notify'
import { SkeletonPageHeader, SkeletonStatGrid } from '../../components/Skeleton'
import './AdminPages.css'
import './Reports.css'

const turnaroundDays = (r) => {
    if (!r.completed_at || !r.requested_at) return null
    const ms = new Date(r.completed_at).getTime() - new Date(r.requested_at).getTime()
    return ms / (1000 * 60 * 60 * 24)
}

const average = (nums) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null)

const formatTurnaround = (days) => {
    if (days === null) return 'N/A'

    const totalMinutes = days * 24 * 60

    if (totalMinutes < 60) return `${Math.round(totalMinutes)}m`
    if (days < 1) return `${(totalMinutes / 60).toFixed(1)}h`
    return `${days.toFixed(1)}d`
}

const peso = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// Requests whose payment has been verified (or that went on past it) --
// what the office has actually collected.
const PAID_STATUSES = ['receipt_verified', 'processing', 'ready_for_claiming', 'completed']

const monthKey = (iso) => {
    const d = new Date(iso)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const monthLabel = (key) => {
    const [y, m] = key.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
}
const currentMonthKey = () => monthKey(new Date().toISOString())
const previousMonthKey = () => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - 1)
    return monthKey(d.toISOString())
}

// Period filter: returns [label, test(iso) => boolean].
function periodFilter(period, customMonth) {
    const year = new Date().getFullYear()
    switch (period) {
        case 'this_month': return [monthLabel(currentMonthKey()), (iso) => monthKey(iso) === currentMonthKey()]
        case 'last_month': return [monthLabel(previousMonthKey()), (iso) => monthKey(iso) === previousMonthKey()]
        case 'this_year': return [`Year ${year}`, (iso) => new Date(iso).getFullYear() === year]
        case 'month': return customMonth
            ? [monthLabel(customMonth), (iso) => monthKey(iso) === customMonth]
            : ['All time', () => true]
        default: return ['All time', () => true]
    }
}

function Reports() {
    const [allRequests, setAllRequests] = useState([])
    const [allSchedules, setAllSchedules] = useState([])
    const [ratingByRequestId, setRatingByRequestId] = useState({})
    const [employees, setEmployees] = useState([])
    const [documentNameById, setDocumentNameById] = useState({})
    const [students, setStudents] = useState({})
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const [period, setPeriod] = useState('all')
    const [customMonth, setCustomMonth] = useState(currentMonthKey())
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
                .select('request_id, request_number, student_id, document_type_id, assigned_employee_id, status, total_amount, requested_at, completed_at')

            if (requestError) {
                throw new Error('Failed to load requests: ' + requestError.message)
            }

            setAllRequests(requestRows || [])

            const { data: scheduleRows, error: scheduleError } = await supabase
                .from('claim_schedules')
                .select('claim_schedule_id, status, created_at')

            if (scheduleError) {
                throw new Error('Failed to load claim schedules: ' + scheduleError.message)
            }

            setAllSchedules(scheduleRows || [])

            const { data: ratingRows, error: ratingError } = await supabase
                .from('request_ratings')
                .select('request_id, rating')

            if (ratingError) {
                throw new Error('Failed to load ratings: ' + ratingError.message)
            }

            setRatingByRequestId(Object.fromEntries((ratingRows || []).map((r) => [r.request_id, r.rating])))

            const { data: employeeRows } = await supabase
                .from('employees')
                .select('employee_id, user_id, employee_number, status')
                .eq('status', 'active')

            const userIds = [...new Set((employeeRows || []).map((e) => e.user_id))]

            const { data: profiles } = userIds.length
                ? await supabase.from('profiles').select('user_id, first_name, last_name').in('user_id', userIds)
                : { data: [] }

            const profileByUserId = Object.fromEntries((profiles || []).map((p) => [p.user_id, p]))

            setEmployees((employeeRows || []).map((e) => ({
                employee_id: e.employee_id,
                name: profileByUserId[e.user_id]
                    ? `${profileByUserId[e.user_id].first_name} ${profileByUserId[e.user_id].last_name}`.trim()
                    : e.employee_number,
            })))

            const documentTypeIds = [...new Set((requestRows || []).map((r) => r.document_type_id).filter(Boolean))]

            const { data: documentTypes } = documentTypeIds.length
                ? await supabase.from('document_types').select('document_type_id, document_name').in('document_type_id', documentTypeIds)
                : { data: [] }

            setDocumentNameById(Object.fromEntries((documentTypes || []).map((d) => [d.document_type_id, d.document_name])))
            setStudents(await loadStudentsById((requestRows || []).map((r) => r.student_id)))

        } catch (err) {
            console.error('REPORTS ERROR:', err)
            setError(err.message || 'Failed to load reports.')
        } finally {
            setLoading(false)
        }
    }

    const [periodLabel] = periodFilter(period, customMonth)

    const report = useMemo(() => {
        const [, inPeriod] = periodFilter(period, customMonth)
        const requests = allRequests.filter((r) => r.requested_at && inPeriod(r.requested_at))
        const schedules = allSchedules.filter((s) => !s.created_at || inPeriod(s.created_at))
        const docName = (id) => documentNameById[id] || 'Unknown'

        const completed = requests.filter((r) => r.status === 'completed')
        const ratings = requests.map((r) => ratingByRequestId[r.request_id]).filter((v) => v !== undefined)

        const docCounts = {}
        for (const r of requests) docCounts[docName(r.document_type_id)] = (docCounts[docName(r.document_type_id)] || 0) + 1

        const turnaroundByDoc = {}
        for (const r of completed) {
            const days = turnaroundDays(r)
            if (days === null) continue
            const name = docName(r.document_type_id)
            if (!turnaroundByDoc[name]) turnaroundByDoc[name] = []
            turnaroundByDoc[name].push(days)
        }

        const months = {}
        for (const r of requests) {
            const key = monthKey(r.requested_at)
            if (!months[key]) months[key] = { key, total: 0, completed: 0, rejected: 0, collected: 0, days: [] }
            const m = months[key]
            m.total += 1
            if (r.status === 'completed') m.completed += 1
            if (r.status === 'rejected') m.rejected += 1
            if (PAID_STATUSES.includes(r.status)) m.collected += Number(r.total_amount || 0)
            const days = turnaroundDays(r)
            if (r.status === 'completed' && days !== null) m.days.push(days)
        }

        return {
            requests,
            total: requests.length,
            completedCount: completed.length,
            rejectedCount: requests.filter((r) => r.status === 'rejected').length,
            feesCollected: requests.filter((r) => PAID_STATUSES.includes(r.status)).reduce((s, r) => s + Number(r.total_amount || 0), 0),
            avgTurnaround: average(completed.map(turnaroundDays).filter((d) => d !== null)),
            avgRating: average(ratings),
            ratingCount: ratings.length,
            documentBreakdown: Object.entries(docCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
            documentTurnaround: Object.entries(turnaroundByDoc)
                .map(([name, days]) => ({ name, count: days.length, avgDays: average(days) }))
                .sort((a, b) => b.avgDays - a.avgDays),
            monthly: Object.values(months)
                .map((m) => ({ ...m, label: monthLabel(m.key), avgDays: average(m.days) }))
                .sort((a, b) => b.key.localeCompare(a.key)),
            employeePerformance: employees.map((e) => {
                const assigned = requests.filter((r) => r.assigned_employee_id === e.employee_id)
                const done = assigned.filter((r) => r.status === 'completed')
                return {
                    ...e,
                    assignedCount: assigned.length,
                    completedCount: done.length,
                    rejectedCount: assigned.filter((r) => r.status === 'rejected').length,
                    avgTurnaroundDays: average(done.map(turnaroundDays).filter((d) => d !== null)),
                    avgRating: average(done.map((r) => ratingByRequestId[r.request_id]).filter((v) => v !== undefined)),
                }
            }).sort((a, b) => b.completedCount - a.completedCount),
            scheduleCounts: {
                scheduled: schedules.filter((s) => s.status === 'scheduled').length,
                claimed: schedules.filter((s) => s.status === 'claimed').length,
                cancelled: schedules.filter((s) => s.status === 'cancelled').length,
            },
        }
    }, [allRequests, allSchedules, ratingByRequestId, employees, documentNameById, period, customMonth])

    const generatedAt = new Date().toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' })

    const exportExcel = async () => {
        try {
            setExporting(true)
            const docName = (id) => documentNameById[id] || 'Unknown'
            const fileSuffix = periodLabel.replace(/\s+/g, '-')

            await downloadExcelReport(`CertiChain-Report-${fileSuffix}.xlsx`, [
                {
                    name: 'Summary',
                    columns: [{ header: 'Measure', key: 'label', width: 34 }, { header: 'Value', key: 'value', width: 22 }],
                    rows: [
                        { label: 'Total requests', value: report.total },
                        { label: 'Completed', value: report.completedCount },
                        { label: 'Rejected', value: report.rejectedCount },
                        { label: 'Fees collected (paid requests)', value: peso(report.feesCollected) },
                        { label: 'Average turnaround (completed)', value: formatTurnaround(report.avgTurnaround) },
                        { label: 'Average satisfaction', value: report.avgRating === null ? 'N/A' : `${report.avgRating.toFixed(1)} / 5 (${report.ratingCount} rated)` },
                        { label: 'Claiming: scheduled', value: report.scheduleCounts.scheduled },
                        { label: 'Claiming: claimed', value: report.scheduleCounts.claimed },
                        { label: 'Claiming: cancelled', value: report.scheduleCounts.cancelled },
                    ],
                },
                {
                    name: 'Monthly',
                    columns: [
                        { header: 'Month', key: 'label', width: 20 },
                        { header: 'Requests', key: 'total', width: 12 },
                        { header: 'Completed', key: 'completed', width: 12 },
                        { header: 'Rejected', key: 'rejected', width: 12 },
                        { header: 'Fees collected', key: 'collected', width: 16, format: 'peso' },
                        { header: 'Avg turnaround (days)', key: 'avgDaysNum', width: 22, format: 'decimal' },
                    ],
                    rows: report.monthly.map((m) => ({ ...m, avgDaysNum: m.avgDays === null ? 'N/A' : Number(m.avgDays.toFixed(1)) })),
                },
                {
                    name: 'By document',
                    columns: [
                        { header: 'Document', key: 'name', width: 44 },
                        { header: 'Requests', key: 'count', width: 12 },
                        { header: 'Completed', key: 'completed', width: 12 },
                        { header: 'Avg turnaround (days)', key: 'avgDays', width: 22, format: 'decimal' },
                    ],
                    rows: report.documentBreakdown.map((d) => {
                        const t = report.documentTurnaround.find((x) => x.name === d.name)
                        return { name: d.name, count: d.count, completed: t?.count || 0, avgDays: t ? Number(t.avgDays.toFixed(1)) : 'N/A' }
                    }),
                },
                {
                    name: 'Employees',
                    columns: [
                        { header: 'Employee', key: 'name', width: 28 },
                        { header: 'Assigned', key: 'assignedCount', width: 12 },
                        { header: 'Completed', key: 'completedCount', width: 12 },
                        { header: 'Rejected', key: 'rejectedCount', width: 12 },
                        { header: 'Avg turnaround', key: 'turnaround', width: 16 },
                        { header: 'Avg rating', key: 'rating', width: 12 },
                    ],
                    rows: report.employeePerformance.map((e) => ({
                        ...e,
                        turnaround: formatTurnaround(e.avgTurnaroundDays),
                        rating: e.avgRating === null ? 'N/A' : Number(e.avgRating.toFixed(1)),
                    })),
                },
                {
                    name: 'Requests',
                    columns: [
                        { header: 'Request #', key: 'number', width: 14 },
                        { header: 'Document', key: 'document', width: 40 },
                        { header: 'Student', key: 'student', width: 28 },
                        { header: 'Student ID', key: 'studentNumber', width: 14 },
                        { header: 'Status', key: 'status', width: 20 },
                        { header: 'Amount', key: 'amount', width: 12, format: 'peso' },
                        { header: 'Requested', key: 'requested', width: 22, format: 'datetime' },
                        { header: 'Completed', key: 'completed', width: 22, format: 'datetime' },
                    ],
                    rows: [...report.requests]
                        .sort((a, b) => new Date(b.requested_at) - new Date(a.requested_at))
                        .map((r) => ({
                            number: r.request_number,
                            document: docName(r.document_type_id),
                            student: students[r.student_id]?.name || '',
                            studentNumber: students[r.student_id]?.number || '',
                            status: (r.status || '').replace(/_/g, ' '),
                            amount: Number(r.total_amount || 0),
                            requested: r.requested_at ? new Date(r.requested_at) : '',
                            completed: r.completed_at ? new Date(r.completed_at) : '',
                        })),
                },
            ], [
                "Registrar's Office Report — CertiChain",
                `Period: ${periodLabel}`,
                `Generated: ${generatedAt}`,
            ])
        } catch (err) {
            console.error('EXPORT ERROR:', err)
            notifyError('Could not create the Excel file: ' + (err.message || 'unknown error'))
        } finally {
            setExporting(false)
        }
    }

    if (loading) {
        return (
            <div>
                <SkeletonPageHeader />
                <SkeletonStatGrid
                    count={6}
                    icon={false}
                    gridClassName="admin-stat-grid"
                    cardClassName="admin-card"
                    cardStyle={{ margin: 0 }}
                />
            </div>
        )
    }

    if (error) {
        return <div className="admin-error-box">{error}</div>
    }

    const stat = (value, label) => (
        <div className="admin-card report-stat" style={{ margin: 0 }}>
            <span className="report-stat-value">{value}</span>
            <span className="report-stat-label">{label}</span>
        </div>
    )

    return (
        <div className="reports-page">
            {/* Only shown when printing / saving as PDF */}
            <div className="report-print-header">
                <strong>Holy Cross of Davao College — Registrar&apos;s Office</strong>
                <span>Report period: {periodLabel} · Generated {generatedAt}</span>
            </div>

            <div className="admin-page-header-row">
                <div>
                    <h1 style={{ fontSize: 26, marginBottom: 6 }}>Reports</h1>
                    <p>Request statistics, fees collected, processing times, and employee performance.</p>
                </div>

                <div className="report-actions no-print">
                    <button className="admin-secondary-button" onClick={() => window.print()}>
                        Export PDF
                    </button>
                    <button className="admin-primary-button" onClick={exportExcel} disabled={exporting}>
                        {exporting ? 'Preparing…' : 'Export Excel'}
                    </button>
                </div>
            </div>

            <div className="report-period no-print">
                <label htmlFor="report-period">Period</label>
                <select
                    id="report-period"
                    className="admin-search-input"
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                >
                    <option value="all">All time</option>
                    <option value="this_month">This month</option>
                    <option value="last_month">Last month</option>
                    <option value="this_year">This year</option>
                    <option value="month">Choose a month…</option>
                </select>
                {period === 'month' && (
                    <input
                        type="month"
                        className="admin-search-input"
                        value={customMonth}
                        max={currentMonthKey()}
                        onChange={(e) => setCustomMonth(e.target.value)}
                    />
                )}
                <span className="report-period-label">Showing: <strong>{periodLabel}</strong></span>
            </div>

            <h2 className="report-h2">Document Request Statistics</h2>

            <div className="admin-stat-grid" style={{ marginBottom: 28 }}>
                {stat(report.total, 'Total Requests')}
                {stat(report.completedCount, 'Completed')}
                {stat(report.rejectedCount, 'Rejected')}
                {stat(peso(report.feesCollected), 'Fees Collected')}
                {stat(formatTurnaround(report.avgTurnaround), 'Avg Turnaround')}
                {stat(
                    report.avgRating === null ? 'N/A' : `${report.avgRating.toFixed(1)} ★`,
                    `Avg Satisfaction ${report.ratingCount > 0 ? `(${report.ratingCount} rated)` : ''}`
                )}
            </div>

            <h2 className="report-h2">Monthly Summary</h2>
            <p className="report-note">Fees collected counts requests whose payment was verified.</p>

            <div className="admin-table-wrapper" style={{ marginBottom: 28 }}>
                <table className="admin-table">
                    <thead><tr><th>Month</th><th>Requests</th><th>Completed</th><th>Rejected</th><th>Fees Collected</th><th>Avg Turnaround</th></tr></thead>
                    <tbody>
                        {report.monthly.length === 0 ? (
                            <tr><td colSpan={6} style={{ color: 'var(--slate)' }}>No requests in this period.</td></tr>
                        ) : (
                            report.monthly.map((m) => (
                                <tr key={m.key}>
                                    <td>{m.label}</td>
                                    <td>{m.total}</td>
                                    <td>{m.completed}</td>
                                    <td>{m.rejected}</td>
                                    <td>{peso(m.collected)}</td>
                                    <td>{formatTurnaround(m.avgDays)}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <h2 className="report-h2">Turnaround Time by Document</h2>
            <p className="report-note">Average time from request to completion, for completed requests only.</p>

            <div className="admin-table-wrapper" style={{ marginBottom: 28 }}>
                <table className="admin-table">
                    <thead><tr><th>Document</th><th>Completed</th><th>Avg Turnaround</th></tr></thead>
                    <tbody>
                        {report.documentTurnaround.length === 0 ? (
                            <tr><td colSpan={3} style={{ color: 'var(--slate)' }}>No completed requests in this period.</td></tr>
                        ) : (
                            report.documentTurnaround.map((d) => (
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

            <h2 className="report-h2">Top Requested Documents</h2>

            <div className="admin-table-wrapper" style={{ marginBottom: 28 }}>
                <table className="admin-table">
                    <thead><tr><th>Document</th><th>Requests</th></tr></thead>
                    <tbody>
                        {report.documentBreakdown.length === 0 ? (
                            <tr><td colSpan={2} style={{ color: 'var(--slate)' }}>No requests in this period.</td></tr>
                        ) : (
                            report.documentBreakdown.slice(0, 10).map((d) => (
                                <tr key={d.name}><td>{d.name}</td><td>{d.count}</td></tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <h2 className="report-h2">Employee Performance</h2>

            <div className="admin-table-wrapper" style={{ marginBottom: 28 }}>
                <table className="admin-table">
                    <thead>
                        <tr><th>Employee</th><th>Assigned</th><th>Completed</th><th>Rejected</th><th>Avg Turnaround</th><th>Avg Rating</th></tr>
                    </thead>
                    <tbody>
                        {report.employeePerformance.map((e) => (
                            <tr key={e.employee_id}>
                                <td>{e.name}</td>
                                <td>{e.assignedCount}</td>
                                <td>{e.completedCount}</td>
                                <td>{e.rejectedCount}</td>
                                <td>{formatTurnaround(e.avgTurnaroundDays)}</td>
                                <td>{e.avgRating === null ? 'N/A' : `${e.avgRating.toFixed(1)} ★`}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <h2 className="report-h2">Claiming Statistics</h2>

            <div className="admin-stat-grid">
                {stat(report.scheduleCounts.scheduled, 'Scheduled')}
                {stat(report.scheduleCounts.claimed, 'Claimed')}
                {stat(report.scheduleCounts.cancelled, 'Cancelled')}
            </div>
        </div>
    )
}

export default Reports
