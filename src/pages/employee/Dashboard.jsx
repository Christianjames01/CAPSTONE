import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { IconCalendar, IconAlertCircle } from '../student/icons'
import { IconShieldCheck, IconGear, IconUsers, IconMessage } from './icons'
import { Skeleton } from '../../components/Skeleton'
import { localDay, countByStatus } from '../../lib/dashboardData'
import '../../components/DashboardStats.css'
import './EmployeePages.css'
import './EmployeeDashboard.css'

// The employee dashboard is a personal work view ("what do I do next?"),
// deliberately different from the head's office-wide statistics dashboard.

const FULL_PIPELINE = [
    { key: 'pending', label: 'Pending', statuses: ['pending', 'payment_pending'], to: '/employee/verification', hint: 'Awaiting payment' },
    { key: 'verification', label: 'Receipts to Verify', statuses: ['receipt_uploaded'], to: '/employee/verification', hint: 'Check the receipt' },
    { key: 'processing', label: 'Processing', statuses: ['receipt_verified', 'processing', 'lacking_requirements'], to: '/employee/processing', hint: 'Prepare the document' },
    { key: 'ready', label: 'Ready for Claiming', statuses: ['ready_for_claiming'], to: '/employee/claim-schedule', hint: 'Schedule the release' },
    { key: 'completed', label: 'Completed', statuses: ['completed'], to: '/employee/requests?status=completed', hint: 'Released' },
]

const RELEASING_PIPELINE = [
    { key: 'ready', label: 'Ready for Claiming', statuses: ['ready_for_claiming'], to: '/employee/claim-schedule', hint: 'Waiting to be released' },
    { key: 'completed', label: 'Completed', statuses: ['completed'], to: '/employee/requests?status=completed', hint: 'Released to students' },
]

// Statuses where the next move is the employee's, oldest first.
const ACTION_STATUSES = ['receipt_uploaded', 'receipt_verified', 'processing', 'lacking_requirements', 'pending', 'payment_pending']
const RELEASING_ACTION_STATUSES = ['ready_for_claiming']

const QUICK_ACTIONS = [
    { to: '/employee/verification', label: 'Verify receipts', icon: <IconShieldCheck /> },
    { to: '/employee/processing', label: 'Process documents', icon: <IconGear /> },
    { to: '/employee/claim-schedule', label: 'Claim schedule', icon: <IconCalendar /> },
    { to: '/employee/students', label: 'Find a student', icon: <IconUsers /> },
    { to: '/employee/messages', label: 'Messages', icon: <IconMessage /> },
]

const RELEASING_QUICK_ACTIONS = [
    { to: '/employee/claim-schedule', label: 'Claim schedule', icon: <IconCalendar /> },
    { to: '/employee/messages', label: 'Messages', icon: <IconMessage /> },
]

const DAY_MS = 24 * 60 * 60 * 1000

const greetingFor = (date) => {
    const hour = date.getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
}

const formatTime = (time) => {
    if (!time) return 'No time'
    const [hours, minutes] = time.split(':')
    const date = new Date()
    date.setHours(Number(hours), Number(minutes), 0, 0)
    return date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
}

const waitingLabel = (days) => (days <= 0 ? 'Today' : days === 1 ? '1 day' : `${days} days`)

