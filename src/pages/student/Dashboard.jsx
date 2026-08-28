import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { findAssignedEmployee } from '../../lib/assignEmployee'
import { IconDocumentPlus, IconList, IconCalendar, IconBell, IconClock, IconCheckCircle, IconAlertCircle, IconNewspaper, IconMessage } from './icons'
import './StudentPages.css'
import './Dashboard.css'

const IN_PROGRESS_STATUSES = [
    'pending', 'payment_pending', 'receipt_uploaded', 'receipt_verified',
    'processing', 'lacking_requirements',
]

// Statuses where the ball is in the student's court, and what to tell them
// to do about it.
const ACTION_NEEDED = {
    payment_pending: { label: 'Payment needed', cta: 'Upload receipt →', to: (id) => `/student/request/${id}/upload-receipt` },
    lacking_requirements: { label: 'Requirement needs fixing', cta: 'Submit requirements →', to: (id) => `/student/request/${id}/requirements` },
}

function Dashboard() {
    const [name, setName] = useState('')
    const [requests, setRequests] = useState([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [upcomingClaim, setUpcomingClaim] = useState(null)
    const [latestMessage, setLatestMessage] = useState(null)
    const [unreadMessageCount, setUnreadMessageCount] = useState(0)
    const [loading, setLoading] = useState(true)

    const navigate = useNavigate()

    useEffect(() => {
        loadDashboard()
    }, [])

    async function loadDashboard() {
        try {
            const {
                data: { user }
            } = await supabase.auth.getUser()

            if (!user) {
                setLoading(false)
                return
            }

            const { data: profile } = await supabase
                .from('profiles')
                .select('first_name, last_name')
                .eq('user_id', user.id)
                .single()

            if (profile) {
                setName(profile.first_name)
            }

            const { data: student } = await supabase
                .from('students')
                .select('student_id, college_id, program_id')
                .eq('user_id', user.id)
                .single()

            if (!student) {
                setLoading(false)
                return
            }

            const { data: requestRows } = await supabase
                .from('document_requests')
                .select('request_id, request_number, document_type_id, status, requested_at')
                .eq('student_id', student.student_id)
                .order('requested_at', { ascending: false })

            const rows = requestRows || []
            const documentTypeIds = [...new Set(rows.map((r) => r.document_type_id).filter(Boolean))]

            const { data: documentTypes } = documentTypeIds.length
                ? await supabase.from('document_types').select('document_type_id, document_name').in('document_type_id', documentTypeIds)
                : { data: [] }

            const documentNameById = Object.fromEntries(
                (documentTypes || []).map((d) => [d.document_type_id, d.document_name])
            )

            setRequests(rows.map((r) => ({ ...r, documentName: documentNameById[r.document_type_id] || 'Document' })))

            const { count } = await supabase
                .from('notifications')
                .select('notification_id', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .eq('is_read', false)

            setUnreadCount(count || 0)

            const requestIds = rows.map((r) => r.request_id)

            const { data: scheduleRows } = requestIds.length
                ? await supabase
                    .from('claim_schedules')
                    .select('claim_schedule_id, request_id, claim_date, claim_time, scheduled_date, scheduled_time, status')
                    .in('request_id', requestIds)
                    .neq('status', 'cancelled')
                    .neq('status', 'claimed')
                    .order('claim_date', { ascending: true })
                    .limit(1)
                : { data: [] }

            if (scheduleRows && scheduleRows.length > 0) {
                const schedule = scheduleRows[0]
                const request = rows.find((r) => r.request_id === schedule.request_id)

                setUpcomingClaim({
                    ...schedule,
                    requestNumber: request?.request_number,
                    documentName: documentNameById[request?.document_type_id] || 'Document',
                })
            }

            const assignedEmployeeId = await findAssignedEmployee(student.college_id, student.program_id)

            if (assignedEmployeeId) {
                const { data: employeeRow } = await supabase
                    .from('employees')
                    .select('user_id')
                    .eq('employee_id', assignedEmployeeId)
                    .single()

                if (employeeRow) {
                    const { data: messageRows } = await supabase
                        .from('messages')
                        .select('message_id, sender_user_id, message, is_read, created_at')
                        .or(`and(sender_user_id.eq.${user.id},receiver_user_id.eq.${employeeRow.user_id}),and(sender_user_id.eq.${employeeRow.user_id},receiver_user_id.eq.${user.id})`)
                        .order('created_at', { ascending: false })
                        .limit(1)

                    if (messageRows && messageRows.length > 0) {
                        setLatestMessage({
                            ...messageRows[0],
                            fromStaff: messageRows[0].sender_user_id === employeeRow.user_id,
                        })
                    }

                    const { count } = await supabase
                        .from('messages')
                        .select('message_id', { count: 'exact', head: true })
                        .eq('receiver_user_id', user.id)
                        .eq('sender_user_id', employeeRow.user_id)
                        .eq('is_read', false)

                    setUnreadMessageCount(count || 0)
                }
            }

        } catch (error) {
            console.error('Dashboard error:', error)
        }

        setLoading(false)
    }

    const totalCount = requests.length
    const inProgressCount = requests.filter((r) => IN_PROGRESS_STATUSES.includes(r.status)).length
    const readyCount = requests.filter((r) => r.status === 'ready_for_claiming').length
    const completedCount = requests.filter((r) => r.status === 'completed').length

    const recentRequests = requests.slice(0, 3)
    const actionableRequests = requests.filter((r) => ACTION_NEEDED[r.status])

    const formatClaimDate = (date) => {
        if (!date) return 'N/A'
        return new Date(`${date}T00:00:00`).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
    }

    const formatClaimTime = (time) => {
        if (!time) return ''
        const [hours, minutes] = time.split(':')
        const date = new Date()
        date.setHours(Number(hours), Number(minutes), 0, 0)
        return date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
    }

    return (
        <div>
            <div className="student-dashboard-header">
                <h1>{!loading && name ? `Welcome back, ${name}` : 'Welcome back'}</h1>
                <p>Here's what you can do with your CertiChain account today.</p>
            </div>

            {!loading && (
                <>
                    <div className="student-stat-grid" style={{ marginBottom: 24 }}>
                        <button
                            className="student-stat-card"
                            style={{ '--stat-color': 'var(--blue)', '--stat-tint': 'var(--blue-tint)' }}
                            onClick={() => navigate('/student/my-requests')}
                        >
                            <div className="student-stat-icon"><IconList /></div>
                            <div>
                                <span className="student-stat-value">{totalCount}</span>
                                <span className="student-stat-label">Total Requests</span>
                            </div>
                        </button>

                        <button
                            className="student-stat-card"
                            style={{ '--stat-color': '#B45309', '--stat-tint': '#FEF3C7' }}
                            onClick={() => navigate('/student/my-requests')}
                        >
                            <div className="student-stat-icon"><IconClock /></div>
                            <div>
                                <span className="student-stat-value">{inProgressCount}</span>
                                <span className="student-stat-label">In Progress</span>
                            </div>
                        </button>

                        <button
                            className="student-stat-card"
                            style={{ '--stat-color': '#1e8a5f', '--stat-tint': 'rgba(30, 138, 95, 0.12)' }}
                            onClick={() => navigate('/student/claim-schedule')}
                        >
                            <div className="student-stat-icon"><IconCheckCircle /></div>
                            <div>
                                <span className="student-stat-value">{readyCount}</span>
                                <span className="student-stat-label">Ready for Claiming</span>
                            </div>
                        </button>

                        <button
                            className="student-stat-card"
                            style={{ '--stat-color': 'var(--blue-dark)', '--stat-tint': 'var(--paper)' }}
                            onClick={() => navigate('/student/my-requests')}
                        >
                            <div className="student-stat-icon"><IconDocumentPlus /></div>
                            <div>
                                <span className="student-stat-value">{completedCount}</span>
                                <span className="student-stat-label">Completed</span>
                            </div>
                        </button>

                        <button
                            className="student-stat-card"
                            style={{ '--stat-color': 'var(--red)', '--stat-tint': 'rgba(200, 16, 46, 0.08)' }}
                            onClick={() => navigate('/student/notifications')}
                        >
                            <div className="student-stat-icon"><IconBell /></div>
                            <div>
                                <span className="student-stat-value">{unreadCount}</span>
                                <span className="student-stat-label">Unread Notifications</span>
                            </div>
                        </button>
                    </div>

                    <div style={{ marginBottom: 24 }}>
                        <h2 style={{ fontSize: 17, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ color: 'var(--blue)', display: 'inline-flex' }}><IconNewspaper /></span>
                            HCDC News
                        </h2>

                        <div className="student-card" style={{ padding: 0, overflow: 'hidden' }}>
                            <iframe
                                title="HCDC Official Facebook Page"
                                src="https://www.facebook.com/plugins/page.php?href=https%3A%2F%2Fwww.facebook.com%2Fhcdcofficial&tabs=timeline&width=500&height=560&small_header=false&adapt_container_width=true&hide_cover=false&show_facepile=true"
                                width="100%"
                                height="560"
                                style={{ border: 'none', display: 'block', maxWidth: '100%' }}
                                allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                                allowFullScreen
                            />
                        </div>

                        <p style={{ fontSize: 12.5, color: 'var(--slate)', marginTop: 10 }}>
                            Feed provided by Facebook.{' '}
                            <a
                                href="https://www.facebook.com/hcdcofficial"
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: 'var(--blue)', fontWeight: 600 }}
                            >
                                Visit HCDC's Facebook page →
                            </a>
                        </p>
                    </div>

                    {upcomingClaim && (
                        <div className="student-notice tone-success" style={{ marginTop: 0, marginBottom: 24 }}>
                            <strong>Document ready to claim</strong>
                            <p>
                                {upcomingClaim.documentName} ({upcomingClaim.requestNumber}) —{' '}
                                {(upcomingClaim.claim_date || upcomingClaim.scheduled_date)
                                    ? <>scheduled for {formatClaimDate(upcomingClaim.claim_date || upcomingClaim.scheduled_date)} at {formatClaimTime(upcomingClaim.claim_time || upcomingClaim.scheduled_time)}</>
                                    : 'waiting to be scheduled by the Registrar.'}
                            </p>
                        </div>
                    )}

                    {actionableRequests.length > 0 && (
                        <div style={{ marginBottom: 24 }}>
                            <h2 style={{ fontSize: 17, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ color: '#B45309', display: 'inline-flex' }}><IconAlertCircle /></span>
                                Needs Your Attention
                            </h2>

                            {actionableRequests.map((request) => {
                                const action = ACTION_NEEDED[request.status]

                                return (
                                    <div className="student-list-card" key={request.request_id}>
                                        <div className="student-list-card-header">
                                            <div>
                                                <h3>{request.documentName}</h3>
                                                <p>Request {request.request_number} · {action.label}</p>
                                            </div>
                                            <span className={`student-status-pill status-${request.status}`}>
                                                {request.status.replace(/_/g, ' ')}
                                            </span>
                                        </div>

                                        <button
                                            className="student-link-button"
                                            onClick={() => navigate(action.to(request.request_id))}
                                        >
                                            {action.cta}
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {totalCount === 0 && (
                        <div className="student-notice tone-info" style={{ marginTop: 0, marginBottom: 24 }}>
                            <strong>No requests yet</strong>
                            <p>
                                Once you request your first document, you'll be able to track its
                                status right here — from payment to claiming.
                            </p>
                        </div>
                    )}

                    {latestMessage && (
                        <div className="student-list-card" style={{ marginBottom: 24 }}>
                            <div className="student-list-card-header">
                                <div>
                                    <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ color: 'var(--blue)', display: 'inline-flex' }}><IconMessage /></span>
                                        Recent Message
                                    </h3>
                                    <p>
                                        {latestMessage.fromStaff ? 'From your registrar staff' : 'You sent'} ·{' '}
                                        {new Date(latestMessage.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                                    </p>
                                </div>
                                {unreadMessageCount > 0 && (
                                    <span className="student-status-pill status-pending">{unreadMessageCount} unread</span>
                                )}
                            </div>

                            <p style={{ fontSize: 13.5, color: 'var(--ink)', margin: '4px 0 10px' }}>
                                {latestMessage.message.length > 140
                                    ? `${latestMessage.message.slice(0, 140)}…`
                                    : latestMessage.message}
                            </p>

                            <button className="student-link-button" onClick={() => navigate('/student/messages')}>
                                {unreadMessageCount > 0 ? 'Reply →' : 'View conversation →'}
                            </button>
                        </div>
                    )}
                </>
            )}

            <div className="student-dashboard-grid">

                <button
                    className="student-dashboard-card"
                    onClick={() => navigate('/student/my-requests')}
                >
                    <div className="student-dashboard-card-icon"><IconList /></div>
                    <h3>My Requests</h3>
                    <p>Track the status of documents you've already requested.</p>
                    <span className="student-dashboard-card-link">View requests →</span>
                </button>

                <button
                    className="student-dashboard-card"
                    onClick={() => navigate('/student/claim-schedule')}
                >
                    <div className="student-dashboard-card-icon"><IconCalendar /></div>
                    <h3>Claim Schedule</h3>
                    <p>See when and where to pick up your ready documents.</p>
                    <span className="student-dashboard-card-link">View schedule →</span>
                </button>

                <button
                    className="student-dashboard-card"
                    onClick={() => navigate('/student/notifications')}
                >
                    <div className="student-dashboard-card-icon"><IconBell /></div>
                    <h3>Notifications</h3>
                    <p>Stay updated on payments, approvals, and claim schedules.</p>
                    <span className="student-dashboard-card-link">View notifications →</span>
                </button>

            </div>

            {!loading && recentRequests.length > 0 && (
                <>
                    <div className="student-page-header-row" style={{ marginTop: 32, marginBottom: 16 }}>
                        <h2 style={{ fontSize: 17 }}>Recent Requests</h2>
                        <button className="student-link-button" onClick={() => navigate('/student/my-requests')}>
                            View all →
                        </button>
                    </div>

                    {recentRequests.map((request) => (
                        <div className="student-list-card" key={request.request_id}>
                            <div className="student-list-card-header">
                                <div>
                                    <h3>{request.documentName}</h3>
                                    <p>Request {request.request_number}</p>
                                </div>
                                <span className={`student-status-pill status-${request.status}`}>
                                    {request.status.replace(/_/g, ' ')}
                                </span>
                            </div>

                            <button
                                className="student-link-button"
                                onClick={() => navigate(`/student/request/${request.request_id}`)}
                            >
                                View details →
                            </button>
                        </div>
                    ))}
                </>
            )}
        </div>
    )
}

export default Dashboard
