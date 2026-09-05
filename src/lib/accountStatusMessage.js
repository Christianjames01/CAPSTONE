import { supabase } from './supabase'

const GENERIC_INACTIVE_MESSAGE = "Your account has been deactivated. Please contact the Registrar's Office for assistance."

export async function getInactiveAccountMessage(userId, role) {
    if (role === 'student') {
        const { data: student } = await supabase
            .from('students')
            .select('verification_status, verification_note')
            .eq('user_id', userId)
            .maybeSingle()

        if (student?.verification_status === 'rejected') {
            const reason = student.verification_note ? ` Reason: ${student.verification_note}.` : ''
            return `Your student registration was rejected.${reason} Please visit or contact the Registrar's Office for assistance.`
        }
    }

    return GENERIC_INACTIVE_MESSAGE
}

// Registrar staff (employee / registrar_head) can have a separate row in the
// `employees` table on top of `profiles`. A head can deactivate or delete
// that row without touching `profiles.status`, so it has to be checked on
// its own -- otherwise the account still passes the profile check above.
//
// Every `employee` account is guaranteed one (both signup paths insert it),
// so a missing row means it was deleted. A `registrar_head` is not
// guaranteed one -- most never had one to begin with -- so a missing row
// only counts as "deleted" if they're an employee; for a head it's simply
// not applicable, and a missing row must not lock them out.
export async function getEmployeeAccountIssue(userId, role) {
    const { data: employee } = await supabase
        .from('employees')
        .select('status')
        .eq('user_id', userId)
        .maybeSingle()

    if (!employee) return role === 'employee' ? 'deleted' : null
    if (employee.status !== 'active') return 'deactivated'
    return null
}

export function employeeIssueMessage(issue, role) {
    if (issue === 'deleted') {
        return role === 'registrar_head'
            ? 'Your registrar staff record has been removed. Please contact the system administrator for assistance.'
            : "Your employee record has been removed by the Registrar Head. Please contact the Registrar's Office for assistance."
    }

    if (issue === 'deactivated') {
        return role === 'registrar_head'
            ? 'Your registrar staff account has been deactivated. Please contact the system administrator for assistance.'
            : "Your employee account has been deactivated by the Registrar Head. Please contact the Registrar's Office for assistance."
    }

    return null
}
