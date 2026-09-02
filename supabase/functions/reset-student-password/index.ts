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
            .select('role, status, first_name, last_name')
            .eq('user_id', caller.id)
            .single()

        const isStaff = callerProfile
            && ['employee', 'registrar_head', 'admin'].includes(callerProfile.role)
            && callerProfile.status === 'active'

        if (!isStaff) {
            return json({ error: 'Only active registrar staff can reset student passwords.' }, 403)
        }

        const { studentUserId, newPassword } = await req.json()

        if (!studentUserId || !newPassword || newPassword.length < 6) {
            return json({ error: 'A student user ID and a password of at least 6 characters are required.' }, 400)
        }

        const { data: studentRow } = await supabaseAdmin
            .from('students')
            .select('student_id, student_number')
            .eq('user_id', studentUserId)
            .maybeSingle()

        if (!studentRow) {
            return json({ error: 'Target account is not a student.' }, 400)
        }

        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(studentUserId, {
            password: newPassword,
        })

        if (updateError) {
            return json({ error: updateError.message }, 500)
        }

        const { data: callerEmployee } = await supabaseAdmin
            .from('employees')
            .select('employee_id')
            .eq('user_id', caller.id)
            .maybeSingle()

        const actorName = callerProfile ? `${callerProfile.first_name} ${callerProfile.last_name}`.trim() : 'Registrar staff'

        await supabaseAdmin.from('activity_logs').insert({
            employee_id: callerEmployee?.employee_id || null,
            user_id: callerEmployee ? null : caller.id,
            action: 'reset_student_password',
            table_name: 'students',
            record_id: studentRow.student_id,
            description: `Reset the login password for student "${studentRow.student_number}" (by ${actorName}).`,
        })

        await supabaseAdmin.from('notifications').insert({
            user_id: studentUserId,
            title: 'Your password was reset',
            message: `Your CertiChain password was reset by ${actorName} from the Registrar's Office. If you did not request this or don't recognize this change, contact the Registrar's Office immediately.`,
            notification_type: 'system',
            is_read: false,
        })

        return json({ success: true })

    } catch (err) {
        console.error('RESET STUDENT PASSWORD ERROR:', err)
        return json({ error: String(err) }, 500)
    }
})
