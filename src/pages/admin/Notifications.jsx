import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { SkeletonList } from '../../components/Skeleton'
import './AdminPages.css'

function Notifications() {
    const navigate = useNavigate()

    const [notifications, setNotifications] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [userId, setUserId] = useState(null)

    useEffect(() => {
        loadNotifications()
    }, [])

    const loadNotifications = async () => {
        try {
            setLoading(true)
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
                .select('notification_id, title, message, notification_type, related_request_id, is_read, read_at, created_at')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })

            if (notificationsError) {
                throw new Error('Failed to load notifications: ' + notificationsError.message)
            }

            setNotifications(data || [])

        } catch (err) {
            console.error('ADMIN NOTIFICATIONS ERROR:', err)
            setError(err.message || 'Failed to load notifications.')
        } finally {
            setLoading(false)
        }
    }

    const markAsRead = async (notification) => {
        if (notification.is_read) return

        setNotifications((prev) =>
            prev.map((n) => (n.notification_id === notification.notification_id ? { ...n, is_read: true } : n))
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
            navigate(`/admin/requests/${notification.related_request_id}`)
        }
    }

    const formatDate = (value) =>
        new Date(value).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

    const unreadCount = notifications.filter((n) => !n.is_read).length

    return (
        <div>
            <div className="admin-page-header-row" style={{ marginBottom: 28 }}>
                <div>
                    <h1 style={{ fontSize: 26, marginBottom: 6 }}>Notifications</h1>
                    <p>System, employee, and student-related alerts sent to you.</p>
                </div>

                {unreadCount > 0 && (
                    <button className="admin-link-button" onClick={markAllAsRead}>Mark all as read</button>
                )}
            </div>

            {error && <div className="admin-error-box">{error}</div>}

            {loading ? (
                <SkeletonList count={3} />
            ) : notifications.length === 0 ? (
                <div className="admin-empty">You have no notifications yet.</div>
            ) : (
                notifications.map((notification) => (
                    <button
                        key={notification.notification_id}
                        onClick={() => handleClick(notification)}
                        className="admin-list-card"
                        style={{
                            textAlign: 'left',
                            width: '100%',
                            cursor: 'pointer',
                            borderColor: notification.is_read ? 'var(--line)' : 'var(--blue)',
                            background: notification.is_read ? 'var(--surface)' : 'var(--blue-tint)',
                        }}
                    >
                        <div className="admin-list-card-header">
                            <div>
                                <h3>{notification.title}</h3>
                                <p>{notification.message}</p>
                            </div>

                            {!notification.is_read && <span className="admin-status-pill status-pending">New</span>}
                        </div>

                        <span style={{ fontSize: 12, color: 'var(--slate)' }}>{formatDate(notification.created_at)}</span>
                    </button>
                ))
            )}
        </div>
    )
}

export default Notifications
