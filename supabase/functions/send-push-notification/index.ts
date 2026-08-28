// Fires on every INSERT into "notifications" (via a Database trigger) and
// sends a web push notification to the user, mirroring send-notification-email.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendPushNotification } from '../_shared/firebaseAdmin.ts'

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
            .select('fcm_token')
            .eq('user_id', notification.user_id)
            .single()

        if (error || !profile?.fcm_token) {
            console.log('SKIPPED: no fcm_token on file for this user')
            return new Response(JSON.stringify({ skipped: true, reason: 'no fcm_token on file' }), { status: 200 })
        }

        console.log('SENDING PUSH TO USER:', notification.user_id)

        const result = await sendPushNotification({
            fcmToken: profile.fcm_token,
            title: notification.title || 'CertiChain Notification',
            body: notification.message || '',
        })

        return new Response(JSON.stringify({ sent: true, fcm: result }), { status: 200 })

    } catch (err) {
        console.error('SEND PUSH NOTIFICATION ERROR:', err)
        return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
    }
})
