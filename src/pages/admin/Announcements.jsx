import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activityLog'
import { notifyError, notifySuccess, confirmModal } from '../../lib/notify'
import './AdminPages.css'

const AUDIENCES = [
    { key: 'students', label: 'All Students', roles: ['student'] },
    { key: 'employees', label: 'All Employees', roles: ['employee', 'registrar_head'] },
    { key: 'everyone', label: 'Everyone', roles: ['student', 'employee', 'registrar_head'] },
]

function Announcements() {
    const [audience, setAudience] = useState('students')
    const [title, setTitle] = useState('')
    const [message, setMessage] = useState('')
    const [sending, setSending] = useState(false)
    const [recipientCount, setRecipientCount] = useState(null)

    const send = async (e) => {
        e.preventDefault()

        if (!title.trim() || !message.trim()) {
            notifyError('Please fill in both a title and a message.')
            return
        }

        const target = AUDIENCES.find((a) => a.key === audience)

        try {
            setSending(true)
            setRecipientCount(null)

            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser()

            if (userError || !user) {
                throw new Error('You are not logged in.')
            }

            const { data: recipients, error: recipientsError } = await supabase
                .from('profiles')
                .select('user_id')
                .in('role', target.roles)
                .eq('status', 'active')

            if (recipientsError) {
                throw new Error('Failed to load recipients: ' + recipientsError.message)
            }

            const rows = recipients || []

            if (rows.length === 0) {
                notifyError('No active accounts match that audience.')
                return
            }

            const confirmed = await confirmModal(
                `Send this announcement to ${rows.length} ${target.label.toLowerCase()}?`
            )

            if (!confirmed) return

            const now = new Date().toISOString()

            const notifications = rows.map((r) => ({
                user_id: r.user_id,
                title: title.trim(),
                message: message.trim(),
                notification_type: 'system',
                is_read: false,
                created_at: now,
            }))

            // Insert in batches so a single request doesn't try to carry
            // thousands of rows at once.
            const BATCH_SIZE = 500

            for (let i = 0; i < notifications.length; i += BATCH_SIZE) {
                const { error: insertError } = await supabase
                    .from('notifications')
                    .insert(notifications.slice(i, i + BATCH_SIZE))

                if (insertError) {
                    throw new Error('Failed to send announcement: ' + insertError.message)
                }
            }

            await logActivity({
                userId: user.id,
                action: 'send_announcement',
                tableName: 'notifications',
                recordId: null,
                description: `Sent an announcement ("${title.trim()}") to ${rows.length} ${target.label.toLowerCase()}.`,
            })

            setRecipientCount(rows.length)
            notifySuccess(`Announcement sent to ${rows.length} ${target.label.toLowerCase()}.`)
            setTitle('')
            setMessage('')

        } catch (err) {
            console.error('SEND ANNOUNCEMENT ERROR:', err)
            notifyError(err.message || 'Failed to send announcement.')
        } finally {
            setSending(false)
        }
    }

    return (
        <div>
            <div className="admin-page-header">
                <h1>Announcements</h1>
                <p>Send a notification to all students, all employees, or everyone at once.</p>
            </div>

            <div className="admin-card" style={{ maxWidth: 640 }}>
                <form onSubmit={send}>
                    <div className="form-group">
                        <label className="form-label">Send to</label>
                        <select
                            className="form-input"
                            value={audience}
                            onChange={(e) => setAudience(e.target.value)}
                            disabled={sending}
                        >
                            {AUDIENCES.map((a) => (
                                <option key={a.key} value={a.key}>{a.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Title</label>
                        <input
                            className="form-input"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Example: Registrar's Office closed Friday"
                            disabled={sending}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Message</label>
                        <textarea
                            className="admin-search-input"
                            style={{ width: '100%', minHeight: 120 }}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Example: The Registrar's Office will be closed this Friday for a staff seminar. Claiming appointments scheduled that day will be automatically rescheduled to the next business day."
                            disabled={sending}
                        />
                    </div>

                    {recipientCount !== null && (
                        <div className="admin-notice tone-success" style={{ marginBottom: 16 }}>
                            Delivered to {recipientCount} recipient{recipientCount === 1 ? '' : 's'}.
                        </div>
                    )}

                    <button type="submit" className="admin-primary-button" disabled={sending}>
                        {sending ? 'Sending...' : 'Send announcement'}
                    </button>
                </form>
            </div>
        </div>
    )
}

export default Announcements
