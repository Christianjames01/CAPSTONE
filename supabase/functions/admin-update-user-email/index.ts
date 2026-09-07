import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const authHeader = req.headers.get('Authorization') || ''
        const token = authHeader.replace(/^Bearer\s+/i, '')

        if (!token) {
            return json({ error: 'Missing authorization.' }, 401)
        }

        const { data: { user: caller }, error: callerError } = await supabaseAdmin.auth.getUser(token)

        if (callerError || !caller) {
            return json({ error: 'Invalid session.' }, 401)
        }

        const { data: callerProfile } = await supabaseAdmin
            .from('profiles')
            .select('role, status')
            .eq('user_id', caller.id)
            .single()

        const isAdmin = callerProfile
            && ['registrar_head', 'admin'].includes(callerProfile.role)
            && callerProfile.status === 'active'

        if (!isAdmin) {
            return json({ error: 'Only an active admin or registrar head can change a user\'s email.' }, 403)
        }

        const { targetUserId, newEmail } = await req.json()

        if (!targetUserId || !newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
            return json({ error: 'A target user ID and a valid new email are required.' }, 400)
        }

        const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
            email: newEmail,
            email_confirm: true,
        })

        if (authUpdateError) {
            return json({ error: authUpdateError.message }, 500)
        }

        const { error: profileUpdateError } = await supabaseAdmin
            .from('profiles')
            .update({ email: newEmail })
            .eq('user_id', targetUserId)

        if (profileUpdateError) {
            return json({ error: `Auth email updated, but profile email could not be synced: ${profileUpdateError.message}` }, 500)
        }

        await supabaseAdmin.from('activity_logs').insert({
            user_id: caller.id,
            action: 'update_user_email',
            table_name: 'profiles',
            record_id: targetUserId,
            description: `Changed login email for user ${targetUserId} to "${newEmail}".`,
        })

        return json({ success: true })

    } catch (err) {
        console.error('ADMIN UPDATE USER EMAIL ERROR:', err)
        return json({ error: String(err) }, 500)
    }
})
