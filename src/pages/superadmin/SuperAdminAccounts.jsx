import { useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { confirmModal, notifyError, notifySuccess } from '../../lib/notify'
import { ROLE_NAMES, STAFF_ROLES, displayName, downloadCsv, formatWhen, timeAgo } from './superadminFormat'
import { friendlyError } from '../../lib/friendlyError'

const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'online', label: 'Online now' },
    { key: 'admin', label: 'System admins' },
    { key: 'registrar_head', label: 'Registrar heads' },
    { key: 'employee', label: 'Employees' },
    { key: 'student', label: 'Students' },
    { key: 'inactive', label: 'Deactivated' },
]

function SuperAdminAccounts({ accounts, onChanged }) {
    const [filter, setFilter] = useState('all')
    const [query, setQuery] = useState('')
    const [busyId, setBusyId] = useState(null)

    const counts = useMemo(() => {
        const result = { all: accounts.length, inactive: 0, online: 0 }
        for (const a of accounts) {
            result[a.role] = (result[a.role] || 0) + 1
            if (a.status !== 'active') result.inactive += 1
            if (a.online) result.online += 1
        }
        return result
    }, [accounts])

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase()
        return accounts.filter((a) => {
            if (filter === 'inactive' && a.status === 'active') return false
            if (filter === 'online' && !a.online) return false
            if (!['all', 'inactive', 'online'].includes(filter) && a.role !== filter) return false
            if (!q) return true
            return `${a.full_name || ''} ${a.email || ''} ${ROLE_NAMES[a.role] || ''}`.toLowerCase().includes(q)
        })
    }, [accounts, filter, query])

    async function changeRole(account) {
        const name = displayName(account)
        const next = account.role === 'admin' ? 'registrar_head' : 'admin'
        const nextLabel = ROLE_NAMES[next] || next
        const confirmed = await confirmModal(
            `${name} will be switched from ${ROLE_NAMES[account.role] || account.role} to ${nextLabel}.`,
            { title: `Change role to ${nextLabel}?`, confirmButtonText: 'Change role' }
        )
        if (!confirmed) return

        setBusyId(account.user_id)
        const { error } = await supabase.rpc('superadmin_set_account_role', {
            p_user_id: account.user_id,
            p_role: next,
        })
        setBusyId(null)

        if (error) {
            notifyError(friendlyError(error))
            return
        }
        notifySuccess(`${name} is now ${nextLabel}.`)
        onChanged()
    }

    async function toggleStatus(account) {
        const name = displayName(account)
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
            notifyError(friendlyError(error))
            return
        }
        notifySuccess(`${name} ${next === 'active' ? 'reactivated' : 'deactivated'}.`)
        onChanged()
    }

    function exportAccounts() {
        downloadCsv(
            `certichain-accounts-${new Date().toISOString().slice(0, 10)}.csv`,
            ['Name', 'Email', 'Role', 'Status', 'Created', 'Last sign-in'],
            visible.map((a) => [
                a.full_name, a.email, ROLE_NAMES[a.role] || a.role, a.status,
                formatWhen(a.account_created_at), formatWhen(a.last_sign_in_at),
            ])
        )
    }

    return (
        <>
            <header className="admin-page-header-row">
                <div className="admin-page-header">
                    <h1>Accounts</h1>
                    <p>Every account in the system. Staff accounts can be deactivated here.</p>
                </div>
                <button type="button" className="admin-link-button" onClick={exportAccounts} disabled={visible.length === 0}>
                    Export CSV
                </button>
            </header>

            <div className="sa-toolbar">
                <div className="sa-chips" role="tablist" aria-label="Filter accounts">
                    {FILTERS.map((f) => (
                        <button
                            key={f.key}
                            type="button"
                            role="tab"
                            aria-selected={filter === f.key}
                            className={`admin-filter-chip${filter === f.key ? ' active' : ''}`}
                            onClick={() => setFilter(f.key)}
                        >
                            {f.label} <span className="sa-chip-count">{counts[f.key] ?? 0}</span>
                        </button>
                    ))}
                </div>
                <input
                    type="search"
                    className="admin-search-input"
                    placeholder="Search name, email or role"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label="Search accounts"
                />
            </div>

            <section className="admin-card">
                {visible.length === 0 ? (
                    <p className="admin-empty">No accounts match this filter.</p>
                ) : (
                    <div className="admin-table-wrapper">
                        <table className="admin-table">
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
                                {visible.map((a) => {
                                    const isStaff = STAFF_ROLES.includes(a.role)
                                    return (
                                        <tr key={a.user_id}>
                                            <td>
                                                <span className="sa-name">{displayName(a)}</span>
                                                <span className="sa-sub">{a.email}</span>
                                            </td>
                                            <td>{ROLE_NAMES[a.role] || a.role}</td>
                                            <td>
                                                <span className={`sa-pill ${a.status === 'active' ? 'is-active' : 'is-inactive'}`}>
                                                    {a.status === 'active' ? 'Active' : 'Deactivated'}
                                                </span>
                                            </td>
                                            <td title={formatWhen(a.last_sign_in_at)}>
                                                {a.online ? (
                                                    <span className="sa-online-label">
                                                        <span className="sa-online-dot" />
                                                        Online
                                                    </span>
                                                ) : a.last_sign_in_at ? (
                                                    timeAgo(a.last_sign_in_at)
                                                ) : (
                                                    <span className="sa-muted">Never</span>
                                                )}
                                            </td>
                                            <td>{formatWhen(a.account_created_at)}</td>
                                            <td className="sa-actions-cell">
                                                {isStaff ? (
                                                    <>
                                                        <button
                                                            type="button"
                                                            className="admin-link-button"
                                                            onClick={() => changeRole(a)}
                                                            disabled={busyId === a.user_id}
                                                        >
                                                            Make {a.role === 'admin' ? 'Registrar Head' : 'System Admin'}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className={`admin-link-button ${a.status === 'active' ? 'is-danger' : 'is-success'}`}
                                                            onClick={() => toggleStatus(a)}
                                                            disabled={busyId === a.user_id}
                                                        >
                                                            {a.status === 'active' ? 'Deactivate' : 'Reactivate'}
                                                        </button>
                                                    </>
                                                ) : (
                                                    <span className="sa-sub" title="Managed by registrar staff">Staff-managed</span>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </>
    )
}

export default SuperAdminAccounts
