import { supabase } from './supabase'

// Shared by the student, employee, and admin Messages pages.
//
// Delete is "delete for me": it records the hide in message_hidden and the
// other people in the conversation keep their copy. Edit goes through the
// edit_my_message() RPC, which only lets the sender change their own text.

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

// For the admin oversight view: which *other* people deleted each message
// for themselves. Returns a Map from "sender|created_at" (so all copies of
// one message count together) to the user ids who deleted it. Only the
// registrar head can read other people's message_hidden rows; for anyone
// else, or if the table isn't there yet, this is just empty.
export async function loadDeletionsByOthers(currentUserId, allRows) {
    const { data, error } = await supabase
        .from('message_hidden')
        .select('user_id, message_id')
        .neq('user_id', currentUserId)

    if (error) {
        console.warn('LOAD MESSAGE DELETIONS ERROR:', error)
        return new Map()
    }

    const keyById = new Map(allRows.map((r) => [r.message_id, `${r.sender_user_id}|${r.created_at}`]))
    const deleters = new Map()

    for (const h of data || []) {
        const key = keyById.get(h.message_id)
        if (!key) continue
        if (!deleters.has(key)) deleters.set(key, new Set())
        deleters.get(key).add(h.user_id)
    }

    return deleters
}

// True when `m` is one of the rows edited in place with the same
// sender + created_at as `edited`.
export function isSameSend(m, edited) {
    return m.sender_user_id === edited.sender_user_id && m.created_at === edited.created_at
}
