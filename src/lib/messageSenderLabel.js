import { supabase } from './supabase'

export const REGISTRAR_LABEL = 'HCDC-Registrar'

// Resolves the label to show for a message's sender, consistently across
// all three Messages pages (admin/employee/student): the registrar head
// always reads as "HCDC-Registrar" rather than their personal name (the
// same framing already used in the registrar contact template), an
// employee shows their admin-set nickname when they have one, and a
// student shows their real name. Employees pass showRegistrarHeadName
// so they see the head's full name instead of the office label.
export async function buildSenderLabels(userIds, { showRegistrarHeadName = false } = {}) {
    if (userIds.length === 0) return {}

    const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, role')
        .in('user_id', userIds)

    const employeeIds = (profiles || []).filter((p) => p.role === 'employee').map((p) => p.user_id)

    const { data: employees } = employeeIds.length
        ? await supabase.from('employees').select('user_id, display_name').in('user_id', employeeIds)
        : { data: [] }

    const displayNameByUserId = Object.fromEntries((employees || []).map((e) => [e.user_id, e.display_name]))

    const labels = {}

    for (const p of profiles || []) {
        const realName = `${p.first_name} ${p.last_name}`.trim()

        if ((p.role === 'registrar_head' || p.role === 'admin') && !showRegistrarHeadName) {
            labels[p.user_id] = REGISTRAR_LABEL
        } else if (p.role === 'employee') {
            labels[p.user_id] = displayNameByUserId[p.user_id]?.trim() || realName
        } else {
            labels[p.user_id] = realName
        }
    }

    return labels
}
