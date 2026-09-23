import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET')

const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const OVERDUE_ELIGIBLE_STATUSES = ['pending', 'payment_pending', 'receipt_uploaded', 'receipt_verified', 'processing']
const OVERDUE_DAYS = 2
const OPEN_STATUSES = [
    'pending', 'payment_pending', 'receipt_uploaded', 'receipt_verified',
    'processing', 'lacking_requirements', 'ready_for_claiming',
]

Deno.serve(async (req) => {
    if (WEBHOOK_SECRET && req.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    try {
        // Idempotency guard: the cron job is scheduled to fire once a day,
        // but a retry, a stray duplicate pg_cron schedule, or a manual
        // re-trigger would otherwise insert a second "Daily registrar
        // alert" for everyone. Skip the whole run if one already went out
        // recently, rather than relying on the caller to only ever invoke
        // this once.
        const recentCutoff = new Date(Date.now() - 20 * 60 * 60 * 1000)

        const { data: recentAlert, error: recentAlertError } = await supabaseAdmin
            .from('notifications')
            .select('notification_id')
            .eq('title', 'Daily registrar alert')
            .gte('created_at', recentCutoff.toISOString())
            .limit(1)
            .maybeSingle()

        if (recentAlertError) throw recentAlertError

        if (recentAlert) {
            return new Response(JSON.stringify({ notified: 0, skipped: 'already sent within the last 20 hours' }), { status: 200 })
        }

        const overdueCutoff = new Date()
        overdueCutoff.setDate(overdueCutoff.getDate() - OVERDUE_DAYS)

        const { data: overdueRows, error: overdueError } = await supabaseAdmin
            .from('document_requests')
            .select('request_number, requested_at')
            .in('status', OVERDUE_ELIGIBLE_STATUSES)
            .lte('requested_at', overdueCutoff.toISOString())

        if (overdueError) throw overdueError

        const { data: unassignedRows, error: unassignedError } = await supabaseAdmin
            .from('document_requests')
            .select('request_number')
            .is('assigned_employee_id', null)
            .in('status', OPEN_STATUSES)

        if (unassignedError) throw unassignedError

        const overdueCount = overdueRows?.length || 0
        const unassignedCount = unassignedRows?.length || 0

        if (overdueCount === 0 && unassignedCount === 0) {
            return new Response(JSON.stringify({ notified: 0, overdueCount, unassignedCount }), { status: 200 })
        }

        const lines: string[] = []
        if (overdueCount > 0) {
            // Each request's own elapsed time, not the fixed OVERDUE_DAYS
            // threshold -- a request sitting for a week should read as
            // "7 days", not just repeat "2+ days" forever.
            const sample = (overdueRows || []).slice(0, 5).map((r) => {
                const daysSat = Math.floor((Date.now() - new Date(r.requested_at).getTime()) / (1000 * 60 * 60 * 24))
                return `${r.request_number} (${daysSat} day${daysSat === 1 ? '' : 's'})`
            }).join(', ')
            lines.push(`${overdueCount} request(s) have sat unprocessed: ${sample}${overdueCount > 5 ? ', ...' : ''}.`)
        }
        if (unassignedCount > 0) {
            const sample = (unassignedRows || []).slice(0, 5).map((r) => r.request_number).join(', ')
            lines.push(`${unassignedCount} request(s) have no employee assigned: ${sample}${unassignedCount > 5 ? ', ...' : ''}.`)
        }

        const { data: heads, error: headsError } = await supabaseAdmin
            .from('profiles')
            .select('user_id')
            .in('role', ['registrar_head', 'admin'])
            .eq('status', 'active')

        if (headsError) throw headsError

        let notified = 0

        for (const head of heads || []) {
            const { error: insertError } = await supabaseAdmin.from('notifications').insert({
                user_id: head.user_id,
                title: 'Daily registrar alert',
                message: lines.join(' '),
                notification_type: 'system',
            })

            if (insertError) {
                console.error('FAILED TO NOTIFY', head.user_id, insertError)
                continue
            }
            notified++
        }

        return new Response(JSON.stringify({ notified, overdueCount, unassignedCount }), { status: 200 })

    } catch (err) {
        console.error('SEND REGISTRAR ALERTS ERROR:', err)
        return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
    }
})
