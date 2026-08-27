import { supabase } from './supabase'

// Best-effort notification write. Never throws — a notification failure
// should not block the action that triggered it.
export async function notify({ userId, title, message, notificationType, relatedRequestId }) {
    try {
        await supabase.from('notifications').insert({
            user_id: userId,
            title,
            message,
            notification_type: notificationType || null,
            related_request_id: relatedRequestId || null,
            is_read: false,
        })
    } catch (error) {
        console.error('NOTIFY ERROR:', error)
    }
}

// Looks up a student's auth user_id from their student_id, then notifies them.
export async function notifyStudentByStudentId({ studentId, title, message, notificationType, relatedRequestId }) {
    try {
        const { data: student, error } = await supabase
            .from('students')
            .select('user_id')
            .eq('student_id', studentId)
            .single()

        if (error || !student) {
            console.error('NOTIFY STUDENT LOOKUP ERROR:', error)
            return
        }

        await notify({ userId: student.user_id, title, message, notificationType, relatedRequestId })
    } catch (error) {
        console.error('NOTIFY STUDENT ERROR:', error)
    }
}
