import { supabase } from './supabase'

export const MESSAGES_UPDATED_EVENT = 'messages-updated'

// Unread messages the given user received, out of a list of message rows.
export function unreadReceived(messages, userId) {
    return (messages || []).filter((m) => m.receiver_user_id === userId && !m.is_read)
}

// Marks the given messages as read and tells the sidebar layouts to
// refresh their unread-message badge. Shared by all three Messages pages.
export async function markMessagesRead(messageIds) {
    if (!messageIds || messageIds.length === 0) return

    const { error } = await supabase
        .from('messages')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .in('message_id', messageIds)

    if (error) throw new Error('Failed to mark messages as read: ' + error.message)

    window.dispatchEvent(new Event(MESSAGES_UPDATED_EVENT))
}

// Returns a copy of the rows with the given ids flagged as read, for
// updating page state after markMessagesRead succeeds.
export function withRead(messages, messageIds) {
    const ids = new Set(messageIds)
    return messages.map((m) => (ids.has(m.message_id) ? { ...m, is_read: true } : m))
}
