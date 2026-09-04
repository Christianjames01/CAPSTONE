import { supabase } from './supabase'

const GENERIC_INACTIVE_MESSAGE = "Your account has been deactivated. Please contact the Registrar's Office for assistance."

export async function getInactiveAccountMessage(userId, role) {
    if (role === 'student') {
        const { data: student } = await supabase
            .from('students')
            .select('verification_status, verification_note')
            .eq('user_id', userId)
            .maybeSingle()

        if (student?.verification_status === 'rejected') {
            const reason = student.verification_note ? ` Reason: ${student.verification_note}.` : ''
            return `Your student registration was rejected.${reason} Please visit or contact the Registrar's Office for assistance.`
        }
    }

    return GENERIC_INACTIVE_MESSAGE
}
