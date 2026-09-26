import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { findAssignedEmployee } from '../../lib/assignEmployee'
import { notify, notifyError, confirmModal } from '../../lib/notify'
import { buildSenderLabels, REGISTRAR_LABEL } from '../../lib/messageSenderLabel'
import { markMessagesRead, unreadReceived, withRead } from '../../lib/markMessagesRead'
import { SkeletonList } from '../../components/Skeleton'
import MessageBubble from '../../components/MessageBubble'
import { loadHiddenMessageIds, editOwnMessage, deleteOwnMessage, markSendDeleted, isSameSend } from '../../lib/messageActions'
import '../auth/Auth.css'
import './StudentPages.css'
import './StudentMessages.css'

const DEFAULT_MESSAGE =
    "Hi, I'd like to ask about my document request. Please let me know if you need anything " +
    "from me — I'll check back here for your reply. Thank you!"

const CLOSED_STATUSES = ['completed', 'cancelled', 'rejected']

const initialsOf = (name) =>
    (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || '?'

const otherParty = (m, userId) => (m.sender_user_id === userId ? m.receiver_user_id : m.sender_user_id)

// One conversation per registrar staff member: every employee who handles
// (or handled) one of the student's requests, plus anyone else from the
// Registrar who has messaged them. ?employee=<employee_id> (from a request
// page) opens that employee's conversation.
function Messages() {
    const [searchParams, setSearchParams] = useSearchParams()
    const requestedEmployeeId = searchParams.get('employee')

    const [userId, setUserId] = useState(null)
    const [contacts, setContacts] = useState([])
    const [selectedUserId, setSelectedUserId] = useState(null)
    const [messages, setMessages] = useState([])
    // message_id -> the staff member whose conversation it belongs in, and
    // sender labels for staff other than that person (e.g. the Registrar Head).
    const [threadOf, setThreadOf] = useState({})
    const [labels, setLabels] = useState({})
    const [reply, setReply] = useState('')

    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        loadMessages()
    }, [])

    const loadMessages = async () => {
        try {
            setError('')

            const { data: { user }, error: userError } = await supabase.auth.getUser()
            if (userError || !user) throw new Error('You are not logged in.')
            setUserId(user.id)

            const { data: student, error: studentError } = await supabase
                .from('students')
                .select('student_id, college_id, program_id')
                .eq('user_id', user.id)
                .single()

            if (studentError || !student) throw new Error('Student record could not be found.')

            // Employees handling the student's requests, newest request first.
            const { data: ownRequests } = await supabase
                .from('document_requests')
                .select('request_number, assigned_employee_id, status, requested_at')
                .eq('student_id', student.student_id)
                .not('assigned_employee_id', 'is', null)
                .order('requested_at', { ascending: false })

            const requestsByEmployee = {}
            for (const r of ownRequests || []) {
                if (!requestsByEmployee[r.assigned_employee_id]) requestsByEmployee[r.assigned_employee_id] = []
                requestsByEmployee[r.assigned_employee_id].push(r)
            }

            let employeeIds = Object.keys(requestsByEmployee)
            if (employeeIds.length === 0) {
                const fallback = await findAssignedEmployee(student.college_id, student.program_id)
                if (fallback) employeeIds = [fallback]
            }

            const { data: employeeRows } = employeeIds.length
                ? await supabase
                    .from('employees')
                    .select('employee_id, user_id, employee_number, position_title, display_name')
                    .in('employee_id', employeeIds)
                : { data: [] }

            const { data: messageRows, error: messagesError } = await supabase
                .from('messages')
                .select('*')
                .or(`sender_user_id.eq.${user.id},receiver_user_id.eq.${user.id}`)
                .order('created_at', { ascending: true })

            if (messagesError) throw new Error('Failed to load messages: ' + messagesError.message)

            // Messages this student deleted "for me".
            const hiddenIds = await loadHiddenMessageIds(user.id)
            const rows = (messageRows || []).filter((m) => !hiddenIds.has(m.message_id))

            const employeeUserIds = (employeeRows || []).map((e) => e.user_id)
            const otherUserIds = [...new Set([...employeeUserIds, ...rows.map((m) => otherParty(m, user.id))])].filter(Boolean)
            const labels = await buildSenderLabels(otherUserIds)

            // Which conversation each message belongs in. Messages with an
            // employee go in that employee's conversation. Messages from
            // other registrar staff (the Registrar Head replying while
            // viewing a student-employee conversation) go in the
            // conversation that was active when they were sent -- the one
            // holding the latest earlier message -- so they read as part
            // of the same chat.
            const employeeUserSet = new Set(employeeUserIds)
            const assigned = {}
            let lastThread = null
            for (const m of rows) {
                const other = otherParty(m, user.id)
                if (employeeUserSet.has(other)) {
                    assigned[m.message_id] = other
                    lastThread = other
                } else if (employeeUserSet.size > 0) {
                    assigned[m.message_id] = lastThread // null = not placed yet (see below)
                } else {
                    assigned[m.message_id] = other
                }
            }

            const lastAt = (uid) => {
                const thread = rows.filter((m) => assigned[m.message_id] === uid)
                return thread.length ? new Date(thread[thread.length - 1].created_at).getTime() : 0
            }

            const list = (employeeRows || []).map((e) => {
                const handled = requestsByEmployee[e.employee_id] || []
                const active = handled.filter((r) => !CLOSED_STATUSES.includes(r.status))
                return {
                    userId: e.user_id,
                    employeeId: e.employee_id,
                    name: e.display_name?.trim() || labels[e.user_id] || e.employee_number,
                    subtitle: e.position_title || 'Registrar staff',
                    requests: (active.length ? active : handled).map((r) => r.request_number),
                    handlesActive: active.length > 0,
                    latestRequestAt: handled[0] ? new Date(handled[0].requested_at).getTime() : 0,
                    lastAt: lastAt(e.user_id),
                }
            })

            // With no employee to talk to, other registrar staff who messaged
            // the student (e.g. the Registrar Head) get their own conversation.
            for (const uid of new Set(rows.map((m) => otherParty(m, user.id)))) {
                if (!uid || employeeUserSet.size > 0 || list.some((c) => c.userId === uid)) continue
                list.push({
                    userId: uid,
                    employeeId: null,
                    name: labels[uid] || REGISTRAR_LABEL,
                    subtitle: "Registrar's Office",
                    requests: [],
                    handlesActive: false,
                    latestRequestAt: 0,
                    lastAt: lastAt(uid),
                })
            }

            // Active handlers first, then most recent conversation.
            list.sort((a, b) => Number(b.handlesActive) - Number(a.handlesActive) || b.lastAt - a.lastAt || b.latestRequestAt - a.latestRequestAt)

            // Staff messages sent before any employee conversation existed go
            // in the top conversation.
            for (const id of Object.keys(assigned)) {
                if (!assigned[id]) assigned[id] = list[0]?.userId || null
            }

            setContacts(list)
            setMessages(rows)
            setThreadOf(assigned)
            setLabels(labels)

            setSelectedUserId((current) => {
                if (current && list.some((c) => c.userId === current)) return current
                const requested = requestedEmployeeId && list.find((c) => c.employeeId === requestedEmployeeId)
                return (requested || list[0])?.userId || null
            })
        } catch (err) {
            console.error('STUDENT MESSAGES ERROR:', err)
            setError(err.message || 'Failed to load messages.')
        } finally {
            setLoading(false)
        }
    }

    const selected = contacts.find((c) => c.userId === selectedUserId) || null
    // Messages sent from this page before a reload aren't in threadOf yet;
    // they belong with the person they were sent to.
    const threadFor = (m) => threadOf[m.message_id] || otherParty(m, userId)
    const thread = selected ? messages.filter((m) => threadFor(m) === selected.userId) : []
    const unreadInThread = unreadReceived(thread, userId)

    const selectContact = (contact) => {
        setSelectedUserId(contact.userId)
        setReply('')
        if (contact.employeeId) setSearchParams({ employee: contact.employeeId }, { replace: true })
        else setSearchParams({}, { replace: true })
    }

    const markThreadRead = async () => {
        const ids = unreadInThread.map((m) => m.message_id)
        try {
            await markMessagesRead(ids)
            setMessages((prev) => withRead(prev, ids))
        } catch (err) {
            notifyError(err.message)
        }
    }

    const sendMessage = async () => {
        const text = (reply || (thread.length === 0 ? DEFAULT_MESSAGE : '')).trim()
        if (!text || !selected || !userId) return

        try {
            setSending(true)

            const { data, error: sendError } = await supabase
                .from('messages')
                .insert({
                    sender_user_id: userId,
                    receiver_user_id: selected.userId,
                    message: text,
                    is_read: false,
                })
                .select()
                .single()

            if (sendError) throw new Error('Failed to send message: ' + sendError.message)

            await notify({
                userId: selected.userId,
                title: 'New message',
                message: text,
                notificationType: 'message',
            })

            setMessages((prev) => [...prev, data])
            setReply('')
        } catch (err) {
            console.error('SEND MESSAGE ERROR:', err)
            notifyError(err.message || 'Failed to send message.')
        } finally {
            setSending(false)
        }
    }

    // Unsend for everyone: the registrar staff see "... deleted a message".
    const deleteMessage = async (m) => {
        const confirmed = await confirmModal(
            'Delete this message for everyone? The registrar staff will see that you deleted a message instead.',
            { title: 'Delete message?', confirmButtonText: 'Delete', icon: 'warning' }
        )
        if (!confirmed) return

        try {
            setBusy(true)
            await deleteOwnMessage(m.message_id)
            setMessages((prev) => markSendDeleted(prev, m, userId))
        } catch (err) {
            console.error('DELETE MESSAGE ERROR:', err)
            notifyError(err.message || 'Failed to delete message.')
        } finally {
            setBusy(false)
        }
    }

    // Returns false on failure so the bubble stays in edit mode.
    const editMessage = async (m, newText) => {
        try {
            await editOwnMessage(m.message_id, newText)
            const edited_at = new Date().toISOString()
            setMessages((prev) => prev.map((x) => (isSameSend(x, m) ? { ...x, message: newText, edited_at } : x)))
            return true
        } catch (err) {
            console.error('EDIT MESSAGE ERROR:', err)
            notifyError(err.message || 'Failed to edit message.')
            return false
        }
    }

    const formatTime = (value) =>
        new Date(value).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

    return (
        <div>
            <div className="student-page-header">
                <h1>Messages</h1>
                <p>Chat with the registrar staff handling your requests. Each person has their own conversation.</p>
            </div>

            {error && <div className="student-error-box">{error}</div>}

            {loading ? (
                <SkeletonList count={3} />
            ) : contacts.length === 0 ? (
                <div className="student-empty">
                    No registrar employee is assigned to your requests or program yet. Please check back later or visit
                    the Registrar's Office directly.
                </div>
            ) : (
                <div className="sm-layout">
                    <aside className="student-card sm-contacts" aria-label="Conversations">
                        <span className="sm-contacts-label">Conversations</span>
                        <ul>
                            {contacts.map((c) => {
                                const convo = messages.filter((m) => threadFor(m) === c.userId)
                                const last = convo[convo.length - 1]
                                const unread = unreadReceived(convo, userId).length
                                const active = c.userId === selectedUserId

                                return (
                                    <li key={c.userId}>
                                        <button
                                            type="button"
                                            className={`sm-contact${active ? ' is-active' : ''}`}
                                            onClick={() => selectContact(c)}
                                            aria-current={active ? 'true' : undefined}
                                        >
                                            <span className="sm-avatar" aria-hidden="true">{initialsOf(c.name)}</span>
                                            <span className="sm-contact-main">
                                                <span className="sm-contact-top">
                                                    <strong>{c.name}</strong>
                                                    {unread > 0 && <span className="sm-unread">{unread}</span>}
                                                </span>
                                                <span className="sm-contact-sub">
                                                    {c.requests.length ? `Handles ${c.requests.join(', ')}` : c.subtitle}
                                                </span>
                                                <span className="sm-contact-preview">
                                                    {last
                                                        ? `${last.sender_user_id === userId ? 'You: ' : ''}${last.deleted_at ? 'Message deleted' : last.message}`
                                                        : 'No messages yet'}
                                                </span>
                                            </span>
                                        </button>
                                    </li>
                                )
                            })}
                        </ul>
                    </aside>

                    {selected && (
                        <section className="student-card sm-thread" aria-label={`Conversation with ${selected.name}`}>
                            <header className="sm-thread-head">
                                <span className="sm-avatar is-large" aria-hidden="true">{initialsOf(selected.name)}</span>
                                <div>
                                    <h2>{selected.name}</h2>
                                    <p>
                                        {selected.subtitle}
                                        {selected.requests.length > 0 && ` · ${selected.handlesActive ? 'Handling' : 'Handled'} ${selected.requests.join(', ')}`}
                                    </p>
                                </div>
                                {unreadInThread.length > 0 && (
                                    <button className="student-link-button sm-mark-read" onClick={markThreadRead}>
                                        Mark as read
                                    </button>
                                )}
                            </header>

                            <div className="sm-messages">
                                {thread.length === 0 ? (
                                    <p className="sm-empty">
                                        No messages with {selected.name} yet. Send a message below to start the conversation.
                                    </p>
                                ) : (
                                    thread.map((m) => {
                                        const isSelf = m.sender_user_id === userId
                                        const senderLabel = isSelf
                                            ? null
                                            : m.sender_user_id === selected.userId
                                                ? selected.name
                                                : labels[m.sender_user_id] || REGISTRAR_LABEL

                                        return (
                                            <MessageBubble
                                                key={m.message_id}
                                                isSelf={isSelf}
                                                senderLabel={senderLabel}
                                                badge={m.receiver_user_id === userId && !m.is_read && (
                                                    <span className="student-status-pill status-pending">New</span>
                                                )}
                                                text={m.message}
                                                time={formatTime(m.created_at)}
                                                edited={!!m.edited_at}
                                                deletedNote={m.deleted_at
                                                    ? ((m.deleted_by || m.sender_user_id) === userId ? 'You deleted a message' : `${senderLabel || REGISTRAR_LABEL} deleted a message`)
                                                    : null}
                                                onEdit={isSelf ? (text) => editMessage(m, text) : undefined}
                                                onDelete={isSelf ? () => deleteMessage(m) : undefined}
                                                disabled={busy}
                                            />
                                        )
                                    })
                                )}
                            </div>

                            <div className="sm-composer">
                                <input
                                    className="student-search-input"
                                    value={reply}
                                    onChange={(e) => setReply(e.target.value)}
                                    placeholder={thread.length === 0 ? DEFAULT_MESSAGE : `Message ${selected.name}…`}
                                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                                    disabled={sending}
                                    aria-label={`Message ${selected.name}`}
                                />
                                <button
                                    className="auth-submit"
                                    style={{ width: 'auto', padding: '11px 20px' }}
                                    onClick={sendMessage}
                                    disabled={sending || (!reply.trim() && thread.length > 0)}
                                >
                                    {sending ? 'Sending...' : 'Send'}
                                </button>
                            </div>
                        </section>
                    )}
                </div>
            )}
        </div>
    )
}

export default Messages
