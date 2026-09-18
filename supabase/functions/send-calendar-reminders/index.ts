import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmail, EMAIL_FOOTER_HTML } from '../_shared/email.ts'

const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET')

const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// Two heads-up points ahead of an office_events date -- a first warning
// with more lead time, and a final one the day before -- rather than
// notifying every single day counting down to it (which would just get
// muted/ignored). Each notification/email says how many days out it is.
const REMINDER_DAYS_OUT = [3, 1]

function toDateStr(d: Date) {
    return d.toISOString().slice(0, 10)
}

Deno.serve(async (req) => {
    if (WEBHOOK_SECRET && req.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    try {
        const targetDates = REMINDER_DAYS_OUT.map((daysOut) => {
            const d = new Date()
            d.setDate(d.getDate() + daysOut)
            return { daysOut, dateStr: toDateStr(d) }
        })

        const { data: events, error: eventsError } = await supabaseAdmin
            .from('office_events')
            .select('event_id, event_date, title, note')
            .in('event_date', targetDates.map((t) => t.dateStr))

        if (eventsError) throw eventsError

        if (!events || events.length === 0) {
            return new Response(JSON.stringify({ notified: 0, emailed: 0, eventsFound: 0 }), { status: 200 })
        }

        const dateToDaysOut = Object.fromEntries(targetDates.map((t) => [t.dateStr, t.daysOut]))

        // Soonest event first, so the headline reminder/email leads with
        // whatever is closest rather than however Postgres happened to
        // return the rows.
        const items = events
            .map((ev) => ({ ...ev, daysOut: dateToDaysOut[ev.event_date] }))
            .sort((a, b) => a.daysOut - b.daysOut)

        const countdownLabel = (daysOut: number) => `in ${daysOut} day${daysOut === 1 ? '' : 's'}`

        const summaryLines = items.map(
            (ev) => `"${ev.title}" on ${ev.event_date} (${countdownLabel(ev.daysOut)})${ev.note ? ' — ' + ev.note : ''}`
        )

        const headline = items.length === 1
            ? `Upcoming: "${items[0].title}" ${countdownLabel(items[0].daysOut)}`
            : `${items.length} upcoming office calendar events`

        const { data: staff, error: staffError } = await supabaseAdmin
            .from('profiles')
            .select('user_id, email, first_name')
            .in('role', ['employee', 'registrar_head', 'admin'])
            .eq('status', 'active')

        if (staffError) throw staffError

        let notified = 0
        let emailed = 0

        for (const person of staff || []) {
            const { error: insertError } = await supabaseAdmin.from('notifications').insert({
                user_id: person.user_id,
                title: headline,
                message: summaryLines.join(' '),
                notification_type: 'system',
            })

            if (insertError) {
                console.error('FAILED TO NOTIFY', person.user_id, insertError)
            } else {
                notified++
            }

            if (!person.email) continue

            try {
                await sendEmail({
                    to: person.email,
                    subject: headline,
                    html: `
                        <p>Hi ${person.first_name || 'there'},</p>
                        <p>Heads up on what's coming up on the Office Calendar:</p>
                        <ul>
                            ${items.map((ev) => `
                                <li>
                                    <strong>${ev.title}</strong> — ${ev.event_date} (${countdownLabel(ev.daysOut)})
                                    ${ev.note ? `<br/><span style="color:#57616F;">${ev.note}</span>` : ''}
                                </li>
                            `).join('')}
                        </ul>
                        <p style="color:#57616F;font-size:12px;margin-top:24px;">
                            This is an automated reminder from CertiChain — HCDC Registrar Services.
                        </p>
                        ${EMAIL_FOOTER_HTML}
                    `,
                })
                emailed++
            } catch (sendErr) {
                console.error('FAILED TO EMAIL', person.email, sendErr)
            }
        }

        return new Response(JSON.stringify({ notified, emailed, eventsFound: items.length }), { status: 200 })

    } catch (err) {
        console.error('SEND CALENDAR REMINDERS ERROR:', err)
        return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
    }
})
