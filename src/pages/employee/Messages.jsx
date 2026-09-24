import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { notifyError, confirmModal } from '../../lib/notify'
import { buildSenderLabels } from '../../lib/messageSenderLabel'
import { markMessagesRead, unreadReceived, withRead } from '../../lib/markMessagesRead'
import { SkeletonList } from '../../components/Skeleton'
import MessageBubble from '../../components/MessageBubble'
import { loadHiddenMessageIds, editOwnMessage, deleteOwnMessage, markSendDeleted, isSameSend } from '../../lib/messageActions'
import './EmployeePages.css'

function Messages() {
    const [userId, setUserId] = useState(null)
    const [threads, setThreads] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const [activeThread, setActiveThread] = useState(null)
    const [reply, setReply] = useState('')
    const [sending, setSending] = useState(false)
    const [senderNames, setSenderNames] = useState({})
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        loadMessages()
    }, [])

    const loadMessages = async () => {
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

            const { data, error: messagesError } = await supabase
                .from('messages')
                .select('*')
                .or(`sender_user_id.eq.${user.id},receiver_user_id.eq.${user.id}`)
                .order('created_at', { ascending: true })

            if (messagesError) {
                throw new Error('Failed to load messages: ' + messagesError.message)
            }

            // Messages this user deleted "for me" stay out of every thread.
            const hiddenIds = await loadHiddenMessageIds(user.id)
            const rows = (data || []).filter((m) => !hiddenIds.has(m.message_id))

            const otherUserIds = [
                ...new Set(
                    rows.map((m) => (m.sender_user_id === user.id ? m.receiver_user_id : m.sender_user_id))
                )
            ]

            const { data: profiles } = otherUserIds.length
                ? await supabase.from('profiles').select('user_id, first_name, last_name, role').in('user_id', otherUserIds)
                : { data: [] }

            const profileByUserId = Object.fromEntries(
                (profiles || []).map((p) => [p.user_id, p])
            )

            // A message from the registrar head has no field linking it to
            // "this was about student X" -- messages is strictly 1:1, and
            // RLS only lets an employee query rows where they're the
            // sender or receiver, so there's no query that could look up
            // the fan-out sibling sent to the student either. The admin
            // side tags the employee-facing copy's text with a hidden
            // [[ref=<studentUserId>]] prefix when it fans a head reply out
            // (see admin/Messages.jsx sendReply) specifically so this page
            // can file it under that student instead of under the head.
            const REF_TAG = /^\[\[ref=([0-9a-f-]+)\]\]/

            const redirectToStudent = {}
            const studentIdsToFetch = new Set()

            for (const m of rows) {
                const match = m.message.match(REF_TAG)
                if (!match) continue
                redirectToStudent[m.message_id] = match[1]
                if (!profileByUserId[match[1]]) studentIdsToFetch.add(match[1])
            }

            if (studentIdsToFetch.size > 0) {
                const { data: extraProfiles } = await supabase
                    .from('profiles').select('user_id, first_name, last_name, role').in('user_id', [...studentIdsToFetch])

                for (const p of extraProfiles || []) profileByUserId[p.user_id] = p
            }

            const labels = await buildSenderLabels([...otherUserIds, ...studentIdsToFetch], { showRegistrarHeadName: true })

            // A reply this employee sent into a shared conversation fans out
            // as one row per recipient (student + head), all with the same
            // text and timestamp. File every copy under the student so the
            // reply stays in that conversation instead of also opening a
            // separate thread with the head, and show it as one bubble.
            const fanOutKey = (m) => `${m.message}|${m.created_at}`
            const studentForFanOut = {}

            for (const m of rows) {
                if (m.sender_user_id !== user.id) continue
                if (profileByUserId[m.receiver_user_id]?.role === 'student') {
                    studentForFanOut[fanOutKey(m)] = m.receiver_user_id
                }
            }

            const shownOwnReplies = new Set()
            const grouped = {}

            for (const m of rows) {
                const rawOtherId = m.sender_user_id === user.id ? m.receiver_user_id : m.sender_user_id
                const ownFanOutStudent = m.sender_user_id === user.id ? studentForFanOut[fanOutKey(m)] : null
                const otherId = redirectToStudent[m.message_id] || ownFanOutStudent || rawOtherId
                const displayMessage = m.message.replace(REF_TAG, '')

                if (ownFanOutStudent) {
                    const bubbleKey = `${otherId}|${fanOutKey(m)}`
                    if (shownOwnReplies.has(bubbleKey)) continue
                    shownOwnReplies.add(bubbleKey)
                }

                if (!grouped[otherId]) {
                    grouped[otherId] = {
                        otherUserId: otherId,
                        name: labels[otherId] || 'Unknown',
                        messages: [],
                        unreadCount: 0,
                        // Anyone besides "the" other person (e.g. the head)
                        // who has sent into this thread -- a reply here
                        // fans out to them too, so this stays a shared
                        // conversation rather than only ever routing back
                        // to the one counterpart.
                        extraParticipantIds: new Set(),
                    }
                }

                grouped[otherId].messages.push({ ...m, message: displayMessage })

                if (m.receiver_user_id === user.id && !m.is_read) {
                    grouped[otherId].unreadCount += 1
                }

                if (m.sender_user_id !== user.id && m.sender_user_id !== otherId) {
                    grouped[otherId].extraParticipantIds.add(m.sender_user_id)
                }
            }

            for (const group of Object.values(grouped)) {
                group.messages.sort((a, b) => a.created_at.localeCompare(b.created_at))
                group.extraParticipantIds = [...group.extraParticipantIds]
            }

            const threadList = Object.values(grouped).sort((a, b) => {
                const aLast = a.messages[a.messages.length - 1]?.created_at || ''
                const bLast = b.messages[b.messages.length - 1]?.created_at || ''
                return bLast.localeCompare(aLast)
            })

            setThreads(threadList)
            setSenderNames(labels)

        } catch (err) {
            console.error('MESSAGES ERROR:', err)
            setError(err.message || 'Failed to load messages.')
        } finally {
            setLoading(false)
        }
    }

    // Marks every unread message in the given threads as read, in the
    // database and in page state, and refreshes the sidebar badge.
    const markThreadsRead = async (targetThreads) => {
        const ids = targetThreads.flatMap((t) => unreadReceived(t.messages, userId).map((m) => m.message_id))
        if (ids.length === 0) return

        try {
            await markMessagesRead(ids)
            const targetKeys = new Set(targetThreads.map((t) => t.otherUserId))
            setThreads((prev) =>
                prev.map((t) =>
                    targetKeys.has(t.otherUserId) ? { ...t, messages: withRead(t.messages, ids), unreadCount: 0 } : t
                )
            )
        } catch (err) {
            notifyError(err.message)
        }
    }

    const openThread = (thread) => {
        const readIds = unreadReceived(thread.messages, userId).map((m) => m.message_id)
        setActiveThread({ ...thread, messages: withRead(thread.messages, readIds), unreadCount: 0 })
        markThreadsRead([thread])
    }

    const totalUnread = threads.reduce((sum, t) => sum + t.unreadCount, 0)

    const sendReply = async () => {
        if (!reply.trim() || !activeThread) return

        // messages is strictly 1:1, so reaching everyone in this thread
        // (the student plus anyone else who's messaged in, e.g. the head)
        // means one row per recipient, same fan-out the admin side does.
        const recipientIds = [activeThread.otherUserId, ...(activeThread.extraParticipantIds || [])]

        try {
            setSending(true)

            const rows = recipientIds.map((id) => ({
                sender_user_id: userId,
                receiver_user_id: id,
                message: reply.trim(),
                is_read: false,
            }))

            const { data, error: sendError } = await supabase
                .from('messages')
                .insert(rows)
                .select()

            if (sendError) {
                throw new Error('Failed to send message: ' + sendError.message)
            }

            // One bubble here even though it went out as multiple rows.
            const displayRow = data.find((d) => d.receiver_user_id === activeThread.otherUserId) || data[0]

            const updatedThread = {
                ...activeThread,
                messages: [...activeThread.messages, displayRow],
            }

            setActiveThread(updatedThread)
            setThreads((prev) =>
                prev.map((t) => (t.otherUserId === activeThread.otherUserId ? updatedThread : t))
            )
            setReply('')

        } catch (err) {
            console.error('SEND MESSAGE ERROR:', err)
            notifyError(err.message || 'Failed to send message.')
        } finally {
            setSending(false)
        }
    }

    const replaceActiveThread = (updatedThread) => {
        setActiveThread(updatedThread)
        setThreads((prev) =>
            updatedThread.messages.length === 0
                ? prev.filter((t) => t.otherUserId !== updatedThread.otherUserId)
                : prev.map((t) => (t.otherUserId === updatedThread.otherUserId ? updatedThread : t))
        )
    }

    // Unsend for everyone: the student (and anyone else in the thread)
    // sees "... deleted a message" instead of the text.
    const deleteMessage = async (m) => {
        const confirmed = await confirmModal(
            'Delete this message for everyone? Everyone in the conversation will see that you deleted a message instead.',
            { title: 'Delete message?', confirmButtonText: 'Delete', icon: 'warning' }
        )
        if (!confirmed) return

        try {
            setBusy(true)
            await deleteOwnMessage(m.message_id)
            replaceActiveThread({ ...activeThread, messages: markSendDeleted(activeThread.messages, m, userId) })
        } catch (err) {
            console.error('DELETE MESSAGE ERROR:', err)
            notifyError(err.message || 'Failed to delete message.')
        } finally {
            setBusy(false)
        }
    }

    // "You deleted a message" / "Yul deleted a message", or null.
    const deletedLabel = (m) => {
        if (!m?.deleted_at) return null
        const by = m.deleted_by || m.sender_user_id
        return by === userId ? 'You deleted a message' : `${senderNames[by] || 'Someone'} deleted a message`
    }

    // Returns false on failure so the bubble stays in edit mode.
    const editMessage = async (m, newText) => {
        try {
            await editOwnMessage(m.message_id, newText)
            const edited_at = new Date().toISOString()
            replaceActiveThread({
                ...activeThread,
                messages: activeThread.messages.map((x) => (isSameSend(x, m) ? { ...x, message: newText, edited_at } : x)),
            })
            return true
        } catch (err) {
            console.error('EDIT MESSAGE ERROR:', err)
            notifyError(err.message || 'Failed to edit message.')
            return false
        }
    }

    const formatTime = (value) =>
        new Date(value).toLocaleString('en-PH', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        })

    if (activeThread) {
        return (
            <div>
                <button className="employee-link-button" style={{ marginBottom: 16 }} onClick={() => setActiveThread(null)}>
                    ← Back to Messages
                </button>

                <div className="employee-page-header">
                    <h1>{activeThread.name}</h1>
                </div>

                <div className="employee-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {activeThread.messages.map((m) => {
                        const isSelf = m.sender_user_id === userId

                        return (
                            <MessageBubble
                                key={m.message_id}
                                isSelf={isSelf}
                                senderLabel={!isSelf ? (senderNames[m.sender_user_id] || 'Unknown') : null}
                                text={m.message}
                                time={formatTime(m.created_at)}
                                edited={!!m.edited_at}
                                deletedNote={deletedLabel(m)}
                                onEdit={isSelf ? (text) => editMessage(m, text) : undefined}
                                onDelete={isSelf ? () => deleteMessage(m) : undefined}
                                disabled={busy}
                            />
                        )
                    })}
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                    <input
                        className="employee-search-input"
                        style={{ flex: 1, maxWidth: 'none' }}
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        placeholder="Type a reply..."
                        aria-label="Type a reply"
                        onKeyDown={(e) => e.key === 'Enter' && sendReply()}
                        disabled={sending}
                    />

                    <button
                        className="employee-card"
                        style={{ margin: 0, padding: '11px 20px', background: 'var(--blue)', color: 'var(--white)', fontWeight: 600, fontSize: 14 }}
                        onClick={sendReply}
                        disabled={sending}
                    >
                        {sending ? 'Sending...' : 'Send'}
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div>
            <div className="employee-page-header-row">
                <div className="employee-page-header">
                    <h1>Messages</h1>
                    <p>Student inquiries and conversations.</p>
                </div>

                {totalUnread > 0 && (
                    <button className="employee-link-button" onClick={() => markThreadsRead(threads)}>
                        Mark all as read
                    </button>
                )}
            </div>

            {error && <div className="employee-error-box">{error}</div>}

            {loading ? (
                <SkeletonList count={3} />
            ) : threads.length === 0 ? (
                <div className="employee-empty">No messages yet.</div>
            ) : (
                threads.map((thread) => {
                    const lastMessage = thread.messages[thread.messages.length - 1]

                    return (
                        <div
                            key={thread.otherUserId}
                            role="button"
                            tabIndex={0}
                            className="employee-list-card"
                            style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }}
                            onClick={() => openThread(thread)}
                            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), openThread(thread))}
                        >
                            <div className="employee-list-card-header">
                                <div>
                                    <h3>{thread.name}</h3>
                                    <p>{lastMessage?.deleted_at ? <em>{deletedLabel(lastMessage)}</em> : lastMessage?.message}</p>
                                </div>

                                {thread.unreadCount > 0 && (
                                    <span className="employee-status-pill status-pending">{thread.unreadCount} new</span>
                                )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                <span style={{ fontSize: 12, color: 'var(--slate)' }}>
                                    {lastMessage ? formatTime(lastMessage.created_at) : ''}
                                </span>

                                {thread.unreadCount > 0 && (
                                    <button
                                        className="employee-link-button"
                                        onClick={(e) => { e.stopPropagation(); markThreadsRead([thread]) }}
                                        onKeyDown={(e) => e.stopPropagation()}
                                    >
                                        Mark as read
                                    </button>
                                )}
                            </div>
                        </div>
                    )
                })
            )}
        </div>
    )
}

export default Messages
