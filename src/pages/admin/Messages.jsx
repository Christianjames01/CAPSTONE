import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { notifyError } from '../../lib/notify'
import { SkeletonList } from '../../components/Skeleton'
import Modal from '../../components/Modal'
import './AdminPages.css'

// Same contact block already shown to students on the Help & Support page
// -- reused here so the head doesn't have to retype the office's number,
// email, and address every time they open a new conversation.
const TEMPLATE_MESSAGE = `Hi! This is the HCDC Registrar's Office (ORRM). You can reach us at (082) 221-9071 to 79 loc. 116 or 167, or email registrar@hcdc.edu.ph. Our office is at Sta. Ana Avenue corner C. De Guzman Street, Brgy. 14-B, Davao City. How can we help you today?`

function Messages() {
    const [currentUserId, setCurrentUserId] = useState(null)
    const [threads, setThreads] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [activeThread, setActiveThread] = useState(null)

    const [reply, setReply] = useState('')
    const [sending, setSending] = useState(false)

    const [showNewMessage, setShowNewMessage] = useState(false)
    const [studentQuery, setStudentQuery] = useState('')
    const [studentResults, setStudentResults] = useState([])
    const [searchingStudents, setSearchingStudents] = useState(false)

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

            setCurrentUserId(user.id)

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

    const isMyThread = (thread) =>
        !!currentUserId && (thread.participantA === currentUserId || thread.participantB === currentUserId)

    const otherParticipant = (thread) => {
        if (thread.participantA === currentUserId) return { id: thread.participantB, name: thread.nameB }
        return { id: thread.participantA, name: thread.nameA }
    }

    const openStudentPicker = () => {
        setStudentQuery('')
        setStudentResults([])
        setShowNewMessage(true)
    }

    // Number and name are on different tables (students / profiles), so
    // "matches either" needs two lookups run in parallel and merged/
    // de-duped, rather than one query across the join.
    const searchStudents = async (query) => {
        setStudentQuery(query)

        const trimmed = query.trim()
        if (!trimmed) {
            setStudentResults([])
            return
        }

        try {
            setSearchingStudents(true)

            const [{ data: byNumber }, { data: nameProfiles }] = await Promise.all([
                supabase.from('students').select('student_id, user_id, student_number').ilike('student_number', `%${trimmed}%`).limit(20),
                supabase.from('profiles').select('user_id, first_name, last_name').eq('role', 'student')
                    .or(`first_name.ilike.%${trimmed}%,last_name.ilike.%${trimmed}%`).limit(20),
            ])

            const nameUserIds = (nameProfiles || []).map((p) => p.user_id)

            const { data: byName } = nameUserIds.length
                ? await supabase.from('students').select('student_id, user_id, student_number').in('user_id', nameUserIds)
                : { data: [] }

            const numberUserIds = (byNumber || []).map((s) => s.user_id)

            const { data: numberProfiles } = numberUserIds.length
                ? await supabase.from('profiles').select('user_id, first_name, last_name').in('user_id', numberUserIds)
                : { data: [] }

            const profileByUserId = Object.fromEntries([...(numberProfiles || []), ...(nameProfiles || [])].map((p) => [p.user_id, p]))

            const combined = [...(byNumber || []), ...(byName || [])]
            const seen = new Set()
            const results = []

            for (const s of combined) {
                if (seen.has(s.user_id)) continue
                seen.add(s.user_id)
                const p = profileByUserId[s.user_id]
                results.push({
                    userId: s.user_id,
                    studentNumber: s.student_number,
                    name: p ? `${p.first_name} ${p.last_name}`.trim() : 'Unknown',
                })
            }

            setStudentResults(results)

        } catch (err) {
            console.error('SEARCH STUDENTS ERROR:', err)
        } finally {
            setSearchingStudents(false)
        }
    }

    const startThreadWithStudent = (student) => {
        const pairKey = [currentUserId, student.userId].sort().join('|')
        const existing = threads.find((t) => t.pairKey === pairKey)

        if (existing) {
            setActiveThread(existing)
        } else {
            setActiveThread({
                pairKey,
                participantA: currentUserId,
                participantB: student.userId,
                nameA: 'You',
                roleA: 'admin',
                nameB: student.name,
                roleB: 'student',
                messages: [],
            })
        }

        setShowNewMessage(false)
        setReply('')
    }

    const sendReply = async () => {
        if (!reply.trim() || !activeThread || !currentUserId) return

        const receiverId = otherParticipant(activeThread).id

        try {
            setSending(true)

            const { data, error: sendError } = await supabase
                .from('messages')
                .insert({
                    sender_user_id: currentUserId,
                    receiver_user_id: receiverId,
                    message: reply.trim(),
                    is_read: false,
                })
                .select()
                .single()

            if (sendError) throw new Error(sendError.message)

            const updatedThread = { ...activeThread, messages: [...activeThread.messages, data] }
            setActiveThread(updatedThread)

            setThreads((prev) => {
                const exists = prev.some((t) => t.pairKey === updatedThread.pairKey)
                return exists
                    ? prev.map((t) => (t.pairKey === updatedThread.pairKey ? updatedThread : t))
                    : [updatedThread, ...prev]
            })

            setReply('')

        } catch (err) {
            console.error('SEND MESSAGE ERROR:', err)
            notifyError(err.message || 'Failed to send message.')
        } finally {
            setSending(false)
        }
    }

    const formatTime = (value) =>
        new Date(value).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

    const nameForSender = (thread, senderId) =>
        senderId === currentUserId ? 'You' : (senderId === thread.participantA ? thread.nameA : thread.nameB)

    if (activeThread) {
        const mine = isMyThread(activeThread)

        return (
            <div>
                <button className="admin-link-button" style={{ marginBottom: 16 }} onClick={() => { setActiveThread(null); setReply('') }}>
                    ← Back to Messages
                </button>

                <div className="admin-page-header">
                    <h1>{activeThread.nameA} ↔ {activeThread.nameB}</h1>
                    <p>
                        {activeThread.roleA === 'student' ? 'Student' : 'Registrar Staff'} and{' '}
                        {activeThread.roleB === 'student' ? 'Student' : 'Registrar Staff'}
                        {!mine && ' · view only'}
                    </p>
                </div>

                <div className="admin-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {activeThread.messages.length === 0 ? (
                        <p style={{ fontSize: 13, color: 'var(--slate)' }}>No messages yet — say hello below.</p>
                    ) : (
                        activeThread.messages.map((m) => {
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
                        })
                    )}
                </div>

                {mine && (
                    <>
                        <button
                            className="admin-link-button"
                            style={{ marginTop: 12 }}
                            onClick={() => setReply(TEMPLATE_MESSAGE)}
                        >
                            Use registrar contact template
                        </button>

                        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                            <input
                                className="admin-search-input"
                                style={{ flex: 1, maxWidth: 'none' }}
                                value={reply}
                                onChange={(e) => setReply(e.target.value)}
                                placeholder="Type a message..."
                                aria-label="Type a message"
                                onKeyDown={(e) => e.key === 'Enter' && sendReply()}
                                disabled={sending}
                            />

                            <button className="admin-primary-button" onClick={sendReply} disabled={sending}>
                                {sending ? 'Sending...' : 'Send'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        )
    }

    return (
        <div>
            <div className="admin-page-header-row">
                <div>
                    <h1>Messages</h1>
                    <p>All conversations between students and registrar employees, for oversight — and your own with students.</p>
                </div>

                <button className="admin-primary-button" onClick={openStudentPicker}>
                    + New Message
                </button>
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

            {showNewMessage && (
                <Modal title="New Message" maxWidth={480} onClose={() => setShowNewMessage(false)}>
                    <input
                        className="admin-search-input"
                        style={{ width: '100%', marginBottom: 14 }}
                        value={studentQuery}
                        onChange={(e) => searchStudents(e.target.value)}
                        placeholder="Search by student name or number"
                        autoFocus
                    />

                    {searchingStudents ? (
                        <p style={{ fontSize: 13, color: 'var(--slate)' }}>Searching...</p>
                    ) : studentQuery.trim() && studentResults.length === 0 ? (
                        <p style={{ fontSize: 13, color: 'var(--slate)' }}>No students matched.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
                            {studentResults.map((s) => (
                                <button
                                    key={s.userId}
                                    className="admin-list-card"
                                    style={{ width: '100%', textAlign: 'left', cursor: 'pointer', marginBottom: 0, padding: 12 }}
                                    onClick={() => startThreadWithStudent(s)}
                                >
                                    <h3 style={{ fontSize: 13.5 }}>{s.name}</h3>
                                    <p style={{ fontSize: 12.5 }}>{s.studentNumber}</p>
                                </button>
                            ))}
                        </div>
                    )}
                </Modal>
            )}
        </div>
    )
}

export default Messages
