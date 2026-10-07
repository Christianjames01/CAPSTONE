import { useMemo, useState } from 'react'
import { ROLE_NAMES, displayName, downloadCsv, formatWhen, timeAgo } from './superadminFormat'

const RANGES = [
    { key: 'today', label: 'Today', days: 1 },
    { key: '7d', label: '7 days', days: 7 },
    { key: '30d', label: '30 days', days: 30 },
    { key: 'all', label: 'All', days: null },
]

function SuperAdminLogins({ logins }) {
    const [range, setRange] = useState('7d')
    const [role, setRole] = useState('all')
    const [query, setQuery] = useState('')

    const roles = useMemo(() => [...new Set(logins.map((l) => l.role).filter(Boolean))], [logins])

    const visible = useMemo(() => {
        const days = RANGES.find((r) => r.key === range)?.days
        const cutoff = days ? Date.now() - days * 86400000 : null
        const q = query.trim().toLowerCase()
        return logins.filter((row) => {
            if (cutoff && new Date(row.logged_in_at).getTime() < cutoff) return false
            if (role !== 'all' && row.role !== role) return false
            if (!q) return true
            return `${row.full_name || ''} ${row.email || ''} ${ROLE_NAMES[row.role] || ''}`.toLowerCase().includes(q)
        })
    }, [logins, range, role, query])

    function exportLogins() {
        downloadCsv(
            `certichain-logins-${new Date().toISOString().slice(0, 10)}.csv`,
            ['When', 'Name', 'Email', 'Role'],
            visible.map((l) => [formatWhen(l.logged_in_at), l.full_name, l.email, ROLE_NAMES[l.role] || l.role])
        )
    }

    return (
        <>
            <header className="admin-page-header-row">
                <div className="admin-page-header">
                    <h1>Login activity</h1>
                    <p>Each successful sign-in, newest first. Times are Manila time.</p>
                </div>
                <button type="button" className="admin-link-button" onClick={exportLogins} disabled={visible.length === 0}>
                    Export CSV
                </button>
            </header>

            <div className="sa-toolbar">
                <div className="sa-chips" role="tablist" aria-label="Date range">
                    {RANGES.map((r) => (
                        <button
                            key={r.key}
                            type="button"
                            role="tab"
                            aria-selected={range === r.key}
                            className={`admin-filter-chip${range === r.key ? ' active' : ''}`}
                            onClick={() => setRange(r.key)}
                        >
                            {r.label}
                        </button>
                    ))}
                </div>
                <div className="sa-toolbar-right">
                    <select className="sa-select" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Filter by role">
                        <option value="all">All roles</option>
                        {roles.map((r) => (
                            <option key={r} value={r}>{ROLE_NAMES[r] || r}</option>
                        ))}
                    </select>
                    <input
                        type="search"
                        className="admin-search-input"
                        placeholder="Search name or email"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        aria-label="Search login history"
                    />
                </div>
            </div>

            <section className="admin-card">
                <p className="sa-muted sa-count">{visible.length} sign-in{visible.length === 1 ? '' : 's'}</p>
                {visible.length === 0 ? (
                    <p className="admin-empty">No sign-ins match these filters.</p>
                ) : (
                    <div className="admin-table-wrapper">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>When</th>
                                    <th>Name</th>
                                    <th>Role</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visible.map((row, index) => (
                                    <tr key={`${row.user_id}-${row.logged_in_at}-${index}`}>
                                        <td title={timeAgo(row.logged_in_at)}>{formatWhen(row.logged_in_at)}</td>
                                        <td>
                                            <span className="sa-name">{displayName(row)}</span>
                                            <span className="sa-sub">{row.email}</span>
                                        </td>
                                        <td>{ROLE_NAMES[row.role] || row.role || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </>
    )
}

export default SuperAdminLogins
