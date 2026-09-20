import { supabase } from './supabase'

export function todayStr() {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function formatQueueNumber(n) {
    return `Q-${String(n).padStart(3, '0')}`
}

// Whether the registrar office counts as open today for walk-in queuing:
// weekdays are open by default, weekends need an explicit office_open_days
// entry (same table the Office Calendar already uses), and either can be
// overridden by an announcement pinned to today and marked closed (e.g. a
// holiday) -- reusing the same signal the student dashboard banner shows.
export async function isOfficeOpenToday() {
    const today = todayStr()
    const dow = new Date().getDay()
    const isWeekend = dow === 0 || dow === 6

    const { data: closedAnnouncement } = await supabase
        .from('announcements')
        .select('announcement_id')
        .eq('announcement_date', today)
        .eq('is_closed', true)
        .eq('is_active', true)
        .maybeSingle()

    if (closedAnnouncement) return false

    if (!isWeekend) return true

    const { data: openDay } = await supabase
        .from('office_open_days')
        .select('open_day_id')
        .eq('open_date', today)
        .maybeSingle()

    return !!openDay
}

// Creates today's next ticket for a student in one call: reserves the next
// sequential number (atomic, race-safe -- see next_queue_number in the
// migration) and inserts the ticket row.
export async function createQueueTicket({ studentId, requestId, purpose }) {
    const today = todayStr()

    const { data: queueNumber, error: numberError } = await supabase.rpc('next_queue_number', { p_date: today })
    if (numberError) throw new Error('Failed to reserve a queue number: ' + numberError.message)

    const { data, error: insertError } = await supabase
        .from('walk_in_queue')
        .insert({
            queue_date: today,
            queue_number: queueNumber,
            student_id: studentId,
            request_id: requestId || null,
            purpose: purpose?.trim() || null,
        })
        .select()
        .single()

    if (insertError) throw new Error('Failed to create your queue ticket: ' + insertError.message)

    return data
}
