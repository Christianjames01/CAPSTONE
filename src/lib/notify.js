import Swal from 'sweetalert2'
import { supabase } from './supabase'

const CONFIRM_COLOR = '#0d6efd'
const CANCEL_COLOR = '#6c757d'

// Best-effort in-app notification write (a DB trigger emails the user off
// this insert). Never throws — a notification failure should not block the
// action that triggered it.
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

export async function notifyStudentByStudentId({ studentId, title, message, notificationType, relatedRequestId }) {
    try {
        const { data: student, error: studentError } = await supabase
            .from('students')
            .select('user_id')
            .eq('student_id', studentId)
            .single()

        if (studentError || !student?.user_id) {
            throw studentError || new Error('Student has no linked user account.')
        }

        await notify({ userId: student.user_id, title, message, notificationType, relatedRequestId })
    } catch (error) {
        console.error('NOTIFY STUDENT ERROR:', error)
    }
}

export function notifySuccess(message, title = 'Success') {
    return Swal.fire({
        icon: 'success',
        title,
        text: message,
        confirmButtonColor: CONFIRM_COLOR,
    })
}

export function notifyError(message, title = 'Error') {
    return Swal.fire({
        icon: 'error',
        title,
        text: message,
        confirmButtonColor: CONFIRM_COLOR,
    })
}

export function notifyWarning(message, title = 'Warning') {
    return Swal.fire({
        icon: 'warning',
        title,
        text: message,
        confirmButtonColor: CONFIRM_COLOR,
    })
}

export async function confirmModal(message, { title = 'Are you sure?', confirmButtonText = 'Yes', icon = 'question' } = {}) {
    const result = await Swal.fire({
        icon,
        title,
        text: message,
        showCancelButton: true,
        confirmButtonText,
        cancelButtonText: 'Cancel',
        confirmButtonColor: CONFIRM_COLOR,
        cancelButtonColor: CANCEL_COLOR,
    })
    return result.isConfirmed
}
