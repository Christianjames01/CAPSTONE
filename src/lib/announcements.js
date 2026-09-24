import { supabase } from './supabase'

// audienceFlag is one of 'show_to_students' | 'show_to_employees' | 'show_to_public'
export async function fetchActiveAnnouncements(audienceFlag) {
    const { data, error } = await supabase
        .from('announcements')
        .select('announcement_id, title, message, announcement_date, is_closed, created_at')
        .eq('is_active', true)
        .eq(audienceFlag, true)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('FETCH ANNOUNCEMENTS ERROR:', error)
        return []
    }

    return data || []
}

export function formatAnnouncementDate(dateStr, { withYear = false } = {}) {
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-PH', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        ...(withYear ? { year: 'numeric' } : {}),
    })
}

// 'closed' | 'open' | 'general' -- drives the accent color, icon, and badge
// so the admin list, the admin preview, and the student dashboard agree.
export function announcementTone(a) {
    if (!a.announcement_date) return 'general'
    return a.is_closed ? 'closed' : 'open'
}
