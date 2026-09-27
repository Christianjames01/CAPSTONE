import { useEffect, useState } from 'react'
import { IconMessage } from '../employee/icons'
import { supabase } from '../../lib/supabase'
import { notifyError, notifySuccess, confirmModal } from '../../lib/notify'
import { buildSenderLabels } from '../../lib/messageSenderLabel'
import { markMessagesRead, unreadReceived, withRead } from '../../lib/markMessagesRead'
import { SkeletonList } from '../../components/Skeleton'
import Modal from '../../components/Modal'
import MessageBubble from '../../components/MessageBubble'
import { ChatApp, ChatSidebar, ChatListItem, ChatListEmpty, ChatPane, ChatHeader, ChatMessages, ChatComposer, ChatPlaceholder, ChatAvatar } from '../../components/ChatApp'
import { chatListTime, chatBubbleTime } from '../../lib/chatTime'
import { loadHiddenMessageIds, hideMessagesForMe, editOwnMessage, deleteOwnMessage, markSendDeleted, siblingMessageIds, isSameSend, refOf, stripRef } from '../../lib/messageActions'
import './AdminPages.css'
import { useLiveRefresh } from '../../lib/useLiveRefresh'
import { useTyping } from '../../lib/useTyping'

// Same contact block already shown to students on the Help & Support page
// -- reused here so the head doesn't have to retype the office's number,
// email, and address every time they open a new conversation.
const TEMPLATE_MESSAGE = `Hi! This is the HCDC Registrar's Office (ORRM). You can reach us at (082) 221-9071 to 79 loc. 116 or 167, or email registrar@hcdc.edu.ph. Our office is at Sta. Ana Avenue corner C. De Guzman Street, Brgy. 14-B, Davao City. How can we help you today?`

