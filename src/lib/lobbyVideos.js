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

const isMissingColumn = (error) => error && (error.code === '42703' || /source|published_at/i.test(error.message || ''))

// Active videos in play order: the newest from Facebook first, then the ones
// added by hand. [] (and unavailable) before the migration.
export async function loadLobbyVideos({ includeInactive = false } = {}) {
    const run = (columns, synced) => {
        let query = supabase.from('lobby_videos').select(columns)
        if (synced) query = query.order('published_at', { ascending: false, nullsFirst: false })
        query = query.order('sort_order', { ascending: true }).order('created_at', { ascending: true })
        if (!includeInactive) query = query.eq('is_active', true)
        return query
    }
    const base = 'video_id, url, title, play_seconds, is_active, sort_order, created_at'
    let { data, error } = await run(base + ', source, published_at', true)
    // Before the Facebook sync migration: without its columns.
    if (isMissingColumn(error)) ({ data, error } = await run(base, false))
    if (isMissingTable(error)) return { videos: [], unavailable: true }
    if (error) throw error
    return { videos: data || [], unavailable: false }
}
