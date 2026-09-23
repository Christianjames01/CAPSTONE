import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

Deno.serve(async (req) => {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
    }

    try {
        const authHeader = req.headers.get('Authorization') || ''
        const token = authHeader.replace(/^Bearer\s+/i, '')

        if (!token) {
            return new Response(JSON.stringify({ error: 'You are not logged in.' }), { status: 401 })
        }

        // Verify the caller's own identity against their JWT (not a shared
        // webhook secret -- this is invoked by a logged-in admin, not cron)
        // before deciding whether they're allowed to do this at all.
        const supabaseAsCaller = createClient(SUPABASE_URL, ANON_KEY, {
            global: { headers: { Authorization: `Bearer ${token}` } },
        })

        const { data: { user: caller }, error: callerError } = await supabaseAsCaller.auth.getUser()

        if (callerError || !caller) {
            return new Response(JSON.stringify({ error: 'You are not logged in.' }), { status: 401 })
        }

        const { data: callerProfile, error: callerProfileError } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('user_id', caller.id)
            .single()

        if (callerProfileError || callerProfile?.role !== 'registrar_head') {
            return new Response(JSON.stringify({ error: 'Only the registrar head can change a student\'s login email.' }), { status: 403 })
        }

        const { studentUserId, newEmail } = await req.json()

        if (!studentUserId || !newEmail) {
            return new Response(JSON.stringify({ error: 'studentUserId and newEmail are required.' }), { status: 400 })
        }

        const trimmedEmail = String(newEmail).trim()

        if (!EMAIL_PATTERN.test(trimmedEmail)) {
            return new Response(JSON.stringify({ error: 'Please provide a valid email address.' }), { status: 400 })
        }

        const { data: targetProfile, error: targetProfileError } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('user_id', studentUserId)
            .single()

        if (targetProfileError || targetProfile?.role !== 'student') {
            return new Response(JSON.stringify({ error: 'Target account is not a student.' }), { status: 400 })
        }

        // email_confirm: true skips the normal "click a link to confirm"
        // step -- the whole point of this admin override is for a student
        // whose old HCDC mailbox is already dead and can't receive or
        // click that link themselves.
        const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(studentUserId, {
            email: trimmedEmail,
            email_confirm: true,
        })

        if (updateAuthError) throw updateAuthError

        const { error: updateProfileError } = await supabaseAdmin
            .from('profiles')
            .update({ email: trimmedEmail })
            .eq('user_id', studentUserId)

        if (updateProfileError) throw updateProfileError

        return new Response(JSON.stringify({ success: true, email: trimmedEmail }), { status: 200 })

    } catch (err) {
        console.error('ADMIN UPDATE STUDENT EMAIL ERROR:', err)
        return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), { status: 500 })
    }
})
