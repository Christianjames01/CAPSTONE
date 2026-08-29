import { supabase } from './supabase'

// Brute-force protection: checked before attempting sign-in, and updated
// after, via the login-guard Edge Function (needs the service role since
// there's no authenticated session yet at this point).
export async function checkLoginLock(email) {
    const { data, error } = await supabase.functions.invoke('login-guard', {
        body: { email, action: 'check' },
    })

    if (error) {
        console.error('LOGIN LOCK CHECK ERROR:', error)
        return { locked: false }
    }

    return data
}

export async function recordLoginAttempt(email, success) {
    const { data, error } = await supabase.functions.invoke('login-guard', {
        body: { email, action: 'record', success },
    })

    if (error) {
        console.error('RECORD LOGIN ATTEMPT ERROR:', error)
        return {}
    }

    return data
}

export function formatLockMessage(lockedUntil) {
    const minutesLeft = Math.max(1, Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / 60_000))
    return `Too many failed login attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.`
}
