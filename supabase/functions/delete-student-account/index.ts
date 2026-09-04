import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const supabaseAdmin = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

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
            .select('role, status, first_name, last_name, email')
            .eq('user_id', caller.id)
            .single()

        const isHeadOrAdmin = callerProfile
            && ['admin', 'registrar_head'].includes(callerProfile.role)
            && callerProfile.status === 'active'

        if (!isHeadOrAdmin) {
            return json({ error: 'Only an active registrar head or admin can delete a student account.' }, 403)
        }

        const { studentUserId, password } = await req.json()

        if (!studentUserId || !password) {
            return json({ error: 'A student user ID and your password are required.' }, 400)
        }

        const verifyClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: { persistSession: false, autoRefreshToken: false },
        })

        const { error: verifyError } = await verifyClient.auth.signInWithPassword({
            email: callerProfile.email || caller.email!,
            password,
        })

        if (verifyError) {
            return json({ error: 'Incorrect password.' }, 401)
        }

        const { data: studentRow } = await supabaseAdmin
            .from('students')
            .select('student_id, student_number')
            .eq('user_id', studentUserId)
            .maybeSingle()

        if (!studentRow) {
            return json({ error: 'Target account is not a student.' }, 400)
        }

        const { count: requestCount, error: countError } = await supabaseAdmin
            .from('document_requests')
            .select('request_id', { count: 'exact', head: true })
            .eq('student_id', studentRow.student_id)

        if (countError) {
            return json({ error: countError.message }, 500)
        }

        if ((requestCount || 0) > 0) {
            return json({
                error: `This student has ${requestCount} document request(s) on file, so their account can't be deleted. Deactivate the account instead.`,
            }, 400)
        }

        const { error: deleteStudentError } = await supabaseAdmin
            .from('students')
            .delete()
            .eq('student_id', studentRow.student_id)

        if (deleteStudentError) {
            return json({ error: 'Failed to delete student record: ' + deleteStudentError.message }, 500)
        }

        const { error: deleteProfileError } = await supabaseAdmin
            .from('profiles')
            .delete()
            .eq('user_id', studentUserId)

        if (deleteProfileError) {
            return json({ error: 'Failed to delete profile: ' + deleteProfileError.message }, 500)
        }

        const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(studentUserId)

        if (deleteAuthError) {
            return json({
                error: `The student record and profile were removed, but the login account itself could not be deleted: ${deleteAuthError.message}`,
            }, 500)
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
            action: 'delete_student_account',
            table_name: 'students',
            record_id: studentRow.student_id,
            description: `Permanently deleted the account for student "${studentRow.student_number}" (by ${actorName}).`,
        })

        return json({ success: true })

    } catch (err) {
        console.error('DELETE STUDENT ACCOUNT ERROR:', err)
        return json({ error: String(err) }, 500)
    }
})
