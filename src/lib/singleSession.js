import Swal from 'sweetalert2'
import { supabase } from './supabase'

const STORAGE_KEY = 'certichain_session_id'

// Shown to whoever just logged in, when establishStudentSession() reports
// a session was already active elsewhere.
export function notifyPreviousDeviceSignedOut() {
    return Swal.fire({
        title: 'Signed out elsewhere',
        text: 'Your account was already signed in on another device. That session has been signed out.',
        confirmButtonText: 'OK',
        confirmButtonColor: '#123B78',
    })
}

// Called once, right when a student successfully logs in (password login,
// Google OAuth callback, or finishing their profile for the first time).
// Stamps a fresh id on their profile and remembers it locally -- any other
// tab/device holding an older id will see this change via Realtime and
// sign itself out, enforcing "one device at a time" for students.
// Returns whether a session was already active elsewhere, so the caller
// can let this person know their login just signed that device out.
export async function establishStudentSession(userId) {
    const { data: existing } = await supabase
        .from('profiles')
        .select('active_session_id')
        .eq('user_id', userId)
        .single()

    const sessionId = crypto.randomUUID()

    const { error } = await supabase
        .from('profiles')
        .update({ active_session_id: sessionId })
        .eq('user_id', userId)

    if (error) {
        console.error('ESTABLISH SESSION ERROR:', error)
        return { hadExistingSession: false }
    }

    localStorage.setItem(STORAGE_KEY, sessionId)

    return { hadExistingSession: !!existing?.active_session_id }
}

// Called from the student layout on mount. Watches this user's profile
// row and calls onKicked() the moment active_session_id changes to
// something other than what this tab/device stored at login.
export function watchStudentSession(userId, onKicked) {
    const localSessionId = localStorage.getItem(STORAGE_KEY)

    // No local session id means this tab never went through a login flow
    // that set one (e.g. it predates this feature) -- nothing to compare
    // against yet, so don't watch until the next real login.
    if (!localSessionId) return () => {}

    const channel = supabase
        .channel(`profile-session-${userId}`)
        .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `user_id=eq.${userId}` },
            (payload) => {
                const remoteSessionId = payload.new?.active_session_id
                if (remoteSessionId && remoteSessionId !== localSessionId) {
                    onKicked()
                }
            }
        )
        .subscribe()

    return () => {
        supabase.removeChannel(channel)
    }
}
