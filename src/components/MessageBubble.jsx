import { useState } from 'react'
import './MessageBubble.css'

// One chat bubble, shared by the student, employee, and admin Messages
// pages. Edit and Delete only appear on the viewer's own messages
// (`isSelf`); editing happens inline in the bubble.
function MessageBubble({ isSelf, senderLabel, badge, text, time, edited, onEdit, onDelete, disabled }) {
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState(text)
    const [saving, setSaving] = useState(false)

    const startEditing = () => {
        setDraft(text)
        setEditing(true)
    }

    const save = async () => {
        const next = draft.trim()
        if (!next || next === text) {
            setEditing(false)
            return
        }

        setSaving(true)
        const ok = await onEdit(next)
        setSaving(false)
        if (ok !== false) setEditing(false)
    }

    const onKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            save()
        } else if (e.key === 'Escape') {
            setEditing(false)
        }
    }

    const showActions = isSelf && !editing && (onEdit || onDelete)

    return (
        <div className={`msg${isSelf ? ' is-self' : ''}`}>
            {(senderLabel || badge) && (
                <div className="msg-sender">
                    {senderLabel}
                    {badge}
                </div>
            )}

            <div className={`msg-bubble${editing ? ' is-editing' : ''}`}>
                {editing ? (
                    <>
                        <textarea
                            className="msg-edit-input"
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={onKeyDown}
                            rows={Math.min(6, Math.max(2, draft.split('\n').length))}
                            disabled={saving}
                            aria-label="Edit message"
                            autoFocus
                        />
                        <div className="msg-edit-actions">
                            <button type="button" onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
                            <button type="button" className="is-primary" onClick={save} disabled={saving || !draft.trim()}>
                                {saving ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </>
                ) : (
                    <p className="msg-text">{text}</p>
                )}
                <span className="msg-time">
                    {time}
                    {edited && ' · edited'}
                </span>
            </div>

            {showActions && (
                <div className="msg-actions">
                    {onEdit && (
                        <button type="button" onClick={startEditing} disabled={disabled}>Edit</button>
                    )}
                    {onDelete && (
                        <button type="button" className="is-danger" onClick={onDelete} disabled={disabled}>Delete</button>
                    )}
                </div>
            )}
        </div>
    )
}

export default MessageBubble
