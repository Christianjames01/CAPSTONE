import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { findAssignedEmployee } from '../../lib/assignEmployee'
import { notify, notifyError, confirmModal } from '../../lib/notify'
import { buildSenderLabels, REGISTRAR_LABEL } from '../../lib/messageSenderLabel'
import { markMessagesRead, unreadReceived, withRead } from '../../lib/markMessagesRead'
import { SkeletonList } from '../../components/Skeleton'
import MessageBubble from '../../components/MessageBubble'
import { ChatApp, ChatSidebar, ChatListItem, ChatPane, ChatHeader, ChatMessages, ChatComposer, ChatPlaceholder, ChatAvatar } from '../../components/ChatApp'
import { chatListTime, chatBubbleTime } from '../../lib/chatTime'
import { loadHiddenMessageIds, editOwnMessage, deleteOwnMessage, markSendDeleted, isSameSend, refOf, stripRef } from '../../lib/messageActions'
import '../auth/Auth.css'
import './StudentPages.css'
import { useLiveRefresh } from '../../lib/useLiveRefresh'
import { useTyping } from '../../lib/useTyping'

const DEFAULT_MESSAGE =
    "Hi, I'd like to ask about my document request. Please let me know if you need anything " +
    "from me — I'll check back here for your reply. Thank you!"

