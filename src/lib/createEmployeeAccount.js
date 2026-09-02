import { createClient } from '@supabase/supabase-js'
import { supabase } from './supabase'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export async function createEmployeeAccount({
    email,
    password,
    firstName,
    lastName,
    employeeNumber,
    positionTitle,
    assignedCollegeId,
}) {
    const tempClient = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data, error } = await tempClient.auth.signUp({
        email,
        password,
        options: {
            data: {
                role: 'employee',
                first_name: firstName,
                last_name: lastName,
            },
        },
    })

    if (error) {
        throw new Error(error.message)
    }

    if (!data.user) {
        throw new Error(
            'Account created, but no user was returned. Email confirmation may be required before the profile exists.'
        )
    }

    const { error: employeeError } = await supabase
        .from('employees')
        .insert({
            user_id: data.user.id,
            employee_number: employeeNumber,
            position_title: positionTitle,
            assigned_college_id: assignedCollegeId || null,
            status: 'active',
        })

    if (employeeError) {
        throw new Error(
            `Account created (${email}), but the employee profile could not be saved: ${employeeError.message}`
        )
    }

    return data.user
}
