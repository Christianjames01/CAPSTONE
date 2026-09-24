import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activityLog'
import { notifyError, notifyWarning, confirmModal } from '../../lib/notify'
import { sanitizeAnnouncementHtml } from '../../lib/sanitizeHtml'
import { SkeletonList } from '../../components/Skeleton'
import Modal from '../../components/Modal'
import RichTextEditor from '../../components/RichTextEditor'
import AnnouncementNotice from '../../components/AnnouncementNotice'
import AnnouncementToneIcon from '../../components/AnnouncementToneIcon'
import { announcementTone, formatAnnouncementDate } from '../../lib/announcements'
import { IconMegaphone } from './icons'
import './AdminPages.css'
import './Announcements.css'

const EMPTY_FORM = {
    announcement_id: null,
    title: '',
    message: '',
    announcement_date: '',
    is_closed: false,
    is_active: true,
}

const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'inactive', label: 'Inactive' },
    { key: 'dated', label: 'Office dates' },
    { key: 'past', label: 'Past dates' },
]

// Messages longer than this are clamped on the card with a "Show more" toggle.
const LONG_MESSAGE_CHARS = 220

// For places a title is shown as plain text (confirm dialogs, activity log
// entries) -- strips any formatting tags so those read as normal sentences
// instead of showing raw markup.
function stripHtml(html) {
    return (html || '').replace(/<[^>]*>/g, '').trim()
}

// YYYY-MM-DD in the viewer's local time, comparable with announcement_date.
function todayIso() {
    return new Date().toLocaleDateString('en-CA')
}

function isPastDate(a) {
    return Boolean(a.announcement_date) && a.announcement_date < todayIso()
}

