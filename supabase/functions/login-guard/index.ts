import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MAX_ATTEMPTS = 5
const LOCKOUT_MINUTES = 15
// Failed attempts one IP address may record per window (stops one person
// locking many accounts by reporting fake failures).
const MAX_FAILURES_PER_IP = 20

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
                // Only the signed-in owner of this email can clear the counter
                // (otherwise anyone could reset it between password guesses).
                const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
                const { data: { user } } = token
                    ? await supabaseAdmin.auth.getUser(token).catch(() => ({ data: { user: null } }))
                    : { data: { user: null } }
                if (!user || (user.email || '').toLowerCase() !== email.trim().toLowerCase()) {
                    return json({ ok: true })
                }
                await supabaseAdmin
                    .from('profiles')
                    .update({ failed_login_attempts: 0, locked_until: null })
                    .eq('user_id', profile.user_id)

                return json({ ok: true })
            }

            if (isLocked) {
                return json({ locked: true, lockedUntil: lockedUntil!.toISOString() })
            }

            // Per-IP cap on reported failures (table from 20260930020000;
            // skipped if it isn't there yet).
            const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
            const since = new Date(Date.now() - LOCKOUT_MINUTES * 60_000).toISOString()
            const { count, error: countError } = await supabaseAdmin
                .from('login_guard_attempts')
                .select('attempt_id', { count: 'exact', head: true })
                .eq('ip_address', ip)
                .gte('created_at', since)
            if (!countError) {
                if ((count || 0) >= MAX_FAILURES_PER_IP) {
                    return json({ locked: false, attemptsRemaining: null })
                }
                await supabaseAdmin.from('login_guard_attempts').insert({ ip_address: ip })
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
