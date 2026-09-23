import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { StatusDonutChart, RequestsTrendChart } from './DashboardCharts'
import { SkeletonDashboard } from '../../components/Skeleton'
import { IconUsers, IconFileStack, IconHourglass, IconPackage, IconCheckCircle, IconXCircle, IconBan, IconCalendarCheck, IconClipboardCheck, IconLayers, IconSwap, IconBarChart } from './icons'
import { localDay, statusChartData as buildStatusChartData, dailyTrend, weeklyChange } from '../../lib/dashboardData'
import '../../components/DashboardStats.css'
import './AdminPages.css'

const QUICK_LINKS = [
    { to: '/admin/requests', label: 'All Requests', Icon: IconFileStack },
    { to: '/admin/assignments', label: 'Assignments', Icon: IconSwap },
    { to: '/admin/claim-schedules', label: 'Claim Schedules', Icon: IconCalendarCheck },
    { to: '/admin/reports', label: 'Reports', Icon: IconBarChart },
]

// Statuses that still need someone to act on them.
const ACTIVE_STATUSES = ['pending', 'payment_pending', 'receipt_uploaded', 'receipt_verified', 'processing', 'lacking_requirements', 'ready_for_claiming']

// "2m ago", "3h ago", "Yesterday", "Sep 18" -- compact times for the activity feed.
const relativeTime = (value, now) => {
    const then = new Date(value)
    const minutes = Math.floor((now - then) / 60000)
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    if (hours < 48) return 'Yesterday'
    return then.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

const initialsOf = (name) =>
    (name || '?').split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()

function AdminDashboard() {
    const navigate = useNavigate()

    const [requests, setRequests] = useState([])
    const [todayCount, setTodayCount] = useState(0)
    const [missedCount, setMissedCount] = useState(0)
    const [rescheduleRequestCount, setRescheduleRequestCount] = useState(0)
    const [recentActivity, setRecentActivity] = useState([])
    const [studentCount, setStudentCount] = useState(0)
    const [recentStudents, setRecentStudents] = useState([])
    const [employeeNames, setEmployeeNames] = useState({})
    const [loadedAt, setLoadedAt] = useState(() => new Date())
    const [headName, setHeadName] = useState('')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        loadDashboard()
    }, [])

    const loadDashboard = async () => {
        try {
            setLoading(true)
            setError('')

            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data: me } = await supabase
                    .from('profiles')
                    .select('first_name')
                    .eq('user_id', user.id)
                    .single()
                setHeadName(me?.first_name?.trim() || '')
            }

            const { data: requestRows, error: requestError } = await supabase
                .from('document_requests')
                .select('request_id, status, requested_at, assigned_employee_id')

            if (requestError) {
                throw new Error('Failed to load requests: ' + requestError.message)
            }

            setRequests(requestRows || [])

            const { data: employeeRows } = await supabase
                .from('employees')
                .select('employee_id, user_id, display_name, status')

            const employeeUserIds = [...new Set((employeeRows || []).map((e) => e.user_id).filter(Boolean))]
            const { data: employeeProfiles } = employeeUserIds.length
                ? await supabase.from('profiles').select('user_id, first_name, last_name').in('user_id', employeeUserIds)
                : { data: [] }

            const employeeProfileByUserId = Object.fromEntries((employeeProfiles || []).map((p) => [p.user_id, p]))
            setEmployeeNames(Object.fromEntries((employeeRows || []).map((e) => {
                const p = employeeProfileByUserId[e.user_id]
                const realName = p ? `${p.first_name} ${p.last_name}`.trim() : 'Employee'
                return [e.employee_id, e.display_name?.trim() || realName]
            })))

            const today = localDay()

            const { count } = await supabase
                .from('claim_schedules')
                .select('claim_schedule_id', { count: 'exact', head: true })
                .eq('claim_date', today)
                .neq('status', 'cancelled')

            setTodayCount(count || 0)

            const { count: missed } = await supabase
                .from('claim_schedules')
                .select('claim_schedule_id', { count: 'exact', head: true })
                .eq('status', 'missed')

            setMissedCount(missed || 0)

            const { count: rescheduleRequests } = await supabase
                .from('claim_schedules')
                .select('claim_schedule_id', { count: 'exact', head: true })
                .not('reschedule_requested_at', 'is', null)
                .neq('status', 'cancelled')

            setRescheduleRequestCount(rescheduleRequests || 0)

            const { data: logs, error: logsError } = await supabase
                .from('activity_logs')
                .select('activity_log_id, action, description, employee_id, created_at')
                .order('created_at', { ascending: false })
                .limit(8)

            if (logsError) {
                console.error('ACTIVITY LOGS ERROR:', logsError)
            }

            const employeeIds = [...new Set((logs || []).map((l) => l.employee_id).filter(Boolean))]

            const { data: employees } = employeeIds.length
                ? await supabase.from('employees').select('employee_id, user_id, employee_number').in('employee_id', employeeIds)
                : { data: [] }

            const userIds = [...new Set((employees || []).map((e) => e.user_id))]

            const { data: profiles } = userIds.length
                ? await supabase.from('profiles').select('user_id, first_name, last_name').in('user_id', userIds)
                : { data: [] }

            const profileByUserId = Object.fromEntries((profiles || []).map((p) => [p.user_id, p]))
            const employeeById = Object.fromEntries((employees || []).map((e) => [e.employee_id, e]))

            setRecentActivity(
                (logs || []).map((log) => {
                    const employee = employeeById[log.employee_id]
                    const profile = employee ? profileByUserId[employee.user_id] : null

                    return {
                        ...log,
                        actorName: profile ? `${profile.first_name} ${profile.last_name}`.trim() : 'System',
                    }
                })
            )

            const { count: studentTotal } = await supabase
                .from('students')
                .select('student_id', { count: 'exact', head: true })

            setStudentCount(studentTotal || 0)

            let { data: studentRows, error: studentRowsError } = await supabase
                .from('students')
                .select('student_id, user_id, student_number, college_id, created_at')
                .order('created_at', { ascending: false })
                .limit(5)

            if (studentRowsError) {
                console.error('RECENT STUDENTS (created_at) ERROR:', studentRowsError)

                const fallback = await supabase
                    .from('students')
                    .select('student_id, user_id, student_number, college_id')
                    .order('student_number', { ascending: false })
                    .limit(5)

                studentRows = fallback.data
            }

            const rows = studentRows || []
            const studentUserIds = [...new Set(rows.map((s) => s.user_id))]
            const studentCollegeIds = [...new Set(rows.map((s) => s.college_id).filter(Boolean))]

            const [{ data: studentProfiles }, { data: studentColleges }] = await Promise.all([
                studentUserIds.length
                    ? supabase.from('profiles').select('user_id, first_name, last_name').in('user_id', studentUserIds)
                    : Promise.resolve({ data: [] }),
                studentCollegeIds.length
                    ? supabase.from('colleges').select('college_id, college_name').in('college_id', studentCollegeIds)
                    : Promise.resolve({ data: [] }),
            ])

            const studentProfileByUserId = Object.fromEntries((studentProfiles || []).map((p) => [p.user_id, p]))
            const collegeNameById = Object.fromEntries((studentColleges || []).map((c) => [c.college_id, c.college_name]))

            setRecentStudents(
                rows.map((s) => {
                    const profile = studentProfileByUserId[s.user_id]

                    return {
                        ...s,
                        fullName: profile ? `${profile.first_name} ${profile.last_name}`.trim() : 'Unknown',
                        collegeName: collegeNameById[s.college_id] || 'Unassigned',
                    }
                })
            )

        } catch (err) {
            console.error('ADMIN DASHBOARD ERROR:', err)
            setError(err.message || 'Failed to load dashboard.')
        } finally {
            setLoading(false)
            setLoadedAt(new Date())
        }
    }

    const countByStatus = (statuses) =>
        requests.filter((r) => statuses.includes(r.status)).length

    const statusChartData = useMemo(() => buildStatusChartData(requests), [requests])
    const trendChartData = useMemo(() => dailyTrend(requests, 14), [requests])
    const weeklyRequests = useMemo(() => weeklyChange(requests), [requests])

    const activeRequests = requests.filter((r) => ACTIVE_STATUSES.includes(r.status))
    const unassignedCount = activeRequests.filter((r) => !r.assigned_employee_id).length

    // Active requests per employee, busiest first.
    const workload = useMemo(() => {
        const counts = {}
        for (const r of requests) {
            if (!ACTIVE_STATUSES.includes(r.status) || !r.assigned_employee_id) continue
            counts[r.assigned_employee_id] = (counts[r.assigned_employee_id] || 0) + 1
        }
        return Object.entries(counts)
            .map(([employeeId, count]) => ({ employeeId, count, name: employeeNames[employeeId] || 'Employee' }))
            .sort((a, b) => b.count - a.count)
    }, [requests, employeeNames])
    const workloadMax = Math.max(1, ...workload.map((w) => w.count))
    const averageLoad = workload.length ? (workload.reduce((sum, w) => sum + w.count, 0) / workload.length) : 0

    const overviewStats = [
        { label: 'Total Students', value: studentCount, to: '/admin/students', Icon: IconUsers, note: 'Registered student accounts' },
        { label: 'Total Requests', value: requests.length, to: '/admin/requests', Icon: IconFileStack, note: `${weeklyRequests.current} this week`, change: weeklyRequests.change },
        { label: "Today's Appointments", value: todayCount, to: '/admin/claim-schedules', Icon: IconCalendarCheck, note: 'Scheduled to claim today' },
        { label: 'Unassigned', value: unassignedCount, to: '/admin/assignments', Icon: IconSwap, note: unassignedCount ? 'Active requests with no employee' : 'Every active request has an owner', warn: unassignedCount > 0 },
    ]

    const statusStats = [
        { key: 'pending', label: 'Pending', statuses: ['pending', 'payment_pending'], to: '/admin/requests?status=pending,payment_pending', Icon: IconHourglass },
        { key: 'verification', label: 'In Verification', statuses: ['receipt_uploaded', 'receipt_verified'], to: '/admin/requests?status=receipt_uploaded,receipt_verified', Icon: IconClipboardCheck },
        { key: 'processing', label: 'Processing', statuses: ['processing', 'lacking_requirements'], to: '/admin/requests?status=processing,lacking_requirements', Icon: IconLayers },
        { key: 'ready', label: 'Ready for Claiming', statuses: ['ready_for_claiming'], to: '/admin/requests?status=ready_for_claiming', Icon: IconPackage },
        { key: 'completed', label: 'Completed', statuses: ['completed'], to: '/admin/requests?status=completed', Icon: IconCheckCircle },
        { key: 'rejected', label: 'Rejected', statuses: ['rejected'], to: '/admin/requests?status=rejected', Icon: IconXCircle },
        { key: 'cancelled', label: 'Cancelled', statuses: ['cancelled'], to: '/admin/requests?status=cancelled', Icon: IconBan },
    ].map((stat) => {
        const value = countByStatus(stat.statuses)
        const share = requests.length ? Math.round((value / requests.length) * 100) : 0
        return { ...stat, value, share, color: `var(--status-${stat.key})` }
    })

    const attentionStats = [
        { label: missedCount === 1 ? 'Missed Claim' : 'Missed Claims', value: missedCount, to: '/admin/claim-schedules?status=missed', note: 'Students who did not show up' },
        { label: rescheduleRequestCount === 1 ? 'Reschedule Request' : 'Reschedule Requests', value: rescheduleRequestCount, to: '/admin/claim-schedules?status=reschedule', note: 'Students asking for a new date' },
    ]

    if (loading) {
        return (
            <SkeletonDashboard portal="admin" overview={4} status={7} charts twoCol headerLinks={4} />
        )
    }

    if (error) {
        return <div className="admin-error-box">{error}</div>
    }

    return (
        <div>
            <header className="dash-greeting">
                <div>
                    <h1>
                        {loadedAt.getHours() < 12 ? 'Good morning' : loadedAt.getHours() < 18 ? 'Good afternoon' : 'Good evening'}
                        {headName ? `, ${headName}` : ''}
                    </h1>
                    <p>
                        <span className="dash-greeting-role">Registrar Dashboard</span>
                        {loadedAt.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                </div>
                <nav className="dash-greeting-links" aria-label="Quick links">
                    {QUICK_LINKS.map((link) => (
                        <button key={link.to} className="dash-greeting-link" onClick={() => navigate(link.to)}>
                            <span aria-hidden="true"><link.Icon /></span>
                            {link.label}
                        </button>
                    ))}
                </nav>
            </header>

            {attentionStats.some((stat) => stat.value > 0) && (
                <div className="dash-alert-grid">
                    {attentionStats.filter((stat) => stat.value > 0).map((stat) => (
                        <button key={stat.to} className="dash-alert-tile" onClick={() => navigate(stat.to)}>
                            <span className="dash-alert-icon" aria-hidden="true"><IconXCircle /></span>
                            <span className="dash-alert-text">
                                <strong>{stat.value} {stat.label}</strong>
                                <span>{stat.note}</span>
                            </span>
                            <span className="dash-alert-arrow" aria-hidden="true">→</span>
                        </button>
                    ))}
                </div>
            )}

            <section className="dash-stats" aria-label="Key statistics">
                <div className="dash-overview-grid">
                    {overviewStats.map((stat) => (
                        <button key={stat.label} className={`dash-stat-tile dash-overview-tile${stat.warn ? ' is-warn' : ''}`} onClick={() => navigate(stat.to)}>
                            <div className="dash-stat-top">
                                <span className="dash-stat-label">{stat.label}</span>
                                <span className="dash-stat-icon dash-stat-icon-brand" aria-hidden="true"><stat.Icon /></span>
                            </div>
                            <span className="dash-stat-value dash-stat-value-lg">{stat.value.toLocaleString()}</span>
                            <span className="dash-stat-note">
                                {stat.change !== undefined && stat.change !== 0 && (
                                    <span className="dash-stat-change">
                                        {stat.change > 0 ? '▲' : '▼'} {Math.abs(stat.change)} vs last week
                                        <span aria-hidden="true"> · </span>
                                    </span>
                                )}
                                {stat.note}
                            </span>
                        </button>
                    ))}
                </div>

                <div className="dash-stats-heading">
                    <h2>Requests by Status</h2>
                    <span>Share of all {requests.length.toLocaleString()} requests</span>
                </div>

                <div className="dash-status-grid">
                    {statusStats.map((stat) => (
                        <button
                            key={stat.key}
                            className="dash-stat-tile dash-status-tile"
                            style={{ '--tile-color': stat.color }}
                            onClick={() => navigate(stat.to)}
                            aria-label={`${stat.label}: ${stat.value} requests, ${stat.share}% of all requests`}
                        >
                            <div className="dash-stat-top">
                                <span className="dash-stat-icon" aria-hidden="true"><stat.Icon /></span>
                                <span className="dash-stat-label">{stat.label}</span>
                            </div>
                            <span className="dash-stat-value">{stat.value.toLocaleString()}</span>
                            <div className="dash-stat-meter" aria-hidden="true">
                                <span style={{ width: `${stat.share}%` }} />
                            </div>
                            <span className="dash-stat-note">{stat.share}% of requests</span>
                        </button>
                    ))}
                </div>
            </section>

            <div className="dash-charts-grid">
                <StatusDonutChart data={statusChartData} />
                <RequestsTrendChart data={trendChartData} />
            </div>

            <div className="dash-two-col dash-head-panels">
                <section className="dash-panel">
                    <div className="dash-panel-head">
                        <div>
                            <h2>Team workload</h2>
                            <span>Active requests per employee{workload.length > 0 && ` · average ${averageLoad.toFixed(1)}`}</span>
                        </div>
                        <button className="admin-link-button" onClick={() => navigate('/admin/assignments')}>Rebalance →</button>
                    </div>

                    {workload.length === 0 ? (
                        <p className="dash-panel-empty">No active requests are assigned right now.</p>
                    ) : (
                        <ul className="dash-workload">
                            {workload.map((w) => (
                                <li key={w.employeeId}>
                                    <button onClick={() => navigate(`/admin/employees/${w.employeeId}`)}>
                                        <span className="dash-avatar" aria-hidden="true">{initialsOf(w.name)}</span>
                                        <span className="dash-workload-main">
                                            <span className="dash-workload-top">
                                                <strong>{w.name}</strong>
                                                <span>{w.count} active</span>
                                            </span>
                                            <span className="dash-workload-track" aria-hidden="true">
                                                <span
                                                    className={w.count > averageLoad * 1.5 && workload.length > 1 ? 'is-heavy' : ''}
                                                    style={{ width: `${(w.count / workloadMax) * 100}%` }}
                                                />
                                            </span>
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <section className="dash-panel">
                    <div className="dash-panel-head">
                        <div>
                            <h2>Recent activity</h2>
                            <span>What the team did last</span>
                        </div>
                        <button className="admin-link-button" onClick={() => navigate('/admin/activity-logs')}>View all →</button>
                    </div>

                    {recentActivity.length === 0 ? (
                        <p className="dash-panel-empty">No employee activity has been recorded yet.</p>
                    ) : (
                        <ol className="dash-feed">
                            {recentActivity.map((log) => (
                                <li key={log.activity_log_id}>
                                    <span className="dash-avatar is-small" aria-hidden="true">{initialsOf(log.actorName)}</span>
                                    <span className="dash-feed-body">
                                        <span className="dash-feed-line">
                                            <strong>{log.actorName}</strong>
                                            <span className="dash-feed-action">{log.action.replace(/_/g, ' ')}</span>
                                        </span>
                                        <span className="dash-feed-desc">{log.description}</span>
                                    </span>
                                    <time className="dash-feed-time" dateTime={log.created_at} title={new Date(log.created_at).toLocaleString('en-PH')}>
                                        {relativeTime(log.created_at, loadedAt)}
                                    </time>
                                </li>
                            ))}
                        </ol>
                    )}
                </section>
            </div>

            <section className="dash-panel" style={{ marginTop: 20 }}>
                <div className="dash-panel-head">
                    <div>
                        <h2>Recently registered students</h2>
                        <span>{studentCount.toLocaleString()} students in total</span>
                    </div>
                    <button className="admin-link-button" onClick={() => navigate('/admin/students')}>View all →</button>
                </div>

                {recentStudents.length === 0 ? (
                    <p className="dash-panel-empty">No students have registered yet.</p>
                ) : (
                    <ul className="dash-students">
                        {recentStudents.map((student) => (
                            <li key={student.student_id}>
                                <button onClick={() => navigate(`/admin/students/${student.student_id}`)}>
                                    <span className="dash-avatar" aria-hidden="true">{initialsOf(student.fullName)}</span>
                                    <span className="dash-students-body">
                                        <strong>{student.fullName}</strong>
                                        <span>{student.student_number}</span>
                                        <span className="dash-students-college">{student.collegeName}</span>
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    )
}

export default AdminDashboard
