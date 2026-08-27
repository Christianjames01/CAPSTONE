import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import './AdminPages.css'

function ActivityLogs() {
    const [logs, setLogs] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')

    useEffect(() => {
        loadLogs()
    }, [])

    const loadLogs = async () => {
        try {
            setLoading(true)
            setError('')

            const { data, error: logsError } = await supabase
                .from('activity_logs')
                .select('activity_log_id, user_id, employee_id, action, table_name, record_id, description, created_at')
                .order('created_at', { ascending: false })
                .limit(200)

            if (logsError) {
                throw new Error('Failed to load activity logs: ' + logsError.message)
            }

            const rows = data || []

            const employeeIds = [...new Set(rows.map((l) => l.employee_id).filter(Boolean))]

            const { data: employees } = employeeIds.length
                ? await supabase.from('employees').select('employee_id, user_id, employee_number').in('employee_id', employeeIds)
                : { data: [] }

            const employeeById = Object.fromEntries((employees || []).map((e) => [e.employee_id, e]))

            const directUserIds = rows.map((l) => l.user_id).filter(Boolean)
            const employeeUserIds = (employees || []).map((e) => e.user_id)
            const allUserIds = [...new Set([...directUserIds, ...employeeUserIds])]

            const { data: profiles } = allUserIds.length
                ? await supabase.from('profiles').select('user_id, first_name, last_name, role').in('user_id', allUserIds)
                : { data: [] }

            const profileByUserId = Object.fromEntries((profiles || []).map((p) => [p.user_id, p]))

            setLogs(
                rows.map((log) => {
                    let actorName = 'System'
                    let actorRole = ''

                    if (log.employee_id && employeeById[log.employee_id]) {
                        const profile = profileByUserId[employeeById[log.employee_id].user_id]
                        actorName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : employeeById[log.employee_id].employee_number
                        actorRole = 'Employee'
                    } else if (log.user_id && profileByUserId[log.user_id]) {
                        const profile = profileByUserId[log.user_id]
                        actorName = `${profile.first_name} ${profile.last_name}`.trim()
                        actorRole = profile.role === 'admin' ? 'Admin' : 'Registrar Head'
                    }

                    return { ...log, actorName, actorRole }
                })
            )

        } catch (err) {
            console.error('ADMIN ACTIVITY LOGS ERROR:', err)
            setError(err.message || 'Failed to load activity logs.')
        } finally {
            setLoading(false)
        }
    }

    const visibleLogs = logs.filter((log) => {
        if (!search.trim()) return true
        const term = search.trim().toLowerCase()
        return (
            log.actorName.toLowerCase().includes(term) ||
            log.action.toLowerCase().includes(term) ||
            (log.description || '').toLowerCase().includes(term)
        )
    })

    const formatDate = (value) =>
        new Date(value).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

    return (
        <div>
            <div className="admin-page-header">
                <h1>Activity Logs</h1>
                <p>Every recorded action across all employees and registrar heads — who did what, and when.</p>
            </div>

            <input
                className="admin-search-input"
                style={{ marginBottom: 20 }}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by actor, action, or description"
            />

            {error && <div className="admin-error-box">{error}</div>}

            {loading ? (
                <p className="admin-loading">Loading activity logs...</p>
            ) : visibleLogs.length === 0 ? (
                <div className="admin-empty">No activity matches this search.</div>
            ) : (
                <div className="admin-table-wrapper">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Actor</th>
                                <th>Action</th>
                                <th>Description</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visibleLogs.map((log) => (
                                <tr key={log.activity_log_id}>
                                    <td>{log.actorName} {log.actorRole && <span style={{ color: 'var(--slate)', fontSize: 11 }}>({log.actorRole})</span>}</td>
                                    <td style={{ textTransform: 'capitalize' }}>{log.action.replace(/_/g, ' ')}</td>
                                    <td>{log.description}</td>
                                    <td style={{ whiteSpace: 'nowrap' }}>{formatDate(log.created_at)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

export default ActivityLogs
