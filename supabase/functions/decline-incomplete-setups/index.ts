import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET')

const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const WORKING_DAYS_ALLOWED = 3

function phDateOnly(ms: number): Date {
    const phShifted = new Date(ms + 8 * 60 * 60 * 1000)
    return new Date(phShifted.toISOString().slice(0, 10) + 'T00:00:00Z')
}

function businessDaysElapsed(startMs: number, endMs: number): number {
    let cursor = phDateOnly(startMs)
    const end = phDateOnly(endMs)
    let count = 0

    while (cursor < end) {
        cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
        const day = cursor.getUTCDay()
        if (day !== 0 && day !== 6) count++
    }

    return count
}

Deno.serve(async (req) => {
    if (WEBHOOK_SECRET && req.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    try {
        const now = Date.now()
        const calendarDayPrefilter = new Date(now - WORKING_DAYS_ALLOWED * 24 * 60 * 60 * 1000).toISOString()

        const { data: candidateProfiles, error: profilesError } = await supabaseAdmin
            .from('profiles')
            .select('user_id, first_name, last_name, email, created_at')
            .eq('role', 'student')
            .eq('status', 'active')
            .lte('created_at', calendarDayPrefilter)

        if (profilesError) throw profilesError

        const candidates = candidateProfiles || []

        if (candidates.length === 0) {
            return new Response(JSON.stringify({ declinedCount: 0 }), { status: 200 })
        }

        const candidateUserIds = candidates.map((p) => p.user_id)

        const { data: existingStudents, error: studentsError } = await supabaseAdmin
            .from('students')
            .select('user_id')
            .in('user_id', candidateUserIds)

        if (studentsError) throw studentsError

        const hasStudentRecord = new Set((existingStudents || []).map((s) => s.user_id))

        let declinedCount = 0

        for (const profile of candidates) {
            if (hasStudentRecord.has(profile.user_id)) continue

            const daysWaiting = businessDaysElapsed(new Date(profile.created_at).getTime(), now)
            if (daysWaiting < WORKING_DAYS_ALLOWED) continue

            const { error: updateError } = await supabaseAdmin
                .from('profiles')
                .update({ status: 'inactive' })
                .eq('user_id', profile.user_id)
                .eq('status', 'active')

            if (updateError) {
                console.error('FAILED TO DECLINE', profile.user_id, updateError)
                continue
            }

            declinedCount++

            const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email

            await supabaseAdmin.from('activity_logs').insert({
                user_id: null,
                employee_id: null,
                action: 'auto_decline_incomplete_setup',
                table_name: 'profiles',
                record_id: profile.user_id,
                description: `Auto-deactivated "${name}" (${profile.email}) after ${WORKING_DAYS_ALLOWED} working days without completing student profile setup.`,
            })
        }

        return new Response(JSON.stringify({ declinedCount }), { status: 200 })

    } catch (err) {
        console.error('DECLINE INCOMPLETE SETUPS ERROR:', err)
        return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
    }
})
