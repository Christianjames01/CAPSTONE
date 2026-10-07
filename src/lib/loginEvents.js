import { supabase } from './supabase'

// Records a successful sign-in for the superadmin's login history. Best effort:
// a failure here is logged and never stops anyone from signing in.
export async function recordLoginEvent() {
    const { error } = await supabase.rpc('record_login_event')
    if (error) console.warn('Could not record login event:', error.message)
}
