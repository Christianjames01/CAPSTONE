import { supabase } from './supabase'

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-student-password`

export function generateTempPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
    let password = ''

    for (let i = 0; i < 10; i++) {
        password += chars[Math.floor(Math.random() * chars.length)]
    }

    return password
}

export async function resetStudentPassword({ studentUserId, newPassword }) {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
        throw new Error('You are not logged in.')
    }

    const response = await fetch(FUNCTIONS_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ studentUserId, newPassword }),
    })

    const result = await response.json()

    if (!response.ok) {
        throw new Error(result.error || 'Failed to reset password.')
    }

    return result
}
