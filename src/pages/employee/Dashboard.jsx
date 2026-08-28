import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { fetchActiveAnnouncements } from '../../lib/announcements'
import { IconCalendar } from '../student/icons'
import { IconShieldCheck, IconGear, IconUsers } from './icons'
import './EmployeePages.css'

const QUICK_LINKS = [
    { to: '/employee/verification', label: 'Request Verification', icon: <IconShieldCheck /> },
    { to: '/employee/processing', label: 'Document Processing', icon: <IconGear /> },
    { to: '/employee/claim-schedule', label: 'Claim Schedule', icon: <IconCalendar /> },
    { to: '/employee/students', label: 'Students', icon: <IconUsers /> },
]

function EmployeeDashboard() {
    const navigate = useNavigate()

    const [employee, setEmployee] = useState(null)
    const [name, setName] = useState('')
    const [requests, setRequests] = useState([])
    const [todaySchedules, setTodaySchedules] = useState([])
    const [announcements, setAnnouncements] = useState([])
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
                    status
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

            const {
                data: requestData,
                error: requestError
            } = await supabase
                .from('document_requests')
                .select(`
                    request_id,
                    request_number,
                    total_amount,
                    status,
                    requested_at
                `)
                .eq('assigned_employee_id', employeeData.employee_id)
                .order('requested_at', { ascending: false })

            if (requestError) {
                throw new Error('Failed to load requests: ' + requestError.message)
            }

            setRequests(requestData || [])

            const today = new Date().toISOString().slice(0, 10)

            const { data: scheduleRows, error: scheduleError } = await supabase
                .from('claim_schedules')
                .select('claim_schedule_id, request_id, student_id, claim_time, scheduled_time, status')
                .eq('scheduled_by', employeeData.employee_id)
                .eq('claim_date', today)
                .neq('status', 'cancelled')
                .order('claim_time', { ascending: true })

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

            setAnnouncements(await fetchActiveAnnouncements('show_to_employees'))

        } catch (error) {
            console.error('EMPLOYEE DASHBOARD ERROR:', error)
            setErrorMessage(error.message || 'Failed to load employee dashboard.')
        } finally {
            setLoading(false)
        }
    }

    const pendingCount = requests.filter(
        (r) => r.status === 'pending' || r.status === 'payment_pending'
    ).length

    const receiptCount = requests.filter((r) => r.status === 'receipt_uploaded').length
    const processingCount = requests.filter((r) => r.status === 'processing').length
    const completedCount = requests.filter((r) => r.status === 'completed').length

    const recentRequests = requests.slice(0, 6)

    const formatTime = (time) => {
        if (!time) return 'N/A'
        const [hours, minutes] = time.split(':')
        const date = new Date()
        date.setHours(Number(hours), Number(minutes), 0, 0)
        return date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
    }

    if (loading) {
        return <p className="employee-loading">Loading dashboard...</p>
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
            <div className="employee-page-header">
                <h1>{name ? `Welcome back, ${name}` : 'Employee Dashboard'}</h1>
                <p>
                    {employee?.employee_number} · {employee?.position_title}
                </p>
            </div>

            {announcements.map((a) => (
                <div className="employee-notice tone-info" key={a.announcement_id} style={{ marginBottom: 16 }}>
                    <strong>{a.title}</strong>
                    <p>{a.message}</p>
                </div>
            ))}

            <div className="employee-info-grid" style={{ marginBottom: 24 }}>
                {[
                    { label: 'Pending', value: pendingCount, to: '/employee/verification' },
                    { label: 'Receipts to Verify', value: receiptCount, to: '/employee/verification' },
                    { label: 'Processing', value: processingCount, to: '/employee/processing' },
                    { label: 'Completed', value: completedCount, to: '/employee/requests' },
                    { label: "Today's Appointments", value: todaySchedules.length, to: '/employee/claim-schedule' },
                ].map((stat) => (
                    <button
                        key={stat.label}
                        className="employee-card"
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 28 }}>
                {QUICK_LINKS.map((link) => (
                    <button
                        key={link.to}
                        className="employee-card"
                        style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0, padding: '14px 16px' }}
                        onClick={() => navigate(link.to)}
                    >
                        <span style={{ color: 'var(--blue)', display: 'flex' }}>{link.icon}</span>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{link.label}</span>
                    </button>
                ))}
            </div>

            {todaySchedules.length > 0 && (
                <>
                    <h2 style={{ fontSize: 17, marginBottom: 14 }}>Today's Appointments</h2>

                    {todaySchedules.map((schedule) => (
                        <div className="employee-list-card" key={schedule.claim_schedule_id}>
                            <div className="employee-list-card-header">
                                <div>
                                    <h3>{schedule.requestNumber}</h3>
                                    <p>Student {schedule.studentNumber} · {formatTime(schedule.claim_time || schedule.scheduled_time)}</p>
                                </div>
                                <span className={`employee-status-pill status-${schedule.status}`}>{schedule.status}</span>
                            </div>

                            <button
                                className="employee-link-button"
                                onClick={() => navigate(`/employee/requests/${schedule.request_id}`)}
                            >
                                Open request →
                            </button>
                        </div>
                    ))}
                </>
            )}

            <div className="employee-page-header-row" style={{ marginTop: todaySchedules.length > 0 ? 28 : 0, marginBottom: 16 }}>
                <h2 style={{ fontSize: 17 }}>Recent Assigned Requests</h2>
                <button className="employee-link-button" onClick={() => navigate('/employee/requests')}>
                    View all →
                </button>
            </div>

            {recentRequests.length === 0 ? (
                <div className="employee-empty">No requests are currently assigned to you.</div>
            ) : (
                recentRequests.map((request) => (
                    <div className="employee-list-card" key={request.request_id}>
                        <div className="employee-list-card-header">
                            <div>
                                <h3>{request.request_number}</h3>
                                <p>₱{Number(request.total_amount || 0).toFixed(2)}</p>
                            </div>
                            <span className={`employee-status-pill status-${request.status}`}>
                                {request.status.replace(/_/g, ' ')}
                            </span>
                        </div>

                        <button
                            className="employee-link-button"
                            onClick={() => navigate(`/employee/requests/${request.request_id}`)}
                        >
                            Open request →
                        </button>
                    </div>
                ))
            )}
        </div>
    )
}

export default EmployeeDashboard
