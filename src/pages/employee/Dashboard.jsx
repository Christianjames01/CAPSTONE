import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { IconCalendar } from '../student/icons'
import { IconShieldCheck, IconGear, IconUsers } from './icons'
import { SkeletonDashboard } from '../../components/Skeleton'
import { StatusDonutChart, RequestsTrendChart } from '../admin/DashboardCharts'
import { IconFileStack, IconHourglass, IconPackage, IconCheckCircle, IconCalendarCheck, IconXCircle } from '../admin/icons'
import { localDay, statusChartData as buildStatusChartData, dailyTrend, weeklyChange, countByStatus } from '../../lib/dashboardData'
import '../../components/DashboardStats.css'
import './EmployeePages.css'

const QUICK_LINKS = [
    { to: '/employee/verification', label: 'Request Verification', icon: <IconShieldCheck /> },
    { to: '/employee/processing', label: 'Document Processing', icon: <IconGear /> },
    { to: '/employee/claim-schedule', label: 'Claim Schedule', icon: <IconCalendar /> },
    { to: '/employee/students', label: 'Students', icon: <IconUsers /> },
]

const RELEASING_QUICK_LINKS = [
    { to: '/employee/claim-schedule', label: 'Claim Schedule', icon: <IconCalendar /> },
]

function EmployeeDashboard() {
    const navigate = useNavigate()

    const [employee, setEmployee] = useState(null)
    const [name, setName] = useState('')
    const [requests, setRequests] = useState([])
    const [documentNames, setDocumentNames] = useState({})
    // One clock reading per page load, so every "waiting N days" agrees.
    const [now] = useState(() => new Date())
    const [todaySchedules, setTodaySchedules] = useState([])
    const [missedCount, setMissedCount] = useState(0)
    const [rescheduleRequestCount, setRescheduleRequestCount] = useState(0)
    const [loading, setLoading] = useState(true)
    const [errorMessage, setErrorMessage] = useState('')

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

            const {
                data: employeeData,
                error: employeeError
            } = await supabase
                .from('employees')
                .select(`
                    employee_id,
                    employee_number,
                    position_title,
                    assigned_college_id,
                    status,
                    access_scope
                `)
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
                .select('request_id, request_number, document_type_id, total_amount, status, requested_at')
                .order('requested_at', { ascending: false })

            if (isReleasingScope) {
                // Releasing is a front-desk job: show claiming-relevant
                // requests office-wide, not just ones assigned to this account.
                requestQuery = requestQuery.in('status', ['ready_for_claiming', 'scheduled', 'claimed', 'completed'])
            } else {
                requestQuery = requestQuery.eq('assigned_employee_id', employeeData.employee_id)
            }

            const {
                data: requestData,
                error: requestError
            } = await requestQuery

            if (requestError) {
                throw new Error('Failed to load requests: ' + requestError.message)
            }

            setRequests(requestData || [])

            const documentTypeIds = [...new Set((requestData || []).map((r) => r.document_type_id).filter(Boolean))]
            if (documentTypeIds.length > 0) {
                const { data: documentTypes } = await supabase
                    .from('document_types')
                    .select('document_type_id, document_name')
                    .in('document_type_id', documentTypeIds)

                setDocumentNames(Object.fromEntries((documentTypes || []).map((d) => [d.document_type_id, d.document_name])))
            }

            const myRequestIds = (requestData || []).map((r) => r.request_id)

            if (myRequestIds.length > 0) {
                const { data: attentionSchedules } = await supabase
                    .from('claim_schedules')
                    .select('claim_schedule_id, request_id, status, reschedule_requested_at')
                    .in('request_id', myRequestIds)
                    .neq('status', 'cancelled')

                const rows = attentionSchedules || []
                setMissedCount(rows.filter((s) => s.status === 'missed').length)
                setRescheduleRequestCount(rows.filter((s) => s.reschedule_requested_at).length)
            }

            const today = localDay()

            let todayScheduleQuery = supabase
                .from('claim_schedules')
                .select('claim_schedule_id, request_id, student_id, claim_time, scheduled_time, status')
                .eq('claim_date', today)
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
    const recentRequests = requests.slice(0, 6)

    const DAY_MS = 24 * 60 * 60 * 1000
    const DONE_STATUSES = ['completed', 'claimed', 'rejected', 'cancelled']
    const waitingDays = (r) => (r.requested_at ? Math.floor((now - new Date(r.requested_at)) / DAY_MS) : 0)
    const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening'

    const statusChartData = useMemo(() => buildStatusChartData(requests), [requests])
    const trendChartData = useMemo(() => dailyTrend(requests, 14), [requests])
    const weekly = useMemo(() => weeklyChange(requests), [requests])

    const count = (statuses) => countByStatus(requests, statuses)
    const needsActionCount = count(['pending', 'payment_pending', 'receipt_uploaded'])

    const overviewStats = isReleasingOnly
        ? [
            { label: 'Ready for Claiming', value: count(['ready_for_claiming']), to: '/employee/requests?status=ready_for_claiming', Icon: IconPackage, note: 'Waiting to be released' },
            { label: "Today's Appointments", value: todaySchedules.length, to: '/employee/claim-schedule', Icon: IconCalendarCheck, note: 'Scheduled to claim today' },
            { label: 'Completed', value: count(['completed']), to: '/employee/requests?status=completed', Icon: IconCheckCircle, note: 'Released to students' },
        ]
        : [
            { label: 'Assigned to Me', value: requests.length, to: '/employee/requests', Icon: IconFileStack, note: `${weekly.current} new this week`, change: weekly.change },
            { label: 'Needs Action', value: needsActionCount, to: '/employee/verification', Icon: IconHourglass, note: 'Pending or awaiting receipt check' },
            { label: "Today's Appointments", value: todaySchedules.length, to: '/employee/claim-schedule', Icon: IconCalendarCheck, note: 'Scheduled to claim today' },
        ]

    const statusStats = (isReleasingOnly
        ? [
            { key: 'ready', label: 'Ready for Claiming', statuses: ['ready_for_claiming'], to: '/employee/requests?status=ready_for_claiming', Icon: IconPackage },
            { key: 'completed', label: 'Completed', statuses: ['completed'], to: '/employee/requests?status=completed', Icon: IconCheckCircle },
        ]
        : [
            { key: 'pending', label: 'Pending', statuses: ['pending', 'payment_pending'], to: '/employee/verification', Icon: IconHourglass },
            { key: 'verification', label: 'Receipts to Verify', statuses: ['receipt_uploaded'], to: '/employee/verification', Icon: IconFileStack },
            { key: 'processing', label: 'Processing', statuses: ['processing', 'lacking_requirements'], to: '/employee/processing', Icon: IconPackage },
            { key: 'ready', label: 'Ready for Claiming', statuses: ['ready_for_claiming'], to: '/employee/requests?status=ready_for_claiming', Icon: IconCalendarCheck },
            { key: 'completed', label: 'Completed', statuses: ['completed'], to: '/employee/requests?status=completed', Icon: IconCheckCircle },
        ]
    ).map((stat) => {
        const value = count(stat.statuses)
        const share = requests.length ? Math.round((value / requests.length) * 100) : 0
        return { ...stat, value, share, color: `var(--status-${stat.key})` }
    })

    const attentionStats = [
        { label: missedCount === 1 ? 'Missed Claim' : 'Missed Claims', value: missedCount, to: '/employee/claim-schedule', note: 'Students who did not show up' },
        { label: rescheduleRequestCount === 1 ? 'Reschedule Request' : 'Reschedule Requests', value: rescheduleRequestCount, to: '/employee/claim-schedule', note: 'Students asking for a new date' },
    ].filter((s) => s.value > 0)

    const formatTime = (time) => {
        if (!time) return 'N/A'
        const [hours, minutes] = time.split(':')
        const date = new Date()
        date.setHours(Number(hours), Number(minutes), 0, 0)
        return date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
    }

    if (loading) {
        return (
            <SkeletonDashboard portal="employee" overview={3} status={5} charts twoCol listsFirst headerLinks={4} />
        )
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
        <div>
            <header className="dash-greeting">
                <div>
                    <h1>{greeting}{name ? `, ${name}` : ''}</h1>
                    <p>
                        {now.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                        {employee?.position_title && <span className="dash-greeting-role">{employee.position_title}</span>}
                    </p>
                </div>
                <nav className="dash-greeting-links" aria-label="Quick links">
                    {(isReleasingOnly ? RELEASING_QUICK_LINKS : QUICK_LINKS).map((link) => (
                        <button key={link.to} className="dash-greeting-link" onClick={() => navigate(link.to)}>
                            <span aria-hidden="true">{link.icon}</span>
                            {link.label}
                        </button>
                    ))}
                </nav>
            </header>

            {attentionStats.length > 0 && (
                <div className="dash-alert-grid">
                    {attentionStats.map((stat) => (
                        <button key={stat.note} className="dash-alert-tile" onClick={() => navigate(stat.to)}>
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
                    <h2>{isReleasingOnly ? 'Claiming Status' : 'My Requests by Status'}</h2>
                    <span>Share of {requests.length.toLocaleString()} {isReleasingOnly ? 'claiming' : 'assigned'} requests</span>
                </div>

                <div className="dash-status-grid">
                    {statusStats.map((stat) => (
                        <button
                            key={stat.key}
                            className="dash-stat-tile dash-status-tile"
                            style={{ '--tile-color': stat.color }}
                            onClick={() => navigate(stat.to)}
                            aria-label={`${stat.label}: ${stat.value} requests, ${stat.share}% of requests`}
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


            <div className="dash-two-col" style={{ marginBottom: 28 }}>
                <section>
                    <div className="employee-page-header-row" style={{ marginBottom: 14 }}>
                        <h2 style={{ fontSize: 16 }}>Today's Appointments</h2>
                        <button className="employee-link-button" onClick={() => navigate('/employee/claim-schedule')}>
                            Claim schedule →
                        </button>
                    </div>

                    {todaySchedules.length === 0 ? (
                        <div className="employee-empty">No students are scheduled to claim today.</div>
                    ) : (
                        <ul className="dash-row-list">
                            {todaySchedules.map((schedule) => (
                                <li key={schedule.claim_schedule_id}>
                                    <button className="dash-row" onClick={() => navigate(`/employee/requests/${schedule.request_id}`)}>
                                        <span className="dash-row-time">{formatTime(schedule.claim_time || schedule.scheduled_time)}</span>
                                        <span className="dash-row-main">
                                            <strong>{schedule.requestNumber}</strong>
                                            <span>Student {schedule.studentNumber}</span>
                                        </span>
                                        <span className={`employee-status-pill status-${schedule.status}`}>{schedule.status.replace(/_/g, ' ')}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <section>
                    <div className="employee-page-header-row" style={{ marginBottom: 14 }}>
                        <h2 style={{ fontSize: 16 }}>{isReleasingOnly ? 'Recent Claiming Requests' : 'Recent Assigned Requests'}</h2>
                        <button className="employee-link-button" onClick={() => navigate('/employee/requests')}>
                            View all →
                        </button>
                    </div>

                    {recentRequests.length === 0 ? (
                        <div className="employee-empty">No requests are currently assigned to you.</div>
                    ) : (
                        <ul className="dash-row-list">
                            {recentRequests.map((request) => (
                                <li key={request.request_id}>
                                    <button className="dash-row" onClick={() => navigate(`/employee/requests/${request.request_id}`)}>
                                        <span className="dash-row-main">
                                            <strong>{documentNames[request.document_type_id] || request.request_number}</strong>
                                            <span>
                                                {request.request_number}
                                                {request.requested_at && ` · ${new Date(request.requested_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}`}
                                            </span>
                                        </span>
                                        {!DONE_STATUSES.includes(request.status) && (
                                            <span className={`dash-wait${waitingDays(request) >= 5 ? ' is-late' : waitingDays(request) >= 3 ? ' is-aging' : ''}`}>
                                                {waitingDays(request) <= 0 ? 'Today' : waitingDays(request) === 1 ? '1 day' : `${waitingDays(request)} days`}
                                            </span>
                                        )}
                                        <span className={`employee-status-pill status-${request.status}`}>
                                            {request.status.replace(/_/g, ' ')}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>

            {!isReleasingOnly && (
                <div className="dash-charts-grid">
                    <StatusDonutChart data={statusChartData} />
                    <RequestsTrendChart data={trendChartData} />
                </div>
            )}
        </div>
    )
}

export default EmployeeDashboard
