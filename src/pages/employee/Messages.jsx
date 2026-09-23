import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { notifyError } from '../../lib/notify'
import { SkeletonList } from '../../components/Skeleton'
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
                .select('message_id, request_id, sender_user_id, receiver_user_id, message, is_read, created_at')
                .or(`sender_user_id.eq.${user.id},receiver_user_id.eq.${user.id}`)
                .order('created_at', { ascending: true })

            if (messagesError) {
                throw new Error('Failed to load messages: ' + messagesError.message)
            }

            const rows = data || []

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

            const grouped = {}

            for (const m of rows) {
                const rawOtherId = m.sender_user_id === user.id ? m.receiver_user_id : m.sender_user_id
                const otherId = redirectToStudent[m.message_id] || rawOtherId
                const displayMessage = m.message.replace(REF_TAG, '')

                if (!grouped[otherId]) {
                    grouped[otherId] = {
                        otherUserId: otherId,
                        name: profileByUserId[otherId]
                            ? `${profileByUserId[otherId].first_name} ${profileByUserId[otherId].last_name}`.trim()
                            : 'Unknown',
                        messages: [],
                        unreadCount: 0,
                    }
                }

                grouped[otherId].messages.push({ ...m, message: displayMessage })

                if (m.receiver_user_id === user.id && !m.is_read) {
                    grouped[otherId].unreadCount += 1
                }
            }

            for (const group of Object.values(grouped)) {
                group.messages.sort((a, b) => a.created_at.localeCompare(b.created_at))
            }

            const threadList = Object.values(grouped).sort((a, b) => {
                const aLast = a.messages[a.messages.length - 1]?.created_at || ''
                const bLast = b.messages[b.messages.length - 1]?.created_at || ''
                return bLast.localeCompare(aLast)
            })

            setThreads(threadList)
            setSenderNames(
                Object.fromEntries(
                    Object.entries(profileByUserId).map(([id, p]) => [id, `${p.first_name} ${p.last_name}`.trim()])
                )
            )

        } catch (err) {
            console.error('MESSAGES ERROR:', err)
            setError(err.message || 'Failed to load messages.')
        } finally {
            setLoading(false)
        }
    }

    const openThread = async (thread) => {
        setActiveThread(thread)

        const unreadIds = thread.messages
            .filter((m) => m.receiver_user_id === userId && !m.is_read)
            .map((m) => m.message_id)

        if (unreadIds.length > 0) {
            await supabase
                .from('messages')
                .update({ is_read: true, read_at: new Date().toISOString() })
                .in('message_id', unreadIds)

            setThreads((prev) =>
                prev.map((t) => (t.otherUserId === thread.otherUserId ? { ...t, unreadCount: 0 } : t))
            )
        }
    }

    const sendReply = async () => {
        if (!reply.trim() || !activeThread) return

        try {
            setSending(true)

            const { data, error: sendError } = await supabase
                .from('messages')
                .insert({
                    sender_user_id: userId,
                    receiver_user_id: activeThread.otherUserId,
                    message: reply.trim(),
                    is_read: false,
                })
                .select()
                .single()

            if (sendError) {
                throw new Error('Failed to send message: ' + sendError.message)
            }

            const updatedThread = {
                ...activeThread,
                messages: [...activeThread.messages, data],
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
                        // Only label it when it's from someone other than
                        // this thread's usual counterpart -- e.g. the
                        // registrar head replying on the student's behalf.
                        const senderLabel = !isSelf && m.sender_user_id !== activeThread.otherUserId
                            ? senderNames[m.sender_user_id] || 'Registrar'
                            : null

                        return (
                            <div key={m.message_id} style={{ alignSelf: isSelf ? 'flex-end' : 'flex-start', maxWidth: '70%' }}>
                                {senderLabel && (
                                    <span style={{ fontSize: 11, color: 'var(--slate)', display: 'block', marginBottom: 4 }}>
                                        {senderLabel}
                                    </span>
                                )}
                                <div
                                    style={{
                                        background: isSelf ? 'var(--blue)' : 'var(--paper)',
                                        color: isSelf ? 'var(--white)' : 'var(--ink)',
                                        padding: '10px 14px',
                                        borderRadius: 10,
                                    }}
                                >
                                    <p style={{ color: 'inherit', fontSize: 14 }}>{m.message}</p>
                                    <span style={{ fontSize: 10.5, opacity: 0.7, display: 'block', marginTop: 4 }}>
                                        {formatTime(m.created_at)}
                                    </span>
                                </div>
                            </div>
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
            <div className="employee-page-header">
                <h1>Messages</h1>
                <p>Student inquiries and conversations.</p>
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
                        <button
                            key={thread.otherUserId}
                            className="employee-list-card"
                            style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }}
                            onClick={() => openThread(thread)}
                        >
                            <div className="employee-list-card-header">
                                <div>
                                    <h3>{thread.name}</h3>
                                    <p>{lastMessage?.message}</p>
                                </div>

                                {thread.unreadCount > 0 && (
                                    <span className="employee-status-pill status-pending">{thread.unreadCount} new</span>
                                )}
                            </div>

                            <span style={{ fontSize: 12, color: 'var(--slate)' }}>
                                {lastMessage ? formatTime(lastMessage.created_at) : ''}
                            </span>
                        </button>
                    )
                })
            )}
        </div>
    )
}

export default Messages
