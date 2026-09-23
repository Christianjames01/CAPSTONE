import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { StatusDonutChart, RequestsTrendChart } from './DashboardCharts'
import { SkeletonPageHeader, SkeletonStatGrid, SkeletonList } from '../../components/Skeleton'
import { IconUsers, IconFileStack, IconHourglass, IconPackage, IconCheckCircle, IconXCircle, IconBan, IconCalendarCheck, IconClipboardCheck, IconLayers } from './icons'
import { localDay, statusChartData as buildStatusChartData, dailyTrend, weeklyChange } from '../../lib/dashboardData'
import '../../components/DashboardStats.css'
import './AdminPages.css'

function AdminDashboard() {
    const navigate = useNavigate()

    const [requests, setRequests] = useState([])
    const [todayCount, setTodayCount] = useState(0)
    const [missedCount, setMissedCount] = useState(0)
    const [rescheduleRequestCount, setRescheduleRequestCount] = useState(0)
    const [recentActivity, setRecentActivity] = useState([])
    const [studentCount, setStudentCount] = useState(0)
    const [recentStudents, setRecentStudents] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        loadDashboard()
    }, [])

    const loadDashboard = async () => {
        try {
            setLoading(true)
            setError('')

            const { data: requestRows, error: requestError } = await supabase
                .from('document_requests')
                .select('request_id, status, requested_at')

            if (requestError) {
                throw new Error('Failed to load requests: ' + requestError.message)
            }

            setRequests(requestRows || [])

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
        }
    }

    const countByStatus = (statuses) =>
        requests.filter((r) => statuses.includes(r.status)).length

    const statusChartData = useMemo(() => buildStatusChartData(requests), [requests])
    const trendChartData = useMemo(() => dailyTrend(requests, 14), [requests])
    const weeklyRequests = useMemo(() => weeklyChange(requests), [requests])

    const overviewStats = [
        { label: 'Total Students', value: studentCount, to: '/admin/students', Icon: IconUsers, note: 'Registered student accounts' },
        { label: 'Total Requests', value: requests.length, to: '/admin/requests', Icon: IconFileStack, note: `${weeklyRequests.current} this week`, change: weeklyRequests.change },
        { label: "Today's Appointments", value: todayCount, to: '/admin/claim-schedules', Icon: IconCalendarCheck, note: 'Scheduled to claim today' },
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
            <div>
                <SkeletonPageHeader />
                <SkeletonStatGrid count={3} gridClassName="dash-overview-grid" cardClassName="dash-stat-tile dash-skeleton-tile" />
                <SkeletonStatGrid count={7} gridClassName="dash-status-grid" cardClassName="dash-stat-tile dash-skeleton-tile" />
                <SkeletonList count={2} />
            </div>
        )
    }

    if (error) {
        return <div className="admin-error-box">{error}</div>
    }

    return (
        <div>
            <div className="admin-page-header">
                <h1>Registrar Dashboard</h1>
                <p>System-wide overview of document requests and registrar activity.</p>
            </div>

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
                        <button key={stat.label} className="dash-stat-tile dash-overview-tile" onClick={() => navigate(stat.to)}>
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

            <div className="admin-page-header-row" style={{ marginBottom: 16 }}>
                <h2 style={{ fontSize: 17 }}>Employee Activity Overview</h2>
                <button className="admin-link-button" onClick={() => navigate('/admin/activity-logs')}>
                    View all →
                </button>
            </div>

            {recentActivity.length === 0 ? (
                <div className="admin-empty">No employee activity has been recorded yet.</div>
            ) : (
                recentActivity.map((log) => (
                    <div className="admin-list-card" key={log.activity_log_id}>
                        <div className="admin-list-card-header">
                            <div>
                                <h3 style={{ textTransform: 'capitalize' }}>{log.action.replace(/_/g, ' ')}</h3>
                                <p>{log.actorName} · {log.description}</p>
                            </div>

                            <span style={{ fontSize: 12, color: 'var(--slate)', whiteSpace: 'nowrap' }}>
                                {new Date(log.created_at).toLocaleString('en-PH', {
                                    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                                })}
                            </span>
                        </div>
                    </div>
                ))
            )}

            <div className="admin-page-header-row" style={{ marginTop: 28, marginBottom: 16 }}>
                <h2 style={{ fontSize: 17 }}>Recently Registered Students</h2>
                <button className="admin-link-button" onClick={() => navigate('/admin/students')}>
                    View all →
                </button>
            </div>

            {recentStudents.length === 0 ? (
                <div className="admin-empty">No students have registered yet.</div>
            ) : (
                recentStudents.map((student) => (
                    <div className="admin-list-card" key={student.student_id}>
                        <div className="admin-list-card-header">
                            <div>
                                <h3>{student.fullName}</h3>
                                <p>{student.student_number} · {student.collegeName}</p>
                            </div>
                        </div>

                        <button
                            className="admin-link-button"
                            onClick={() => navigate(`/admin/students/${student.student_id}`)}
                        >
                            View record →
                        </button>
                    </div>
                ))
            )}
        </div>
    )
}

export default AdminDashboard