function Messages() {
    const [currentUserId, setCurrentUserId] = useState(null)
    const [senderNames, setSenderNames] = useState({})
    const [threads, setThreads] = useState([])
    // Every row loaded, including the hidden [[ref=]] routing copies, so a
    // delete can also hide those siblings (see hideRows).
    const [rawMessages, setRawMessages] = useState([])
    const [deletingKey, setDeletingKey] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    // The open conversation is read from `threads` on every render (so live
    // messages show up in it); a brand-new conversation that has no
    // messages yet lives in draftThread until the first one is sent.
    const [activeKey, setActiveKey] = useState(null)
    const [draftThread, setDraftThread] = useState(null)

    const [reply, setReply] = useState('')
    const [threadSearch, setThreadSearch] = useState('')
    const [threadFilter, setThreadFilter] = useState('all')
    const [sending, setSending] = useState(false)

    const [showNewMessage, setShowNewMessage] = useState(false)
    const [studentQuery, setStudentQuery] = useState('')
    const [studentResults, setStudentResults] = useState([])
    const [searchingStudents, setSearchingStudents] = useState(false)

    useLiveRefresh(['messages'], (options) => loadMessages(options))
    const { typingUserIds, sendTyping } = useTyping(currentUserId)

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

            setCurrentUserId(user.id)

            const { data, error: messagesError } = await supabase
                .from('messages')
                .select('*')
                .order('created_at', { ascending: true })

            if (messagesError) {
                throw new Error('Failed to load messages: ' + messagesError.message)
            }

            // Messages this user deleted "for me".
            const hiddenIds = await loadHiddenMessageIds(user.id)
            const visible = (data || []).filter((m) => !hiddenIds.has(m.message_id))

            setRawMessages(visible)

            const userIds = [
                ...new Set(visible.flatMap((m) => [m.sender_user_id, m.receiver_user_id]))
            ]

            const { data: profiles } = userIds.length
                ? await supabase.from('profiles').select('user_id, first_name, last_name, role, profile_photo_url').in('user_id', userIds)
                : { data: [] }

            const profileByUserId = Object.fromEntries((profiles || []).map((p) => [p.user_id, p]))
            const labels = await buildSenderLabels(userIds)

            const nameFor = (userId) => labels[userId] || 'Unknown'

            const roleFor = (userId) => profileByUserId[userId]?.role || ''

            // A reply into a student-employee conversation is saved as one
            // row per recipient, each tagged [[ref=]] (see sendReply). Show
            // the student's copy (tag removed) and drop the employee's, so
            // the message appears once. Older replies only tagged the
            // employee's copy.
            const rows = visible
                .filter((m) => !refOf(m.message) || roleFor(m.receiver_user_id) === 'student')
                .map((m) => (refOf(m.message) ? { ...m, message: stripRef(m.message) } : m))

            // Rows saved in the same send (same sender and moment) but to
            // someone else -- how a fanned-out reply is recognised.
            const otherReceiversOf = (m) => visible
                .filter((x) => x.sender_user_id === m.sender_user_id && x.created_at === m.created_at && x.receiver_user_id !== m.receiver_user_id)
                .map((x) => x.receiver_user_id)

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
            // 1:1), so a fresh reload regroups it into its own
            // "head <-> student" / "head <-> employee" pairs. Fold only those
            // fanned-out copies back into the conversation they were sent
            // in. A direct message between the head and a student (or a
            // student's reply to it) has no sibling and stays in its own
            // head <-> student conversation.
            {
                for (const [key, group] of Object.entries(grouped)) {
                    const isHeadGroup = group.participantA === user.id || group.participantB === user.id
                    if (!isHeadGroup) continue

                    const otherId = group.participantA === user.id ? group.participantB : group.participantA

                    // Every non-head conversation this person is part of (an
                    // employee can be talking with several students).
                    const candidates = Object.values(grouped).filter((g) =>
                        g.pairKey !== key &&
                        g.participantA !== user.id && g.participantB !== user.id &&
                        (g.participantA === otherId || g.participantB === otherId)
                    )

                    if (candidates.length === 0) continue

                    const signatureOf = (m) => `${m.sender_user_id}|${m.message}|${m.created_at}`
                    const touched = new Set()
                    const moved = new Set()

                    for (const m of group.messages) {
                        const signature = signatureOf(m)

                        // A fanned-out copy belongs in whichever conversation
                        // already holds its sibling (same sender, text, time).
                        const sibling = candidates
                            .map((g) => ({ g, index: g.messages.findIndex((x) => signatureOf(x) === signature) }))
                            .find((c) => c.index !== -1)

                        if (sibling) {
                            // Show it once, but keep the head's own copy so its
                            // unread status counts and "Mark as read" can clear it.
                            if (m.receiver_user_id === user.id) sibling.g.messages[sibling.index] = m
                            moved.add(m.message_id)
                            continue
                        }

                        // The head's own fanned-out reply: its other copy went
                        // to the other person of the conversation it belongs in.
                        const others = m.sender_user_id === user.id ? otherReceiversOf(m) : []
                        const target = others
                            .map((id) => grouped[[otherId, id].sort().join('|')])
                            .find((g) => g && g.pairKey !== key)

                        if (target) {
                            target.messages.push(m)
                            touched.add(target)
                            moved.add(m.message_id)
                        }
                    }

                    for (const g of touched) g.messages.sort((a, b) => a.created_at.localeCompare(b.created_at))

                    // Whatever is left is a direct conversation with the head.
                    group.messages = group.messages.filter((m) => !moved.has(m.message_id))
                    if (group.messages.length === 0) delete grouped[key]
                }
            }

            const threadList = Object.values(grouped)
                .map((t) => ({
                    ...t,
                    nameA: nameFor(t.participantA),
                    roleA: roleFor(t.participantA),
                    photoA: profileByUserId[t.participantA]?.profile_photo_url || '',
                    nameB: nameFor(t.participantB),
                    roleB: roleFor(t.participantB),
                    photoB: profileByUserId[t.participantB]?.profile_photo_url || '',
                }))
                .sort((a, b) => {
                    const aLast = a.messages[a.messages.length - 1]?.created_at || ''
                    const bLast = b.messages[b.messages.length - 1]?.created_at || ''
                    return bLast.localeCompare(aLast)
                })

            setThreads(threadList)
            setSenderNames(labels)

        } catch (err) {
            console.error('ADMIN MESSAGES ERROR:', err)
            setError(err.message || 'Failed to load messages.')
        } finally {
            setLoading(false)
        }
    }

    // Only messages sent to the head count as unread here -- oversight
    // threads between a student and an employee belong to them.
    const unreadCountFor = (thread) => unreadReceived(thread.messages, currentUserId).length

    const totalUnread = threads.reduce((sum, t) => sum + unreadCountFor(t), 0)

    // Marks every unread message the head received in the given threads
    // as read, in the database and in page state, and refreshes the badge.
    const markThreadsRead = async (targetThreads) => {
        const ids = targetThreads.flatMap((t) => unreadReceived(t.messages, currentUserId).map((m) => m.message_id))
        if (ids.length === 0) return

        try {
            await markMessagesRead(ids)
            const targetKeys = new Set(targetThreads.map((t) => t.pairKey))
            setThreads((prev) =>
                prev.map((t) => (targetKeys.has(t.pairKey) ? { ...t, messages: withRead(t.messages, ids) } : t))
            )
        } catch (err) {
            notifyError(err.message)
        }
    }

    const activeThread = threads.find((t) => t.pairKey === activeKey)
        || (draftThread?.pairKey === activeKey ? draftThread : null)

    const openThread = (thread) => {
        setActiveKey(thread.pairKey)
        setReply('')
    }

    const closeThread = () => {
        setActiveKey(null)
        setReply('')
    }

    // Opening a conversation, or a message arriving while it's open, marks
    // what was sent to the head as read -- like Messenger.
    const activeUnread = activeThread ? unreadCountFor(activeThread) : 0
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (activeThread && activeUnread > 0) markThreadsRead([activeThread])
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeKey, activeUnread])

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

        if (!existing) {
            setDraftThread({
                pairKey,
                participantA: currentUserId,
                participantB: userId,
                nameA: 'HCDC-Registrar',
                roleA: 'admin',
                nameB: name,
                roleB: role,
                messages: [],
            })
        }

        setActiveKey(pairKey)
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

            // Replying into a student-employee conversation: tag each copy
            // with the other person, so both of their pages file it in this
            // conversation (the student's page would otherwise treat a head
            // message as a direct one).
            const staffRecipient = recipients.find((r) => r.role !== 'student')
            const rows = recipients.map((r) => {
                const fannedOut = recipients.length > 1 && studentRecipient
                const tagFor = !fannedOut ? null : r.id !== studentRecipient.id ? studentRecipient.id : staffRecipient?.id
                return {
                    sender_user_id: currentUserId,
                    receiver_user_id: r.id,
                    message: tagFor ? `[[ref=${tagFor}]]${reply.trim()}` : reply.trim(),
                    is_read: false,
                }
            })

            const { data, error: sendError } = await supabase
                .from('messages')
                .insert(rows)
                .select()

            if (sendError) throw new Error(sendError.message)

            setRawMessages((prev) => [...prev, ...data])

            // Delivered as one row per recipient under the hood, but shown
            // as a single bubble here -- it's one message from the head's
            // point of view, not several. Show the untagged copy.
            const shown = data.find((d) => d.receiver_user_id === studentRecipient?.id) || data[0]
            const displayRow = { ...shown, message: stripRef(shown.message) }
            const updatedThread = { ...activeThread, messages: [...activeThread.messages, displayRow] }

            setThreads((prev) => {
                const exists = prev.some((t) => t.pairKey === updatedThread.pairKey)
                return exists
                    ? prev.map((t) => (t.pairKey === updatedThread.pairKey ? updatedThread : t))
                    : [updatedThread, ...prev]
            })

            setReply('')
            sendTyping(recipients.map((r) => r.id), false)

        } catch (err) {
            console.error('SEND MESSAGE ERROR:', err)
            notifyError(err.message || 'Failed to send message.')
        } finally {
            setSending(false)
        }
    }

    // "Delete for me": hides every stored copy of the message(s) for this
    // user only; the other people in the conversation keep theirs.
    const hideRows = async (msgs) => {
        const ids = siblingMessageIds(msgs, rawMessages)
        await hideMessagesForMe(currentUserId, ids)
        const hidden = new Set(ids)
        setRawMessages((prev) => prev.filter((m) => !hidden.has(m.message_id)))
        return hidden
    }

    // Unsend for everyone: all participants see "... deleted a message".
    const deleteMessage = async (m) => {
        const confirmed = await confirmModal(
            'Delete this message for everyone? Everyone in the conversation will see "HCDC-Registrar deleted a message" instead.',
            { title: 'Delete message?', confirmButtonText: 'Delete', icon: 'warning' }
        )
        if (!confirmed) return

        try {
            setDeletingKey(m.message_id)
            await deleteOwnMessage(m.message_id)

            const updatedThread = { ...activeThread, messages: markSendDeleted(activeThread.messages, m, currentUserId) }
            setThreads((prev) => prev.map((t) => (t.pairKey === updatedThread.pairKey ? updatedThread : t)))
            setRawMessages((prev) => markSendDeleted(prev, m, currentUserId))
        } catch (err) {
            console.error('DELETE MESSAGE ERROR:', err)
            notifyError(err.message || 'Failed to delete message.')
        } finally {
            setDeletingKey(null)
        }
    }

    // Only offered on the head's own messages (see MessageBubble). Returns
    // false on failure so the bubble stays in edit mode.
    const editMessage = async (m, newText) => {
        try {
            await editOwnMessage(m.message_id, newText)
            const edited_at = new Date().toISOString()
            const apply = (list) => list.map((x) => (isSameSend(x, m) ? { ...x, message: newText, edited_at } : x))

            const updatedThread = { ...activeThread, messages: apply(activeThread.messages) }
            setThreads((prev) => prev.map((t) => (t.pairKey === updatedThread.pairKey ? updatedThread : t)))
            setRawMessages((prev) => prev.map((x) => (isSameSend(x, m) && !x.message.startsWith('[[ref=') ? { ...x, message: newText, edited_at } : x)))
            return true
        } catch (err) {
            console.error('EDIT MESSAGE ERROR:', err)
            notifyError(err.message || 'Failed to edit message.')
            return false
        }
    }

    // Used from both the conversation list and the open conversation.
    // New messages sent into the conversation later will bring it back.
    const deleteConversation = async (thread) => {
        const count = thread.messages.length
        const confirmed = await confirmModal(
            `Delete the conversation "${thread.nameA} ↔ ${thread.nameB}" (${count} message${count === 1 ? '' : 's'}) for you? It will be removed from your Messages only; the others in it will still see it.`,
            { title: 'Delete conversation?', confirmButtonText: 'Delete for me', icon: 'warning' }
        )
        if (!confirmed) return

        try {
            setDeletingKey(`thread:${thread.pairKey}`)
            await hideRows(thread.messages)

            setThreads((prev) => prev.filter((t) => t.pairKey !== thread.pairKey))

            if (activeKey === thread.pairKey) closeThread()
            notifySuccess('Conversation deleted from your Messages.')
        } catch (err) {
            console.error('DELETE CONVERSATION ERROR:', err)
            notifyError(err.message || 'Failed to delete conversation.')
        } finally {
            setDeletingKey(null)
        }
    }

    // A merged thread can include messages from someone who isn't either
    // of the original two participants (e.g. the head folded into a
    // student<->employee conversation), so this has to resolve any
    // sender's real name rather than just matching against A/B.
    // senderNames only knows about senders from messages that already
    // existed at page load -- the head's own very first message ever
    // (e.g. right after starting a brand-new "+ New Message" thread)
    // wouldn't be in it yet, so resolve "self" directly instead of
    // depending on that lookup for the one sender we always know for sure.
    const nameForSender = (senderId) =>
        senderId === currentUserId ? 'HCDC-Registrar' : (senderNames[senderId] || 'Unknown')

    // "You deleted a message" / "Yul deleted a message", or null.
    const deletedLabel = (m) => {
        if (!m?.deleted_at) return null
        const by = m.deleted_by || m.sender_user_id
        return by === currentUserId ? 'You deleted a message' : `${nameForSender(by)} deleted a message`
    }

    const roleLabel = (role) => (role === 'student' ? 'Student' : role === 'employee' ? 'Employee' : role ? 'Registrar' : '')

    const unreadThreads = threads.filter((t) => unreadCountFor(t) > 0)
    const myThreads = threads.filter((t) => isMyThread(t))

    const threadQuery = threadSearch.trim().toLowerCase()
    const visibleThreads = (threadFilter === 'unread' ? unreadThreads : threadFilter === 'mine' ? myThreads : threads)
        .filter((t) => !threadQuery || `${t.nameA} ${t.nameB}`.toLowerCase().includes(threadQuery))

    // In the head's own conversations, show the other person; in oversight
    // conversations, show both people.
    const peopleOf = (thread) => {
        const a = { id: thread.participantA, name: thread.nameA, photo: thread.photoA }
        const b = { id: thread.participantB, name: thread.nameB, photo: thread.photoB }
        if (thread.participantA === currentUserId) return [b]
        if (thread.participantB === currentUserId) return [a]
        return [a, b]
    }
    const titleOf = (thread) => peopleOf(thread).map((p) => p.name).join(' & ')
    const subtitleOf = (thread) => {
        const people = peopleOf(thread)
        if (people.length === 1) {
            const role = people[0].id === thread.participantA ? thread.roleA : thread.roleB
            return roleLabel(role)
        }
        return `${roleLabel(thread.roleA)} & ${roleLabel(thread.roleB)} · replying reaches both`
    }

    const previewOf = (m) => {
        if (!m) return 'No messages yet'
        if (m.deleted_at) return deletedLabel(m)
        return `${m.sender_user_id === currentUserId ? 'You' : nameForSender(m.sender_user_id).split(' ')[0]}: ${m.message}`
    }

    const typersIn = (thread) =>
        [thread.participantA, thread.participantB].filter((id) => id !== currentUserId && typingUserIds.includes(id))
    const activeTypers = activeThread ? typersIn(activeThread) : []

    const photoOf = (userId) => (activeThread?.participantA === userId ? activeThread.photoA : activeThread?.participantB === userId ? activeThread.photoB : '')

    return (
        <div>
            {error && <div className="admin-error-box">{error}</div>}

            {loading ? (
                <SkeletonList count={4} />
            ) : (
                <ChatApp chatOpen={!!activeThread}>
                    <ChatSidebar
                        title="Messages"
                        subtitle="Your conversations, and every student–staff conversation for oversight."
                        actions={
                            <>
                                {totalUnread > 0 && (
                                    <button type="button" className="chat-icon-button" onClick={() => markThreadsRead(threads)} title="Mark all as read" aria-label="Mark all as read">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12.5l4.5 4.5L15 8.5M9.5 16.5l1 1L22 6" /></svg>
                                    </button>
                                )}
                                <button type="button" className="chat-icon-button" onClick={openStudentPicker} title="New message" aria-label="New message">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                                </button>
                            </>
                        }
                        toolbar={
                            <>
                                <input
                                    className="chat-search"
                                    type="search"
                                    value={threadSearch}
                                    onChange={(e) => setThreadSearch(e.target.value)}
                                    placeholder="Search Messages"
                                    aria-label="Search conversations by name"
                                />
                                <div className="chat-tabs">
                                    {[
                                        { key: 'all', label: 'All', count: threads.length },
                                        { key: 'unread', label: 'Unread', count: unreadThreads.length },
                                        { key: 'mine', label: 'Yours', count: myThreads.length },
                                    ].map((tab) => (
                                        <button
                                            key={tab.key}
                                            type="button"
                                            className={`chat-tab${threadFilter === tab.key ? ' is-active' : ''}`}
                                            onClick={() => setThreadFilter(tab.key)}
                                        >
                                            {tab.label}<span>{tab.count}</span>
                                        </button>
                                    ))}
                                </div>
                            </>
                        }
                    >
                        {threads.length === 0 ? (
                            <ChatListEmpty>No conversations yet. Start one with the pencil button.</ChatListEmpty>
                        ) : visibleThreads.length === 0 ? (
                            <ChatListEmpty>No conversations match.</ChatListEmpty>
                        ) : (
                            visibleThreads.map((thread) => {
                                const last = thread.messages[thread.messages.length - 1]
                                return (
                                    <ChatListItem
                                        key={thread.pairKey}
                                        active={thread.pairKey === activeKey}
                                        unread={unreadCountFor(thread)}
                                        people={peopleOf(thread)}
                                        name={titleOf(thread)}
                                        meta={isMyThread(thread) ? null : 'Oversight'}
                                        preview={previewOf(last)}
                                        time={last ? chatListTime(last.created_at) : ''}
                                        typing={typersIn(thread).length > 0}
                                        onClick={() => openThread(thread)}
                                    />
                                )
                            })
                        )}
                    </ChatSidebar>

                    <ChatPane label={activeThread ? `Conversation: ${titleOf(activeThread)}` : 'Conversation'}>
                        {!activeThread ? (
                            <ChatPlaceholder title="Your messages" text="Pick a conversation, or start a new one with a student." />
                        ) : (
                            <>
                                <ChatHeader
                                    onBack={closeThread}
                                    people={peopleOf(activeThread)}
                                    title={titleOf(activeThread)}
                                    subtitle={subtitleOf(activeThread)}
                                    typing={activeTypers.length > 0 && `${nameForSender(activeTypers[0])} is typing…`}
                                    actions={activeThread.messages.length > 0 && (
                                        <button
                                            type="button"
                                            className="chat-icon-button is-danger"
                                            onClick={() => deleteConversation(activeThread)}
                                            disabled={deletingKey !== null}
                                            title="Delete conversation for you"
                                            aria-label="Delete conversation for you"
                                        >
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 12.5h9l1-12.5" /></svg>
                                        </button>
                                    )}
                                />

                                <ChatMessages
                                    messages={activeThread.messages}
                                    threadKey={activeThread.pairKey}
                                    typing={activeTypers.length > 0 && {
                                        people: [{ name: nameForSender(activeTypers[0]), photo: photoOf(activeTypers[0]) }],
                                        label: `${nameForSender(activeTypers[0])} is typing`,
                                    }}
                                    empty="No messages yet — say hello below."
                                    renderMessage={(m, { groupStart, groupEnd }) => {
                                        const isSelf = m.sender_user_id === currentUserId
                                        const senderName = nameForSender(m.sender_user_id)

                                        return (
                                            <MessageBubble
                                                key={m.message_id}
                                                isSelf={isSelf}
                                                senderLabel={groupStart && (isSelf ? !isMyThread(activeThread) : peopleOf(activeThread).length > 1) ? senderName : null}
                                                avatar={isSelf ? undefined : (
                                                    <ChatAvatar people={[{ name: senderName, photo: photoOf(m.sender_user_id) }]} size={28} />
                                                )}
                                                groupStart={groupStart}
                                                groupEnd={groupEnd}
                                                text={m.message}
                                                time={groupEnd ? chatBubbleTime(m.created_at) : null}
                                                edited={!!m.edited_at}
                                                deletedNote={deletedLabel(m)}
                                                onEdit={isSelf ? (text) => editMessage(m, text) : undefined}
                                                onDelete={isSelf ? () => deleteMessage(m) : undefined}
                                                disabled={deletingKey !== null}
                                            />
                                        )
                                    }}
                                />

                                <ChatComposer
                                    value={reply}
                                    onChange={(value) => {
                                        setReply(value)
                                        sendTyping(otherParticipants(activeThread).map((p) => p.id), !!value.trim())
                                    }}
                                    onSend={sendReply}
                                    sending={sending}
                                    canSend={!!reply.trim()}
                                    placeholder={isMyThread(activeThread) ? `Message ${titleOf(activeThread)}…` : 'Message both of them…'}
                                    above={!reply && (
                                        <div className="chat-composer-extra">
                                            <button type="button" className="chat-pill-button" onClick={() => setReply(TEMPLATE_MESSAGE)}>
                                                Use registrar contact template
                                            </button>
                                        </div>
                                    )}
                                />
                            </>
                        )}
                    </ChatPane>
                </ChatApp>
            )}

            {showNewMessage && (
                <Modal title="New Message" subtitle="Find a student to start a conversation." icon={IconMessage} maxWidth={480} onClose={() => setShowNewMessage(false)}>
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
