import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { notifyError, notifySuccess } from '../../lib/notify'
import { SkeletonList } from '../../components/Skeleton'
import './AdminPages.css'

function Notifications() {
    const navigate = useNavigate()

    const [notifications, setNotifications] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [userId, setUserId] = useState(null)

    const [currentRole, setCurrentRole] = useState('')
    const [overdueAlertDays, setOverdueAlertDays] = useState('')
    const [savingSettings, setSavingSettings] = useState(false)

    useEffect(() => {
        loadNotifications()
        loadCurrentRole()
        loadSettings()
    }, [])

    const loadCurrentRole = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('user_id', user.id)
            .single()

        setCurrentRole(profile?.role || '')
    }

    const loadSettings = async () => {
        const { data } = await supabase
            .from('system_settings')
            .select('overdue_alert_days')
            .eq('id', 1)
            .maybeSingle()

        setOverdueAlertDays(data?.overdue_alert_days ?? 2)
    }

    const saveSettings = async () => {
        const days = Number(overdueAlertDays)

        if (!days || days < 1) {
            notifyError('Enter a number of days of at least 1.')
            return
        }

        try {
            setSavingSettings(true)

            const { data: { user } } = await supabase.auth.getUser()

            const { error: updateError } = await supabase
                .from('system_settings')
                .update({ overdue_alert_days: days, updated_at: new Date().toISOString(), updated_by: user?.id })
                .eq('id', 1)

            if (updateError) throw new Error(updateError.message)

            notifySuccess('Overdue alert threshold updated.')

        } catch (err) {
            console.error('SAVE SYSTEM SETTINGS ERROR:', err)
            notifyError(err.message || 'Failed to save settings.')
        } finally {
            setSavingSettings(false)
        }
    }

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

            {currentRole === 'registrar_head' && (
                <div className="admin-card" style={{ marginBottom: 24 }}>
                    <h2 style={{ fontSize: 15, marginBottom: 6 }}>Daily Registrar Alert Settings</h2>
                    <p style={{ fontSize: 13, color: 'var(--slate)', marginBottom: 14 }}>
                        A request sitting unprocessed for this many days or more gets flagged in the daily "Daily registrar alert" notification.
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input
                            type="number"
                            min="1"
                            className="admin-search-input"
                            style={{ width: 90 }}
                            value={overdueAlertDays}
                            onChange={(e) => setOverdueAlertDays(e.target.value)}
                            disabled={savingSettings}
                        />
                        <span style={{ fontSize: 13.5, color: 'var(--slate)' }}>days</span>
                        <button className="admin-primary-button" onClick={saveSettings} disabled={savingSettings}>
                            {savingSettings ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </div>
            )}

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
