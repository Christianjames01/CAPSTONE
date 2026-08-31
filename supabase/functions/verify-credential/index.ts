// Public credential verification, rate-limited per IP. Credential numbers
// are short and sequential (CERT-000123), so unlimited direct table access
// would let anyone script through the whole number space and harvest every
// graduate's name, college, and program from public_credential_verification.
// This function is now the ONLY way to read that view -- anon/authenticated
// grants on it have been revoked (see the accompanying migration).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MAX_ATTEMPTS = 20
const WINDOW_MINUTES = 10

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
        const { credentialNumber } = await req.json()

        if (!credentialNumber || typeof credentialNumber !== 'string' || !credentialNumber.trim()) {
            return json({ error: 'Missing credential number' }, 400)
        }

        const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
        const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString()

        const { count } = await supabaseAdmin
            .from('credential_verification_attempts')
            .select('attempt_id', { count: 'exact', head: true })
            .eq('ip_address', ip)
            .gte('created_at', windowStart)

        if ((count || 0) >= MAX_ATTEMPTS) {
            return json({ rateLimited: true, message: 'Too many verification attempts. Please try again in a few minutes.' }, 429)
        }

        await supabaseAdmin.from('credential_verification_attempts').insert({ ip_address: ip })

        const { data, error } = await supabaseAdmin
            .from('public_credential_verification')
            .select('*')
            .eq('credential_number', credentialNumber.trim())
            .maybeSingle()

        if (error) {
            console.error('VERIFY LOOKUP ERROR:', error)
            return json({ error: 'Lookup failed' }, 500)
        }

        return json({ result: data || null })

    } catch (err) {
        console.error('VERIFY CREDENTIAL ERROR:', err)
        return json({ error: String(err) }, 500)
    }
})
