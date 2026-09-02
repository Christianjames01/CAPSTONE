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
        const payload = await req.json()
        const notification = payload.record

        console.log('RECEIVED NOTIFICATION:', JSON.stringify(notification))

        if (!notification?.user_id) {
            console.log('SKIPPED: no user_id on payload')
            return new Response(JSON.stringify({ skipped: true, reason: 'no user_id' }), { status: 200 })
        }

        const { data: profile, error } = await supabaseAdmin
            .from('profiles')
            .select('email, first_name')
            .eq('user_id', notification.user_id)
            .single()

        if (error || !profile?.email) {
            console.error('PROFILE LOOKUP ERROR:', error)
            return new Response(JSON.stringify({ skipped: true, reason: 'no email on file' }), { status: 200 })
        }

        console.log('SENDING TO:', profile.email)

        const result = await sendEmail({
            to: profile.email,
            subject: notification.title || 'CertiChain Notification',
            html: `
                <p>Hi ${profile.first_name || 'there'},</p>
                <p>${notification.message}</p>
                <p style="color:#57616F;font-size:12px;margin-top:24px;">
                    This is an automated notification from CertiChain — HCDC Registrar Services.
                    You can also view this in your account's Notifications page.
                </p>
            `,
        })

        return new Response(JSON.stringify({ sent: true, ...result }), { status: 200 })

    } catch (err) {
        console.error('SEND NOTIFICATION EMAIL ERROR:', err)
        return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
    }
})
