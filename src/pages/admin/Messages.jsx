import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { SkeletonList } from '../../components/Skeleton'
import './AdminPages.css'

function Messages() {
    const [threads, setThreads] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [activeThread, setActiveThread] = useState(null)

    useEffect(() => {
        loadMessages()
    }, [])

    const loadMessages = async () => {
        try {
            setLoading(true)
            setError('')

            const { data, error: messagesError } = await supabase
                .from('messages')
                .select('message_id, request_id, sender_user_id, receiver_user_id, message, is_read, created_at')
                .order('created_at', { ascending: true })

            if (messagesError) {
                throw new Error('Failed to load messages: ' + messagesError.message)
            }

            const rows = data || []

            const userIds = [
                ...new Set(rows.flatMap((m) => [m.sender_user_id, m.receiver_user_id]))
            ]

            const { data: profiles } = userIds.length
                ? await supabase.from('profiles').select('user_id, first_name, last_name, role').in('user_id', userIds)
                : { data: [] }

            const profileByUserId = Object.fromEntries((profiles || []).map((p) => [p.user_id, p]))

            const nameFor = (userId) => {
                const p = profileByUserId[userId]
                return p ? `${p.first_name} ${p.last_name}`.trim() : 'Unknown'
            }

            const roleFor = (userId) => profileByUserId[userId]?.role || ''

            const grouped = {}

            for (const m of rows) {
                const pairKey = [m.sender_user_id, m.receiver_user_id].sort().join('|')

                if (!grouped[pairKey]) {
                    grouped[pairKey] = {
                        pairKey,
                        participantA: m.sender_user_id,
                        participantB: m.receiver_user_id,
                        messages: [],
                    }
                }

                grouped[pairKey].messages.push(m)
            }

            const threadList = Object.values(grouped)
                .map((t) => ({
                    ...t,
                    nameA: nameFor(t.participantA),
                    roleA: roleFor(t.participantA),
                    nameB: nameFor(t.participantB),
                    roleB: roleFor(t.participantB),
                }))
                .sort((a, b) => {
                    const aLast = a.messages[a.messages.length - 1]?.created_at || ''
                    const bLast = b.messages[b.messages.length - 1]?.created_at || ''
                    return bLast.localeCompare(aLast)
                })

            setThreads(threadList)

        } catch (err) {
            console.error('ADMIN MESSAGES ERROR:', err)
            setError(err.message || 'Failed to load messages.')
        } finally {
            setLoading(false)
        }
    }

    const formatTime = (value) =>
        new Date(value).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

    const nameForSender = (thread, senderId) =>
        senderId === thread.participantA ? thread.nameA : thread.nameB

    if (activeThread) {
        return (
            <div>
                <button className="admin-link-button" style={{ marginBottom: 16 }} onClick={() => setActiveThread(null)}>
                    ← Back to Messages
                </button>

                <div className="admin-page-header">
                    <h1>{activeThread.nameA} ↔ {activeThread.nameB}</h1>
                    <p>
                        {activeThread.roleA === 'student' ? 'Student' : 'Registrar Staff'} and{' '}
                        {activeThread.roleB === 'student' ? 'Student' : 'Registrar Staff'} · view only
                    </p>
                </div>

                <div className="admin-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {activeThread.messages.map((m) => {
                        const isA = m.sender_user_id === activeThread.participantA

                        return (
                            <div
                                key={m.message_id}
                                style={{
                                    alignSelf: isA ? 'flex-start' : 'flex-end',
                                    maxWidth: '70%',
                                }}
                            >
                                <span style={{ fontSize: 11, color: 'var(--slate)', display: 'block', marginBottom: 4 }}>
                                    {nameForSender(activeThread, m.sender_user_id)}
                                </span>
                                <div
                                    style={{
                                        background: isA ? 'var(--paper)' : 'var(--blue)',
                                        color: isA ? 'var(--ink)' : 'var(--white)',
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
            </div>
        )
    }

    return (
        <div>
            <div className="admin-page-header">
                <h1>Messages</h1>
                <p>All conversations between students and registrar employees, for oversight.</p>
            </div>

            {error && <div className="admin-error-box">{error}</div>}

            {loading ? (
                <SkeletonList count={3} />
            ) : threads.length === 0 ? (
                <div className="admin-empty">No conversations yet.</div>
            ) : (
                threads.map((thread) => {
                    const lastMessage = thread.messages[thread.messages.length - 1]

                    return (
                        <button
                            key={thread.pairKey}
                            className="admin-list-card"
                            style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }}
                            onClick={() => setActiveThread(thread)}
                        >
                            <div className="admin-list-card-header">
                                <div>
                                    <h3>{thread.nameA} ↔ {thread.nameB}</h3>
                                    <p>{lastMessage?.message}</p>
                                </div>

                                <span className="admin-status-pill">{thread.messages.length} messages</span>
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
