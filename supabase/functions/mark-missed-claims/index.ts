import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET')

const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

function phToday(nowMs: number): string {
    return new Date(nowMs + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

// Next weekday (Mon-Fri) strictly after the given YYYY-MM-DD date, unless a
// weekend date is explicitly marked open in office_open_days (e.g. the
// Registrar Head marks a Saturday open during enrollment), in which case
// that date is used instead of skipping it.
function nextBusinessDay(fromDateStr: string, openWeekendDates: Set<string>): string {
    let d = new Date(`${fromDateStr}T00:00:00Z`)
    d = new Date(d.getTime() + 24 * 60 * 60 * 1000)

    while (true) {
        const isWeekend = d.getUTCDay() === 0 || d.getUTCDay() === 6
        const dateStr = d.toISOString().slice(0, 10)

        if (!isWeekend || openWeekendDates.has(dateStr)) {
            return dateStr
        }

        d = new Date(d.getTime() + 24 * 60 * 60 * 1000)
    }
}

Deno.serve(async (req) => {
    if (WEBHOOK_SECRET && req.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    try {
        const now = Date.now()
        const todayPH = phToday(now)

        const { data: overdueSchedules, error: fetchError } = await supabaseAdmin
            .from('claim_schedules')
            .select('claim_schedule_id, request_id, student_id, scheduled_date, scheduled_time, auto_rescheduled_at, remarks')
            .eq('status', 'scheduled')
            .lt('scheduled_date', todayPH)

        if (fetchError) throw fetchError

        const { data: openDayRows, error: openDaysError } = await supabaseAdmin
            .from('office_open_days')
            .select('open_date')
            .gte('open_date', todayPH)

        if (openDaysError) throw openDaysError

        const openWeekendDates = new Set((openDayRows || []).map((r) => r.open_date))

        let autoRescheduledCount = 0
        let markedCount = 0

        for (const schedule of overdueSchedules || []) {
            const { data: request } = await supabaseAdmin
                .from('document_requests')
                .select('request_number, assigned_employee_id')
                .eq('request_id', schedule.request_id)
                .single()

            const { data: student } = await supabaseAdmin
                .from('students')
                .select('user_id')
                .eq('student_id', schedule.student_id)
                .single()

            let employeeUserId: string | null = null

            if (request?.assigned_employee_id) {
                const { data: employee } = await supabaseAdmin
                    .from('employees')
                    .select('user_id')
                    .eq('employee_id', request.assigned_employee_id)
                    .single()

                employeeUserId = employee?.user_id || null
            }

            if (!schedule.auto_rescheduled_at) {
                const missedDate = schedule.scheduled_date
                const newDate = nextBusinessDay(todayPH, openWeekendDates)

                const { error: rescheduleError } = await supabaseAdmin
                    .from('claim_schedules')
                    .update({
                        scheduled_date: newDate,
                        claim_date: newDate,
                        auto_rescheduled_at: new Date().toISOString(),
                        remarks: schedule.remarks
                            ? `${schedule.remarks} | Automatically rescheduled from ${missedDate} after a missed appointment.`
                            : `Automatically rescheduled from ${missedDate} after a missed appointment.`,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('claim_schedule_id', schedule.claim_schedule_id)
                    .eq('status', 'scheduled')

                if (rescheduleError) {
                    console.error('FAILED TO AUTO-RESCHEDULE', schedule.claim_schedule_id, rescheduleError)
                    continue
                }

                autoRescheduledCount++

                if (student?.user_id) {
                    await supabaseAdmin.from('notifications').insert({
                        user_id: student.user_id,
                        title: 'Claiming appointment automatically rescheduled',
                        message: `You missed your claiming appointment for request ${request?.request_number || schedule.request_id} on ${missedDate}. It has been automatically rescheduled to ${newDate} at ${schedule.scheduled_time}. If that doesn't work for you, request another reschedule from the request page.`,
                        notification_type: 'claim_schedule',
                        related_request_id: schedule.request_id,
                    })
                }

                if (employeeUserId) {
                    await supabaseAdmin.from('notifications').insert({
                        user_id: employeeUserId,
                        title: 'Missed appointment auto-rescheduled',
                        message: `Request ${request?.request_number || schedule.request_id} was missed on ${missedDate} and has been automatically rescheduled to ${newDate}.`,
                        notification_type: 'claim_schedule',
                        related_request_id: schedule.request_id,
                    })
                }

                await supabaseAdmin.from('activity_logs').insert({
                    user_id: null,
                    employee_id: null,
                    action: 'auto_reschedule_missed_claim',
                    table_name: 'claim_schedules',
                    record_id: schedule.claim_schedule_id,
                    description: `Automatically rescheduled request "${request?.request_number || schedule.request_id}" from ${missedDate} to ${newDate} after a missed appointment.`,
                })

                continue
            }

            const { error: updateError } = await supabaseAdmin
                .from('claim_schedules')
                .update({ status: 'missed', updated_at: new Date().toISOString() })
                .eq('claim_schedule_id', schedule.claim_schedule_id)
                .eq('status', 'scheduled')

            if (updateError) {
                console.error('FAILED TO MARK MISSED', schedule.claim_schedule_id, updateError)
                continue
            }

            markedCount++

            if (student?.user_id) {
                await supabaseAdmin.from('notifications').insert({
                    user_id: student.user_id,
                    title: 'Missed claiming appointment',
                    message: `You missed your scheduled claiming date for request ${request?.request_number || schedule.request_id} on ${schedule.scheduled_date}. Please contact the Registrar's Office to reschedule.`,
                    notification_type: 'claim_schedule',
                    related_request_id: schedule.request_id,
                })
            }

            if (employeeUserId) {
                await supabaseAdmin.from('notifications').insert({
                    user_id: employeeUserId,
                    title: 'Student missed claiming appointment',
                    message: `Request ${request?.request_number || schedule.request_id} was not claimed on its scheduled date (${schedule.scheduled_date}). Reschedule it when the student follows up.`,
                    notification_type: 'claim_schedule',
                    related_request_id: schedule.request_id,
                })
            }

            // Cumulative missed-claim count across ALL of this student's requests,
            // not just this one -- a single request rarely gets missed 2-3 times on
            // its own since it's only auto-rescheduled once before requiring staff
            // to manually reschedule it.
            if (student?.user_id) {
                const { count: missedCount } = await supabaseAdmin
                    .from('claim_schedules')
                    .select('claim_schedule_id', { count: 'exact', head: true })
                    .eq('student_id', schedule.student_id)
                    .eq('status', 'missed')

                if ((missedCount || 0) >= 2) {
                    await supabaseAdmin.from('notifications').insert({
                        user_id: student.user_id,
                        title: 'Your document is unclaimed',
                        message: `You now have ${missedCount} missed claiming appointments on your CertiChain account, and your document for request ${request?.request_number || schedule.request_id} remains unclaimed. Please visit the Registrar's Office as soon as possible. Repeated missed appointments may result in your account being suspended or deactivated by the Registrar's Office.`,
                        notification_type: 'claim_schedule',
                        related_request_id: schedule.request_id,
                    })

                    if (employeeUserId) {
                        await supabaseAdmin.from('notifications').insert({
                            user_id: employeeUserId,
                            title: 'Student has repeated missed claims',
                            message: `This student now has ${missedCount} missed claiming appointments across their requests, including request ${request?.request_number || schedule.request_id}. Consider following up before their account standing is reviewed.`,
                            notification_type: 'claim_schedule',
                            related_request_id: schedule.request_id,
                        })
                    }

                    await supabaseAdmin.from('activity_logs').insert({
                        user_id: null,
                        employee_id: null,
                        action: 'repeated_missed_claims_warning',
                        table_name: 'claim_schedules',
                        record_id: schedule.claim_schedule_id,
                        description: `Sent a repeated-missed-claims warning to a student with ${missedCount} total missed appointments (latest: request "${request?.request_number || schedule.request_id}").`,
                    })
                }
            }
        }

        return new Response(JSON.stringify({ autoRescheduledCount, markedCount }), { status: 200 })

    } catch (err) {
        console.error('MARK MISSED CLAIMS ERROR:', err)
        return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
    }
})
