import { supabase } from './supabase'

// Facebook videos for the lobby TV (20261002000000_lobby_videos).

// Links Facebook's embedded player accepts: page videos, watch links,
// reels and fb.watch short links.
export function isFacebookVideoUrl(value) {
    try {
        const u = new URL(String(value).trim())
        if (u.protocol !== 'https:') return false
        const host = u.hostname.toLowerCase()
        if (host === 'fb.watch') return u.pathname.length > 1
        if (!/(^|\.)facebook\.com$/.test(host)) return false
        return /\/videos\/|\/watch\/?|\/reel\/|\/share\/v\/|\/share\/r\//.test(u.pathname + u.search)
    } catch {
        return false
    }
}

// The embedded player URL: autoplay, muted (browsers only autoplay muted
// video), no caption text.
export function facebookEmbedUrl(url, width = 1280) {
    const params = new URLSearchParams({
        href: url.trim(),
        show_text: 'false',
        autoplay: 'true',
        mute: '1',
        width: String(width),
    })
    return `https://www.facebook.com/plugins/video.php?${params}`
}

const isMissingTable = (error) => error && (error.code === 'PGRST205' || error.code === '42P01')

// Active videos in play order. [] (and unavailable) before the migration.
export async function loadLobbyVideos({ includeInactive = false } = {}) {
    let query = supabase
        .from('lobby_videos')
        .select('video_id, url, title, play_seconds, is_active, sort_order, created_at')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
    if (!includeInactive) query = query.eq('is_active', true)
    const { data, error } = await query
    if (isMissingTable(error)) return { videos: [], unavailable: true }
    if (error) throw error
    return { videos: data || [], unavailable: false }
}
