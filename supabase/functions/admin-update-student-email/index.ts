import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Called directly from the browser (unlike the cron-triggered functions),
// so without these headers the browser's CORS preflight fails before the
// real request is even sent -- surfaces client-side as a bare
// "Failed to fetch" with no further detail.
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status: number) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: CORS_HEADERS })
    }

    if (req.method !== 'POST') {
        return jsonResponse({ error: 'Method not allowed' }, 405)
    }

    try {
        const authHeader = req.headers.get('Authorization') || ''
        const token = authHeader.replace(/^Bearer\s+/i, '')

        if (!token) {
            return jsonResponse({ error: 'You are not logged in.' }, 401)
        }

        // Verify the caller's own identity against their JWT (not a shared
        // webhook secret -- this is invoked by a logged-in admin, not cron)
        // before deciding whether they're allowed to do this at all.
        const supabaseAsCaller = createClient(SUPABASE_URL, ANON_KEY, {
            global: { headers: { Authorization: `Bearer ${token}` } },
        })

        const { data: { user: caller }, error: callerError } = await supabaseAsCaller.auth.getUser()

        if (callerError || !caller) {
            return jsonResponse({ error: 'You are not logged in.' }, 401)
        }

        const { data: callerProfile, error: callerProfileError } = await supabaseAdmin
            .from('profiles')
            .select('role, status')
            .eq('user_id', caller.id)
            .single()

        // Same staff rule as reset-student-password: the registrar head and
        // active employees, except releasing-only (front desk) accounts.
        const isHead = callerProfile?.role === 'registrar_head'
        const isActiveEmployee = callerProfile?.role === 'employee' && callerProfile?.status === 'active'

        if (callerProfileError || (!isHead && !isActiveEmployee)) {
            return jsonResponse({ error: 'Only the registrar head or registrar employees can change a student\'s login email.' }, 403)
        }

        if (isActiveEmployee) {
            const { data: callerEmployeeScope } = await supabaseAdmin
                .from('employees')
                .select('access_scope')
                .eq('user_id', caller.id)
                .maybeSingle()

            if (callerEmployeeScope?.access_scope === 'releasing') {
                return jsonResponse({ error: 'Releasing-only accounts cannot change a student\'s login email.' }, 403)
            }
        }

        const { studentUserId, newEmail } = await req.json()

        if (!studentUserId || !newEmail) {
            return jsonResponse({ error: 'studentUserId and newEmail are required.' }, 400)
        }

        const trimmedEmail = String(newEmail).trim()

        if (!EMAIL_PATTERN.test(trimmedEmail)) {
            return jsonResponse({ error: 'Please provide a valid email address.' }, 400)
        }

        const { data: targetProfile, error: targetProfileError } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('user_id', studentUserId)
            .single()

        if (targetProfileError || targetProfile?.role !== 'student') {
            return jsonResponse({ error: 'Target account is not a student.' }, 400)
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

        return jsonResponse({ success: true, email: trimmedEmail }, 200)

    } catch (err) {
        console.error('ADMIN UPDATE STUDENT EMAIL ERROR:', err)
        return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500)
    }
})
