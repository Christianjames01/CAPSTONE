import { supabase } from './supabase'

// Student display info for request/claim lists: student_id -> { name, number }.
// Names live on profiles (by user_id), numbers on students, so this is two
// lookups. Missing rows just fall back to the student number.
export async function loadStudentsById(studentIds) {
    const ids = [...new Set((studentIds || []).filter(Boolean))]
    if (ids.length === 0) return {}

    const { data: students } = await supabase
        .from('students')
        .select('student_id, user_id, student_number')
        .in('student_id', ids)

    const userIds = [...new Set((students || []).map((s) => s.user_id).filter(Boolean))]

    const { data: profiles } = userIds.length
        ? await supabase.from('profiles').select('user_id, first_name, last_name').in('user_id', userIds)
        : { data: [] }

    const profileByUserId = Object.fromEntries((profiles || []).map((p) => [p.user_id, p]))

    return Object.fromEntries(
        (students || []).map((s) => {
            const p = profileByUserId[s.user_id]
            const name = p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : ''
            return [s.student_id, { name: name || `Student ${s.student_number}`, number: s.student_number || 'N/A' }]
        })
    )
}
