import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { StatusDonutChart, RequestsTrendChart } from './DashboardCharts'
import './AdminPages.css'

const STATUS_BUCKETS = [
    { key: 'pending', label: 'Pending', statuses: ['pending', 'payment_pending'], color: '#2a78d6' },
    { key: 'verification', label: 'In Verification', statuses: ['receipt_uploaded', 'receipt_verified'], color: '#eb6834' },
    { key: 'processing', label: 'Processing', statuses: ['processing', 'lacking_requirements'], color: '#1baf7a' },
    { key: 'ready', label: 'Ready for Claiming', statuses: ['ready_for_claiming'], color: '#eda100' },
    { key: 'completed', label: 'Completed', statuses: ['completed'], color: '#e87ba4' },
    { key: 'rejected', label: 'Rejected', statuses: ['rejected', 'cancelled'], color: '#008300' },
]

const TREND_DAYS = 14

function AdminDashboard() {
    const navigate = useNavigate()

    const [requests, setRequests] = useState([])
    const [todayCount, setTodayCount] = useState(0)
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

            const today = new Date().toISOString().slice(0, 10)

            const { count } = await supabase
                .from('claim_schedules')
                .select('claim_schedule_id', { count: 'exact', head: true })
                .eq('claim_date', today)
                .neq('status', 'cancelled')

            setTodayCount(count || 0)

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

    const statusChartData = useMemo(
        () => STATUS_BUCKETS.map((bucket) => ({
            key: bucket.key,
            label: bucket.label,
            color: bucket.color,
            value: countByStatus(bucket.statuses),
        })),
        [requests]
    )

    const trendChartData = useMemo(() => {
        const days = []

        for (let i = TREND_DAYS - 1; i >= 0; i--) {
            const d = new Date()
            d.setDate(d.getDate() - i)
            days.push(d.toISOString().slice(0, 10))
        }

        const countByDay = Object.fromEntries(days.map((date) => [date, 0]))

        requests.forEach((r) => {
            if (!r.requested_at) return
            const day = r.requested_at.slice(0, 10)
            if (day in countByDay) countByDay[day] += 1
        })

        return days.map((date) => ({ date, count: countByDay[date] }))
    }, [requests])

    const stats = [
        { label: 'Total Students', value: studentCount, to: '/admin/students' },
        { label: 'Total Requests', value: requests.length, to: '/admin/requests' },
        { label: 'Pending', value: countByStatus(['pending', 'payment_pending']), to: '/admin/requests' },
        { label: 'Completed', value: countByStatus(['completed']), to: '/admin/requests' },
        { label: 'Rejected', value: countByStatus(['rejected']), to: '/admin/requests' },
        { label: "Today's Appointments", value: todayCount, to: '/admin/claim-schedules' },
    ]

    if (loading) {
        return <p className="admin-loading">Loading dashboard...</p>
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

            <div className="admin-info-grid" style={{ marginBottom: 28 }}>
                {stats.map((stat) => (
                    <button
                        key={stat.label}
                        className="admin-card"
                        style={{ textAlign: 'left', margin: 0 }}
                        onClick={() => navigate(stat.to)}
                    >
                        <span style={{ display: 'block', fontSize: 26, fontWeight: 700, color: 'var(--blue)', marginBottom: 4 }}>
                            {stat.value}
                        </span>
                        <span style={{ fontSize: 12.5, color: 'var(--slate)' }}>{stat.label}</span>
                    </button>
                ))}
            </div>

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
