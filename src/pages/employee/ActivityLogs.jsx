import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { SkeletonList } from '../../components/Skeleton'
import HighlightedText from '../../components/HighlightedText'
import PageStats from '../../components/PageStats'
import { IconHistory } from './icons'
import { IconCalendarCheck, IconBarChart } from '../admin/icons'
import './EmployeePages.css'
import { useLiveRefresh } from '../../lib/useLiveRefresh'

function ActivityLogs() {
    const [logs, setLogs] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useLiveRefresh(['activity_logs'], (options) => loadLogs(options))

    useEffect(() => {
        loadLogs()
    }, [])

    const loadLogs = async ({ silent = false } = {}) => {
        try {
            if (!silent) setLoading(true)
            setError('')

            const {
                data: { user },
                error: userError
            } = await supabase.auth.getUser()

            if (userError || !user) {
                throw new Error('You are not logged in.')
            }

            const { data: employee, error: employeeError } = await supabase
                .from('employees')
                .select('employee_id')
                .eq('user_id', user.id)
                .single()

            if (employeeError || !employee) {
                throw new Error('Employee record could not be found.')
            }

            const { data, error: logsError } = await supabase
                .from('activity_logs')
                .select('activity_log_id, action, table_name, record_id, description, created_at')
                .eq('employee_id', employee.employee_id)
                .order('created_at', { ascending: false })
                .limit(100)

            if (logsError) {
                throw new Error('Failed to load activity logs: ' + logsError.message)
            }

            setLogs(data || [])

        } catch (err) {
            console.error('ACTIVITY LOGS ERROR:', err)
            setError(err.message || 'Failed to load activity logs.')
        } finally {
            setLoading(false)
        }
    }

    const formatDate = (value) =>
        new Date(value).toLocaleString('en-PH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        })

    return (
        <div>
            <div className="employee-page-header">
                <h1>Activity Logs</h1>
                <p>A record of actions you've taken on requests, receipts, requirements, and claim schedules.</p>
            </div>

            {error && <div className="employee-error-box">{error}</div>}

            {!loading && logs.length > 0 && (() => {
                const counts = {}
                for (const l of logs) counts[l.action] = (counts[l.action] || 0) + 1
                const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
                return (
                    <PageStats
                        stats={[
                            { label: 'Your actions', value: logs.length, note: 'Most recent first', Icon: IconHistory },
                            { label: 'Today', value: logs.filter((l) => new Date(l.created_at).toDateString() === new Date().toDateString()).length, note: 'Recorded today', Icon: IconCalendarCheck },
                            { label: 'Most common', value: top ? top[1] : 0, note: top ? top[0].replace(/_/g, ' ') : '—', Icon: IconBarChart },
                        ]}
                    />
                )
            })()}

            {loading ? (
                <SkeletonList count={3} />
            ) : logs.length === 0 ? (
                <div className="employee-empty">
                    No activity has been recorded yet. Actions you take (verifying payments,
                    approving requirements, processing requests, scheduling claims) will
                    appear here.
                </div>
            ) : (
                logs.map((log) => (
                    <div className="employee-list-card" key={log.activity_log_id}>
                        <div className="employee-list-card-header">
                            <div className="ui-card-title">
                                <span className="ui-avatar is-square" aria-hidden="true"><IconHistory /></span>
                                <div>
                                    <span className="ui-log-action">{log.action.replace(/_/g, ' ')}</span>
                                    <p style={{ marginTop: 6 }}>{log.description ? <HighlightedText text={log.description} /> : (log.table_name ? `on ${log.table_name}` : '')}</p>
                                </div>
                            </div>

                            <span style={{ fontSize: 12, color: 'var(--slate)', whiteSpace: 'nowrap' }}>
                                {formatDate(log.created_at)}
                            </span>
                        </div>
                    </div>
                ))
            )}
        </div>
    )
}

export default ActivityLogs
