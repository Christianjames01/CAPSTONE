import { supabase } from './supabase'

const OPEN_STATUSES = [
    'pending', 'payment_pending', 'receipt_uploaded', 'receipt_verified',
    'processing', 'lacking_requirements', 'ready_for_claiming',
]

export async function findAssignedEmployee(collegeId, programId) {
    const { data: assignments, error: assignmentError } = await supabase
        .from('employee_assignments')
        .select('employee_id')
        .eq('college_id', collegeId)
        .eq('program_id', programId)
        .eq('is_primary', true)
        .eq('status', 'active')

    if (assignmentError) {
        throw new Error('Failed to find registrar assignment: ' + assignmentError.message)
    }

    if (!assignments || assignments.length === 0) {
        return null
    }

    if (assignments.length === 1) {
        return assignments[0].employee_id
    }

    const employeeIds = [...new Set(assignments.map((a) => a.employee_id))]

    const { data: openRequests } = await supabase
        .from('document_requests')
        .select('assigned_employee_id')
        .in('assigned_employee_id', employeeIds)
        .in('status', OPEN_STATUSES)

    const countByEmployee = Object.fromEntries(employeeIds.map((id) => [id, 0]))

    for (const r of openRequests || []) {
        countByEmployee[r.assigned_employee_id] = (countByEmployee[r.assigned_employee_id] || 0) + 1
    }

    employeeIds.sort((a, b) => countByEmployee[a] - countByEmployee[b])

    return employeeIds[0]
}
