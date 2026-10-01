import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Fetches the newest videos from the HCDC Facebook Page (Graph API) into
// lobby_videos, so the lobby Queue Display plays them automatically.
//
// Secrets (Edge Functions -> Secrets):
//   FB_PAGE_TOKEN    a Page access token for the HCDC Page (from a Page admin)
//   FB_MAX_VIDEOS    optional, how many newest videos to keep (default 10)
//   FB_MAX_SECONDS   optional, longest play time per video (default 180)
//
// Called hourly by pg_cron (x-webhook-secret), or from the Queue page's
// "Sync now" by an active Registrar Head/admin.

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET')
const PAGE_TOKEN = Deno.env.get('FB_PAGE_TOKEN')
const MAX_VIDEOS = Math.min(25, Math.max(1, Number(Deno.env.get('FB_MAX_VIDEOS')) || 10))
const MAX_SECONDS = Math.min(900, Math.max(10, Number(Deno.env.get('FB_MAX_SECONDS')) || 180))
const GRAPH = 'https://graph.facebook.com/v21.0'

const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

function sameSecret(given: string | null, expected: string): boolean {
    if (!given) return false
    const a = new TextEncoder().encode(given)
    const b = new TextEncoder().encode(expected)
    let diff = a.length ^ b.length
    for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0)
    return diff === 0
}

// The cron job (secret) or a signed-in active head/admin.
async function allowed(req: Request): Promise<boolean> {
    if (WEBHOOK_SECRET && sameSecret(req.headers.get('x-webhook-secret'), WEBHOOK_SECRET)) return true
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    if (!token) return false
    const { data: { user } } = await supabaseAdmin.auth.getUser(token).catch(() => ({ data: { user: null } }))
    if (!user) return false
    const { data: profile } = await supabaseAdmin.from('profiles').select('role, status').eq('user_id', user.id).maybeSingle()
    return !!profile && ['registrar_head', 'admin'].includes(profile.role) && profile.status === 'active'
}

type FbVideo = {
    id: string
    title?: string
    description?: string
    permalink_url?: string
    length?: number
    created_time?: string
    published?: boolean
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        if (!(await allowed(req))) return json({ error: 'Unauthorized' }, 401)

        if (!PAGE_TOKEN) {
            return json({ error: 'Not set up yet: add FB_PAGE_TOKEN (a Page access token for the HCDC Facebook Page) to the Edge Function secrets.' }, 400)
        }

        // The Page's own videos, newest first (/me with a Page token = the Page).
        const params = new URLSearchParams({
            fields: 'id,title,description,permalink_url,length,created_time,published',
            limit: String(MAX_VIDEOS),
            access_token: PAGE_TOKEN,
        })
        const res = await fetch(`${GRAPH}/me/videos?${params}`)
        const body = await res.json()
        if (!res.ok || body.error) {
            const message = body?.error?.message || `Facebook returned ${res.status}`
            return json({ error: `Facebook: ${message}` }, 502)
        }

        const videos: FbVideo[] = (body.data || []).filter((v: FbVideo) => v.id && v.published !== false)

        const rows = videos.map((v) => {
            const link = v.permalink_url
                ? (v.permalink_url.startsWith('http') ? v.permalink_url : `https://www.facebook.com${v.permalink_url}`)
                : `https://www.facebook.com/watch/?v=${v.id}`
            const text = (v.title || v.description || '').replace(/\s+/g, ' ').trim()
            return {
                fb_video_id: v.id,
                source: 'facebook',
                url: link,
                title: text ? text.slice(0, 120) : null,
                play_seconds: Math.min(MAX_SECONDS, Math.max(10, Math.ceil(v.length || 60))),
                published_at: v.created_time || null,
            }
        })

        let added = 0
        if (rows.length) {
            // Existing ones keep is_active (a head may have hidden one).
            const { data: existing } = await supabaseAdmin
                .from('lobby_videos')
                .select('fb_video_id')
                .in('fb_video_id', rows.map((r) => r.fb_video_id))
            const known = new Set((existing || []).map((r: { fb_video_id: string }) => r.fb_video_id))
            added = rows.filter((r) => !known.has(r.fb_video_id)).length

            const { error } = await supabaseAdmin.from('lobby_videos').upsert(rows, { onConflict: 'fb_video_id' })
            if (error) throw error
        }

        // Keep only the newest MAX_VIDEOS from Facebook.
        const keepIds = rows.map((r) => r.fb_video_id)
        let removed = 0
        if (keepIds.length) {
            const { data: gone } = await supabaseAdmin
                .from('lobby_videos')
                .delete()
                .eq('source', 'facebook')
                .not('fb_video_id', 'in', `(${keepIds.map((id) => `"${id}"`).join(',')})`)
                .select('video_id')
            removed = gone?.length || 0
        }

        return json({ ok: true, fetched: rows.length, added, removed })
    } catch (err) {
        console.error('SYNC FACEBOOK VIDEOS ERROR:', err)
        return json({ error: String(err) }, 500)
    }
})
