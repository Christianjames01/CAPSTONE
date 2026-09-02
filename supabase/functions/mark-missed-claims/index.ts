import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET')

const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
    if (WEBHOOK_SECRET && req.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    try {
        const nowPH = new Date(Date.now() + 8 * 60 * 60 * 1000)
        const todayPH = nowPH.toISOString().slice(0, 10)

        const { data: overdueSchedules, error: fetchError } = await supabaseAdmin
            .from('claim_schedules')
            .select('claim_schedule_id, request_id, student_id, scheduled_date, scheduled_time')
            .eq('status', 'scheduled')
            .lt('scheduled_date', todayPH)

        if (fetchError) throw fetchError

        let markedCount = 0

        for (const schedule of overdueSchedules || []) {
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

            if (student?.user_id) {
                await supabaseAdmin.from('notifications').insert({
                    user_id: student.user_id,
                    title: 'Missed claiming appointment',
                    message: `You missed your scheduled claiming date for request ${request?.request_number || schedule.request_id} on ${schedule.scheduled_date}. Please contact the Registrar's Office to reschedule.`,
                    notification_type: 'claim_schedule',
                    related_request_id: schedule.request_id,
                })
            }

            if (request?.assigned_employee_id) {
                const { data: employee } = await supabaseAdmin
                    .from('employees')
                    .select('user_id')
                    .eq('employee_id', request.assigned_employee_id)
                    .single()

                if (employee?.user_id) {
                    await supabaseAdmin.from('notifications').insert({
                        user_id: employee.user_id,
                        title: 'Student missed claiming appointment',
                        message: `Request ${request.request_number} was not claimed on its scheduled date (${schedule.scheduled_date}). Reschedule it when the student follows up.`,
                        notification_type: 'claim_schedule',
                        related_request_id: schedule.request_id,
                    })
                }
            }
        }

        return new Response(JSON.stringify({ markedCount }), { status: 200 })

    } catch (err) {
        console.error('MARK MISSED CLAIMS ERROR:', err)
        return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
    }
})
