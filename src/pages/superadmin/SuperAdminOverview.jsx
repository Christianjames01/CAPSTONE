import { Link, useOutletContext } from 'react-router-dom'
import { ROLE_NAMES, STAFF_ROLES, daysSince, displayName, formatDay, timeAgo } from './superadminFormat'
import { SkeletonStatGrid } from '../../components/Skeleton'

function Tile({ label, value, note, tone }) {
    return (
        <div className={`sa-tile${tone ? ` is-${tone}` : ''}`}>
            <span className="sa-tile-label">{label}</span>
            <span className="sa-tile-value">{value ?? '—'}</span>
            {note && <span className="sa-tile-note">{note}</span>}
        </div>
    )
}

function LoginChart({ daily }) {
    if (daily.length === 0) return <p className="sa-muted">No login data yet.</p>
    const peak = Math.max(1, ...daily.map((d) => Number(d.logins)))
    return (
        <div className="sa-chart" role="img" aria-label="Logins per day">
            {daily.map((d) => {
                const logins = Number(d.logins)
                const height = logins === 0 ? 2 : Math.max(8, (logins / peak) * 100)
                return (
                    <div key={d.day} className="sa-chart-col" title={`${formatDay(d.day)}: ${logins} login${logins === 1 ? '' : 's'}, ${d.unique_users} people`}>
                        <span className="sa-chart-count">{logins || ''}</span>
                        <div className="sa-chart-bar" style={{ height: `${height}%` }} />
                        <span className="sa-chart-label">{formatDay(d.day)}</span>
                    </div>
                )
            })}
        </div>
    )
}

function RoleBars({ counts }) {
    const entries = Object.entries(counts || {}).sort((a, b) => b[1] - a[1])
    const total = entries.reduce((sum, [, n]) => sum + Number(n), 0) || 1
    if (entries.length === 0) return <p className="sa-muted">No accounts yet.</p>
    return (
        <ul className="sa-bars">
            {entries.map(([role, n]) => (
                <li key={role}>
                    <div className="sa-bars-head">
                        <span>{ROLE_NAMES[role] || role}</span>
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

function SuperAdminOverview() {
    const { overview, accounts, logins, daily, loading } = useOutletContext()
    const stats = overview || {}
    const staff = accounts.filter((a) => STAFF_ROLES.includes(a.role))
    const neverSignedIn = staff.filter((a) => a.status === 'active' && !a.last_sign_in_at)
    const idle = staff.filter((a) => a.status === 'active' && a.last_sign_in_at && daysSince(a.last_sign_in_at) > 30)
    const inactive = accounts.filter((a) => a.status !== 'active')
    const onlineIds = new Set(accounts.filter((a) => a.online).map((a) => a.user_id))
    const stillLoading = loading && !overview

    return (
        <>
            <header className="sa-page-header">
                <h1>Overview</h1>
                <p>How the system is being used, and which accounts need attention.</p>
            </header>

            {stillLoading ? (
                <SkeletonStatGrid count={5} />
            ) : (
                <section className="sa-tiles">
                    <Tile
                        label="Online right now"
                        value={stats.online_now}
                        note={<span className="sa-online-label"><span className="sa-online-dot" aria-hidden="true" />Live</span>}
                        tone="online"
                    />
                    <Tile label="Logins today" value={stats.logins_today} note="Manila time" />
                    <Tile label="Logins, last 7 days" value={stats.logins_7d} />
                    <Tile label="People signed in, 7 days" value={stats.users_7d} />
                    <Tile
                        label="Active accounts"
                        value={stats.active}
                        note={`${stats.inactive ?? 0} inactive`}
                    />
                </section>
            )}

            <div className="sa-grid">
                <section className="sa-card sa-panel-wide">
                    <div className="sa-card-head">
                        <h2>Logins, last 14 days</h2>
                        <Link to="/superadmin/logins" className="sa-btn sa-btn-ghost">Full history →</Link>
                    </div>
                    <LoginChart daily={daily} />
                </section>

                <section className="sa-card">
                    <div className="sa-card-head">
                        <h2>Accounts by role</h2>
                        <Link to="/superadmin/accounts" className="sa-btn sa-btn-ghost">Manage →</Link>
                    </div>
                    <RoleBars counts={stats.accounts} />
                </section>

                <section className="sa-card">
                    <div className="sa-card-head">
                        <h2>Needs attention</h2>
                    </div>
                    <ul className="sa-attention">
                        <AttentionRow
                            count={neverSignedIn.length}
                            label="Staff accounts that never signed in"
                            to="/superadmin/accounts"
                            tone="warn"
                        />
                        <AttentionRow
                            count={idle.length}
                            label="Active staff accounts idle for 30+ days"
                            to="/superadmin/accounts"
                            tone="warn"
                        />
                        <AttentionRow
                            count={inactive.length}
                            label="Deactivated accounts"
                            to="/superadmin/accounts"
                            tone="muted"
                        />
                    </ul>
                </section>

                <section className="sa-card">
                    <div className="sa-card-head">
                        <h2>Latest sign-ins</h2>
                    </div>
                    {logins.length === 0 ? (
                        <p className="sa-muted">No logins recorded yet.</p>
                    ) : (
                        <ul className="sa-feed">
                            {logins.slice(0, 8).map((row, index) => (
                                <li key={`${row.user_id}-${row.logged_in_at}-${index}`}>
                                    <span className="sa-feed-name">
                                        {onlineIds.has(row.user_id) && <span className="sa-online-dot" title="Online now" />}
                                        {displayName(row)}
                                    </span>
                                    <span className="sa-feed-meta">{ROLE_NAMES[row.role] || row.role} · {timeAgo(row.logged_in_at)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </>
    )
}

function AttentionRow({ count, label, to, tone }) {
    return (
        <li className={`sa-attention-row is-${tone}`}>
            <span className="sa-attention-count">{count}</span>
            <Link to={to}>{label}</Link>
        </li>
    )
}

export default SuperAdminOverview
