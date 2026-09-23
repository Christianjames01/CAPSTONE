import { supabase } from './supabase'

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-update-student-email`

export async function updateStudentEmail({ studentUserId, newEmail }) {
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
        body: JSON.stringify({ studentUserId, newEmail }),
    })

    const result = await response.json()

    if (!response.ok) {
        throw new Error(result.error || 'Failed to update login email.')
    }

    return result
}
