import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { SkeletonList } from '../../components/Skeleton'
import HighlightedText from '../../components/HighlightedText'
import './AdminPages.css'

function ActivityLogs() {
    const [logs, setLogs] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')
    const [filterDate, setFilterDate] = useState('')

    useEffect(() => {
        loadLogs()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterDate])

    const loadLogs = async () => {
        try {
            setLoading(true)
            setError('')

            // With no date picked, show the 200 most recent entries -- a
            // quick glance at recent activity. Once activity passes that
            // count, older days become unreachable by that query alone, so
            // picking a specific date instead fetches every entry from
            // that day (up to a generous cap), bypassing the 200 cutoff.
            let query = supabase
                .from('activity_logs')
                .select('activity_log_id, user_id, employee_id, action, table_name, record_id, description, created_at')
                .neq('table_name', 'walk_in_queue')
                .order('created_at', { ascending: false })

            if (filterDate) {
                const dayStart = new Date(`${filterDate}T00:00:00`)
                const dayEnd = new Date(`${filterDate}T23:59:59.999`)
                query = query
                    .gte('created_at', dayStart.toISOString())
                    .lte('created_at', dayEnd.toISOString())
                    .limit(2000)
            } else {
                query = query.limit(200)
            }

            const { data, error: logsError } = await query

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
                        actorRole = profile.role === 'admin'
                            ? 'Admin'
                            : profile.role === 'employee'
                                ? 'Employee'
                                : 'Registrar Head'
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
                <p>
                    {filterDate
                        ? `Every recorded action on ${new Date(`${filterDate}T00:00:00`).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}.`
                        : 'The 200 most recent actions across all employees and registrar heads. Pick a date below to retrieve every log from a specific day instead.'}
                </p>
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
                <input
                    className="admin-search-input"
                    style={{ flex: 1, minWidth: 220 }}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by actor, action, or description"
                    aria-label="Search activity logs"
                />

                <input
                    className="admin-search-input"
                    style={{ maxWidth: 200 }}
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    aria-label="Filter by date"
                    max={new Date().toISOString().slice(0, 10)}
                />

                {filterDate && (
                    <button className="admin-secondary-button" onClick={() => setFilterDate('')}>
                        Show recent instead
                    </button>
                )}
            </div>

            {error && <div className="admin-error-box">{error}</div>}

            {loading ? (
                <SkeletonList count={3} />
            ) : visibleLogs.length === 0 ? (
                <div className="admin-empty">
                    {filterDate ? 'No activity recorded on this date.' : 'No activity matches this search.'}
                </div>
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
                                    <td><HighlightedText text={log.description} /></td>
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
