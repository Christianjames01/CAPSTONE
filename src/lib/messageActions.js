import { supabase } from './supabase'

// Shared by the student, employee, and admin Messages pages.
//
// Deleting a message unsends it for everyone (delete_my_message RPC);
// "delete conversation" on the admin page only hides it for the head
// (message_hidden). Edit goes through edit_my_message(). Both RPCs only let
// the sender act on their own messages.

// Message ids the user has deleted for themselves. If the message_hidden
// table isn't there yet, show everything rather than failing the page.
export async function loadHiddenMessageIds(userId) {
    const { data, error } = await supabase
        .from('message_hidden')
        .select('message_id')
        .eq('user_id', userId)

    if (error) {
        console.warn('LOAD HIDDEN MESSAGES ERROR:', error)
        return new Set()
    }

    return new Set((data || []).map((h) => h.message_id))
}

export async function hideMessagesForMe(userId, messageIds) {
    const { error } = await supabase
        .from('message_hidden')
        .upsert(
            messageIds.map((id) => ({ user_id: userId, message_id: id })),
            { onConflict: 'user_id,message_id', ignoreDuplicates: true }
        )

    if (error) throw new Error('Failed to delete message: ' + error.message)
}

// `replyTo`: keeps a reply a reply after editing.
export async function editOwnMessage(messageId, newText, replyTo = null) {
    const { error } = await supabase.rpc('edit_my_message', {
        p_message_id: String(messageId),
        p_new_text: replyTo ? `[[reply=${replyTo}]]${newText}` : newText,
    })

    if (error) throw new Error(error.message)
}

// One message on screen can be several rows (one per recipient, plus the
// admin's hidden [[ref=]] routing copy), all inserted together by the same
// sender, so they share sender + created_at. Returns every row id among
// `allRows` that belongs to the same on-screen messages as `msgs`.
export function siblingMessageIds(msgs, allRows) {
    const keys = new Set(msgs.map((m) => `${m.sender_user_id}|${m.created_at}`))
    const ids = new Set(msgs.map((m) => m.message_id))
    for (const r of allRows) {
        if (keys.has(`${r.sender_user_id}|${r.created_at}`)) ids.add(r.message_id)
    }
    return [...ids]
}

// Unsend for everyone: only the sender can do it (checked in the RPC).
// Every participant then sees a "<name> deleted a message" placeholder.
export async function deleteOwnMessage(messageId) {
    const { error } = await supabase.rpc('delete_my_message', { p_message_id: String(messageId) })
    if (error) throw new Error(error.message)
}

// Applies an unsend to page state: every copy of the message is marked
// deleted by `userId`.
export function markSendDeleted(list, deletedMsg, userId) {
    const deleted_at = new Date().toISOString()
    return list.map((x) => (isSameSend(x, deletedMsg) ? { ...x, deleted_at, deleted_by: userId } : x))
}

// True when `m` is one of the rows edited in place with the same
// sender + created_at as `edited`.
export function isSameSend(m, edited) {
    return m.sender_user_id === edited.sender_user_id && m.created_at === edited.created_at
}

// Hidden routing tag at the start of a fanned-out copy: [[ref=<user id>]]
// names the other person in the conversation it belongs to (the student on
// the employee's copy, the employee on the student's copy). edit_my_message
// and delete_my_message keep it. Never shown.
const REF_TAG = /^\[\[ref=([0-9a-f-]+)\]\]/

export function refOf(text) {
    return (text || '').match(REF_TAG)?.[1] || null
}

export function stripRef(text) {
    return (text || '').replace(REF_TAG, '')
}


// Messenger-style replies: [[reply=<message id>]] after any [[ref=]] tag
// names the message being answered. edit_my_message keeps whatever text it
// is given, so edits pass the tag back in (see editOwnMessage).
const REPLY_TAG = /^\[\[reply=([0-9a-f-]+)\]\]/

export function withReplyTag(text, replyToId) {
    return replyToId ? `[[reply=${replyToId}]]${text}` : text
}

// A stored message as shown: routing and reply tags removed, with
// `replyTo` (the answered message's id) when it's a reply.
export function readMessage(row) {
    const text = stripRef(row.message)
    const match = text.match(REPLY_TAG)
    return match
        ? { ...row, message: text.slice(match[0].length), replyTo: match[1] }
        : { ...row, message: text, replyTo: row.replyTo || null }
}

// Quote shown above a reply, Messenger style: "You replied to Sar" /
// "Sar replied to you". `byId` holds the conversation's messages.
export function quoteFor(m, { byId, selfId, nameOf, onJump }) {
    if (!m.replyTo) return null
    const original = byId[m.replyTo]
    const senderIsSelf = m.sender_user_id === selfId
    const who = senderIsSelf ? 'You' : (nameOf(m.sender_user_id) || 'Someone').split(' ')[0]

    if (!original) return { label: `${who} replied to a message`, text: 'Original message unavailable' }

    const toSelf = original.sender_user_id === selfId
    const target = toSelf
        ? (senderIsSelf ? 'yourself' : 'you')
        : original.sender_user_id === m.sender_user_id ? 'themself' : (nameOf(original.sender_user_id) || 'someone').split(' ')[0]

    return {
        label: `${who} replied to ${target}`,
        text: original.deleted_at ? 'Message deleted' : original.message,
        onClick: onJump ? () => onJump(original.message_id) : undefined,
    }
}

// Scroll a message into view and flash it (tapping a quote).
export function jumpToMessage(messageId) {
    const el = document.getElementById(`msg-${messageId}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.remove('is-flash')
    void el.offsetWidth
    el.classList.add('is-flash')
}
