import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { SkeletonList } from '../../components/Skeleton'
import HighlightedText from '../../components/HighlightedText'
import './EmployeePages.css'

function ActivityLogs() {
    const [logs, setLogs] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        loadLogs()
    }, [])

    const loadLogs = async () => {
        try {
            setLoading(true)
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
                            <div>
                                <h3 style={{ textTransform: 'capitalize' }}>{log.action.replace(/_/g, ' ')}</h3>
                                <p>{log.description ? <HighlightedText text={log.description} /> : (log.table_name ? `on ${log.table_name}` : '')}</p>
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
