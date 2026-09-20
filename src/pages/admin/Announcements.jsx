import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activityLog'
import { notifyError, notifyWarning, confirmModal } from '../../lib/notify'
import { sanitizeAnnouncementHtml } from '../../lib/sanitizeHtml'
import { SkeletonList } from '../../components/Skeleton'
import Modal from '../../components/Modal'
import RichTextEditor from '../../components/RichTextEditor'
import '../student/StudentPages.css'
import './AdminPages.css'

const EMPTY_FORM = {
    announcement_id: null,
    title: '',
    message: '',
    announcement_date: '',
    is_closed: false,
    is_active: true,
}

function formatAnnouncementDate(dateStr) {
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-PH', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    })
}

function Announcements() {
    const [announcements, setAnnouncements] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)
    const [removing, setRemoving] = useState(null)

    const [form, setForm] = useState(EMPTY_FORM)
    const [showForm, setShowForm] = useState(false)

    useEffect(() => {
        loadAnnouncements()
    }, [])

    const loadAnnouncements = async ({ silent = false } = {}) => {
        try {
            if (!silent) setLoading(true)
            setError('')

            const { data, error: loadError } = await supabase
                .from('announcements')
                .select('announcement_id, title, message, announcement_date, is_closed, is_active, created_at')
                .order('created_at', { ascending: false })

            if (loadError) {
                throw new Error('Failed to load announcements: ' + loadError.message)
            }

            setAnnouncements(data || [])

        } catch (err) {
            console.error('ANNOUNCEMENTS ERROR:', err)
            setError(err.message || 'Failed to load announcements.')
        } finally {
            if (!silent) setLoading(false)
        }
    }

    const logAdmin = async (action, recordId, description) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        await logActivity({ userId: user.id, action, tableName: 'announcements', recordId, description })
    }

    const openNewForm = () => {
        setForm(EMPTY_FORM)
        setShowForm(true)
    }

    const openEditForm = (a) => {
        setForm({
            announcement_id: a.announcement_id,
            title: a.title,
            message: a.message,
            announcement_date: a.announcement_date || '',
            is_closed: a.is_closed,
            is_active: a.is_active,
        })
        setShowForm(true)
    }

    const saveAnnouncement = async () => {
        if (!form.title.trim() || !form.message.trim()) {
            notifyWarning('Title and message are required.')
            return
        }

        try {
            setSaving(true)

            const payload = {
                title: form.title.trim(),
                message: sanitizeAnnouncementHtml(form.message),
                announcement_date: form.announcement_date || null,
                is_closed: form.announcement_date ? form.is_closed : false,
                is_active: form.is_active,
                show_to_students: true,
                updated_at: new Date().toISOString(),
            }

            if (form.announcement_id) {
                const { error: updateError } = await supabase
                    .from('announcements')
                    .update(payload)
                    .eq('announcement_id', form.announcement_id)

                if (updateError) throw new Error(updateError.message)

                await logAdmin('edit_announcement', form.announcement_id, `Updated announcement "${payload.title}".`)
            } else {
                const { data: { user } } = await supabase.auth.getUser()

                const { data, error: insertError } = await supabase
                    .from('announcements')
                    .insert({ ...payload, created_by: user?.id || null })
                    .select()
                    .single()

                if (insertError) throw new Error(insertError.message)

                await logAdmin('add_announcement', data.announcement_id, `Posted announcement "${payload.title}".`)
            }

            setShowForm(false)
            setForm(EMPTY_FORM)
            await loadAnnouncements({ silent: true })

        } catch (err) {
            console.error('SAVE ANNOUNCEMENT ERROR:', err)
            notifyError(err.message || 'Failed to save announcement.')
        } finally {
            setSaving(false)
        }
    }

    const toggleActive = async (a) => {
        try {
            const { error: updateError } = await supabase
                .from('announcements')
                .update({ is_active: !a.is_active, updated_at: new Date().toISOString() })
                .eq('announcement_id', a.announcement_id)

            if (updateError) throw new Error(updateError.message)

            await logAdmin(
                a.is_active ? 'deactivate_announcement' : 'activate_announcement',
                a.announcement_id,
                `${a.is_active ? 'Deactivated' : 'Activated'} announcement "${a.title}".`
            )

            await loadAnnouncements({ silent: true })

        } catch (err) {
            console.error('TOGGLE ANNOUNCEMENT ERROR:', err)
            notifyError(err.message || 'Failed to update announcement.')
        }
    }

    const removeAnnouncement = async (a) => {
        const confirmed = await confirmModal(`Delete the announcement "${a.title}"? This cannot be undone.`)
        if (!confirmed) return

        try {
            setRemoving(a.announcement_id)

            const { error: deleteError } = await supabase
                .from('announcements')
                .delete()
                .eq('announcement_id', a.announcement_id)

            if (deleteError) throw new Error(deleteError.message)

            await logAdmin('remove_announcement', a.announcement_id, `Deleted announcement "${a.title}".`)

            await loadAnnouncements({ silent: true })

        } catch (err) {
            console.error('REMOVE ANNOUNCEMENT ERROR:', err)
            notifyError(err.message || 'Failed to delete announcement.')
        } finally {
            setRemoving(null)
        }
    }

    return (
        <div>
            <div className="admin-page-header-row">
                <div>
                    <h1 style={{ fontSize: 26, marginBottom: 6 }}>Announcements</h1>
                    <p>Post notices about registrar office operations (closures, extended hours, etc.) that students see on their dashboard.</p>
                </div>

                <button className="admin-primary-button" onClick={openNewForm}>+ New Announcement</button>
            </div>

            {showForm && (
                <Modal
                    title={form.announcement_id ? 'Edit Announcement' : 'New Announcement'}
                    maxWidth={640}
                    closeOnBackdropClick={false}
                    onClose={() => { if (saving) return; setShowForm(false); setForm(EMPTY_FORM) }}
                >
                    <div className="form-group" style={{ marginBottom: 14 }}>
                        <label className="form-label" htmlFor="ann-title">Title</label>
                        <input
                            id="ann-title"
                            className="form-input"
                            value={form.title}
                            onChange={(e) => setForm({ ...form, title: e.target.value })}
                            placeholder="e.g. Office closed Friday for a holiday"
                            disabled={saving}
                        />
                    </div>

                    <div className="form-group" style={{ marginBottom: 14 }}>
                        <label className="form-label" htmlFor="ann-message">Message</label>
                        <RichTextEditor
                            editorKey={form.announcement_id || 'new'}
                            value={form.message}
                            onChange={(html) => setForm({ ...form, message: html })}
                            placeholder="Details students should know"
                            disabled={saving}
                        />
                        <small style={{ display: 'block', marginTop: 6, fontSize: 12, color: 'var(--slate)' }}>
                            Bold, italicize, underline, resize, or color the text so it stands out the way you want students to see it.
                        </small>
                    </div>

                    <div className="form-group" style={{ marginBottom: 14 }}>
                        <label className="form-label">Preview — exactly how students will see it</label>
                        <div
                            className={`student-notice ${form.announcement_date ? (form.is_closed ? 'tone-danger' : 'tone-success') : 'tone-info'}`}
                            style={{ marginTop: 0 }}
                        >
                            <strong>
                                {form.title || 'Announcement title'}
                                {form.announcement_date && (
                                    <> — {form.is_closed ? 'Closed' : 'Open'} on {formatAnnouncementDate(form.announcement_date)}</>
                                )}
                            </strong>
                            <div dangerouslySetInnerHTML={{ __html: sanitizeAnnouncementHtml(form.message) || '<p style="opacity:0.6">Your message will appear here.</p>' }} />
                        </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: 14 }}>
                        <label className="form-label" htmlFor="ann-date">Date (optional)</label>
                        <input
                            id="ann-date"
                            type="date"
                            className="form-input"
                            value={form.announcement_date}
                            onChange={(e) => setForm({ ...form, announcement_date: e.target.value })}
                            disabled={saving}
                        />
                        <small style={{ display: 'block', marginTop: 6, fontSize: 12, color: 'var(--slate)' }}>
                            Attach this announcement to a specific day (e.g. a holiday) so students see whether the office is closed or open that day.
                        </small>
                    </div>

                    {form.announcement_date && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, marginBottom: 16 }}>
                            <input type="checkbox" checked={form.is_closed} onChange={(e) => setForm({ ...form, is_closed: e.target.checked })} disabled={saving} />
                            Registrar office is closed on this date
                        </label>
                    )}

                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, marginBottom: 16 }}>
                        <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} disabled={saving} />
                        Active (visible to students right away)
                    </label>

                    <div style={{ display: 'flex', gap: 10 }}>
                        <button className="admin-primary-button" onClick={saveAnnouncement} disabled={saving}>
                            {saving ? 'Saving...' : 'Save'}
                        </button>
                        <button className="admin-secondary-button" onClick={() => setShowForm(false)} disabled={saving}>
                            Cancel
                        </button>
                    </div>
                </Modal>
            )}

            {error && <div className="admin-error-box" style={{ marginTop: 20 }}>{error}</div>}

            {loading ? (
                <SkeletonList count={3} />
            ) : announcements.length === 0 ? (
                <div className="admin-empty" style={{ marginTop: 16 }}>No announcements posted yet.</div>
            ) : (
                announcements.map((a) => (
                    <div className="admin-list-card" key={a.announcement_id} style={{ marginTop: 16 }}>
                        <div className="admin-list-card-header">
                            <div>
                                <h3>{a.title}</h3>
                                <p>
                                    {a.announcement_date
                                        ? formatAnnouncementDate(a.announcement_date)
                                        : `Posted ${new Date(a.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                                </p>
                            </div>

                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                {a.announcement_date && (
                                    <span className={`admin-status-pill status-${a.is_closed ? 'rejected' : 'active'}`}>
                                        {a.is_closed ? 'Closed' : 'Open'}
                                    </span>
                                )}
                                <span className={`admin-status-pill status-${a.is_active ? 'active' : 'inactive'}`}>
                                    {a.is_active ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                        </div>

                        <div
                            style={{ fontSize: 13.5, color: 'var(--ink)', margin: '4px 0 12px' }}
                            dangerouslySetInnerHTML={{ __html: sanitizeAnnouncementHtml(a.message) }}
                        />

                        <div style={{ display: 'flex', gap: 16 }}>
                            <button className="admin-link-button" onClick={() => openEditForm(a)}>Edit</button>
                            <button className="admin-link-button" onClick={() => toggleActive(a)}>
                                {a.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                                className="admin-link-button"
                                style={{ color: 'var(--red)' }}
                                onClick={() => removeAnnouncement(a)}
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
