import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activityLog'
import { notifyError, confirmModal } from '../lib/notify'
import { formatDisplayDateTime } from '../lib/formatDate'
import { useLiveRefresh } from '../lib/useLiveRefresh'
import './RequestNotes.css'

// Internal notes on a request, shared by the head's and employees' request
// pages -- e.g. "Assigned employee is absent until Monday, Maria covering".
// Staff-only: students never see these (see 20260926000000_request_notes).
// Authors can edit/delete their own notes; `canDeleteAny` (the head) can
// delete anyone's; anyone on staff can pin a note to keep it on top.

const CATEGORIES = [
    { value: 'general', label: 'General' },
    { value: 'absence', label: 'Absence / coverage' },
    { value: 'follow_up', label: 'Follow-up' },
    { value: 'issue', label: 'Issue' },
]
const categoryLabel = (value) => CATEGORIES.find((c) => c.value === value)?.label || 'General'

const ROLE_LABELS = { registrar_head: 'Registrar Head', admin: 'Admin', employee: 'Employee' }
const MAX_LENGTH = 2000

function RequestNotes({ request, cardClassName, canDeleteAny = false }) {
    const [notes, setNotes] = useState([])
    const [loading, setLoading] = useState(true)
    const [unavailable, setUnavailable] = useState(false)
    const [userId, setUserId] = useState(null)

    const [category, setCategory] = useState('general')
    const [body, setBody] = useState('')
    const [saving, setSaving] = useState(false)

    const [editingId, setEditingId] = useState(null)
    const [editBody, setEditBody] = useState('')
    const [editCategory, setEditCategory] = useState('general')

    const requestId = request?.request_id

    // Starts with loading=true; later reloads (after a change) update in place.
    const loadNotes = async () => {
        if (!requestId) return

        const { data, error } = await supabase
            .from('request_notes')
            .select('note_id, author_user_id, author_name, author_role, category, body, is_pinned, created_at, edited_at')
            .eq('request_id', requestId)
            .order('is_pinned', { ascending: false })
            .order('created_at', { ascending: false })

        if (error) {
            // Table not created yet (migration pending): show a gentle notice.
            if (error.code === 'PGRST205' || error.code === '42P01') setUnavailable(true)
            else console.error('LOAD NOTES ERROR:', error)
        } else {
            setUnavailable(false)
            setNotes(data || [])
        }
        setLoading(false)
    }

    useEffect(() => {
        loadNotes()
        supabase.auth.getUser().then(({ data }) => setUserId(data?.user?.id || null))
    }, [requestId])

    useLiveRefresh(['request_notes'], loadNotes)

    const addNote = async () => {
        const text = body.trim()
        if (!text || saving) return

        try {
            setSaving(true)
            const { error } = await supabase
                .from('request_notes')
                .insert({ request_id: requestId, category, body: text })

            if (error) throw new Error(error.message)

            await logActivity({
                userId,
                action: 'add_request_note',
                tableName: 'request_notes',
                recordId: requestId,
                description: `Added a ${categoryLabel(category).toLowerCase()} note to "${request.request_number}".`,
            })

            setBody('')
            setCategory('general')
            await loadNotes()
        } catch (err) {
            notifyError('Could not add the note: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    const startEdit = (note) => {
        setEditingId(note.note_id)
        setEditBody(note.body)
        setEditCategory(note.category)
    }

    const saveEdit = async () => {
        const text = editBody.trim()
        if (!text) return

        const { error } = await supabase
            .from('request_notes')
            .update({ body: text, category: editCategory })
            .eq('note_id', editingId)

        if (error) {
            notifyError('Could not save the note: ' + error.message)
            return
        }
        setEditingId(null)
        await loadNotes()
    }

    const togglePin = async (note) => {
        const { error } = await supabase
            .from('request_notes')
            .update({ is_pinned: !note.is_pinned })
            .eq('note_id', note.note_id)

        if (error) notifyError('Could not update the note: ' + error.message)
        else await loadNotes()
    }

    const deleteNote = async (note) => {
        const confirmed = await confirmModal('Delete this note? This cannot be undone.', {
            title: 'Delete note?',
            confirmButtonText: 'Delete',
            icon: 'warning',
        })
        if (!confirmed) return

        const { data, error } = await supabase
            .from('request_notes')
            .delete()
            .eq('note_id', note.note_id)
            .select('note_id')

        if (error || !data?.length) {
            notifyError('Could not delete the note' + (error ? ': ' + error.message : '.'))
            return
        }
        await loadNotes()
    }

    const onComposerKeyDown = (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            addNote()
        }
    }

    return (
        <div className={cardClassName}>
            <div className="rn-head">
                <div>
                    <h2 style={{ fontSize: 16, marginBottom: 4 }}>Staff Notes</h2>
                    <p className="rn-sub">
                        Visible to employees and the Registrar Head only — never to the student.
                    </p>
                </div>
                {notes.length > 0 && <span className="rn-count">{notes.length}</span>}
            </div>

            {unavailable ? (
                <p className="rn-empty">Notes will be available once the latest database update is applied.</p>
            ) : (
                <>
                    <div className="rn-composer">
                        <div className="rn-categories" role="radiogroup" aria-label="Note type">
                            {CATEGORIES.map((c) => (
                                <button
                                    key={c.value}
                                    type="button"
                                    role="radio"
                                    aria-checked={category === c.value}
                                    className={`rn-chip rn-cat-${c.value}${category === c.value ? ' is-active' : ''}`}
                                    onClick={() => setCategory(c.value)}
                                    disabled={saving}
                                >
                                    {c.label}
                                </button>
                            ))}
                        </div>

                        <textarea
                            className="rn-textarea"
                            rows={3}
                            maxLength={MAX_LENGTH}
                            placeholder={
                                category === 'absence'
                                    ? 'e.g. Assigned employee is absent until Monday — Maria is covering this request.'
                                    : 'Write a note for the team…'
                            }
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            onKeyDown={onComposerKeyDown}
                            disabled={saving}
                        />

                        <div className="rn-composer-foot">
                            <span className="rn-hint">
                                {body.length > MAX_LENGTH - 200 ? `${MAX_LENGTH - body.length} characters left` : 'Ctrl + Enter to add'}
                            </span>
                            <button
                                type="button"
                                className="rn-add"
                                onClick={addNote}
                                disabled={saving || !body.trim()}
                            >
                                {saving ? 'Adding…' : 'Add note'}
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <p className="rn-empty">Loading notes…</p>
                    ) : notes.length === 0 ? (
                        <p className="rn-empty">No notes yet. Add one to keep the team informed about this request.</p>
                    ) : (
                        <ul className="rn-list">
                            {notes.map((note) => {
                                const mine = note.author_user_id && note.author_user_id === userId
                                const editing = editingId === note.note_id

                                return (
                                    <li key={note.note_id} className={`rn-note${note.is_pinned ? ' is-pinned' : ''}`}>
                                        <div className="rn-note-top">
                                            <span className={`rn-chip rn-cat-${note.category} is-static`}>
                                                {categoryLabel(note.category)}
                                            </span>
                                            {note.is_pinned && <span className="rn-pinned">Pinned</span>}
                                            <span className="rn-meta">
                                                <strong>{note.author_name || 'Staff'}</strong>
                                                {note.author_role && ` · ${ROLE_LABELS[note.author_role] || note.author_role}`}
                                                {' · '}{formatDisplayDateTime(note.created_at)}
                                                {note.edited_at && ' · edited'}
                                            </span>
                                        </div>

                                        {editing ? (
                                            <div className="rn-edit">
                                                <div className="rn-categories">
                                                    {CATEGORIES.map((c) => (
                                                        <button
                                                            key={c.value}
                                                            type="button"
                                                            className={`rn-chip rn-cat-${c.value}${editCategory === c.value ? ' is-active' : ''}`}
                                                            onClick={() => setEditCategory(c.value)}
                                                        >
                                                            {c.label}
                                                        </button>
                                                    ))}
                                                </div>
                                                <textarea
                                                    className="rn-textarea"
                                                    rows={3}
                                                    maxLength={MAX_LENGTH}
                                                    value={editBody}
                                                    onChange={(e) => setEditBody(e.target.value)}
                                                    autoFocus
                                                />
                                                <div className="rn-actions">
                                                    <button type="button" className="rn-add" onClick={saveEdit} disabled={!editBody.trim()}>
                                                        Save
                                                    </button>
                                                    <button type="button" className="rn-link" onClick={() => setEditingId(null)}>
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="rn-body">{note.body}</p>
                                        )}

                                        {!editing && (
                                            <div className="rn-actions">
                                                <button type="button" className="rn-link" onClick={() => togglePin(note)}>
                                                    {note.is_pinned ? 'Unpin' : 'Pin'}
                                                </button>
                                                {mine && (
                                                    <button type="button" className="rn-link" onClick={() => startEdit(note)}>
                                                        Edit
                                                    </button>
                                                )}
                                                {(mine || canDeleteAny) && (
                                                    <button type="button" className="rn-link is-danger" onClick={() => deleteNote(note)}>
                                                        Delete
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </>
            )}
        </div>
    )
}

export default RequestNotes
