import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { IconPulse } from './icons'

// Four on-demand spot checks -- real pass/fail/unavailable, never a
// fabricated uptime percentage or a polling "monitoring" promise. Each is
// re-run only when asked (the button, or once on page load), since these
// are checks, not a live dashboard.
const CHECKS = [
    {
        key: 'database',
        label: 'Database',
        description: 'A real query against a known table.',
        run: async () => {
            const { error } = await supabase.from('system_settings').select('setting_key').limit(1)
            if (error) throw error
            return 'Reachable and responding to queries.'
        },
    },
    {
        key: 'auth',
        label: 'Authentication service',
        description: 'Checks that Supabase Auth responds — not that this session is signed in.',
        run: async () => {
            const { error } = await supabase.auth.getSession()
            if (error) throw error
            return 'Auth service responded.'
        },
    },
    {
        key: 'storage',
        label: 'File storage',
        description: 'Storage usage summary, same data the Dashboard’s storage card uses.',
        run: async () => {
            const { data, error } = await supabase.rpc('get_storage_usage_summary')
            if (error) throw error
            const mb = data?.total_bytes ? (data.total_bytes / (1024 * 1024)).toFixed(1) : '0'
            return `Reachable. ${mb} MB used${data?.limit_mb ? ` of ${data.limit_mb} MB` : ''}.`
        },
    },
    {
        key: 'verify',
        label: 'Document verification',
        description: 'Checks that the public verification endpoint is reachable and responding — not that any specific credential is valid.',
        run: async () => {
            const { data, error } = await supabase.functions.invoke('verify-credential', {
                body: { credentialNumber: '__system-health-check__' },
            })
            if (error) throw error
            if (!('result' in (data || {}))) throw new Error('Unexpected response shape.')
            return 'Endpoint reachable and responding correctly.'
        },
    },
]

function HealthCard({ check, state }) {
    const status = state?.status || 'checking'
    return (
        <div className="sa-card sa-health-card">
            <div className="sa-health-head">
                <h3>{check.label}</h3>
                {status === 'checking' && <span className="sa-badge">Checking…</span>}
                {status === 'pass' && <span className="sa-badge is-active">Passing</span>}
                {status === 'fail' && <span className="sa-badge is-danger">Failing</span>}
            </div>
            <p>{check.description}</p>
            {status === 'pass' && <p className="sa-muted">{state.message}</p>}
            {status === 'fail' && <p className="sa-muted" style={{ color: 'var(--sa-danger)' }}>{state.message}</p>}
            {state?.checkedAt && (
                <p className="sa-muted">Checked {new Date(state.checkedAt).toLocaleTimeString('en-PH')}</p>
            )}
        </div>
    )
}

function SuperAdminSystemHealth() {
    const [results, setResults] = useState({})
    const [runningAll, setRunningAll] = useState(false)

    const runCheck = useCallback(async (check) => {
        setResults((prev) => ({ ...prev, [check.key]: { status: 'checking' } }))
        try {
            const message = await check.run()
            setResults((prev) => ({ ...prev, [check.key]: { status: 'pass', message, checkedAt: Date.now() } }))
        } catch (err) {
            setResults((prev) => ({
                ...prev,
                [check.key]: { status: 'fail', message: err?.message || 'Check failed.', checkedAt: Date.now() },
            }))
        }
    }, [])

    const runAll = useCallback(async () => {
        setRunningAll(true)
        await Promise.all(CHECKS.map((check) => runCheck(check)))
        setRunningAll(false)
    }, [runCheck])

    useEffect(() => {
        runAll()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <>
            <header className="sa-page-header-row">
                <div className="sa-page-header">
                    <h1>System Health</h1>
                    <p>On-demand checks for each core service. Not a historical uptime monitor.</p>
                </div>
                <button type="button" className="sa-btn sa-btn-primary" onClick={runAll} disabled={runningAll}>
                    <IconPulse /> {runningAll ? 'Checking…' : 'Re-check all'}
                </button>
            </header>

            <div className="sa-health-grid">
                {CHECKS.map((check) => (
                    <HealthCard key={check.key} check={check} state={results[check.key]} />
                ))}
            </div>
        </>
    )
}

export default SuperAdminSystemHealth
