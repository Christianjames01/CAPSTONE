import { supabase } from './supabase'

// Names, role and photo for a list of users, through the
// directory_profiles() database function -- so students can show who a
// message or request is from without reading staff profile rows (email,
// phone, login details). Before that function exists, falls back to reading
// profiles directly.
export async function loadDirectoryProfiles(userIds) {
    const ids = [...new Set((userIds || []).filter(Boolean))]
    if (ids.length === 0) return []

    const { data, error } = await supabase.rpc('directory_profiles', { p_user_ids: ids })
    if (!error) return data || []

    const { data: rows } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, role, profile_photo_url')
        .in('user_id', ids)
    return rows || []
}
