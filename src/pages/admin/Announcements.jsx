import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activityLog'
import { notifyError, notifyWarning, confirmModal } from '../../lib/notify'
import '../auth/Auth.css'
import './AdminPages.css'

const EMPTY_ANNOUNCEMENT = {
    announcement_id: null,
    title: '',
    message: '',
    show_to_students: true,
    show_to_employees: true,
    show_to_public: false,
    is_active: true,
}

function Announcements() {
    const [announcements, setAnnouncements] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)
    const [removing, setRemoving] = useState(null)

    const [form, setForm] = useState(EMPTY_ANNOUNCEMENT)
    const [showForm, setShowForm] = useState(false)

    useEffect(() => {
        loadAnnouncements()
    }, [])

    const loadAnnouncements = async () => {
        try {
            setLoading(true)
            setError('')

            const { data, error: loadError } = await supabase
                .from('announcements')
                .select('announcement_id, title, message, show_to_students, show_to_employees, show_to_public, is_active, created_at')
                .order('created_at', { ascending: false })

            if (loadError) {
                throw new Error('Failed to load announcements: ' + loadError.message)
            }

            setAnnouncements(data || [])

        } catch (err) {
            console.error('LOAD ANNOUNCEMENTS ERROR:', err)
            setError(err.message || 'Failed to load announcements.')
        } finally {
            setLoading(false)
        }
    }

    const logAdmin = async (action, recordId, description) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        await logActivity({ userId: user.id, action, tableName: 'announcements', recordId, description })
    }

    const openNew = () => { setForm(EMPTY_ANNOUNCEMENT); setShowForm(true) }
    const openEdit = (a) => { setForm(a); setShowForm(true) }

    // Bulk-notifies everyone in the announcement's audience. Only called for
    // brand-new active announcements -- edits don't re-notify everyone.
    const notifyAudience = async (announcement) => {
        const userIds = []

        if (announcement.show_to_students) {
            const { data } = await supabase.from('students').select('user_id').eq('status', 'active')
            userIds.push(...(data || []).map((s) => s.user_id))
        }

        if (announcement.show_to_employees) {
            const { data } = await supabase.from('employees').select('user_id').eq('status', 'active')
            userIds.push(...(data || []).map((e) => e.user_id))
        }

        if (userIds.length === 0) return

        const rows = userIds.map((userId) => ({
            user_id: userId,
            title: announcement.title,
            message: announcement.message,
            notification_type: 'announcement',
            is_read: false,
        }))

        const { error: bulkNotifyError } = await supabase.from('notifications').insert(rows)

        if (bulkNotifyError) {
            console.error('NOTIFY ANNOUNCEMENT AUDIENCE ERROR:', bulkNotifyError)
        }
    }

    const save = async () => {
        if (!form.title.trim() || !form.message.trim()) {
            notifyWarning('Title and message are required.')
            return
        }

        if (!form.show_to_students && !form.show_to_employees && !form.show_to_public) {
            notifyWarning('Select at least one audience for this announcement.')
            return
        }

        try {
            setSaving(true)

            const payload = {
                title: form.title.trim(),
                message: form.message.trim(),
                show_to_students: form.show_to_students,
                show_to_employees: form.show_to_employees,
                show_to_public: form.show_to_public,
                is_active: form.is_active,
            }

            if (form.announcement_id) {
                const { error: updateError } = await supabase
                    .from('announcements')
                    .update({ ...payload, updated_at: new Date().toISOString() })
                    .eq('announcement_id', form.announcement_id)

                if (updateError) throw new Error(updateError.message)
                await logAdmin('edit_announcement', form.announcement_id, `Updated announcement "${payload.title}".`)
            } else {
                const {
                    data: { user },
                } = await supabase.auth.getUser()

                const { data, error: insertError } = await supabase
                    .from('announcements')
                    .insert({ ...payload, created_by: user?.id || null })
                    .select()
                    .single()

                if (insertError) throw new Error(insertError.message)
                await logAdmin('add_announcement', data.announcement_id, `Posted announcement "${payload.title}".`)

                if (payload.is_active) {
                    await notifyAudience(payload)
                }
            }

            setShowForm(false)
            await loadAnnouncements()

        } catch (err) {
            console.error('SAVE ANNOUNCEMENT ERROR:', err)
            notifyError(err.message || 'Failed to save announcement.')
        } finally {
            setSaving(false)
        }
    }

    const toggleActive = async (announcement) => {
        const nextActive = !announcement.is_active

        try {
            const { error: updateError } = await supabase
                .from('announcements')
                .update({ is_active: nextActive, updated_at: new Date().toISOString() })
                .eq('announcement_id', announcement.announcement_id)

            if (updateError) throw new Error(updateError.message)

            await logAdmin(
                nextActive ? 'activate_announcement' : 'deactivate_announcement',
                announcement.announcement_id,
                `${nextActive ? 'Activated' : 'Deactivated'} announcement "${announcement.title}".`
            )

            await loadAnnouncements()

        } catch (err) {
            console.error('TOGGLE ANNOUNCEMENT ERROR:', err)
            notifyError(err.message || 'Failed to update announcement.')
        }
    }

    const remove = async (announcement) => {
        const confirmed = await confirmModal(`Delete the announcement "${announcement.title}"? This cannot be undone.`)
        if (!confirmed) return

        try {
            setRemoving(announcement.announcement_id)

            const { error: deleteError } = await supabase
                .from('announcements')
                .delete()
                .eq('announcement_id', announcement.announcement_id)

            if (deleteError) throw new Error(deleteError.message)

            await logAdmin('delete_announcement', announcement.announcement_id, `Deleted announcement "${announcement.title}".`)

            setAnnouncements((prev) => prev.filter((a) => a.announcement_id !== announcement.announcement_id))

        } catch (err) {
            console.error('DELETE ANNOUNCEMENT ERROR:', err)
            notifyError(err.message || 'Failed to delete announcement.')
        } finally {
            setRemoving(null)
        }
    }

    const audienceLabel = (a) => {
        const audiences = []
        if (a.show_to_students) audiences.push('Students')
        if (a.show_to_employees) audiences.push('Employees')
        if (a.show_to_public) audiences.push('Public landing page')
        return audiences.join(' · ') || 'No audience selected'
    }

    return (
        <div>
            <div className="admin-page-header-row" style={{ marginBottom: 16 }}>
                <div>
                    <h1 style={{ fontSize: 26, marginBottom: 6 }}>Announcements</h1>
                    <p>Post notices for students, employees, or the public landing page.</p>
                </div>
                <button className="admin-primary-button" onClick={openNew}>+ New Announcement</button>
            </div>

            {error && <div className="admin-error-box">{error}</div>}

            {showForm && (
                <div className="admin-card" style={{ marginBottom: 20 }}>
                    <h3 style={{ fontSize: 15, marginBottom: 14 }}>{form.announcement_id ? 'Edit Announcement' : 'New Announcement'}</h3>

                    <div className="form-group" style={{ marginBottom: 14 }}>
                        <label className="form-label">Title</label>
                        <input
                            className="form-input"
                            value={form.title}
                            onChange={(e) => setForm({ ...form, title: e.target.value })}
                            disabled={saving}
                        />
                    </div>

                    <div className="form-group" style={{ marginBottom: 14 }}>
                        <label className="form-label">Message</label>
                        <textarea
                            className="form-input"
                            rows={4}
                            value={form.message}
                            onChange={(e) => setForm({ ...form, message: e.target.value })}
                            disabled={saving}
                        />
                    </div>

                    <div className="form-group" style={{ marginBottom: 14 }}>
                        <label className="form-label">Show to</label>
                        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5 }}>
                                <input
                                    type="checkbox"
                                    checked={form.show_to_students}
                                    onChange={(e) => setForm({ ...form, show_to_students: e.target.checked })}
                                    disabled={saving}
                                />
                                Students (dashboard)
                            </label>

                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5 }}>
                                <input
                                    type="checkbox"
                                    checked={form.show_to_employees}
                                    onChange={(e) => setForm({ ...form, show_to_employees: e.target.checked })}
                                    disabled={saving}
                                />
                                Employees (dashboard)
                            </label>

                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5 }}>
                                <input
                                    type="checkbox"
                                    checked={form.show_to_public}
                                    onChange={(e) => setForm({ ...form, show_to_public: e.target.checked })}
                                    disabled={saving}
                                />
                                Public landing page
                            </label>
                        </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: 14 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5 }}>
                            <input
                                type="checkbox"
                                checked={form.is_active}
                                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                                disabled={saving}
                            />
                            Active (visible now)
                        </label>
                    </div>

                    <div style={{ display: 'flex', gap: 10 }}>
                        <button className="admin-primary-button" onClick={save} disabled={saving}>
                            {saving ? 'Saving...' : 'Save'}
                        </button>
                        <button className="admin-link-button" style={{ color: 'var(--slate)' }} onClick={() => setShowForm(false)}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {loading ? (
                <p className="admin-loading">Loading announcements...</p>
            ) : announcements.length === 0 ? (
                <div className="admin-empty">No announcements yet.</div>
            ) : (
                announcements.map((a) => (
                    <div className="admin-list-card" key={a.announcement_id}>
                        <div className="admin-list-card-header">
                            <div>
                                <h3>{a.title}</h3>
                                <p>{a.message}</p>
                            </div>
                            <span className={`admin-status-pill status-${a.is_active ? 'active' : 'inactive'}`}>
                                {a.is_active ? 'Active' : 'Inactive'}
                            </span>
                        </div>

                        <p style={{ fontSize: 12.5, color: 'var(--slate)', marginBottom: 10 }}>
                            {audienceLabel(a)}
                        </p>

                        <div style={{ display: 'flex', gap: 16 }}>
                            <button className="admin-link-button" onClick={() => openEdit(a)}>Edit</button>

                            <button className="admin-link-button" onClick={() => toggleActive(a)}>
                                {a.is_active ? 'Deactivate' : 'Activate'}
                            </button>

                            <button
                                className="admin-link-button"
                                style={{ color: 'var(--red)' }}
                                onClick={() => remove(a)}
                                disabled={removing === a.announcement_id}
                            >
                                {removing === a.announcement_id ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                ))
            )}
        </div>
    )
}

export default Announcements
