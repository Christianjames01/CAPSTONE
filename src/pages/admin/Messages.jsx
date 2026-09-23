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

            // The [[ref=...]] tagged copy is a routing helper only the
            // employee's own page needs (see sendReply) -- the untagged
            // sibling sent to the student already carries the real
            // content, so drop the tagged copy here rather than showing
            // the same message twice.
            const rows = (data || []).filter((m) => !m.message.startsWith('[[ref='))

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

            // A reply sent while viewing someone else's conversation is
            // delivered as one row per recipient (messages is strictly
            // 1:1), so a fresh reload naturally regroups it into its own
            // "head <-> student" / "head <-> employee" pairs. Fold those
            // back into whichever existing non-head thread the other
            // person already belongs to, so it reads as one conversation
            // in this list too, not three.
            {
                for (const [key, group] of Object.entries(grouped)) {
                    const isHeadGroup = group.participantA === user.id || group.participantB === user.id
                    if (!isHeadGroup) continue

                    const otherId = group.participantA === user.id ? group.participantB : group.participantA

                    const target = Object.values(grouped).find((g) =>
                        g.pairKey !== key &&
                        g.participantA !== user.id && g.participantB !== user.id &&
                        (g.participantA === otherId || g.participantB === otherId)
                    )

                    if (!target) continue

                    const seen = new Set(target.messages.map((m) => `${m.sender_user_id}|${m.message}|${m.created_at}`))

                    for (const m of group.messages) {
                        const signature = `${m.sender_user_id}|${m.message}|${m.created_at}`
                        if (seen.has(signature)) continue
                        seen.add(signature)
                        target.messages.push(m)
                    }

                    target.messages.sort((a, b) => a.created_at.localeCompare(b.created_at))
                    delete grouped[key]
                }
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

    // Normally just the one other person. Viewing a student<->employee
    // thread the head isn't part of, neither A nor B is the head, so both
    // come back -- a reply there fans out to each of them individually
    // (the schema is strictly 1:1 rows), but still reads as one message
    // sent into this same conversation rather than a separate DM.
    const otherParticipants = (thread) => {
        const both = [
            { id: thread.participantA, name: thread.nameA, role: thread.roleA },
            { id: thread.participantB, name: thread.nameB, role: thread.roleB },
        ]
        const others = both.filter((p) => p.id !== currentUserId)
        return others.length > 0 ? others : both
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

    // Shared by both the "+ New Message" student picker and the "Message
    // <person>" buttons shown while viewing someone else's conversation --
    // either way it's the head opening/continuing their own thread with
    // that specific person.
    const startThreadWithUser = ({ userId, name, role }) => {
        const pairKey = [currentUserId, userId].sort().join('|')
        const existing = threads.find((t) => t.pairKey === pairKey)

        if (existing) {
            setActiveThread(existing)
        } else {
            setActiveThread({
                pairKey,
                participantA: currentUserId,
                participantB: userId,
                nameA: 'You',
                roleA: 'admin',
                nameB: name,
                roleB: role,
                messages: [],
            })
        }

        setShowNewMessage(false)
        setReply('')
    }

    const sendReply = async () => {
        if (!reply.trim() || !activeThread || !currentUserId) return

        const recipients = otherParticipants(activeThread)
        if (recipients.length === 0) return

        // The employee's own Messages page can't query the student's copy
        // of a fanned-out message (RLS only allows sender=self or
        // receiver=self), so there's no way for it to know these two rows
        // are siblings other than reading it off the message itself. This
        // tag is invisible to the student's copy and stripped back out
        // before display on the employee's side.
        const studentRecipient = recipients.find((r) => r.role === 'student')

        try {
            setSending(true)

            const rows = recipients.map((r) => {
                const needsTag = recipients.length > 1 && studentRecipient && r.id !== studentRecipient.id
                return {
                    sender_user_id: currentUserId,
                    receiver_user_id: r.id,
                    message: needsTag ? `[[ref=${studentRecipient.id}]]${reply.trim()}` : reply.trim(),
                    is_read: false,
                }
            })

            const { data, error: sendError } = await supabase
                .from('messages')
                .insert(rows)
                .select()

            if (sendError) throw new Error(sendError.message)

            // Delivered as one row per recipient under the hood, but shown
            // as a single bubble here -- it's one message from the head's
            // point of view, not several. Show the untagged copy.
            const displayRow = data.find((d) => !d.message.startsWith('[[ref=')) || data[0]
            const updatedThread = { ...activeThread, messages: [...activeThread.messages, displayRow] }
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
                        {!mine && ' · replying here reaches both of them'}
                    </p>
                </div>

                <div className="admin-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {activeThread.messages.length === 0 ? (
                        <p style={{ fontSize: 13, color: 'var(--slate)' }}>No messages yet — say hello below.</p>
                    ) : (
                        activeThread.messages.map((m) => {
                            const isSelf = m.sender_user_id === currentUserId

                            return (
                                <div
                                    key={m.message_id}
                                    style={{
                                        alignSelf: isSelf ? 'flex-end' : 'flex-start',
                                        maxWidth: '70%',
                                    }}
                                >
                                    <span style={{ fontSize: 11, color: 'var(--slate)', display: 'block', marginBottom: 4 }}>
                                        {nameForSender(activeThread, m.sender_user_id)}
                                    </span>
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
                        })
                    )}
                </div>

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
                        placeholder={mine ? 'Type a message...' : 'Type a message to both...'}
                        aria-label="Type a message"
                        onKeyDown={(e) => e.key === 'Enter' && sendReply()}
                        disabled={sending}
                    />

                    <button className="admin-primary-button" onClick={sendReply} disabled={sending}>
                        {sending ? 'Sending...' : 'Send'}
                    </button>
                </div>
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
                                    onClick={() => startThreadWithUser({ userId: s.userId, name: s.name, role: 'student' })}
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
