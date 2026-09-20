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

// Issues the next ticket number in one call: reserves the next sequential
// number (atomic, race-safe -- see next_queue_number in the migration) and
// inserts the ticket row. `studentId` is optional -- a plain walk-in
// number needs nothing but the number itself; `visitorName` is just a
// free-text label for the head's own reference, not tied to any account.
export async function createQueueTicket({ studentId, requestId, visitorName, purpose } = {}) {
    const today = todayStr()

    const { data: queueNumber, error: numberError } = await supabase.rpc('next_queue_number', { p_date: today })
    if (numberError) throw new Error('Failed to reserve a queue number: ' + numberError.message)

    const { data, error: insertError } = await supabase
        .from('walk_in_queue')
        .insert({
            queue_date: today,
            queue_number: queueNumber,
            student_id: studentId || null,
            request_id: requestId || null,
            visitor_name: visitorName?.trim() || null,
            purpose: purpose?.trim() || null,
        })
        .select()
        .single()

    if (insertError) throw new Error('Failed to create the queue ticket: ' + insertError.message)

    return data
}

// Issues a whole block of tickets in one action (e.g. numbers 1-50 at the
// start of the day) instead of clicking "Issue Number" one at a time.
// Reserves a contiguous range atomically, then inserts every ticket row in
// a single request. Returns the created rows in ticket-number order.
export async function createQueueTicketBatch(count) {
    const today = todayStr()

    const { data: numbers, error: numberError } = await supabase.rpc('reserve_queue_numbers', {
        p_date: today,
        p_count: count,
    })
    if (numberError) throw new Error('Failed to reserve queue numbers: ' + numberError.message)

    const rows = (numbers || []).map((queue_number) => ({
        queue_date: today,
        queue_number,
    }))

    const { data, error: insertError } = await supabase
        .from('walk_in_queue')
        .insert(rows)
        .select()

    if (insertError) throw new Error('Failed to create the queue tickets: ' + insertError.message)

    return (data || []).sort((a, b) => a.queue_number - b.queue_number)
}
