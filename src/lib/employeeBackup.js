import { supabase } from './supabase'
import { downloadExcelReport } from './reportExport'

const toDate = (v) => (v ? new Date(v) : null)

// Exports everything about one employee before their employees record is
// permanently deleted (src/pages/admin/Employees.jsx removeEmployee). Their
// login account and profile aren't touched by that delete, and every
// request/receipt/etc. they ever touched keeps its own row (the FKs are
// ON DELETE SET NULL, not CASCADE) -- but the employee record itself
// (number, position, assignments) is gone for good, so this is the backup
// for that part.
export async function exportEmployeeBackup(employee) {
    const employeeId = employee.employee_id

    const [{ data: assignments }, { data: requests }, { data: colleges }, { data: programs }] = await Promise.all([
        supabase.from('employee_assignments').select('*').eq('employee_id', employeeId).order('created_at', { ascending: true }),
        supabase.from('document_requests').select('request_number, status, total_amount, requested_at, completed_at').eq('assigned_employee_id', employeeId).order('requested_at', { ascending: true }),
        supabase.from('colleges').select('college_id, college_name'),
        supabase.from('programs').select('program_id, program_name'),
    ])

    const collegeNameById = Object.fromEntries((colleges || []).map((c) => [c.college_id, c.college_name]))
    const programNameById = Object.fromEntries((programs || []).map((p) => [p.program_id, p.program_name]))

    const sheets = [
        {
            name: 'Employee',
            columns: [
                { header: 'Field', key: 'field', width: 24 },
                { header: 'Value', key: 'value', width: 50 },
            ],
            rows: [
                { field: 'Full Name', value: employee.name },
                { field: 'Email', value: employee.email },
                { field: 'Employee Number', value: employee.employee_number },
                { field: 'Position Title', value: employee.position_title },
                { field: 'Nickname', value: employee.displayName || '' },
                { field: 'Assigned College', value: employee.collegeName || '' },
                { field: 'Status', value: employee.status },
                { field: 'Can Add Employees', value: employee.canAddEmployees ? 'Yes' : 'No' },
                { field: 'Backup Generated At', value: new Date().toLocaleString('en-PH') },
            ],
        },
        {
            name: 'Assignments',
            columns: [
                { header: 'College', key: 'college', width: 24 },
                { header: 'Program', key: 'program', width: 28 },
                { header: 'Primary', key: 'primary', width: 10 },
                { header: 'Status', key: 'status', width: 12 },
            ],
            rows: (assignments || []).map((a) => ({
                college: collegeNameById[a.college_id] || '',
                program: programNameById[a.program_id] || '',
                primary: a.is_primary ? 'Yes' : 'No',
                status: a.status,
            })),
        },
        {
            name: 'Requests Handled',
            columns: [
                { header: 'Request #', key: 'request_number', width: 16 },
                { header: 'Status', key: 'status', width: 18 },
                { header: 'Total Amount', key: 'total_amount', width: 14, format: 'peso' },
                { header: 'Requested At', key: 'requested_at', width: 20, format: 'datetime' },
                { header: 'Completed At', key: 'completed_at', width: 20, format: 'datetime' },
            ],
            rows: (requests || []).map((r) => ({
                request_number: r.request_number,
                status: r.status,
                total_amount: Number(r.total_amount || 0),
                requested_at: toDate(r.requested_at),
                completed_at: toDate(r.completed_at),
            })),
        },
    ]

    const fileName = `employee-backup-${employee.employee_number || employeeId}-${new Date().toISOString().slice(0, 10)}.xlsx`

    await downloadExcelReport(fileName, sheets, [
        `Employee Record Backup — ${employee.name}`,
        `Employee Number: ${employee.employee_number} · Generated ${new Date().toLocaleString('en-PH')}`,
        'The login account and request history stay in the system; only the employee record itself is being deleted.',
    ])
}
