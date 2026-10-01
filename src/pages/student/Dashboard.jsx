import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useLiveRefresh } from '../../lib/useLiveRefresh'
import { loadHiddenMessageIds, readMessage } from '../../lib/messageActions'
import { buildSenderLabels, REGISTRAR_LABEL } from '../../lib/messageSenderLabel'
import { chatListTime } from '../../lib/chatTime'
import { fetchActiveAnnouncements } from '../../lib/announcements'
import { fetchOfficeScheduleNotices } from '../../lib/officeCalendar'
import AnnouncementNotice from '../../components/AnnouncementNotice'
import { IconDocumentPlus, IconList, IconCheckCircle, IconAlertCircle, IconMessage, IconHelp } from './icons'
import { ACTIVE_STATUSES, describeRequest } from '../../lib/studentProgress'
import { SkeletonStatGrid, SkeletonPage } from '../../components/Skeleton'
import './StudentPages.css'
import './Dashboard.css'

// Statuses where the student has to do something.
const ACTION_STATUSES = ['pending', 'payment_pending', 'lacking_requirements']

const greeting = () => {
    const h = new Date().getHours()
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

function Dashboard() {
    const [name, setName] = useState('')
    const [requests, setRequests] = useState([])
    // Unread notifications show on the bell in the header.
    const [, setUnreadCount] = useState(0)
    const [upcomingClaim, setUpcomingClaim] = useState(null)
    const [missedClaimCount, setMissedClaimCount] = useState(0)
    const [latestMessage, setLatestMessage] = useState(null)
    const [unreadMessageCount, setUnreadMessageCount] = useState(0)
    const [announcements, setAnnouncements] = useState([])
    const [loading, setLoading] = useState(true)

    const navigate = useNavigate()

    useEffect(() => {
        loadDashboard()

        window.addEventListener('notifications-updated', loadDashboard)
        return () => window.removeEventListener('notifications-updated', loadDashboard)
    }, [])

    // Update in place when requests change -- no manual refresh needed.
    useLiveRefresh(['document_requests', 'claim_schedules', 'announcements', 'office_open_days', 'messages'], loadDashboard)

    // Everything is fetched in two rounds of parallel requests (instead of
    // one after another): each database round trip is ~0.3 s from Davao.
    async function loadDashboard() {
        try {
            const {
                data: { user }
            } = await supabase.auth.getUser()

            if (!user) {
                setLoading(false)
                return
            }

            // Round 1: everything that only needs the signed-in user.
            const [
                posted,
                officeNotices,
                { data: profile },
                { data: student },
                { count: unreadNotifications },
                { data: messageRows },
                hiddenIds,
                { count: unreadMessages },
                { data: documentTypes },
            ] = await Promise.all([
                fetchActiveAnnouncements('show_to_students'),
                fetchOfficeScheduleNotices(),
                supabase.from('profiles').select('first_name, last_name').eq('user_id', user.id).single(),
                supabase.from('students').select('student_id, college_id, program_id').eq('user_id', user.id).single(),
                supabase.from('notifications').select('notification_id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false),
                supabase
                    .from('messages')
                    .select('message_id, sender_user_id, receiver_user_id, message, is_read, created_at, deleted_at')
                    .or(`sender_user_id.eq.${user.id},receiver_user_id.eq.${user.id}`)
                    .order('created_at', { ascending: false })
                    .limit(20),
                loadHiddenMessageIds(user.id),
                supabase.from('messages').select('message_id', { count: 'exact', head: true }).eq('receiver_user_id', user.id).eq('is_read', false),
                supabase.from('document_types').select('document_type_id, document_name'),
            ])

            setAnnouncements([...officeNotices.filter((n) => n.announcement_date), ...posted, ...officeNotices.filter((n) => !n.announcement_date)])
            if (profile) setName(profile.first_name)
            setUnreadCount(unreadNotifications || 0)
            setUnreadMessageCount(unreadMessages || 0)

            const documentNameById = Object.fromEntries(
                (documentTypes || []).map((d) => [d.document_type_id, d.document_name])
            )

            // Most recent message in any of the student's conversations (the
            // staff handling their requests, or the Registrar Head), shown the
            // way Messages shows it: tags removed, deleted ones as such.
            const latest = (messageRows || []).find((m) => !hiddenIds.has(m.message_id))
            const otherId = latest && (latest.sender_user_id === user.id ? latest.receiver_user_id : latest.sender_user_id)

            // Round 2: things that need the student record or the latest message.
            const [
                { data: requestRows },
                { data: scheduleRows },
                { count: missedCount },
                labels,
                { data: employeeRow },
            ] = await Promise.all([
                student
                    ? supabase
                        .from('document_requests')
                        .select('*')
                        .eq('student_id', student.student_id)
                        .order('requested_at', { ascending: false })
                    : Promise.resolve({ data: [] }),
                student
                    ? supabase
                        .from('claim_schedules')
                        .select('claim_schedule_id, request_id, claim_date, claim_time, scheduled_date, scheduled_time, status')
                        .eq('student_id', student.student_id)
                        .neq('status', 'cancelled')
                        .neq('status', 'claimed')
                        .order('claim_date', { ascending: true })
                        .limit(1)
                    : Promise.resolve({ data: [] }),
                student
                    ? supabase.from('claim_schedules').select('claim_schedule_id', { count: 'exact', head: true }).eq('student_id', student.student_id).eq('status', 'missed')
                    : Promise.resolve({ count: 0 }),
                otherId ? buildSenderLabels([otherId]) : Promise.resolve({}),
                otherId
                    ? supabase.from('employees').select('employee_id, display_name').eq('user_id', otherId).maybeSingle()
                    : Promise.resolve({ data: null }),
            ])

            if (latest) {
                setLatestMessage({
                    ...readMessage(latest),
                    fromStaff: latest.sender_user_id !== user.id,
                    otherName: employeeRow?.display_name?.trim() || labels[otherId] || REGISTRAR_LABEL,
                    employeeId: employeeRow?.employee_id || null,
                })
            } else {
                setLatestMessage(null)
            }

            if (!student) {
                setLoading(false)
                return
            }

            const rows = requestRows || []
            setRequests(rows.map((r) => ({ ...r, documentName: documentNameById[r.document_type_id] || 'Document' })))
            setMissedClaimCount(missedCount || 0)

            if (scheduleRows && scheduleRows.length > 0) {
                const schedule = scheduleRows[0]
                const request = rows.find((r) => r.request_id === schedule.request_id)

                setUpcomingClaim({
                    ...schedule,
                    requestNumber: request?.request_number,
                    documentName: documentNameById[request?.document_type_id] || 'Document',
                })
            } else {
                setUpcomingClaim(null)
            }

        } catch (error) {
            console.error('Dashboard error:', error)
        }

        setLoading(false)
    }

    // A rejected request (not an automatic one) means the receipt must be re-uploaded.
    const isActive = (r) => ACTIVE_STATUSES.includes(r.status) || (r.status === 'rejected' && !r.auto_rejected_at)
    const activeRequests = requests
        .filter(isActive)
        // The upcoming pickup (when it's this request) gives its "Ready" row the date.
        .map((r) => ({ ...r, info: describeRequest(r, { schedule: upcomingClaim?.request_id === r.request_id ? upcomingClaim : null }) }))
        .sort((a, b) => (a.info.tone === 'action' ? 0 : 1) - (b.info.tone === 'action' ? 0 : 1))
    const actionCount = activeRequests.filter((r) => r.info.tone === 'action').length
    const completedCount = requests.filter((r) => r.status === 'completed').length
    const readyCount = requests.filter((r) => r.status === 'ready_for_claiming').length

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

    const summary = [
        { key: 'active', label: 'Active Requests', hint: 'In progress', value: activeRequests.length, icon: <IconList />, color: 'var(--blue-accent, var(--blue))', tint: 'var(--blue-tint)', to: `/student/my-requests?status=${ACTIVE_STATUSES.join(',')}` },
        { key: 'action', label: 'Pending Actions', hint: actionCount ? 'Needs you' : 'All clear', value: actionCount, icon: <IconAlertCircle />, color: '#B45309', tint: 'rgba(180, 83, 9, 0.12)', to: `/student/my-requests?status=${[...ACTION_STATUSES, 'rejected'].join(',')}` },
        { key: 'completed', label: 'Completed', hint: 'Released to you', value: completedCount, icon: <IconCheckCircle />, color: '#1e8a5f', tint: 'rgba(30, 138, 95, 0.12)', to: '/student/my-requests?status=completed' },
        { key: 'ready', label: 'Ready for You', hint: 'Ready for pickup', value: readyCount, icon: <IconDocumentPlus />, color: '#9A7A1F', tint: 'rgba(201, 162, 58, 0.16)', to: '/student/claim-schedule' },
    ]

    return (
        <div className="sd-page">
            <section className="sd-hero">
                <div className="sd-hero-text">
                    <h1>{greeting()}{!loading && name ? `, ${name}` : ''}</h1>
                    <p>Manage your academic document requests, requirements, and document releases in one place.</p>
                </div>
                <div className="sd-hero-actions">
                    <button type="button" className="sd-primary-btn" onClick={() => navigate('/student/new-request')}>
                        <IconDocumentPlus /> Request a Document
                    </button>
                    <button type="button" className="sd-secondary-btn" onClick={() => navigate('/student/guide')}>
                        <IconHelp /> How it works
                    </button>
                </div>
            </section>

            {loading && (
                <>
                    <SkeletonStatGrid count={4} gridClassName="sd-summary" cardClassName="sd-summary-card" />
                    <SkeletonPage portal="student" blocks={[{ type: 'list', count: 3, fields: 0 }]} />
                </>
            )}

            {!loading && (
                <>
                    {announcements.length > 0 && (
                        <section className="student-announcements" aria-label="Announcements">
                            {announcements.map((a) => (
                                <AnnouncementNotice key={a.announcement_id} announcement={a} />
                            ))}
                        </section>
                    )}

                    <div className="sd-summary">
                        {summary.map((card) => (
                            <button
                                type="button"
                                key={card.key}
                                className={`sd-summary-card${card.key === 'action' && card.value > 0 ? ' is-alert' : ''}`}
                                style={{ '--stat-color': card.color, '--stat-tint': card.tint }}
                                onClick={() => navigate(card.to)}
                            >
                                <span className="sd-summary-icon">{card.icon}</span>
                                <span className="sd-summary-body">
                                    <span className="sd-summary-value">{card.value}</span>
                                    <span className="sd-summary-label">{card.label}</span>
                                    <span className="sd-summary-hint">{card.hint}</span>
                                </span>
                            </button>
                        ))}
                    </div>

                    {missedClaimCount > 0 && (
                        <div className="student-notice tone-danger" style={{ marginTop: 0, marginBottom: 20 }}>
                            <strong>{missedClaimCount === 1 ? 'You missed a pickup appointment' : `You've missed ${missedClaimCount} pickup appointments`}</strong>
                            <p>
                                Please visit the Registrar's Office as soon as possible to claim your document(s).
                                {missedClaimCount >= 2
                                    ? ' Repeated missed appointments may result in your account being suspended or deactivated by the Registrar\'s Office.'
                                    : ''}
                            </p>
                        </div>
                    )}

                    {upcomingClaim && (
                        <div className="sd-pickup">
                            <span className="sd-pickup-icon"><IconCheckCircle /></span>
                            <div>
                                <strong>Your document is ready</strong>
                                <p>
                                    {upcomingClaim.documentName} ({upcomingClaim.requestNumber}) —{' '}
                                    {(upcomingClaim.claim_date || upcomingClaim.scheduled_date)
                                        ? <>pickup on <b>{formatClaimDate(upcomingClaim.claim_date || upcomingClaim.scheduled_date)}</b> at <b>{formatClaimTime(upcomingClaim.claim_time || upcomingClaim.scheduled_time)}</b>, Registrar's Office. Bring a valid ID and your Official Receipt.</>
                                        : 'the Registrar will set your pickup date and time.'}
                                </p>
                            </div>
                            <button type="button" className="sd-secondary-btn" onClick={() => navigate('/student/claim-schedule')}>View pickup</button>
                        </div>
                    )}

                    <section className="sd-current" aria-labelledby="sd-current-title">
                        <div className="sd-section-head">
                            <h2 id="sd-current-title">Current Requests</h2>
                            {requests.length > 0 && (
                                <button type="button" className="student-link-button" onClick={() => navigate('/student/my-requests')}>
                                    View all requests →
                                </button>
                            )}
                        </div>

                        {activeRequests.length === 0 ? (
                            <div className="sd-empty">
                                <span className="sd-empty-icon"><IconList /></span>
                                <strong>No active requests</strong>
                                <p>You don't have any active document requests yet.</p>
                                <button type="button" className="sd-primary-btn" onClick={() => navigate('/student/new-request')}>
                                    <IconDocumentPlus /> Request a Document
                                </button>
                            </div>
                        ) : (
                            <div className="sd-table" role="table" aria-label="Your current requests">
                                <div className="sd-row sd-row-head" role="row">
                                    <span role="columnheader">Document</span>
                                    <span role="columnheader">Requested</span>
                                    <span role="columnheader">Status</span>
                                    <span role="columnheader">Next action</span>
                                    <span role="columnheader"><span className="visually-hidden">Details</span></span>
                                </div>
                                {activeRequests.map((r) => (
                                    <div key={r.request_id} className={`sd-row${r.info.tone === 'action' ? ' is-action' : ''}`} role="row">
                                        <span role="cell" className="sd-cell-doc">
                                            <strong>{r.documentName}</strong>
                                            <small>{r.request_number}</small>
                                        </span>
                                        <span role="cell" className="sd-cell-date">
                                            <small className="sd-cell-label">Requested</small>
                                            {r.requested_at ? new Date(r.requested_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                                        </span>
                                        <span role="cell">
                                            <span className={`sd-status tone-${r.info.tone}`}>{r.info.statusLabel}</span>
                                        </span>
                                        <span role="cell" className="sd-cell-next">
                                            {r.info.tone === 'action' && r.info.action ? (
                                                <button type="button" className="sd-action-btn" onClick={() => navigate(r.info.action.to)}>
                                                    {r.info.action.label}
                                                </button>
                                            ) : (
                                                <span className="sd-no-action">{r.info.todo.split('.')[0]}.</span>
                                            )}
                                        </span>
                                        <span role="cell" className="sd-cell-view">
                                            <button type="button" className="sd-view-btn" onClick={() => navigate(`/student/request/${r.request_id}`)}>
                                                View Details
                                            </button>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {latestMessage && (
                        <div className="student-list-card" style={{ marginTop: 24 }}>
                            <div className="student-list-card-header">
                                <div>
                                    <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ color: 'var(--blue-accent, var(--blue))', display: 'inline-flex' }}><IconMessage /></span>
                                        Recent Message
                                    </h3>
                                    <p>
                                        {latestMessage.fromStaff ? `From ${latestMessage.otherName}` : `You to ${latestMessage.otherName}`} · {chatListTime(latestMessage.created_at)}
                                    </p>
                                </div>
                                {unreadMessageCount > 0 && (
                                    <span className="student-status-pill status-pending">{unreadMessageCount} unread</span>
                                )}
                            </div>

                            <p style={{ fontSize: 13.5, color: 'var(--ink)', margin: '4px 0 10px' }}>
                                {latestMessage.deleted_at
                                    ? <em style={{ color: 'var(--slate)' }}>{latestMessage.fromStaff ? 'This message was deleted.' : 'You deleted this message.'}</em>
                                    : latestMessage.message.length > 140
                                        ? `${latestMessage.message.slice(0, 140)}…`
                                        : latestMessage.message}
                            </p>

                            <button
                                className="student-link-button"
                                onClick={() => navigate(latestMessage.employeeId ? `/student/messages?employee=${latestMessage.employeeId}` : '/student/messages')}
                            >
                                {unreadMessageCount > 0 ? 'Reply →' : 'View conversation →'}
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}

export default Dashboard
