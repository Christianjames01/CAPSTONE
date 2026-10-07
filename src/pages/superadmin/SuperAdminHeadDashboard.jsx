import { formatWhen, timeAgo } from './superadminFormat'

const STATUS_LABELS = {
    pending: 'Pending',
    payment_pending: 'Payment Pending',
    receipt_uploaded: 'Receipt Uploaded',
    receipt_verified: 'Receipt Verified',
    processing: 'Processing',
    lacking_requirements: 'Lacking Requirements',
    ready_for_claiming: 'Ready for Claiming',
    completed: 'Completed',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
}

function peso(value) {
    return `₱${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function Tile({ label, value, note }) {
    return (
        <div className="sa-tile">
            <span className="sa-tile-label">{label}</span>
            <span className="sa-tile-value">{value ?? '—'}</span>
            {note && <span className="sa-tile-note">{note}</span>}
        </div>
    )
}

function RequestsChart({ daily }) {
    if (!daily || daily.length === 0) return <p className="sa-muted">No request data yet.</p>
    const peak = Math.max(1, ...daily.map((d) => Number(d.count)))
    return (
        <div className="sa-chart" role="img" aria-label="Requests per day">
            {daily.map((d) => {
                const count = Number(d.count)
                const height = count === 0 ? 2 : Math.max(8, (count / peak) * 100)
                const label = new Date(`${d.day}T00:00:00+08:00`).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' })
                return (
                    <div key={d.day} className="sa-chart-col" title={`${label}: ${count} request${count === 1 ? '' : 's'}`}>
                        <span className="sa-chart-count">{count || ''}</span>
                        <div className="sa-chart-bar" style={{ height: `${height}%` }} />
                        <span className="sa-chart-label">{label}</span>
                    </div>
                )
            })}
        </div>
    )
}

function StatusBars({ counts }) {
    const entries = Object.entries(counts || {}).sort((a, b) => b[1] - a[1])
    const total = entries.reduce((sum, [, n]) => sum + Number(n), 0) || 1
    if (entries.length === 0) return <p className="sa-muted">No requests yet.</p>
    return (
        <ul className="sa-bars">
            {entries.map(([status, n]) => (
                <li key={status}>
                    <div className="sa-bars-head">
                        <span>{STATUS_LABELS[status] || status}</span>
                        <strong>{n}</strong>
                    </div>
                    <div className="sa-bars-track">
                        <div className="sa-bars-fill" style={{ width: `${(Number(n) / total) * 100}%` }} />
                    </div>
                </li>
            ))}
        </ul>
    )
}

function SuperAdminHeadDashboard({ data, loading }) {
    const d = data || {}

    return (
        <>
            <header className="admin-page-header">
                <h1>Head Dashboard</h1>
                <p>A read-only mirror of the registrar head's dashboard. The superadmin can see this data but can't edit, approve, or delete anything here — use the head or admin account for that.</p>
            </header>

            <section className="sa-tiles">
                <Tile label="Total requests" value={loading && !data ? '…' : d.requests_total} note={`${d.requests_today ?? 0} today`} />
                <Tile label="Unassigned, active" value={loading && !data ? '…' : d.unassigned_active} />
                <Tile label="Today's appointments" value={loading && !data ? '…' : d.today_appointments} />
                <Tile label="Total students" value={loading && !data ? '…' : d.student_count} note={`${d.employee_count ?? 0} active employees`} />
            </section>

            <section className="sa-tiles">
                <Tile label="Missed claims" value={loading && !data ? '…' : d.missed_claims} />
                <Tile label="Reschedule requests" value={loading && !data ? '…' : d.reschedule_requests} />
                <Tile label="Active announcements" value={loading && !data ? '…' : d.announcements_active} />
            </section>

            <div className="sa-grid">
                <section className="admin-card sa-panel sa-panel-wide">
                    <div className="sa-panel-head">
                        <h2>Requests, last 14 days</h2>
                    </div>
                    <RequestsChart daily={d.daily_requests} />
                </section>

                <section className="admin-card sa-panel">
                    <div className="sa-panel-head">
                        <h2>Requests by status</h2>
                    </div>
                    <StatusBars counts={d.status_counts} />
                </section>

                <section className="admin-card sa-panel">
                    <div className="sa-panel-head">
                        <h2>Employee workload</h2>
                    </div>
                    {(!d.employee_workload || d.employee_workload.length === 0) ? (
                        <p className="sa-muted">No active employees yet.</p>
                    ) : (
                        <ul className="sa-bars">
                            {d.employee_workload.map((w) => (
                                <li key={w.employee_id}>
                                    <div className="sa-bars-head">
                                        <span>{w.name || 'Employee'}</span>
                                        <strong>{w.active_requests}</strong>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <section className="admin-card sa-panel">
                    <div className="sa-panel-head">
                        <h2>Recently registered students</h2>
                    </div>
                    {(!d.recent_students || d.recent_students.length === 0) ? (
                        <p className="sa-muted">No students yet.</p>
                    ) : (
                        <ul className="sa-feed">
                            {d.recent_students.map((s) => (
                                <li key={s.student_id}>
                                    <span className="sa-feed-name">{s.full_name || 'Unknown'}</span>
                                    <span className="sa-feed-meta">{s.student_number} · {s.college_name || 'Unassigned'} · {timeAgo(s.created_at)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>

            <section className="admin-card">
                <div className="sa-panel-head">
                    <h2>Recent requests</h2>
                </div>
                {(!d.recent_requests || d.recent_requests.length === 0) ? (
                    <p className="admin-empty">No requests yet.</p>
                ) : (
                    <div className="admin-table-wrapper">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Request #</th>
                                    <th>Student</th>
                                    <th>Document</th>
                                    <th>Status</th>
                                    <th>Amount</th>
                                    <th>Requested</th>
                                </tr>
                            </thead>
                            <tbody>
                                {d.recent_requests.map((r) => (
                                    <tr key={r.request_id}>
                                        <td>{r.request_number || r.request_id}</td>
                                        <td>{r.student_name || 'Unknown'}</td>
                                        <td>{r.document_name || '—'}</td>
                                        <td>
                                            <span className="sa-pill is-active">{STATUS_LABELS[r.status] || r.status}</span>
                                        </td>
                                        <td>{peso(r.total_amount)}</td>
                                        <td title={formatWhen(r.requested_at)}>{timeAgo(r.requested_at)}</td>
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

export default SuperAdminHeadDashboard
