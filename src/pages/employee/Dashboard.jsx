import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { IconAlertCircle, IconClock } from '../student/icons'
import { IconShieldCheck, IconGear } from './icons'
import { IconPackage, IconCheckCircle, IconCalendarCheck } from '../admin/icons'
import { Skeleton } from '../../components/Skeleton'
import { localDay } from '../../lib/dashboardData'
import '../../components/DashboardStats.css'
import './EmployeePages.css'
import './EmployeeDashboard.css'

// Employee dashboard: an inbox of the requests waiting on this employee,
// grouped by the next step, with a direct action on every row. Deliberately
// different from the head's office-wide statistics dashboard.

const QUEUES = [
    {
        key: 'verify',
        label: 'To verify',
        statuses: ['receipt_uploaded'],
        action: 'Verify',
        empty: 'No receipts are waiting to be checked.',
        Icon: IconShieldCheck,
        color: 'var(--status-verification)',
    },
    {
        key: 'process',
        label: 'In processing',
        statuses: ['receipt_verified', 'processing', 'lacking_requirements'],
        action: 'Process',
        empty: 'Nothing is being processed right now.',
        Icon: IconGear,
        color: 'var(--status-processing)',
    },
    {
        key: 'release',
        label: 'Ready to release',
        statuses: ['ready_for_claiming'],
        action: 'Schedule',
        empty: 'No documents are waiting to be released.',
        Icon: IconPackage,
        color: 'var(--status-ready)',
    },
    {
        key: 'awaiting',
        label: 'Awaiting payment',
        statuses: ['pending', 'payment_pending'],
        action: 'View',
        empty: 'No requests are waiting on student payment.',
        Icon: IconClock,
        color: 'var(--status-pending)',
    },
]

const RELEASING_QUEUES = QUEUES.filter((q) => q.key === 'release')

const DAY_MS = 24 * 60 * 60 * 1000

const greetingFor = (date) => {
    const hour = date.getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
}

const formatTime = (time) => {
    if (!time) return '—'
    const [hours, minutes] = time.split(':')
    const date = new Date()
    date.setHours(Number(hours), Number(minutes), 0, 0)
    return date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
}

const waitingText = (days) => (days <= 0 ? 'Today' : days === 1 ? '1 day' : `${days} days`)

