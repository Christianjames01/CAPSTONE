import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { notifyError } from '../../lib/notify'
import { friendlyError } from '../../lib/friendlyError'
import { useLiveRefresh } from '../../lib/useLiveRefresh'
import { ROLE_NAMES, formatWhen } from './superadminFormat'
import { SkeletonStatGrid } from '../../components/Skeleton'

function SuperAdminSecurity() {
    const [snapshot, setSnapshot] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    async function load() {
        setLoading(true)
        const { data, error: rpcError } = await supabase.rpc('superadmin_security_snapshot')
        const message = rpcError ? friendlyError(rpcError, 'Failed to load security data.') : ''
        setError(message)
        if (rpcError) notifyError(message)
        setSnapshot(data || null)
        setLoading(false)
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Lockouts are set by the login-guard edge function, which writes
    // profiles.locked_until -- show a new one without waiting for a manual
    // refresh.
    useLiveRefresh(['profiles'], load)

    const locked = snapshot?.currently_locked || []

    return (
        <>
            <header className="sa-page-header">
                <h1>Security Center</h1>
                <p>Live account-lockout and sign-in abuse state.</p>
            </header>

            <div className="sa-note">
                This shows live state only. Failed-attempt counters reset automatically on a successful
                sign-in, and the per-IP abuse log is purged hourly for anything older than a day —
                there is no historical security event log to browse further back than that.
            </div>

            {loading && !snapshot ? (
                <SkeletonStatGrid count={3} />
            ) : (
                <section className="sa-tiles">
                    <div className="sa-tile">
                        <span className="sa-tile-label">Currently locked accounts</span>
                        <span className="sa-tile-value">{snapshot?.currently_locked_count ?? 0}</span>
                    </div>
                    <div className="sa-tile">
                        <span className="sa-tile-label">Accounts with pending failed attempts</span>
                        <span className="sa-tile-value">{snapshot?.accounts_with_pending_failures ?? 0}</span>
                        <span className="sa-tile-note">Not yet locked out</span>
                    </div>
                    <div className="sa-tile">
                        <span className="sa-tile-label">Flagged attempts, last hour</span>
                        <span className="sa-tile-value">{snapshot?.ip_flagged_attempts_1h ?? 0}</span>
                        <span className="sa-tile-note">{snapshot?.ip_flagged_distinct_ips_1h ?? 0} distinct IP(s)</span>
                    </div>
                </section>
            )}

            <section className="sa-card">
                <div className="sa-card-head">
                    <h2>Currently locked accounts</h2>
                    <button type="button" className="sa-btn sa-btn-ghost" onClick={load} disabled={loading}>
                        {loading ? 'Refreshing…' : 'Refresh'}
                    </button>
                </div>

                {error ? (
                    <p className="sa-empty">{error}</p>
                ) : locked.length === 0 ? (
                    <p className="sa-empty">No accounts are currently locked, and no suspicious IP activity in the last hour.</p>
                ) : (
                    <div className="sa-table-wrapper">
                        <table className="sa-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Role</th>
                                    <th>Failed attempts</th>
                                    <th>Locked until</th>
                                </tr>
                            </thead>
                            <tbody>
                                {locked.map((row) => (
                                    <tr key={row.user_id}>
                                        <td>
                                            <span className="sa-name">{row.full_name?.trim() || row.email || 'Unnamed account'}</span>
                                            <span className="sa-sub">{row.email}</span>
                                        </td>
                                        <td>{ROLE_NAMES[row.role] || row.role}</td>
                                        <td>{row.failed_login_attempts ?? '—'}</td>
                                        <td>{formatWhen(row.locked_until)}</td>
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

export default SuperAdminSecurity
