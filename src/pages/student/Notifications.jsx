import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { SkeletonList } from '../../components/Skeleton'
import PageStats from '../../components/PageStats'
import { IconFileStack, IconMegaphone, IconUsers, IconCalendarCheck } from '../admin/icons'
import { IconBell, IconMessage } from '../student/icons'
import { EmptyState } from './StudentUi'
import { friendlyError } from '../../lib/friendlyError'

// Icon per notification type.
const TYPE_ICONS = { request_update: IconFileStack, message: IconMessage, announcement: IconMegaphone, system: IconUsers, schedule: IconCalendarCheck }
// Plain names for the notification kinds.
const TYPE_LABELS = { request_update: 'Request update', message: 'Message', announcement: 'Announcement', system: 'Account', schedule: 'Pickup', claim_schedule: 'Pickup', requirement: 'Requirements', receipt: 'Payment' }
import './StudentPages.css'
import { useLiveRefresh } from '../../lib/useLiveRefresh'

function Notifications() {
    const navigate = useNavigate()

    const [showFilter, setShowFilter] = useState('all')
    const [notifications, setNotifications] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [userId, setUserId] = useState(null)

    useLiveRefresh(['notifications'], (options) => loadNotifications(options))

    useEffect(() => {
        loadNotifications()
    }, [])

    const loadNotifications = async ({ silent = false } = {}) => {
        try {
            if (!silent) setLoading(true)
            setError('')

            const {
                data: { user },
                error: userError
            } = await supabase.auth.getUser()

            if (userError || !user) {
                throw new Error('You are not logged in.')
            }

            setUserId(user.id)

            const { data, error: notificationsError } = await supabase
                .from('notifications')
                .select(`
                    notification_id,
                    title,
                    message,
                    notification_type,
                    related_request_id,
                    is_read,
                    read_at,
                    created_at
                `)
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })

            if (notificationsError) {
                throw new Error('Failed to load notifications: ' + notificationsError.message)
            }

            setNotifications(data || [])

        } catch (err) {
            console.error('NOTIFICATIONS ERROR:', err)
            setError(friendlyError(err, "We couldn't load your notifications."))
        } finally {
            setLoading(false)
        }
    }

    const markAsRead = async (notification) => {
        if (notification.is_read) return

        setNotifications((prev) =>
            prev.map((n) =>
                n.notification_id === notification.notification_id
                    ? { ...n, is_read: true, read_at: new Date().toISOString() }
                    : n
            )
        )

        await supabase
            .from('notifications')
            .update({ is_read: true, read_at: new Date().toISOString() })
            .eq('notification_id', notification.notification_id)

        window.dispatchEvent(new Event('notifications-updated'))
    }

    const markAllAsRead = async () => {
        if (!userId) return

        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))

        await supabase
            .from('notifications')
            .update({ is_read: true, read_at: new Date().toISOString() })
            .eq('user_id', userId)
            .eq('is_read', false)

        window.dispatchEvent(new Event('notifications-updated'))
    }

    const handleClick = (notification) => {
        markAsRead(notification)

        if (notification.related_request_id) {
            navigate(`/student/request/${notification.related_request_id}`)
        }
    }

    const formatDate = (value) => {
        if (!value) return ''

        return new Date(value).toLocaleString('en-PH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        })
    }

    const unreadCount = notifications.filter((n) => !n.is_read).length

    return (
        <div>
            <div className="student-page-header-row" style={{ marginBottom: 28 }}>
                <div>
                    <h1 style={{ fontSize: 26, marginBottom: 6 }}>Notifications</h1>
                    <p>Updates about your requests, payments, and claiming schedules.</p>
                </div>

                {unreadCount > 0 && (
                    <button className="student-link-button" onClick={markAllAsRead}>
                        Mark all as read
                    </button>
                )}
            </div>

            {error && <div className="student-error-box">{error}</div>}

            {!loading && notifications.length > 0 && (
                <>
                    <PageStats
                        stats={[
                            { label: 'Unread', value: unreadCount, note: unreadCount ? 'Need your attention' : 'All caught up', Icon: IconBell, warn: unreadCount > 0, onClick: () => setShowFilter('unread') },
                            { label: 'Today', value: notifications.filter((n) => new Date(n.created_at).toDateString() === new Date().toDateString()).length, note: 'Received today', Icon: IconFileStack },
                            { label: 'All notifications', value: notifications.length, note: 'Most recent first', Icon: IconMegaphone, onClick: () => setShowFilter('all') },
                        ]}
                    />

                    <div className="student-filter-row">
                        {[
                            { key: 'all', label: 'All', count: notifications.length },
                            { key: 'unread', label: 'Unread', count: unreadCount },
                        ].map((chip) => (
                            <button
                                key={chip.key}
                                className={`student-filter-chip${showFilter === chip.key ? ' active' : ''}`}
                                onClick={() => setShowFilter(chip.key)}
                            >
                                {chip.label}<span className="ui-chip-count">{chip.count}</span>
                            </button>
                        ))}
                    </div>
                </>
            )}

            {loading ? (
                <SkeletonList count={3} />
            ) : showFilter === 'unread' && unreadCount === 0 && notifications.length > 0 ? (
                <EmptyState icon={<IconBell />} title="You're all caught up" text="You have no unread notifications." />
            ) : notifications.length === 0 ? (
                <EmptyState
                    icon={<IconBell />}
                    title="No notifications yet"
                    text="Updates about your requests, payments and pickup schedule will show up here."
                />
            ) : (
                notifications.filter((n) => showFilter === 'all' || !n.is_read).map((notification) => (
                    <button
                        key={notification.notification_id}
                        onClick={() => handleClick(notification)}
                        className="student-list-card"
                        style={{
                            textAlign: 'left',
                            width: '100%',
                            cursor: 'pointer',
                            borderLeft: notification.is_read ? undefined : '4px solid var(--blue-accent, var(--blue))',
                            background: notification.is_read ? 'var(--surface)' : 'var(--blue-tint)',
                        }}
                    >
                        <div className="student-list-card-header">
                            <div className="ui-card-title">
                                {(() => {
                                    const TypeIcon = TYPE_ICONS[notification.notification_type] || IconBell
                                    return <span className={`ui-avatar is-square${notification.is_read ? ' is-muted' : ''}`} aria-hidden="true"><TypeIcon /></span>
                                })()}
                                <div>
                                    <span className="nt-type">{TYPE_LABELS[notification.notification_type] || 'Update'}</span>
                                    <h3>{notification.title}</h3>
                                    <p>{notification.message}</p>
                                    <span className="nt-meta">
                                        {formatDate(notification.created_at)}
                                        {notification.related_request_id && <span className="nt-open">View request →</span>}
                                    </span>
                                </div>
                            </div>

                            {!notification.is_read && (
                                <span className="student-status-pill status-pending">New</span>
                            )}
                        </div>

                    </button>
                ))
            )}
        </div>
    )
}

export default Notifications
