import { useEffect, useRef, useState } from 'react'
import './MessageBubble.css'

const PencilIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
)

const TrashIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 12.5h9l1-12.5" />
    </svg>
)

// One chat bubble, shared by the student, employee, and admin Messages
// pages. Edit and Delete only appear on the viewer's own messages
// (`isSelf`); editing turns the bubble into an inline editor card.
function MessageBubble({ isSelf, senderLabel, badge, text, time, edited, onEdit, onDelete, disabled }) {
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState(text)
    const [saving, setSaving] = useState(false)
    const inputRef = useRef(null)

    // Focus with the cursor at the end, and grow the box to fit the text.
    useEffect(() => {
        const el = inputRef.current
        if (!editing || !el) return
        el.focus()
        el.setSelectionRange(el.value.length, el.value.length)
    }, [editing])

    useEffect(() => {
        const el = inputRef.current
        if (!el) return
        el.style.height = 'auto'
        el.style.height = `${Math.min(el.scrollHeight, 240)}px`
    }, [draft, editing])

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
    const unchanged = draft.trim() === text

    return (
        <div className={`msg${isSelf ? ' is-self' : ''}${editing ? ' is-editing' : ''}`}>
            {(senderLabel || badge) && (
                <div className="msg-sender">
                    {senderLabel}
                    {badge}
                </div>
            )}

            {editing ? (
                <div className="msg-editor">
                    <div className="msg-editor-label">Edit message</div>
                    <textarea
                        ref={inputRef}
                        className="msg-editor-input"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={onKeyDown}
                        rows={1}
                        disabled={saving}
                        aria-label="Edit message"
                    />
                    <div className="msg-editor-footer">
                        <span className="msg-editor-hint">
                            <kbd>Enter</kbd> to save · <kbd>Shift</kbd>+<kbd>Enter</kbd> new line · <kbd>Esc</kbd> to cancel
                        </span>
                        <div className="msg-editor-buttons">
                            <button type="button" className="msg-btn" onClick={() => setEditing(false)} disabled={saving}>
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="msg-btn is-primary"
                                onClick={save}
                                disabled={saving || !draft.trim() || unchanged}
                            >
                                {saving ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="msg-bubble">
                    <p className="msg-text">{text}</p>
                    <span className="msg-time">
                        {time}
                        {edited && <span className="msg-edited"> · edited</span>}
                    </span>
                </div>
            )}

            {showActions && (
                <div className="msg-actions">
                    {onEdit && (
                        <button type="button" onClick={startEditing} disabled={disabled}>
                            <PencilIcon /> Edit
                        </button>
                    )}
                    {onDelete && (
                        <button type="button" className="is-danger" onClick={onDelete} disabled={disabled}>
                            <TrashIcon /> Delete
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}

export default MessageBubble
