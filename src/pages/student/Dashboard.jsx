import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { fetchActiveAnnouncements } from '../../lib/announcements'
import AnnouncementCarousel from '../../components/AnnouncementCarousel'
import { IconDocumentPlus, IconList, IconCalendar, IconBell } from './icons'
import './StudentPages.css'
import './Dashboard.css'

const IN_PROGRESS_STATUSES = [
    'pending', 'payment_pending', 'receipt_uploaded', 'receipt_verified',
    'processing', 'lacking_requirements',
]

function Dashboard() {
    const [name, setName] = useState('')
    const [requests, setRequests] = useState([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [upcomingClaim, setUpcomingClaim] = useState(null)
    const [announcements, setAnnouncements] = useState([])
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
                .select('student_id')
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

            setAnnouncements(await fetchActiveAnnouncements('show_to_students'))

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

            {announcements.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                    <AnnouncementCarousel items={announcements} />
                </div>
            )}

            {!loading && (
                <>
                    <div className="student-info-grid" style={{ marginBottom: 24 }}>
                        <button className="student-card" style={{ textAlign: 'left', margin: 0, cursor: 'pointer' }} onClick={() => navigate('/student/my-requests')}>
                            <span style={{ display: 'block', fontSize: 24, fontWeight: 700, color: 'var(--blue)', marginBottom: 4 }}>{totalCount}</span>
                            <span style={{ fontSize: 12.5, color: 'var(--slate)' }}>Total Requests</span>
                        </button>

                        <button className="student-card" style={{ textAlign: 'left', margin: 0, cursor: 'pointer' }} onClick={() => navigate('/student/my-requests')}>
                            <span style={{ display: 'block', fontSize: 24, fontWeight: 700, color: 'var(--blue)', marginBottom: 4 }}>{inProgressCount}</span>
                            <span style={{ fontSize: 12.5, color: 'var(--slate)' }}>In Progress</span>
                        </button>

                        <button className="student-card" style={{ textAlign: 'left', margin: 0, cursor: 'pointer' }} onClick={() => navigate('/student/claim-schedule')}>
                            <span style={{ display: 'block', fontSize: 24, fontWeight: 700, color: 'var(--blue)', marginBottom: 4 }}>{readyCount}</span>
                            <span style={{ fontSize: 12.5, color: 'var(--slate)' }}>Ready for Claiming</span>
                        </button>

                        <button className="student-card" style={{ textAlign: 'left', margin: 0, cursor: 'pointer' }} onClick={() => navigate('/student/my-requests')}>
                            <span style={{ display: 'block', fontSize: 24, fontWeight: 700, color: 'var(--blue)', marginBottom: 4 }}>{completedCount}</span>
                            <span style={{ fontSize: 12.5, color: 'var(--slate)' }}>Completed</span>
                        </button>

                        <button className="student-card" style={{ textAlign: 'left', margin: 0, cursor: 'pointer' }} onClick={() => navigate('/student/notifications')}>
                            <span style={{ display: 'block', fontSize: 24, fontWeight: 700, color: 'var(--blue)', marginBottom: 4 }}>{unreadCount}</span>
                            <span style={{ fontSize: 12.5, color: 'var(--slate)' }}>Unread Notifications</span>
                        </button>
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
                </>
            )}

            <div className="student-dashboard-grid">

                <button
                    className="student-dashboard-card"
                    onClick={() => navigate('/student/new-request')}
                >
                    <div className="student-dashboard-card-icon"><IconDocumentPlus /></div>
                    <h3>Request a Document</h3>
                    <p>Submit a new request for a transcript, certificate, or diploma.</p>
                    <span className="student-dashboard-card-link">Get started →</span>
                </button>

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