const CLOSED_STATUSES = ['completed', 'cancelled', 'rejected']

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
    // Phones show the list first; the chat opens full screen when a
    // conversation is picked (or requested via ?employee=).
    const [chatOpen, setChatOpen] = useState(!!requestedEmployeeId)

    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')

    useLiveRefresh(['messages'], (options) => loadMessages(options))
    const { typingUserIds, sendTyping } = useTyping(userId)

    useEffect(() => {
        loadMessages()
    }, [])

    const loadMessages = async ({ silent = false } = {}) => {
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
            // [[ref=<employee>]] marks a Registrar Head reply sent into the
            // conversation with that employee; the tag itself is never shown.
            const rows = (messageRows || [])
                .filter((m) => !hiddenIds.has(m.message_id))
                .map((m) => {
                    const ref = refOf(m.message)
                    return ref ? { ...m, message: stripRef(m.message), refUserId: ref } : m
                })

            const employeeUserIds = (employeeRows || []).map((e) => e.user_id)
            const otherUserIds = [...new Set([...employeeUserIds, ...rows.map((m) => otherParty(m, user.id))])].filter(Boolean)
            const labels = await buildSenderLabels(otherUserIds)

            // Which conversation each message belongs in. Messages with an
            // employee go in that employee's conversation, and so do Registrar
            // Head replies sent into it (tagged with that employee, see
            // admin/Messages sendReply). Any other message from the head is a
            // direct one and gets its own conversation.
            const employeeUserSet = new Set(employeeUserIds)
            const assigned = {}
            for (const m of rows) {
                const other = otherParty(m, user.id)
                assigned[m.message_id] = !employeeUserSet.has(other) && m.refUserId && employeeUserSet.has(m.refUserId)
                    ? m.refUserId
                    : other
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

            // Other registrar staff with a direct conversation (e.g. the
            // Registrar Head messaging the student) get their own entry.
            for (const uid of new Set(Object.values(assigned))) {
                if (!uid || list.some((c) => c.userId === uid)) continue
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


            setContacts(list)
            setMessages(rows)
            setThreadOf(assigned)
            setLabels(labels)

            if (!silent) setSelectedUserId((current) => {
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
        setChatOpen(true)
        setReply('')
        if (contact.employeeId) setSearchParams({ employee: contact.employeeId }, { replace: true })
        else setSearchParams({}, { replace: true })
    }

    const markThreadRead = async () => {
        const ids = unreadInThread.map((m) => m.message_id)
        if (ids.length === 0) return
        try {
            await markMessagesRead(ids)
            setMessages((prev) => withRead(prev, ids))
        } catch (err) {
            notifyError(err.message)
        }
    }

    // An open conversation reads its messages as they arrive, like
    // Messenger. On phones that's only once the chat is actually open.
    const threadVisible = !!selected && (chatOpen || !window.matchMedia('(max-width: 880px)').matches)
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (threadVisible && unreadInThread.length > 0) markThreadRead()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [threadVisible, selectedUserId, unreadInThread.length])

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
            sendTyping([selected.userId], false)
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

    const threadOfContact = (c) => messages.filter((m) => threadFor(m) === c.userId)

    // The staff member, or other registrar staff who wrote in this
    // conversation (e.g. the head), typing right now.
    const typersIn = (c) => {
        const senders = new Set([c.userId, ...threadOfContact(c).map((m) => m.sender_user_id)])
        return typingUserIds.filter((id) => id !== userId && senders.has(id))
    }
    const activeTypers = selected ? typersIn(selected) : []
    const typerName = (id) => (id === selected?.userId ? selected.name : labels[id] || REGISTRAR_LABEL)

    const previewOf = (m) => {
        if (!m) return 'Start a conversation'
        if (m.deleted_at) return m.sender_user_id === userId ? 'You deleted a message' : 'Message deleted'
        return `${m.sender_user_id === userId ? 'You: ' : ''}${m.message}`
    }

    return (
        <div>
            {error && <div className="student-error-box">{error}</div>}

            {loading ? (
                <SkeletonList count={3} />
            ) : contacts.length === 0 ? (
                <>
                    <div className="student-page-header">
                        <h1>Messages</h1>
                    </div>
                    <div className="student-empty">
                        No registrar employee is assigned to your requests or program yet. Please check back later or visit
                        the Registrar's Office directly.
                    </div>
                </>
            ) : (
                <ChatApp chatOpen={chatOpen && !!selected}>
                    <ChatSidebar title="Messages" subtitle="Chat with the registrar staff handling your requests.">
                        {contacts.map((c) => {
                            const convo = threadOfContact(c)
                            const last = convo[convo.length - 1]

                            return (
                                <ChatListItem
                                    key={c.userId}
                                    active={c.userId === selectedUserId}
                                    unread={unreadReceived(convo, userId).length}
                                    people={[{ name: c.name }]}
                                    name={c.name}
                                    meta={c.requests.length ? `Handles ${c.requests.join(', ')}` : c.subtitle}
                                    preview={previewOf(last)}
                                    time={last ? chatListTime(last.created_at) : ''}
                                    typing={typersIn(c).length > 0}
                                    onClick={() => selectContact(c)}
                                />
                            )
                        })}
                    </ChatSidebar>

                    <ChatPane label={selected ? `Conversation with ${selected.name}` : 'Conversation'}>
                        {!selected ? (
                            <ChatPlaceholder title="Your messages" text="Pick a registrar staff member to chat with." />
                        ) : (
                            <>
                                <ChatHeader
                                    onBack={() => setChatOpen(false)}
                                    people={[{ name: selected.name }]}
                                    title={selected.name}
                                    subtitle={[
                                        selected.subtitle,
                                        selected.requests.length > 0 && `${selected.handlesActive ? 'Handling' : 'Handled'} ${selected.requests.join(', ')}`,
                                    ].filter(Boolean).join(' · ')}
                                    typing={activeTypers.length > 0 && `${typerName(activeTypers[0])} is typing…`}
                                />

                                <ChatMessages
                                    messages={thread}
                                    threadKey={selected.userId}
                                    typing={activeTypers.length > 0 && {
                                        people: [{ name: typerName(activeTypers[0]) }],
                                        label: `${typerName(activeTypers[0])} is typing`,
                                    }}
                                    empty={<>No messages with {selected.name} yet. Say hello — they'll reply here.</>}
                                    renderMessage={(m, { groupStart, groupEnd }) => {
                                        const isSelf = m.sender_user_id === userId
                                        const fromOtherStaff = !isSelf && m.sender_user_id !== selected.userId
                                        const senderLabel = isSelf
                                            ? null
                                            : fromOtherStaff
                                                ? labels[m.sender_user_id] || REGISTRAR_LABEL
                                                : selected.name

                                        return (
                                            <MessageBubble
                                                key={m.message_id}
                                                isSelf={isSelf}
                                                senderLabel={fromOtherStaff && groupStart ? senderLabel : null}
                                                avatar={isSelf ? undefined : <ChatAvatar people={[{ name: senderLabel }]} size={28} />}
                                                groupStart={groupStart}
                                                groupEnd={groupEnd}
                                                text={m.message}
                                                time={groupEnd ? chatBubbleTime(m.created_at) : null}
                                                edited={!!m.edited_at}
                                                deletedNote={m.deleted_at
                                                    ? ((m.deleted_by || m.sender_user_id) === userId ? 'You deleted a message' : `${senderLabel || REGISTRAR_LABEL} deleted a message`)
                                                    : null}
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
                                        sendTyping([selected.userId], !!value.trim())
                                    }}
                                    onSend={sendMessage}
                                    sending={sending}
                                    canSend={!!reply.trim() || thread.length === 0}
                                    placeholder={thread.length === 0 ? 'Say hello, or press send for a quick hello' : `Message ${selected.name}…`}
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
