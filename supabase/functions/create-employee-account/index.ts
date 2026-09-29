import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Creates an employee account for the registrar head (Employees > Add
// Employee). Runs with the service role, so no Cloudflare security check is
// needed -- the caller must be a signed-in, active registrar head or admin.
//
// Creates the login (already confirmed; the employee must change the
// password on first sign-in) and the employees row. If the employees row
// can't be saved, the login is deleted again so nothing is left half-made.

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

// Finds a login by email: profiles first, then the auth user list.
async function findUserByEmail(email: string) {
    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('user_id')
        .ilike('email', email)
        .maybeSingle()
    if (profile?.user_id) {
        const { data } = await supabaseAdmin.auth.admin.getUserById(profile.user_id)
        if (data?.user && (data.user.email || '').toLowerCase() === email) return data.user
    }

    for (let page = 1; page <= 20; page++) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 })
        if (error) return null
        const match = data.users.find((u) => (u.email || '').toLowerCase() === email)
        if (match) return match
        if (data.users.length < 1000) return null
    }
    return null
}

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '')

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
        if (!token) return json({ error: 'Missing authorization.' }, 401)

        const { data: { user: caller }, error: callerError } = await supabaseAdmin.auth.getUser(token)
        if (callerError || !caller) return json({ error: 'Invalid session.' }, 401)

        const { data: callerProfile } = await supabaseAdmin
            .from('profiles')
            .select('role, status')
            .eq('user_id', caller.id)
            .single()

        const allowed = callerProfile
            && ['registrar_head', 'admin'].includes(callerProfile.role)
            && callerProfile.status === 'active'
        if (!allowed) return json({ error: 'Only an active registrar head can add employees.' }, 403)

        const body = await req.json()
        const email = text(body.email, 254).toLowerCase()
        const password = typeof body.password === 'string' ? body.password : ''
        const firstName = text(body.firstName, 100)
        const lastName = text(body.lastName, 100)
        const employeeNumber = text(body.employeeNumber, 50)
        const positionTitle = text(body.positionTitle, 120)
        const displayName = text(body.displayName, 120) || null
        const assignedCollegeId = text(body.assignedCollegeId, 64) || null

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Enter a valid email address.' }, 400)
        if (password.length < 8 || password.length > 72) return json({ error: 'The password must be 8 to 72 characters.' }, 400)
        if (!firstName || !lastName || !employeeNumber || !positionTitle) {
            return json({ error: 'Please fill in all required fields.' }, 400)
        }

        const metadata = { role: 'employee', first_name: firstName, last_name: lastName }

        const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: metadata,
        })

        let newUser = created?.user
        // Whether this call made the login (so a failure below may delete it).
        let madeLogin = !!newUser

        if (createError || !newUser) {
            const message = createError?.message || 'The account could not be created.'
            if (!/already (been )?registered|already exists/i.test(message)) return json({ error: message }, 400)

            // The email already has a login. Finish it as an employee only if
            // it's a leftover from an earlier failed Add Employee: not a
            // student, head or admin, and not already an employee.
            const existing = await findUserByEmail(email)
            if (!existing) return json({ error: 'An account with this email already exists.' }, 409)

            const [{ data: employeeRow }, { data: studentRow }, { data: profileRow }] = await Promise.all([
                supabaseAdmin.from('employees').select('employee_id').eq('user_id', existing.id).maybeSingle(),
                supabaseAdmin.from('students').select('student_id').eq('user_id', existing.id).maybeSingle(),
                supabaseAdmin.from('profiles').select('role').eq('user_id', existing.id).maybeSingle(),
            ])

            if (employeeRow) return json({ error: 'This email already belongs to an employee.' }, 409)
            if (studentRow || profileRow?.role === 'student') {
                return json({ error: 'This email belongs to a student account. Use a different email for the employee.' }, 409)
            }
            if (profileRow && !['employee', null, ''].includes(profileRow.role)) {
                return json({ error: 'This email belongs to a registrar head or admin account.' }, 409)
            }

            const { data: updated, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
                password,
                email_confirm: true,
                user_metadata: metadata,
            })
            if (updateError || !updated?.user) {
                return json({ error: updateError?.message || 'The existing login could not be updated.' }, 400)
            }

            if (profileRow) {
                await supabaseAdmin
                    .from('profiles')
                    .update({ role: 'employee', first_name: firstName, last_name: lastName })
                    .eq('user_id', existing.id)
            }

            newUser = updated.user
            madeLogin = false
        }

        const { error: employeeError } = await supabaseAdmin
            .from('employees')
            .insert({
                user_id: newUser.id,
                employee_number: employeeNumber,
                position_title: positionTitle,
                assigned_college_id: assignedCollegeId,
                display_name: displayName,
                status: 'active',
            })

        if (employeeError) {
            if (madeLogin) await supabaseAdmin.auth.admin.deleteUser(newUser.id)
            return json({ error: `The employee profile could not be saved: ${employeeError.message}` }, 400)
        }

        await supabaseAdmin
            .from('profiles')
            .update({ must_change_password: true })
            .eq('user_id', newUser.id)

        return json({ user: { id: newUser.id, email: newUser.email } })
    } catch (err) {
        console.error('CREATE EMPLOYEE ACCOUNT ERROR:', err)
        return json({ error: String(err) }, 500)
    }
})