function EmployeeDashboard() {
    const navigate = useNavigate()

    const [employee, setEmployee] = useState(null)
    const [name, setName] = useState('')
    const [requests, setRequests] = useState([])
    const [documentNames, setDocumentNames] = useState({})
    const [todaySchedules, setTodaySchedules] = useState([])
    const [missedCount, setMissedCount] = useState(0)
    const [rescheduleRequestCount, setRescheduleRequestCount] = useState(0)
    const [loading, setLoading] = useState(true)
    const [errorMessage, setErrorMessage] = useState('')
    const [hoverDay, setHoverDay] = useState(null)

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
                .select('request_id, request_number, document_type_id, total_amount, status, requested_at, completed_at')
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
            if (documentTypeIds.length > 0) {
                const { data: documentTypes } = await supabase
                    .from('document_types')
                    .select('document_type_id, document_name')
                    .in('document_type_id', documentTypeIds)

                setDocumentNames(Object.fromEntries((documentTypes || []).map((d) => [d.document_type_id, d.document_name])))
            }

            const myRequestIds = rows.map((r) => r.request_id)

            if (myRequestIds.length > 0) {
                const { data: attentionSchedules } = await supabase
                    .from('claim_schedules')
                    .select('claim_schedule_id, request_id, status, reschedule_requested_at')
                    .in('request_id', myRequestIds)
                    .neq('status', 'cancelled')

                const scheduleRows = attentionSchedules || []
                setMissedCount(scheduleRows.filter((s) => s.status === 'missed').length)
                setRescheduleRequestCount(scheduleRows.filter((s) => s.reschedule_requested_at).length)
            }

            let todayScheduleQuery = supabase
                .from('claim_schedules')
                .select('claim_schedule_id, request_id, student_id, claim_time, scheduled_time, status')
                .eq('claim_date', localDay())
                .neq('status', 'cancelled')
                .order('claim_time', { ascending: true })

            if (!isReleasingScope) {
                todayScheduleQuery = todayScheduleQuery.eq('scheduled_by', employeeData.employee_id)
            }

            const { data: scheduleRows, error: scheduleError } = await todayScheduleQuery

            if (scheduleError) {
                console.error('TODAY SCHEDULE ERROR:', scheduleError)
            }

            const sRows = scheduleRows || []
            const scheduleRequestIds = [...new Set(sRows.map((s) => s.request_id))]
            const scheduleStudentIds = [...new Set(sRows.map((s) => s.student_id).filter(Boolean))]

            const [{ data: scheduleRequests }, { data: scheduleStudents }] = await Promise.all([
                scheduleRequestIds.length
                    ? supabase.from('document_requests').select('request_id, request_number').in('request_id', scheduleRequestIds)
                    : Promise.resolve({ data: [] }),
                scheduleStudentIds.length
                    ? supabase.from('students').select('student_id, student_number').in('student_id', scheduleStudentIds)
                    : Promise.resolve({ data: [] }),
            ])

            const requestNumberById = Object.fromEntries((scheduleRequests || []).map((r) => [r.request_id, r.request_number]))
            const studentNumberById = Object.fromEntries((scheduleStudents || []).map((s) => [s.student_id, s.student_number]))

            setTodaySchedules(
                sRows.map((s) => ({
                    ...s,
                    requestNumber: requestNumberById[s.request_id] || 'N/A',
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
    // One clock reading per page load, so every "waiting N days" agrees.
    const [now] = useState(() => new Date())

    const pipeline = (isReleasingOnly ? RELEASING_PIPELINE : FULL_PIPELINE).map((stage) => {
        const inStage = requests.filter((r) => stage.statuses.includes(r.status))
        const oldest = inStage.reduce((min, r) => (r.requested_at && (!min || r.requested_at < min) ? r.requested_at : min), null)
        const oldestDays = oldest ? Math.floor((now - new Date(oldest)) / DAY_MS) : null
        return { ...stage, count: inStage.length, oldestDays }
    })

    const attention = useMemo(() => {
        const statuses = isReleasingOnly ? RELEASING_ACTION_STATUSES : ACTION_STATUSES
        return requests
            .filter((r) => statuses.includes(r.status) && r.requested_at)
            .sort((a, b) => a.requested_at.localeCompare(b.requested_at))
            .slice(0, 6)
            .map((r) => ({ ...r, waitingDays: Math.floor((now - new Date(r.requested_at)) / DAY_MS) }))
    }, [requests, isReleasingOnly, now])

    const actionCount = countByStatus(requests, isReleasingOnly ? RELEASING_ACTION_STATUSES : ACTION_STATUSES)

    // Last 7 local days: requests assigned (by request date) and completed.
    const week = useMemo(() => {
        const days = []
        for (let i = 6; i >= 0; i--) {
            const d = new Date()
            d.setDate(d.getDate() - i)
            days.push({ key: localDay(d), label: d.toLocaleDateString('en-PH', { weekday: 'short' }), received: 0, completed: 0 })
        }
        const byKey = Object.fromEntries(days.map((d) => [d.key, d]))
        for (const r of requests) {
            if (r.requested_at) {
                const k = localDay(new Date(r.requested_at))
                if (byKey[k]) byKey[k].received += 1
            }
            if (r.completed_at) {
                const k = localDay(new Date(r.completed_at))
                if (byKey[k]) byKey[k].completed += 1
            }
        }
        return days
    }, [requests])

    const weekReceived = week.reduce((sum, d) => sum + d.received, 0)
    const weekCompleted = week.reduce((sum, d) => sum + d.completed, 0)
    const weekMax = Math.max(1, ...week.map((d) => Math.max(d.received, d.completed)))

    const alerts = [
        { label: missedCount === 1 ? 'missed claim' : 'missed claims', value: missedCount, to: '/employee/claim-schedule' },
        { label: rescheduleRequestCount === 1 ? 'reschedule request' : 'reschedule requests', value: rescheduleRequestCount, to: '/employee/claim-schedule' },
    ].filter((a) => a.value > 0)

    const summary = (() => {
        const parts = []
        if (actionCount > 0) parts.push(`${actionCount} ${actionCount === 1 ? 'request needs' : 'requests need'} your action`)
        if (todaySchedules.length > 0) parts.push(`${todaySchedules.length} ${todaySchedules.length === 1 ? 'student is' : 'students are'} claiming today`)
        if (parts.length === 0) return "You're all caught up. Nothing is waiting on you right now."
        return `${parts.join(' and ')}.`
    })()

    const primaryAction = isReleasingOnly
        ? { label: 'Open claim schedule', to: '/employee/claim-schedule' }
        : attention.some((r) => r.status === 'receipt_uploaded')
            ? { label: 'Verify receipts', to: '/employee/verification' }
            : { label: 'Continue processing', to: '/employee/processing' }

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
        <div className="emp-dash">
            <section className="emp-hero">
                <div className="emp-hero-text">
                    <span className="emp-hero-date">
                        {now.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </span>
                    <h1>{greetingFor(now)}{name ? `, ${name}` : ''}</h1>
                    <p>{summary}</p>

                    {alerts.length > 0 && (
                        <div className="emp-hero-alerts">
                            {alerts.map((a) => (
                                <button key={a.label} className="emp-hero-alert" onClick={() => navigate(a.to)}>
                                    <IconAlertCircle />
                                    <strong>{a.value}</strong> {a.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="emp-hero-side">
                    <div className="emp-hero-meta">
                        <span>{employee?.position_title}</span>
                        <span>{employee?.employee_number}</span>
                    </div>
                    <button className="emp-hero-cta" onClick={() => navigate(primaryAction.to)}>
                        {primaryAction.label} →
                    </button>
                </div>
            </section>

            <section className="emp-section">
                <div className="emp-section-head">
                    <h2>{isReleasingOnly ? 'Claiming pipeline' : 'Your request pipeline'}</h2>
                    <span>{requests.length} {isReleasingOnly ? 'claiming' : 'assigned'} requests</span>
                </div>

                <ol className="emp-pipeline">
                    {pipeline.map((stage, i) => (
                        <li key={stage.key} className="emp-pipeline-step" style={{ '--step-color': `var(--status-${stage.key})` }}>
                            <button onClick={() => navigate(stage.to)} aria-label={`${stage.label}: ${stage.count} requests`}>
                                <span className="emp-pipeline-index" aria-hidden="true">{i + 1}</span>
                                <span className="emp-pipeline-count">{stage.count}</span>
                                <span className="emp-pipeline-label">{stage.label}</span>
                                <span className="emp-pipeline-hint">
                                    {stage.key !== 'completed' && stage.count > 0 && stage.oldestDays !== null
                                        ? `Oldest: ${stage.oldestDays <= 0 ? "today" : waitingLabel(stage.oldestDays)}`
                                        : stage.hint}
                                </span>
                            </button>
                        </li>
                    ))}
                </ol>
            </section>

            <div className="emp-columns">
                <div className="emp-side">
                <section className="emp-panel">
                    <div className="emp-section-head">
                        <h2>Needs your attention</h2>
                        <button className="employee-link-button" onClick={() => navigate('/employee/requests')}>View all →</button>
                    </div>

                    {attention.length === 0 ? (
                        <div className="emp-empty">
                            <strong>All caught up</strong>
                            <span>No requests are waiting on you.</span>
                        </div>
                    ) : (
                        <ul className="emp-attention">
                            {attention.map((r) => (
                                <li key={r.request_id}>
                                    <button onClick={() => navigate(`/employee/requests/${r.request_id}`)}>
                                        <span className="emp-attention-main">
                                            <strong>{documentNames[r.document_type_id] || 'Document request'}</strong>
                                            <span>{r.request_number} · <span className="emp-attention-status">{r.status.replace(/_/g, ' ')}</span></span>
                                        </span>
                                        <span className={`emp-wait${r.waitingDays >= 5 ? ' is-late' : r.waitingDays >= 3 ? ' is-aging' : ''}`}>
                                            {waitingLabel(r.waitingDays)}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <section className="emp-panel">
                    <div className="emp-section-head">
                        <h2>Quick actions</h2>
                    </div>
                    <div className="emp-actions">
                        {(isReleasingOnly ? RELEASING_QUICK_ACTIONS : QUICK_ACTIONS).map((a) => (
                            <button key={a.to} onClick={() => navigate(a.to)}>
                                <span className="emp-actions-icon" aria-hidden="true">{a.icon}</span>
                                {a.label}
                            </button>
                        ))}
                    </div>
                </section>
                </div>

                <aside className="emp-side">
                    <section className="emp-panel">
                        <div className="emp-section-head">
                            <h2>Today's schedule</h2>
                            <button className="employee-link-button" onClick={() => navigate('/employee/claim-schedule')}>Open →</button>
                        </div>

                        {todaySchedules.length === 0 ? (
                            <div className="emp-empty">
                                <strong>No appointments today</strong>
                                <span>Nobody is scheduled to claim.</span>
                            </div>
                        ) : (
                            <ol className="emp-timeline">
                                {todaySchedules.map((s) => (
                                    <li key={s.claim_schedule_id} className={s.status === 'missed' ? 'is-missed' : ''}>
                                        <button onClick={() => navigate(`/employee/requests/${s.request_id}`)}>
                                            <span className="emp-timeline-time">{formatTime(s.claim_time || s.scheduled_time)}</span>
                                            <span className="emp-timeline-body">
                                                <strong>{s.requestNumber}</strong>
                                                <span>Student {s.studentNumber} · {s.status.replace(/_/g, ' ')}</span>
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </section>

                    <section className="emp-panel">
                        <div className="emp-section-head">
                            <h2>This week</h2>
                        </div>
                        <div className="emp-week-totals">
                            <span><strong>{weekReceived}</strong> received</span>
                            <span><strong>{weekCompleted}</strong> completed</span>
                        </div>
                        <div className="emp-week" role="img" aria-label={`Last 7 days: ${weekReceived} received, ${weekCompleted} completed`}>
                            {week.map((d, i) => (
                                <div
                                    key={d.key}
                                    className={`emp-week-day${i === week.length - 1 ? ' is-today' : ''}`}
                                    onMouseEnter={() => setHoverDay(i)}
                                    onMouseLeave={() => setHoverDay(null)}
                                >
                                    <div className="emp-week-bars">
                                        <span className="emp-week-bar is-received" style={{ height: `${(d.received / weekMax) * 100}%` }} />
                                        <span className="emp-week-bar is-completed" style={{ height: `${(d.completed / weekMax) * 100}%` }} />
                                    </div>
                                    <span className="emp-week-label">{i === week.length - 1 ? 'Today' : d.label}</span>
                                    {hoverDay === i && (
                                        <span className="emp-week-tip">{d.received} received · {d.completed} completed</span>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="emp-week-legend">
                            <span><i className="is-received" /> Received</span>
                            <span><i className="is-completed" /> Completed</span>
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
        <div className="emp-dash" role="status" aria-busy="true" aria-live="polite">
            <span className="skeleton-sr-only">Loading dashboard…</span>
            <section className="emp-hero emp-hero-skeleton">
                <div className="emp-hero-text">
                    <Skeleton width={180} height={12} className="skeleton-on-dark" />
                    <Skeleton width={320} height={30} radius={8} className="skeleton-on-dark" style={{ margin: '12px 0' }} />
                    <Skeleton width="min(440px, 90%)" height={14} className="skeleton-on-dark" />
                </div>
                <div className="emp-hero-side">
                    <Skeleton width={160} height={12} className="skeleton-on-dark" />
                    <Skeleton width={180} height={44} radius={10} className="skeleton-on-dark" />
                </div>
            </section>

            <section className="emp-section">
                <div className="emp-section-head">
                    <Skeleton width={200} height={17} radius={6} />
                    <Skeleton width={120} height={12} />
                </div>
                <ol className="emp-pipeline">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <li className="emp-pipeline-step" key={i}>
                            <div className="emp-pipeline-skeleton">
                                <Skeleton width={22} height={22} radius={11} />
                                <Skeleton width={40} height={30} radius={6} />
                                <Skeleton width="70%" height={13} />
                                <Skeleton width="85%" height={11} />
                            </div>
                        </li>
                    ))}
                </ol>
            </section>

            <div className="emp-columns">
                <div className="emp-side">
                <section className="emp-panel">
                    <div className="emp-section-head">
                        <Skeleton width={190} height={17} radius={6} />
                        <Skeleton width={60} height={13} />
                    </div>
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div className="emp-skeleton-row" key={i}>
                            <div style={{ flex: 1 }}>
                                <Skeleton width={i % 2 ? '45%' : '58%'} height={14} style={{ marginBottom: 7 }} />
                                <Skeleton width="36%" height={11} />
                            </div>
                            <Skeleton width={64} height={24} radius={20} />
                        </div>
                    ))}
                </section>

                <section className="emp-panel">
                    <div className="emp-section-head">
                        <Skeleton width={130} height={17} radius={6} />
                    </div>
                    <div className="emp-actions">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <Skeleton key={i} height={42} radius={10} />
                        ))}
                    </div>
                </section>
                </div>

                <aside className="emp-side">
                    {[3, 0].map((rows, p) => (
                        <section className="emp-panel" key={p}>
                            <div className="emp-section-head">
                                <Skeleton width={140} height={17} radius={6} />
                            </div>
                            {p === 1 ? (
                                <div className="emp-week">
                                    {[40, 65, 30, 80, 55, 20, 70].map((h, i) => (
                                        <div className="emp-week-day" key={i}>
                                            <div className="emp-week-bars"><Skeleton height={`${h}%`} radius={3} style={{ width: '100%' }} /></div>
                                            <Skeleton width={26} height={10} />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                Array.from({ length: rows }).map((_, i) => (
                                    <div className="emp-skeleton-row" key={i}>
                                        <Skeleton width={p === 0 ? 58 : 30} height={p === 0 ? 13 : 30} radius={p === 0 ? 6 : 8} />
                                        <Skeleton width="55%" height={13} />
                                    </div>
                                ))
                            )}
                        </section>
                    ))}
                </aside>
            </div>
        </div>
    )
}

export default EmployeeDashboard
