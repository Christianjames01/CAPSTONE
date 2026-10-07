import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { confirmModal, notifyError, notifySuccess } from '../../lib/notify'
import certichainLogo from '../../assets/certichain-logo.png'
import ThemeToggle from '../../components/ThemeToggle'
import './SuperAdmin.css'

const ROLE_LABELS = {
    student: 'Students',
    employee: 'Employees',
    registrar_head: 'Registrar heads',
    admin: 'System admins',
    superadmin: 'Superadmins',
}

const ROLE_NAMES = {
    student: 'Student',
    employee: 'Employee',
    registrar_head: 'Registrar Head',
    admin: 'System Admin',
    superadmin: 'Superadmin',
}

function formatWhen(value) {
    if (!value) return 'Never'
    return new Date(value).toLocaleString('en-PH', {
        timeZone: 'Asia/Manila',
        dateStyle: 'medium',
        timeStyle: 'short',
    })
}

function Stat({ label, value, note }) {
    return (
        <div className="superadmin-stat">
            <span className="superadmin-stat-value">{value ?? '—'}</span>
            <span className="superadmin-stat-label">{label}</span>
            {note && <span className="superadmin-stat-note">{note}</span>}
        </div>
    )
}

function SuperAdmin() {
    const navigate = useNavigate()
    const [overview, setOverview] = useState(null)
    const [accounts, setAccounts] = useState([])
    const [logins, setLogins] = useState([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState('')
    const [query, setQuery] = useState('')
    const [busyId, setBusyId] = useState(null)

    const load = useCallback(async () => {
        setLoading(true)
        const [overviewRes, accountsRes, loginsRes] = await Promise.all([
            supabase.rpc('superadmin_overview'),
            supabase.rpc('superadmin_list_accounts'),
            supabase.rpc('superadmin_login_history', { p_limit: 200 }),
        ])
        const failed = overviewRes.error || accountsRes.error || loginsRes.error
        setLoadError(failed ? failed.message : '')
        setOverview(overviewRes.data || null)
        setAccounts(accountsRes.data || [])
        setLogins(loginsRes.data || [])
        setLoading(false)
    }, [])

    useEffect(() => {
        load()
    }, [load])

    const visibleLogins = useMemo(() => {
        const q = query.trim().toLowerCase()
        if (!q) return logins
        return logins.filter((row) =>
            `${row.full_name || ''} ${row.email || ''} ${row.role || ''}`.toLowerCase().includes(q)
        )
    }, [logins, query])

    async function toggleStatus(account) {
        const name = account.full_name || account.email
        const next = account.status === 'active' ? 'inactive' : 'active'
        const verb = next === 'inactive' ? 'Deactivate' : 'Reactivate'
        const confirmed = await confirmModal(
            next === 'inactive'
                ? `${name} won't be able to log in until the account is reactivated.`
                : `${name} will be able to log in again.`,
            { title: `${verb} this account?`, confirmButtonText: verb }
        )
        if (!confirmed) return

        setBusyId(account.user_id)
        const { error } = await supabase.rpc('superadmin_set_account_status', {
            p_user_id: account.user_id,
            p_status: next,
        })
        setBusyId(null)

        if (error) {
            notifyError(error.message)
            return
        }
        notifySuccess(`${name} ${next === 'active' ? 'reactivated' : 'deactivated'}.`)
        load()
    }

    async function signOut() {
        await supabase.auth.signOut()
        navigate('/login', { replace: true })
    }

    const stats = overview || {}
    const roleCounts = Object.keys(ROLE_LABELS).filter((role) => stats.accounts?.[role])

    return (
        <div className="superadmin-page">
            <ThemeToggle />
            <header className="superadmin-header">
                <div className="superadmin-brand">
                    <img src={certichainLogo} alt="" />
                    <div>
                        <h1>Superadmin</h1>
                        <p>Login activity and account control</p>
                    </div>
                </div>
                <div className="superadmin-header-actions">
                    <button type="button" className="superadmin-button" onClick={load} disabled={loading}>
                        {loading ? 'Loading…' : 'Refresh'}
                    </button>
                    <button type="button" className="superadmin-button is-ghost" onClick={signOut}>
                        Sign out
                    </button>
                </div>
            </header>

            {loadError && (
                <div className="superadmin-alert" role="alert">
                    Could not load superadmin data: {loadError}. If this is the first time, the
                    superadmin database migration may not be applied yet.
                </div>
            )}

            <section className="superadmin-stats" aria-label="Login summary">
                <Stat label="Logins today" value={overview ? stats.logins_today : null} note="Manila time" />
                <Stat label="Logins, last 7 days" value={overview ? stats.logins_7d : null} />
                <Stat label="People who signed in, last 7 days" value={overview ? stats.users_7d : null} />
                <Stat
                    label="Active accounts"
                    value={overview ? stats.active : null}
                    note={overview ? `${stats.inactive ?? 0} inactive` : null}
                />
            </section>

            {roleCounts.length > 0 && (
                <section className="superadmin-roles" aria-label="Accounts by role">
                    {roleCounts.map((role) => (
                        <span key={role} className="superadmin-role-chip">
                            {ROLE_LABELS[role]} <strong>{stats.accounts[role]}</strong>
                        </span>
                    ))}
                </section>
            )}

            <section className="superadmin-card">
                <div className="superadmin-card-head">
                    <h2>Admin and registrar head accounts</h2>
                </div>
                {accounts.length === 0 ? (
                    <p className="superadmin-empty">No admin or registrar head accounts yet.</p>
                ) : (
                    <div className="superadmin-table-wrap">
                        <table className="superadmin-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Role</th>
                                    <th>Status</th>
                                    <th>Last sign-in</th>
                                    <th>Created</th>
                                    <th aria-label="Actions" />
                                </tr>
                            </thead>
                            <tbody>
                                {accounts.map((account) => (
                                    <tr key={account.user_id}>
                                        <td>
                                            <span className="superadmin-name">{account.full_name || '—'}</span>
                                            <span className="superadmin-email">{account.email}</span>
                                        </td>
                                        <td>{ROLE_NAMES[account.role] || account.role}</td>
                                        <td>
                                            <span className={`superadmin-pill${account.status === 'active' ? ' is-active' : ' is-inactive'}`}>
                                                {account.status === 'active' ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td>{formatWhen(account.last_sign_in_at)}</td>
                                        <td>{formatWhen(account.account_created_at)}</td>
                                        <td className="superadmin-actions-cell">
                                            <button
                                                type="button"
                                                className={`superadmin-button ${account.status === 'active' ? 'is-danger' : 'is-success'}`}
                                                onClick={() => toggleStatus(account)}
                                                disabled={busyId === account.user_id}
                                            >
                                                {account.status === 'active' ? 'Deactivate' : 'Reactivate'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <section className="superadmin-card">
                <div className="superadmin-card-head">
                    <h2>Recent logins</h2>
                    <input
                        type="search"
                        className="superadmin-search"
                        placeholder="Search name, email or role"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        aria-label="Search login history"
                    />
                </div>
                {visibleLogins.length === 0 ? (
                    <p className="superadmin-empty">{logins.length === 0 ? 'No logins recorded yet.' : 'No logins match your search.'}</p>
                ) : (
                    <div className="superadmin-table-wrap">
                        <table className="superadmin-table">
                            <thead>
                                <tr>
                                    <th>When</th>
                                    <th>Name</th>
                                    <th>Role</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleLogins.map((row, index) => (
                                    <tr key={`${row.user_id}-${row.logged_in_at}-${index}`}>
                                        <td>{formatWhen(row.logged_in_at)}</td>
                                        <td>
                                            <span className="superadmin-name">{row.full_name || 'Unknown'}</span>
                                            <span className="superadmin-email">{row.email}</span>
                                        </td>
                                        <td>{ROLE_NAMES[row.role] || row.role || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    )
}

export default SuperAdmin
