import { supabase } from './supabase'

// audienceFlag is one of 'show_to_students' | 'show_to_employees' | 'show_to_public'
export async function fetchActiveAnnouncements(audienceFlag) {
    const { data, error } = await supabase
        .from('announcements')
        .select('announcement_id, title, message, created_at')
        .eq('is_active', true)
        .eq(audienceFlag, true)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('FETCH ANNOUNCEMENTS ERROR:', error)
        return []
    }

    return data || []
}
