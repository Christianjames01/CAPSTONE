import { supabase } from './supabase'

// Sets a temporary password for an employee (registrar head / admin only,
// enforced in the reset_employee_password() database function). The
// employee is signed out and must create a new password on next login.
export async function resetEmployeePassword({ employeeUserId, tempPassword }) {
    const { error } = await supabase.rpc('reset_employee_password', {
        p_employee_user_id: employeeUserId,
        p_temp_password: tempPassword,
    })

    if (error) {
        if (/reset_employee_password/.test(error.message || '') && /schema cache|find the function/i.test(error.message || '')) {
            throw new Error('Password reset is not set up on the database yet (migration 20260925020000).')
        }
        throw new Error(error.message)
    }
}
