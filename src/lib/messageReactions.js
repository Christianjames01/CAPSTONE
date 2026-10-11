import { supabase } from './supabase'

// Messenger's quick-react set.
export const REACTION_EMOJIS = ['👍', '❤️', '😆', '😮', '😢', '😡']

// All reactions on the given messages (RLS limits this to ones the caller
// can actually see -- their own conversations, or every conversation for
// registrar staff). Keyed by message_id for easy lookup while rendering.
export async function loadReactions(messageIds) {
    if (!messageIds || messageIds.length === 0) return []

    const { data, error } = await supabase
        .from('message_reactions')
        .select('message_id, user_id, emoji')
        .in('message_id', messageIds)

    if (error) {
        console.error('LOAD REACTIONS ERROR:', error)
        return []
    }
    return data || []
}

// Sets the caller's reaction on a message to `emoji`, or removes it if
// they already reacted with that same emoji (tap-to-toggle, like
// Messenger). One reaction per user per message -- picking a different
// emoji replaces the old one.
export async function toggleReaction(messageId, userId, emoji, existing) {
    if (existing?.emoji === emoji) {
        const { error } = await supabase
            .from('message_reactions')
            .delete()
            .eq('message_id', messageId)
            .eq('user_id', userId)
        if (error) throw new Error('Failed to remove reaction: ' + error.message)
        return null
    }

    const { error } = await supabase
        .from('message_reactions')
        .upsert({ message_id: messageId, user_id: userId, emoji }, { onConflict: 'message_id,user_id' })

    if (error) throw new Error('Failed to react: ' + error.message)
    return emoji
}

// Groups raw reaction rows for one logical message (which may be several
// sibling row ids in a fanned-out thread -- see siblingMessageIds) into
// display-ready chips: [{ emoji, count, mine }], most-reacted first.
export function groupReactions(rows, selfId) {
    const byEmoji = new Map()
    for (const r of rows) {
        const entry = byEmoji.get(r.emoji) || { emoji: r.emoji, count: 0, mine: false }
        entry.count += 1
        if (r.user_id === selfId) entry.mine = true
        byEmoji.set(r.emoji, entry)
    }
    return [...byEmoji.values()].sort((a, b) => b.count - a.count)
}
