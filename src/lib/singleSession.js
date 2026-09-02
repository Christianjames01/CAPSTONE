import Swal from 'sweetalert2'
import { supabase } from './supabase'

const STORAGE_KEY = 'certichain_session_id'

export function notifyPreviousDeviceSignedOut() {
    return Swal.fire({
        title: 'Signed out elsewhere',
        text: 'Your account was already signed in on another device. That session has been signed out.',
        confirmButtonText: 'OK',
        confirmButtonColor: '#123B78',
    })
}

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

export function watchStudentSession(userId, onKicked) {
    const localSessionId = localStorage.getItem(STORAGE_KEY)

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
