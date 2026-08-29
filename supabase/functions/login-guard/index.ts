// Brute-force protection for password login. Called from Login.jsx before
// (action: "check") and after (action: "record") each sign-in attempt.
// Runs with the service role because a failed attempt, by definition,
// happens before the browser has an authenticated session -- there's no
// RLS-scoped way to read/write this from the client directly.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MAX_ATTEMPTS = 5
const LOCKOUT_MINUTES = 15

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
        const { email, action, success } = await req.json()

        if (!email || typeof email !== 'string') {
            return json({ error: 'Missing email' }, 400)
        }

        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('user_id, failed_login_attempts, locked_until')
            .eq('email', email)
            .maybeSingle()

        // Unknown email: report "not locked" either way, so this endpoint
        // can't be used to enumerate which emails have accounts.
        if (!profile) {
            return json({ locked: false })
        }

        const lockedUntil = profile.locked_until ? new Date(profile.locked_until) : null
        const isLocked = !!lockedUntil && lockedUntil.getTime() > Date.now()

        if (action === 'check') {
            return json({ locked: isLocked, lockedUntil: isLocked ? lockedUntil!.toISOString() : null })
        }

        if (action === 'record') {
            if (success) {
                await supabaseAdmin
                    .from('profiles')
                    .update({ failed_login_attempts: 0, locked_until: null })
                    .eq('user_id', profile.user_id)

                return json({ ok: true })
            }

            // A locked account that keeps getting hit shouldn't have its
            // lock extended by every subsequent attempt -- only count
            // fresh failures once the previous lock has expired.
            if (isLocked) {
                return json({ locked: true, lockedUntil: lockedUntil!.toISOString() })
            }

            const attempts = (profile.failed_login_attempts || 0) + 1
            const willLock = attempts >= MAX_ATTEMPTS

            const update: Record<string, unknown> = { failed_login_attempts: willLock ? 0 : attempts }
            if (willLock) {
                update.locked_until = new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString()
            }

            await supabaseAdmin.from('profiles').update(update).eq('user_id', profile.user_id)

            return json({
                locked: willLock,
                lockedUntil: willLock ? (update.locked_until as string) : null,
                attemptsRemaining: willLock ? 0 : MAX_ATTEMPTS - attempts,
            })
        }

        return json({ error: 'Invalid action' }, 400)

    } catch (err) {
        console.error('LOGIN GUARD ERROR:', err)
        return json({ error: String(err) }, 500)
    }
})
