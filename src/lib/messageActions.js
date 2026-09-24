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

export async function editOwnMessage(messageId, newText) {
    const { error } = await supabase.rpc('edit_my_message', {
        p_message_id: String(messageId),
        p_new_text: newText,
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