function EmployeeDashboard() {
    const navigate = useNavigate()

    const [employee, setEmployee] = useState(null)
    const [name, setName] = useState('')
    const [requests, setRequests] = useState([])
    const [documentNames, setDocumentNames] = useState({})
    const [studentNumbers, setStudentNumbers] = useState({})
    const [todaySchedules, setTodaySchedules] = useState([])
    const [missedCount, setMissedCount] = useState(0)
    const [rescheduleRequestCount, setRescheduleRequestCount] = useState(0)
    const [loading, setLoading] = useState(true)
    const [errorMessage, setErrorMessage] = useState('')
    const [activeQueue, setActiveQueue] = useState(null)
    // One clock reading per page load, so every "waiting N days" agrees.
    const [now] = useState(() => new Date())

    useEffect(() => {
        loadDashboard()
    }, [])

    const loadDashboard = async () => {
        try {
            setLoading(true)
            setErrorMessage('')

            const {
                data: { user },
                error: authError
            } = await supabase.auth.getUser()

            if (authError) throw new Error(authError.message)
            if (!user) throw new Error('You are not logged in.')

            const { data: profile } = await supabase
                .from('profiles')
                .select('first_name, last_name')
                .eq('user_id', user.id)
                .single()

            if (profile) {
                setName(profile.first_name)
            }

            const { data: employeeData, error: employeeError } = await supabase
                .from('employees')
                .select('employee_id, employee_number, position_title, assigned_college_id, status, access_scope')
                .eq('user_id', user.id)
                .single()

            if (employeeError) {
                throw new Error('Employee lookup failed: ' + employeeError.message)
            }

            if (!employeeData) {
                throw new Error('Employee record could not be found.')
            }

            setEmployee(employeeData)

            const isReleasingScope = employeeData.access_scope === 'releasing'

            let requestQuery = supabase
                .from('document_requests')
                .select('request_id, request_number, student_id, document_type_id, total_amount, status, requested_at, completed_at')
                .order('requested_at', { ascending: false })

            if (isReleasingScope) {
                // Releasing is a front-desk job: show claiming-relevant
                // requests office-wide, not just ones assigned to this account.
                requestQuery = requestQuery.in('status', ['ready_for_claiming', 'scheduled', 'claimed', 'completed'])
            } else {
                requestQuery = requestQuery.eq('assigned_employee_id', employeeData.employee_id)
            }

            const { data: requestData, error: requestError } = await requestQuery

            if (requestError) {
                throw new Error('Failed to load requests: ' + requestError.message)
            }

            const rows = requestData || []
            setRequests(rows)

            const documentTypeIds = [...new Set(rows.map((r) => r.document_type_id).filter(Boolean))]

            let todayScheduleQuery = supabase
                .from('claim_schedules')
                .select('claim_schedule_id, request_id, student_id, claim_time, scheduled_time, status')
                .eq('claim_date', localDay())
                .neq('status', 'cancelled')
                .order('claim_time', { ascending: true })

            if (!isReleasingScope) {
                todayScheduleQuery = todayScheduleQuery.eq('scheduled_by', employeeData.employee_id)
            }

            const myRequestIds = rows.map((r) => r.request_id)

            const [{ data: documentTypes }, { data: attentionSchedules }, { data: scheduleRows, error: scheduleError }] = await Promise.all([
                documentTypeIds.length
                    ? supabase.from('document_types').select('document_type_id, document_name').in('document_type_id', documentTypeIds)
                    : Promise.resolve({ data: [] }),
                myRequestIds.length
                    ? supabase.from('claim_schedules').select('claim_schedule_id, request_id, status, reschedule_requested_at').in('request_id', myRequestIds).neq('status', 'cancelled')
                    : Promise.resolve({ data: [] }),
                todayScheduleQuery,
            ])

            if (scheduleError) {
                console.error('TODAY SCHEDULE ERROR:', scheduleError)
            }

            setDocumentNames(Object.fromEntries((documentTypes || []).map((d) => [d.document_type_id, d.document_name])))

            const attentionRows = attentionSchedules || []
            setMissedCount(attentionRows.filter((s) => s.status === 'missed').length)
            setRescheduleRequestCount(attentionRows.filter((s) => s.reschedule_requested_at).length)

            const sRows = scheduleRows || []
            const scheduleRequestIds = [...new Set(sRows.map((s) => s.request_id))]
            const studentIds = [...new Set([...rows, ...sRows].map((r) => r.student_id).filter(Boolean))]

            const [{ data: scheduleRequests }, { data: students }] = await Promise.all([
                scheduleRequestIds.length
                    ? supabase.from('document_requests').select('request_id, request_number, document_type_id').in('request_id', scheduleRequestIds)
                    : Promise.resolve({ data: [] }),
                studentIds.length
                    ? supabase.from('students').select('student_id, student_number').in('student_id', studentIds)
                    : Promise.resolve({ data: [] }),
            ])

            const studentNumberById = Object.fromEntries((students || []).map((s) => [s.student_id, s.student_number]))
            setStudentNumbers(studentNumberById)

            const scheduleRequestById = Object.fromEntries((scheduleRequests || []).map((r) => [r.request_id, r]))

            setTodaySchedules(
                sRows.map((s) => ({
                    ...s,
                    requestNumber: scheduleRequestById[s.request_id]?.request_number || 'N/A',
                    studentNumber: studentNumberById[s.student_id] || 'N/A',
                }))
            )

        } catch (error) {
            console.error('EMPLOYEE DASHBOARD ERROR:', error)
            setErrorMessage(error.message || 'Failed to load employee dashboard.')
        } finally {
            setLoading(false)
        }
    }

    const isReleasingOnly = employee?.access_scope === 'releasing'
    const queueDefs = isReleasingOnly ? RELEASING_QUEUES : QUEUES

    // Each queue's requests, oldest first (the one waiting longest is next).
    const queues = useMemo(
        () => queueDefs.map((q) => ({
            ...q,
            items: requests
                .filter((r) => q.statuses.includes(r.status))
                .sort((a, b) => (a.requested_at || '').localeCompare(b.requested_at || ''))
                .map((r) => ({ ...r, waitingDays: r.requested_at ? Math.floor((now - new Date(r.requested_at)) / DAY_MS) : 0 })),
        })),
        [requests, queueDefs, now]
    )

    // Open on the first queue that has work in it.
    const currentKey = activeQueue || queues.find((q) => q.items.length > 0)?.key || queues[0]?.key
    const current = queues.find((q) => q.key === currentKey) || queues[0]

    const weekAgo = now.getTime() - 7 * DAY_MS
    const receivedThisWeek = requests.filter((r) => r.requested_at && new Date(r.requested_at).getTime() >= weekAgo).length
    const completedThisWeek = requests.filter((r) => r.completed_at && new Date(r.completed_at).getTime() >= weekAgo).length
    const progress = receivedThisWeek > 0 ? Math.min(1, completedThisWeek / receivedThisWeek) : completedThisWeek > 0 ? 1 : 0

    const openRequest = (r) => {
        if (r.status === 'ready_for_claiming') navigate(`/employee/requests/${r.request_id}/claim-schedule`)
        else navigate(`/employee/requests/${r.request_id}`)
    }

    const alerts = [
        { label: missedCount === 1 ? 'Missed claim' : 'Missed claims', value: missedCount, note: 'Students who did not show up' },
        { label: rescheduleRequestCount === 1 ? 'Reschedule request' : 'Reschedule requests', value: rescheduleRequestCount, note: 'Students asking for a new date' },
    ].filter((a) => a.value > 0)

    if (loading) {
        return <EmployeeDashboardSkeleton />
    }

    if (errorMessage) {
        return (
            <div className="employee-error-box">
                {errorMessage}
                <button className="employee-link-button" style={{ display: 'block', marginTop: 8 }} onClick={loadDashboard}>
                    Try again
                </button>
            </div>
        )
    }

    return (
        <div className="ed">
            <header className="ed-header">
                <div>
                    <h1>{greetingFor(now)}{name ? `, ${name}` : ''}</h1>
                    <p>
                        {now.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                        {employee?.position_title && <> · {employee.position_title}</>}
                    </p>
                </div>
                <button className="ed-header-link" onClick={() => navigate('/employee/requests')}>
                    All my requests →
                </button>
            </header>

            <div className="ed-focus" role="tablist" aria-label="Work queues">
                {queues.map((q) => (
                    <button
                        key={q.key}
                        role="tab"
                        aria-selected={q.key === currentKey}
                        className={`ed-focus-card${q.key === currentKey ? ' is-active' : ''}`}
                        style={{ '--q-color': q.color }}
                        onClick={() => setActiveQueue(q.key)}
                    >
                        <span className="ed-focus-icon" aria-hidden="true"><q.Icon /></span>
                        <span className="ed-focus-text">
                            <span className="ed-focus-count">{q.items.length}</span>
                            <span className="ed-focus-label">{q.label}</span>
                        </span>
                    </button>
                ))}
                <button
                    className="ed-focus-card ed-focus-static"
                    style={{ '--q-color': 'var(--status-completed)' }}
                    onClick={() => navigate('/employee/requests?status=completed')}
                >
                    <span className="ed-focus-icon" aria-hidden="true"><IconCheckCircle /></span>
                    <span className="ed-focus-text">
                        <span className="ed-focus-count">{completedThisWeek}</span>
                        <span className="ed-focus-label">Completed this week</span>
                    </span>
                </button>
            </div>

            <div className="ed-body">
                <section className="ed-queue" style={{ '--q-color': current?.color }}>
                    <div className="ed-queue-head">
                        <div>
                            <h2>{current?.label}</h2>
                            <span>{current?.items.length ? 'Oldest first — the top one has waited longest.' : ' '}</span>
                        </div>
                        <span className="ed-queue-count">{current?.items.length} {current?.items.length === 1 ? 'request' : 'requests'}</span>
                    </div>

                    {!current || current.items.length === 0 ? (
                        <div className="ed-queue-empty">
                            <span className="ed-queue-empty-icon" aria-hidden="true"><IconCheckCircle /></span>
                            <strong>Nothing here</strong>
                            <span>{current?.empty}</span>
                        </div>
                    ) : (
                        <ul className="ed-rows">
                            {current.items.slice(0, 8).map((r) => (
                                <li key={r.request_id} className="ed-row">
                                    <span className="ed-row-main">
                                        <strong>{documentNames[r.document_type_id] || 'Document request'}</strong>
                                        <span>
                                            {r.request_number}
                                            {studentNumbers[r.student_id] && <> · Student {studentNumbers[r.student_id]}</>}
                                            {r.status === 'lacking_requirements' && <em className="ed-row-flag">Lacking requirements</em>}
                                        </span>
                                    </span>
                                    <span className={`ed-row-wait${r.waitingDays >= 5 ? ' is-late' : r.waitingDays >= 3 ? ' is-aging' : ''}`}>
                                        <IconClock /> {waitingText(r.waitingDays)}
                                    </span>
                                    <button className="ed-row-action" onClick={() => openRequest(r)}>
                                        {current.action}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}

                    {current && current.items.length > 8 && (
                        <button className="ed-queue-more" onClick={() => navigate('/employee/requests')}>
                            Show all {current.items.length} →
                        </button>
                    )}
                </section>

                <aside className="ed-rail">
                    {alerts.length > 0 && (
                        <div className="ed-alerts">
                            {alerts.map((a) => (
                                <button key={a.note} className="ed-alert" onClick={() => navigate('/employee/claim-schedule')}>
                                    <span className="ed-alert-icon" aria-hidden="true"><IconAlertCircle /></span>
                                    <span className="ed-alert-text">
                                        <strong>{a.value} {a.label}</strong>
                                        <span>{a.note}</span>
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}

                    <section className="ed-card">
                        <div className="ed-card-head">
                            <h2><IconCalendarCheck /> Today</h2>
                            <button className="employee-link-button" onClick={() => navigate('/employee/claim-schedule')}>Schedule →</button>
                        </div>

                        {todaySchedules.length === 0 ? (
                            <p className="ed-muted">No students are scheduled to claim today.</p>
                        ) : (
                            <ul className="ed-appts">
                                {todaySchedules.map((s) => (
                                    <li key={s.claim_schedule_id}>
                                        <button onClick={() => navigate(`/employee/requests/${s.request_id}`)}>
                                            <span className={`ed-appt-time${s.status === 'missed' ? ' is-missed' : ''}`}>
                                                {formatTime(s.claim_time || s.scheduled_time)}
                                            </span>
                                            <span className="ed-appt-body">
                                                <strong>{s.requestNumber}</strong>
                                                <span>Student {s.studentNumber}</span>
                                            </span>
                                            {s.status === 'missed' && <span className="ed-appt-flag">Missed</span>}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    <section className="ed-card">
                        <div className="ed-card-head">
                            <h2>This week</h2>
                        </div>
                        <div className="ed-progress">
                            <div
                                className="ed-ring"
                                style={{ '--p': progress }}
                                role="img"
                                aria-label={`${completedThisWeek} completed out of ${receivedThisWeek} received in the last 7 days`}
                            >
                                <span>{Math.round(progress * 100)}%</span>
                            </div>
                            <div className="ed-progress-text">
                                <p><strong>{completedThisWeek}</strong> completed</p>
                                <p><strong>{receivedThisWeek}</strong> received</p>
                                <span>Last 7 days</span>
                            </div>
                        </div>
                    </section>
                </aside>
            </div>
        </div>
    )
}

// Loading placeholder with the same shape as the dashboard above.
function EmployeeDashboardSkeleton() {
    return (
        <div className="ed" role="status" aria-busy="true" aria-live="polite">
            <span className="skeleton-sr-only">Loading dashboard…</span>
            <header className="ed-header">
                <div>
                    <Skeleton width={300} height={28} radius={8} />
                    <Skeleton width={320} height={13} style={{ marginTop: 10 }} />
                </div>
                <Skeleton width={140} height={36} radius={8} />
            </header>

            <div className="ed-focus">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div className="ed-focus-card ed-focus-static" key={i}>
                        <Skeleton width={40} height={40} radius={12} />
                        <span className="ed-focus-text">
                            <Skeleton width={34} height={24} radius={6} />
                            <Skeleton width={90} height={11} style={{ marginTop: 6 }} />
                        </span>
                    </div>
                ))}
            </div>

            <div className="ed-body">
                <section className="ed-queue">
                    <div className="ed-queue-head">
                        <div>
                            <Skeleton width={150} height={18} radius={6} />
                            <Skeleton width={240} height={11} style={{ marginTop: 8 }} />
                        </div>
                        <Skeleton width={80} height={24} radius={20} />
                    </div>
                    <ul className="ed-rows">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <li className="ed-row" key={i}>
                                <span className="ed-row-main">
                                    <Skeleton width={i % 2 ? '52%' : '64%'} height={14} />
                                    <Skeleton width="42%" height={11} style={{ marginTop: 6 }} />
                                </span>
                                <Skeleton width={70} height={24} radius={20} />
                                <Skeleton width={78} height={34} radius={8} />
                            </li>
                        ))}
                    </ul>
                </section>

                <aside className="ed-rail">
                    <section className="ed-card">
                        <div className="ed-card-head"><Skeleton width={90} height={17} radius={6} /></div>
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div className="ed-appts-skeleton" key={i}>
                                <Skeleton width={64} height={28} radius={8} />
                                <Skeleton width="50%" height={13} />
                            </div>
                        ))}
                    </section>
                    <section className="ed-card">
                        <div className="ed-card-head"><Skeleton width={100} height={17} radius={6} /></div>
                        <div className="ed-progress">
                            <Skeleton width={96} height={96} radius={48} />
                            <div style={{ flex: 1 }}>
                                <Skeleton width="60%" height={14} style={{ marginBottom: 10 }} />
                                <Skeleton width="50%" height={14} />
                            </div>
                        </div>
                    </section>
                </aside>
            </div>
        </div>
    )
}

export default EmployeeDashboard
