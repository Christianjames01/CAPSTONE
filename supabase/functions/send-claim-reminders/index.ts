// Runs once a day on a Cron Trigger. Emails every student whose claim
// schedule falls tomorrow, as a heads-up reminder.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmail } from '../_shared/email.ts'

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
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        const tomorrowStr = tomorrow.toISOString().slice(0, 10)

        const { data: schedules, error } = await supabaseAdmin
            .from('claim_schedules')
            .select('claim_schedule_id, request_id, student_id, claim_date, claim_time, scheduled_date, scheduled_time, status')
            .or(`claim_date.eq.${tomorrowStr},scheduled_date.eq.${tomorrowStr}`)
            .not('status', 'in', '(cancelled,claimed)')

        if (error) throw error

        console.log(`FOUND ${schedules?.length || 0} SCHEDULE(S) FOR ${tomorrowStr}`)

        let sentCount = 0

        for (const schedule of schedules || []) {
            const { data: student } = await supabaseAdmin
                .from('students')
                .select('user_id')
                .eq('student_id', schedule.student_id)
                .single()

            if (!student) continue

            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('email, first_name')
                .eq('user_id', student.user_id)
                .single()

            if (!profile?.email) continue

            const { data: request } = await supabaseAdmin
                .from('document_requests')
                .select('request_number')
                .eq('request_id', schedule.request_id)
                .single()

            const claimDate = schedule.claim_date || schedule.scheduled_date
            const claimTime = schedule.claim_time || schedule.scheduled_time

            try {
                await sendEmail({
                    to: profile.email,
                    subject: 'Reminder: Document claiming tomorrow',
                    html: `
                        <p>Hi ${profile.first_name || 'there'},</p>
                        <p>This is a reminder that your document for request
                        <strong>${request?.request_number || schedule.request_id}</strong>
                        is scheduled for claiming tomorrow, <strong>${claimDate}</strong> at <strong>${claimTime}</strong>.</p>
                        <p>Please bring your official receipt and a valid ID.</p>
                        <p style="color:#57616F;font-size:12px;margin-top:24px;">
                            This is an automated reminder from CertiChain — HCDC Registrar Services.
                        </p>
                    `,
                })
                sentCount++
            } catch (sendErr) {
                console.error('FAILED TO EMAIL', profile.email, sendErr)
            }
        }

        return new Response(JSON.stringify({ remindersSent: sentCount }), { status: 200 })

    } catch (err) {
        console.error('SEND CLAIM REMINDERS ERROR:', err)
        return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
    }
})
