import { useEffect, useRef, useState } from 'react'
import { REACTION_EMOJIS } from '../lib/messageReactions'
import './MessageBubble.css'

const PencilIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
)

const ReplyIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 14 4 9l5-5" />
        <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </svg>
)

const TrashIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 12.5h9l1-12.5" />
    </svg>
)

const SmileIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M8 13.5s1.5 2.5 4 2.5 4-2.5 4-2.5" />
        <path d="M9 9h.01M15 9h.01" />
    </svg>
)

// One chat bubble, shared by the student, employee, and admin Messages
// pages. Edit and Delete only appear on the viewer's own messages
// (`isSelf`); editing turns the bubble into an inline editor card.
//
// `deletedNote`, e.g. "You deleted a message" / "Yul deleted a message":
// the message was unsent, so the placeholder replaces the text and there
// are no actions.
//
// Messenger-style runs (see ChatMessages): `groupStart` / `groupEnd` square
// off the corners between consecutive bubbles from one sender, and
// `avatar` (other people's messages) shows beside the last one. Edit and
// Delete appear on hover, or on a long press on phones (like Messenger).
// `onReply` adds Reply to the menu (any message); `quote` ({ label, text,
// onClick }) shows the answered message above a reply.
function MessageBubble({ messageId, isSelf, senderLabel, badge, text, time, edited, deletedNote, onEdit, onDelete, onReply, quote, disabled, avatar, groupStart = true, groupEnd = true, seen = false, reactions = [], myReaction = null, onReact }) {
    const [editing, setEditing] = useState(false)
    const [revealed, setRevealed] = useState(false)
    const [pickerOpen, setPickerOpen] = useState(false)
    const rowRef = useRef(null)
    const pressTimer = useRef(null)

    // Long press opens the Edit / Delete menu; tapping anywhere else
    // closes it (and the emoji picker, if open).
    useEffect(() => {
        if (!revealed && !pickerOpen) return undefined
        const close = (e) => {
            if (!rowRef.current?.contains(e.target)) {
                setRevealed(false)
                setPickerOpen(false)
            }
        }
        document.addEventListener('pointerdown', close)
        return () => document.removeEventListener('pointerdown', close)
    }, [revealed, pickerOpen])

    useEffect(() => () => clearTimeout(pressTimer.current), [])

    const openMenu = () => {
        setRevealed(true)
        navigator.vibrate?.(12)
    }

    const cancelPress = () => clearTimeout(pressTimer.current)

    const pressHandlers = {
        onTouchStart: () => {
            clearTimeout(pressTimer.current)
            pressTimer.current = setTimeout(openMenu, 450)
        },
        onTouchMove: cancelPress,
        onTouchEnd: cancelPress,
        onTouchCancel: cancelPress,
        // Android fires contextmenu on long press (and desktop on right
        // click): show our menu instead of the browser's.
        onContextMenu: (e) => {
            e.preventDefault()
            cancelPress()
            openMenu()
        },
    }
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

    const canEdit = isSelf && (onEdit || onDelete)
    const showActions = !editing && !deletedNote && (onReply || canEdit || onReact)
    const unchanged = draft.trim() === text

    const rowClass = [
        'msg-row',
        isSelf && 'is-self',
        groupStart && 'is-group-start',
        groupEnd && 'is-group-end',
        revealed && 'is-revealed',
    ].filter(Boolean).join(' ')

    return (
        <div className={rowClass} ref={rowRef} id={messageId ? `msg-${messageId}` : undefined}>
        {!isSelf && avatar !== undefined && (
            <span className="msg-avatar-slot" aria-hidden="true">{groupEnd ? avatar : null}</span>
        )}
        <div className={`msg${isSelf ? ' is-self' : ''}${editing ? ' is-editing' : ''}`}>
            {(senderLabel || badge) && (
                <div className="msg-sender">
                    {senderLabel}
                    {badge}
                </div>
            )}

            {quote && !editing && (
                <button
                    type="button"
                    className="msg-quote"
                    onClick={quote.onClick}
                    disabled={!quote.onClick}
                    title={quote.onClick ? 'Show the original message' : undefined}
                >
                    <span className="msg-quote-label"><ReplyIcon /> {quote.label}</span>
                    <span className="msg-quote-text">{quote.text}</span>
                </button>
            )}

            <div className="msg-bubble-wrap">
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
                    <div
                        className={`msg-bubble${deletedNote ? ' is-deleted' : ''}`}
                        {...(showActions ? pressHandlers : {})}
                    >
                        {deletedNote && (
                            <div className="msg-deleted-note">
                                <TrashIcon />
                                <span>{deletedNote}</span>
                            </div>
                        )}
                        {!deletedNote && <p className="msg-text">{text}</p>}
                        {(time || (edited && !deletedNote)) && (
                            <span className="msg-time">
                                {time}
                                {edited && !deletedNote && <span className="msg-edited">{time ? ' · ' : ''}edited</span>}
                            </span>
                        )}
                    </div>
                )}

                {reactions.length > 0 && !editing && (
                    <div className="msg-reactions">
                        {reactions.map((r) => (
                            <span key={r.emoji} className={`msg-reaction-chip${r.mine ? ' is-mine' : ''}`}>
                                {r.emoji}
                                {r.count > 1 && <span className="msg-reaction-count">{r.count}</span>}
                            </span>
                        ))}
                    </div>
                )}

                {pickerOpen && onReact && (
                    <div className="msg-emoji-picker" role="menu" aria-label="React with an emoji">
                        {REACTION_EMOJIS.map((e) => (
                            <button
                                key={e}
                                type="button"
                                className={myReaction === e ? 'is-active' : ''}
                                onClick={() => { onReact(e); setPickerOpen(false); setRevealed(false) }}
                            >
                                {e}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {seen && isSelf && !deletedNote && !editing && (
                <span className="msg-seen">Seen</span>
            )}

            {showActions && (
                <div className="msg-actions">
                    {onReply && (
                        <button type="button" onClick={() => { setRevealed(false); onReply() }} disabled={disabled}>
                            <ReplyIcon /> Reply
                        </button>
                    )}
                    {onReact && (
                        <button
                            type="button"
                            onClick={() => setPickerOpen((v) => !v)}
                            disabled={disabled}
                            aria-label="React"
                            aria-expanded={pickerOpen}
                        >
                            <SmileIcon />
                        </button>
                    )}
                    {isSelf && onEdit && (
                        <button type="button" onClick={() => { setRevealed(false); startEditing() }} disabled={disabled}>
                            <PencilIcon /> Edit
                        </button>
                    )}
                    {isSelf && onDelete && (
                        <button type="button" className="is-danger" onClick={() => { setRevealed(false); onDelete() }} disabled={disabled}>
                            <TrashIcon /> Delete
                        </button>
                    )}
                </div>
            )}
        </div>
        </div>
    )
}

export default MessageBubble
