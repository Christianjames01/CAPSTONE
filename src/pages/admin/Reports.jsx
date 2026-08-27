import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import './AdminPages.css'

function Reports() {
    const [requests, setRequests] = useState([])
    const [schedules, setSchedules] = useState([])
    const [employeePerformance, setEmployeePerformance] = useState([])
    const [documentBreakdown, setDocumentBreakdown] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        loadReports()
    }, [])

    const loadReports = async () => {
        try {
            setLoading(true)
            setError('')

            const { data: requestRows, error: requestError } = await supabase
                .from('document_requests')
                .select('request_id, document_type_id, assigned_employee_id, status, total_amount, requested_at')

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

        } catch (err) {
            console.error('REPORTS ERROR:', err)
            setError(err.message || 'Failed to load reports.')
        } finally {
            setLoading(false)
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
        return <p className="admin-loading">Loading reports...</p>
    }

    if (error) {
        return <div className="admin-error-box">{error}</div>
    }

    return (
        <div>
            <div className="admin-page-header">
                <h1>Reports</h1>
                <p>Request statistics, employee performance, and claiming statistics.</p>
            </div>

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
                        <tr><th>Employee</th><th>Assigned</th><th>Completed</th><th>Rejected</th></tr>
                    </thead>
                    <tbody>
                        {employeePerformance.map((e) => (
                            <tr key={e.employee_id}>
                                <td>{e.name}</td>
                                <td>{e.assignedCount}</td>
                                <td>{e.completedCount}</td>
                                <td>{e.rejectedCount}</td>
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