function formatPostedDate(iso) {
    return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

function matchesFilter(a, filter) {
    if (filter === 'active') return a.is_active
    if (filter === 'inactive') return !a.is_active
    if (filter === 'dated') return Boolean(a.announcement_date)
    if (filter === 'past') return isPastDate(a)
    return true
}

function Announcements() {
    const [announcements, setAnnouncements] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)
    const [removing, setRemoving] = useState(null)

    const [form, setForm] = useState(EMPTY_FORM)
    const [showForm, setShowForm] = useState(false)

    const [filter, setFilter] = useState('all')
    const [search, setSearch] = useState('')
    const [expandedIds, setExpandedIds] = useState(() => new Set())

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

    const counts = useMemo(() => {
        const result = {}
        FILTERS.forEach((f) => {
            result[f.key] = announcements.filter((a) => matchesFilter(a, f.key)).length
        })
        return result
    }, [announcements])

    const visibleAnnouncements = useMemo(() => {
        const term = search.trim().toLowerCase()
        return announcements.filter((a) =>
            matchesFilter(a, filter) &&
            (!term || `${stripHtml(a.title)} ${stripHtml(a.message)}`.toLowerCase().includes(term))
        )
    }, [announcements, filter, search])

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

    const closeForm = () => {
        if (saving) return
        setShowForm(false)
        setForm(EMPTY_FORM)
    }

    const toggleExpanded = (id) => {
        setExpandedIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const saveAnnouncement = async () => {
        if (!stripHtml(form.title) || !stripHtml(form.message)) {
            notifyWarning('Title and message are required.')
            return
        }

        try {
            setSaving(true)

            const payload = {
                title: sanitizeAnnouncementHtml(form.title),
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

                await logAdmin('edit_announcement', form.announcement_id, `Updated announcement "${stripHtml(payload.title)}".`)
            } else {
                const { data: { user } } = await supabase.auth.getUser()

                const { data, error: insertError } = await supabase
                    .from('announcements')
                    .insert({ ...payload, created_by: user?.id || null })
                    .select()
                    .single()

                if (insertError) throw new Error(insertError.message)

                await logAdmin('add_announcement', data.announcement_id, `Posted announcement "${stripHtml(payload.title)}".`)
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
        const confirmed = await confirmModal(
            a.is_active
                ? `Deactivate "${stripHtml(a.title)}"? Students will no longer see it on their dashboard.`
                : `Activate "${stripHtml(a.title)}"? Students will see it on their dashboard right away.`,
            { title: a.is_active ? 'Deactivate announcement?' : 'Activate announcement?', confirmButtonText: a.is_active ? 'Deactivate' : 'Activate' }
        )
        if (!confirmed) return

        try {
            const { error: updateError } = await supabase
                .from('announcements')
                .update({ is_active: !a.is_active, updated_at: new Date().toISOString() })
                .eq('announcement_id', a.announcement_id)

            if (updateError) throw new Error(updateError.message)

            await logAdmin(
                a.is_active ? 'deactivate_announcement' : 'activate_announcement',
                a.announcement_id,
                `${a.is_active ? 'Deactivated' : 'Activated'} announcement "${stripHtml(a.title)}".`
            )

            await loadAnnouncements({ silent: true })

        } catch (err) {
            console.error('TOGGLE ANNOUNCEMENT ERROR:', err)
            notifyError(err.message || 'Failed to update announcement.')
        }
    }

    const removeAnnouncement = async (a) => {
        const confirmed = await confirmModal(`Delete the announcement "${stripHtml(a.title)}"? This cannot be undone.`)
        if (!confirmed) return

        try {
            setRemoving(a.announcement_id)

            const { error: deleteError } = await supabase
                .from('announcements')
                .delete()
                .eq('announcement_id', a.announcement_id)

            if (deleteError) throw new Error(deleteError.message)

            await logAdmin('remove_announcement', a.announcement_id, `Deleted announcement "${stripHtml(a.title)}".`)

            await loadAnnouncements({ silent: true })

        } catch (err) {
            console.error('REMOVE ANNOUNCEMENT ERROR:', err)
            notifyError(err.message || 'Failed to delete announcement.')
        } finally {
            setRemoving(null)
        }
    }

    const renderCard = (a) => {
        const tone = announcementTone(a)
        const past = isPastDate(a)
        const isLong = stripHtml(a.message).length > LONG_MESSAGE_CHARS
        const expanded = expandedIds.has(a.announcement_id)

        return (
            <article
                key={a.announcement_id}
                className={`ann-card tone-${tone}${a.is_active ? '' : ' is-inactive'}`}
            >
                <span className="ann-card-icon" aria-hidden="true"><AnnouncementToneIcon tone={tone} /></span>

                <div className="ann-card-main">
                    <div className="ann-card-head">
                        <h3 className="ann-card-title" dangerouslySetInnerHTML={{ __html: sanitizeAnnouncementHtml(a.title) }} />

                        <div className="ann-card-pills">
                            {a.announcement_date && (
                                <span className={`admin-status-pill status-${a.is_closed ? 'rejected' : 'active'}`}>
                                    {a.is_closed ? 'Closed' : 'Open'}
                                </span>
                            )}
                            <span className={`admin-status-pill ann-visibility-pill${a.is_active ? ' is-live' : ''}`}>
                                <span className="ann-dot" aria-hidden="true" />
                                {a.is_active ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                    </div>

                    <p className="ann-card-meta">
                        {a.announcement_date && (
                            <>
                                <span className={past ? 'ann-past' : undefined}>
                                    {formatAnnouncementDate(a.announcement_date, { withYear: true })}
                                    {past && ' · date has passed'}
                                </span>
                                <span aria-hidden="true"> · </span>
                            </>
                        )}
                        Posted {formatPostedDate(a.created_at)}
                    </p>

                    <div
                        className={`ann-card-message${isLong && !expanded ? ' is-clamped' : ''}`}
                        dangerouslySetInnerHTML={{ __html: sanitizeAnnouncementHtml(a.message) }}
                    />

                    {isLong && (
                        <button className="ann-more-button" onClick={() => toggleExpanded(a.announcement_id)} aria-expanded={expanded}>
                            {expanded ? 'Show less' : 'Show more'}
                        </button>
                    )}

                    {past && a.is_active && (
                        <p className="ann-hint">
                            This date is over but students still see it. Consider deactivating it.
                        </p>
                    )}

                    <div className="ann-card-actions">
                        <button className="ann-action" onClick={() => openEditForm(a)}>Edit</button>
                        <button className="ann-action" onClick={() => toggleActive(a)}>
                            {a.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                            className="ann-action is-danger"
                            onClick={() => removeAnnouncement(a)}
                            disabled={removing === a.announcement_id}
                        >
                            {removing === a.announcement_id ? 'Deleting...' : 'Delete'}
                        </button>
                    </div>
                </div>
            </article>
        )
    }

    const hasFilters = filter !== 'all' || search.trim() !== ''

    return (
        <div>
            <div className="admin-page-header-row ann-header">
                <div>
                    <h1 style={{ fontSize: 26, marginBottom: 6 }}>Announcements</h1>
                    <p>Post notices about registrar office operations (closures, extended hours, etc.) that students see on their dashboard.</p>
                </div>

                <button className="admin-primary-button" onClick={openNewForm}>+ New Announcement</button>
            </div>

            {showForm && (
                <Modal
                    title={form.announcement_id ? 'Edit Announcement' : 'New Announcement'}
                    maxWidth={680}
                    closeOnBackdropClick={false}
                    onClose={closeForm}
                >
                    <div className="ann-form">
                        <section className="ann-form-section">
                            <h4>Content</h4>

                            <div className="form-group">
                                <label className="form-label" htmlFor="ann-title" onClick={() => document.getElementById('ann-title')?.focus()}>Title</label>
                                <RichTextEditor
                                    editorKey={form.announcement_id || 'new'}
                                    value={form.title}
                                    onChange={(html) => setForm({ ...form, title: html })}
                                    placeholder="e.g. Office closed Friday for a holiday"
                                    id="ann-title"
                                    ariaLabel="Announcement title"
                                    singleLine
                                    disabled={saving}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label" htmlFor="ann-message" onClick={() => document.getElementById('ann-message')?.focus()}>Message</label>
                                <RichTextEditor
                                    editorKey={form.announcement_id || 'new'}
                                    value={form.message}
                                    onChange={(html) => setForm({ ...form, message: html })}
                                    placeholder="Details students should know"
                                    id="ann-message"
                                    ariaLabel="Announcement message"
                                    showCount
                                    disabled={saving}
                                />
                                <small className="ann-help">
                                    Select text, then use the toolbar to bold, resize, color, or turn it into a list. Pasted text comes in plain, so it picks up no stray formatting.
                                </small>
                            </div>
                        </section>

                        <section className="ann-form-section">
                            <h4>Office date <span className="ann-optional">Optional</span></h4>

                            <div className="form-group">
                                <label className="form-label" htmlFor="ann-date">Date</label>
                                <div className="ann-date-row">
                                    <input
                                        id="ann-date"
                                        type="date"
                                        className="form-input"
                                        value={form.announcement_date}
                                        onChange={(e) => setForm({ ...form, announcement_date: e.target.value })}
                                        disabled={saving}
                                    />
                                    {form.announcement_date && (
                                        <button
                                            type="button"
                                            className="ann-action"
                                            onClick={() => setForm({ ...form, announcement_date: '', is_closed: false })}
                                            disabled={saving}
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>
                                <small className="ann-help">
                                    Attach this announcement to a specific day (e.g. a holiday) so students see whether the office is closed or open that day.
                                </small>
                            </div>

                            {form.announcement_date && (
                                <div className="form-group">
                                    <span className="form-label">Registrar office on this date</span>
                                    <div className="ann-segmented" role="radiogroup" aria-label="Registrar office status on this date">
                                        <button
                                            type="button"
                                            role="radio"
                                            aria-checked={!form.is_closed}
                                            className={`is-open${!form.is_closed ? ' is-selected' : ''}`}
                                            onClick={() => setForm({ ...form, is_closed: false })}
                                            disabled={saving}
                                        >
                                            Open
                                        </button>
                                        <button
                                            type="button"
                                            role="radio"
                                            aria-checked={form.is_closed}
                                            className={`is-closed${form.is_closed ? ' is-selected' : ''}`}
                                            onClick={() => setForm({ ...form, is_closed: true })}
                                            disabled={saving}
                                        >
                                            Closed
                                        </button>
                                    </div>
                                </div>
                            )}
                        </section>

                        <section className="ann-form-section">
                            <h4>Visibility</h4>
                            <label className="ann-switch">
                                <input
                                    type="checkbox"
                                    checked={form.is_active}
                                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                                    disabled={saving}
                                />
                                <span className="ann-switch-track" aria-hidden="true" />
                                <span>
                                    <strong>{form.is_active ? 'Active' : 'Inactive'}</strong>
                                    <small>
                                        {form.is_active
                                            ? 'Shows on the student dashboard as soon as you save.'
                                            : 'Saved as a draft. Students won’t see it until you activate it.'}
                                    </small>
                                </span>
                            </label>
                        </section>

                        <section className="ann-form-section">
                            <h4>Preview <span className="ann-optional">Exactly how students will see it</span></h4>
                            <AnnouncementNotice
                                announcement={form}
                                titleFallback="Announcement title"
                                messageFallback={'<p style="opacity:0.6">Your message will appear here.</p>'}
                            />
                        </section>

                        <div className="ann-form-footer">
                            <button className="admin-secondary-button" onClick={closeForm} disabled={saving}>
                                Cancel
                            </button>
                            <button className="admin-primary-button" onClick={saveAnnouncement} disabled={saving}>
                                {saving ? 'Saving...' : form.announcement_id ? 'Save changes' : 'Post announcement'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {error && <div className="admin-error-box" style={{ marginTop: 20 }}>{error}</div>}

            {!loading && announcements.length > 0 && (
                <div className="ann-toolbar">
                    <input
                        className="admin-search-input"
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search announcements"
                        aria-label="Search announcements"
                    />

                    <div className="admin-filter-row" role="tablist" aria-label="Filter announcements">
                        {FILTERS.map((f) => (
                            <button
                                key={f.key}
                                role="tab"
                                aria-selected={filter === f.key}
                                className={`admin-filter-chip${filter === f.key ? ' active' : ''}`}
                                onClick={() => setFilter(f.key)}
                            >
                                {f.label}
                                <span className="ann-chip-count">{counts[f.key]}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {loading ? (
                <SkeletonList count={3} />
            ) : announcements.length === 0 ? (
                <div className="ann-empty">
                    <span className="ann-empty-icon" aria-hidden="true"><IconMegaphone /></span>
                    <h3>No announcements yet</h3>
                    <p>Let students know about office closures, extended hours, or anything else happening at the registrar.</p>
                    <button className="admin-primary-button" onClick={openNewForm}>+ Post your first announcement</button>
                </div>
            ) : visibleAnnouncements.length === 0 ? (
                <div className="admin-empty">
                    No announcements match this view.
                    {hasFilters && (
                        <>
                            {' '}
                            <button className="ann-more-button" onClick={() => { setFilter('all'); setSearch('') }}>
                                Clear filters
                            </button>
                        </>
                    )}
                </div>
            ) : (
                <div className="ann-list">
                    {visibleAnnouncements.map(renderCard)}
                </div>
            )}
        </div>
    )
}

export default Announcements
