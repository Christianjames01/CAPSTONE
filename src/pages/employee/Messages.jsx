import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { notifyError, confirmModal } from '../../lib/notify'
import { buildSenderLabels } from '../../lib/messageSenderLabel'
import { markMessagesRead, unreadReceived, withRead } from '../../lib/markMessagesRead'
import { SkeletonList } from '../../components/Skeleton'
import MessageBubble from '../../components/MessageBubble'
import { ChatApp, ChatSidebar, ChatListItem, ChatListEmpty, ChatPane, ChatHeader, ChatMessages, ChatComposer, ChatPlaceholder, ChatAvatar } from '../../components/ChatApp'
import { chatListTime, chatBubbleTime } from '../../lib/chatTime'
import { loadHiddenMessageIds, editOwnMessage, deleteOwnMessage, markSendDeleted, isSameSend } from '../../lib/messageActions'
import './EmployeePages.css'
import { useLiveRefresh } from '../../lib/useLiveRefresh'
import { useTyping } from '../../lib/useTyping'

function Messages() {
    const [userId, setUserId] = useState(null)
    const [threads, setThreads] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    // The open conversation is looked up in `threads` on every render, so
    // messages arriving live show up in it straight away.
    const [activeId, setActiveId] = useState(null)
    const [search, setSearch] = useState('')
    const [filter, setFilter] = useState('all')
    const [reply, setReply] = useState('')
    const [sending, setSending] = useState(false)
    const [senderNames, setSenderNames] = useState({})
    const [busy, setBusy] = useState(false)

    useLiveRefresh(['messages'], (options) => loadMessages(options))
    const { typingUserIds, sendTyping } = useTyping(userId)

    useEffect(() => {
        loadMessages()
    }, [])

    const loadMessages = async ({ silent = false } = {}) => {
        try {
            if (!silent) setLoading(true)
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
                ? await supabase.from('profiles').select('user_id, first_name, last_name, role, profile_photo_url').in('user_id', otherUserIds)
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
                    .from('profiles').select('user_id, first_name, last_name, role, profile_photo_url').in('user_id', [...studentIdsToFetch])

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
                        photo: profileByUserId[otherId]?.profile_photo_url || '',
                        role: profileByUserId[otherId]?.role || '',
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

    const activeThread = threads.find((t) => t.otherUserId === activeId) || null

    const openThread = (thread) => {
        setActiveId(thread.otherUserId)
        setReply('')
    }

    // Opening a conversation, or a message arriving while it's open, marks
    // it read -- like Messenger.
    const activeUnread = activeThread ? unreadReceived(activeThread.messages, userId).length : 0
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (activeThread && activeUnread > 0) markThreadsRead([activeThread])
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeId, activeUnread])

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

            setThreads((prev) =>
                prev.map((t) => (t.otherUserId === activeThread.otherUserId ? updatedThread : t))
            )
            setReply('')
            sendTyping(recipientIds, false)

        } catch (err) {
            console.error('SEND MESSAGE ERROR:', err)
            notifyError(err.message || 'Failed to send message.')
        } finally {
            setSending(false)
        }
    }

    const replaceActiveThread = (updatedThread) => {
        if (updatedThread.messages.length === 0) setActiveId(null)
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

    const q = search.trim().toLowerCase()
    const visibleThreads = threads
        .filter((t) => filter !== 'unread' || t.unreadCount > 0)
        .filter((t) => !q || t.name.toLowerCase().includes(q))

    const previewOf = (m) => {
        if (!m) return ''
        if (m.deleted_at) return deletedLabel(m)
        return `${m.sender_user_id === userId ? 'You: ' : ''}${m.message}`
    }

    const personOf = (thread) => ({ name: thread.name, photo: thread.photo })

    // Who in a conversation is typing right now (the student, or anyone
    // else who has written in it, e.g. the head).
    const typersIn = (thread) =>
        [thread.otherUserId, ...(thread.extraParticipantIds || [])].filter((id) => typingUserIds.includes(id))
    const activeTypers = activeThread ? typersIn(activeThread) : []
    const typerName = (id) => (id === activeThread?.otherUserId ? activeThread.name : senderNames[id] || 'Someone')

    return (
        <div>
            {error && <div className="employee-error-box">{error}</div>}

            {loading ? (
                <SkeletonList count={4} />
            ) : (
                <ChatApp chatOpen={!!activeThread}>
                    <ChatSidebar
                        title="Messages"
                        subtitle="Student inquiries and conversations."
                        actions={totalUnread > 0 && (
                            <button type="button" className="chat-pill-button" onClick={() => markThreadsRead(threads)}>
                                Mark all read
                            </button>
                        )}
                        toolbar={threads.length > 0 && (
                            <>
                                <input
                                    className="chat-search"
                                    type="search"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search Messages"
                                    aria-label="Search conversations"
                                />
                                <div className="chat-tabs">
                                    {[
                                        { key: 'all', label: 'All' },
                                        { key: 'unread', label: 'Unread', count: threads.filter((t) => t.unreadCount > 0).length },
                                    ].map((tab) => (
                                        <button
                                            key={tab.key}
                                            type="button"
                                            className={`chat-tab${filter === tab.key ? ' is-active' : ''}`}
                                            onClick={() => setFilter(tab.key)}
                                        >
                                            {tab.label}{tab.count ? <span>{tab.count}</span> : null}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    >
                        {threads.length === 0 ? (
                            <ChatListEmpty>No messages yet. Conversations with students will show up here.</ChatListEmpty>
                        ) : visibleThreads.length === 0 ? (
                            <ChatListEmpty>No conversations match.</ChatListEmpty>
                        ) : (
                            visibleThreads.map((thread) => {
                                const last = thread.messages[thread.messages.length - 1]
                                return (
                                    <ChatListItem
                                        key={thread.otherUserId}
                                        active={thread.otherUserId === activeId}
                                        unread={thread.unreadCount}
                                        people={[personOf(thread)]}
                                        name={thread.name}
                                        preview={previewOf(last)}
                                        time={last ? chatListTime(last.created_at) : ''}
                                        typing={typersIn(thread).length > 0}
                                        onClick={() => openThread(thread)}
                                    />
                                )
                            })
                        )}
                    </ChatSidebar>

                    <ChatPane label={activeThread ? `Conversation with ${activeThread.name}` : 'Conversation'}>
                        {!activeThread ? (
                            <ChatPlaceholder title="Your messages" text="Pick a conversation to read and reply." />
                        ) : (
                            <>
                                <ChatHeader
                                    onBack={() => setActiveId(null)}
                                    people={[personOf(activeThread)]}
                                    title={activeThread.name}
                                    subtitle={activeThread.role === 'student' ? 'Student' : "Registrar's Office"}
                                    typing={activeTypers.length > 0 && `${typerName(activeTypers[0])} is typing…`}
                                />

                                <ChatMessages
                                    messages={activeThread.messages}
                                    threadKey={activeThread.otherUserId}
                                    typing={activeTypers.length > 0 && {
                                        people: [activeTypers[0] === activeThread.otherUserId ? personOf(activeThread) : { name: typerName(activeTypers[0]) }],
                                        label: `${typerName(activeTypers[0])} is typing`,
                                    }}
                                    empty="No messages yet."
                                    renderMessage={(m, { groupStart, groupEnd }) => {
                                        const isSelf = m.sender_user_id === userId
                                        const senderName = senderNames[m.sender_user_id] || 'Unknown'
                                        const fromOtherPerson = !isSelf && m.sender_user_id !== activeThread.otherUserId

                                        return (
                                            <MessageBubble
                                                key={m.message_id}
                                                isSelf={isSelf}
                                                senderLabel={fromOtherPerson && groupStart ? senderName : null}
                                                avatar={isSelf ? undefined : (
                                                    <ChatAvatar
                                                        people={[fromOtherPerson ? { name: senderName } : personOf(activeThread)]}
                                                        size={28}
                                                    />
                                                )}
                                                groupStart={groupStart}
                                                groupEnd={groupEnd}
                                                text={m.message}
                                                time={groupEnd ? chatBubbleTime(m.created_at) : null}
                                                edited={!!m.edited_at}
                                                deletedNote={deletedLabel(m)}
                                                onEdit={isSelf ? (text) => editMessage(m, text) : undefined}
                                                onDelete={isSelf ? () => deleteMessage(m) : undefined}
                                                disabled={busy}
                                            />
                                        )
                                    }}
                                />

                                <ChatComposer
                                    value={reply}
                                    onChange={(value) => {
                                        setReply(value)
                                        sendTyping([activeThread.otherUserId, ...(activeThread.extraParticipantIds || [])], !!value.trim())
                                    }}
                                    onSend={sendReply}
                                    sending={sending}
                                    canSend={!!reply.trim()}
                                    placeholder={`Message ${activeThread.name}…`}
                                />
                            </>
                        )}
                    </ChatPane>
                </ChatApp>
            )}
        </div>
    )
}

export default Messages
