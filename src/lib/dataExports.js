// Super Admin "Data Export" page: manual, on-demand exports of whole tables
// for record-keeping. Not a backup system -- there is no automated/scheduled
// job and no restore path. Reuses downloadExcelReport's existing navy-header
// convention (src/lib/reportExport.js), same as employeeBackup.js/
// studentBackup.js/requestBackup.js, but for every row instead of one.
import { supabase } from './supabase'
import { downloadExcelReport } from './reportExport'

const today = () => new Date().toISOString().slice(0, 10)

export async function exportAllStudents() {
    const { data: students } = await supabase
        .from('students')
        .select('*')
        .order('student_number', { ascending: true })

    const userIds = [...new Set((students || []).map((s) => s.user_id))]
    const collegeIds = [...new Set((students || []).map((s) => s.college_id).filter(Boolean))]
    const programIds = [...new Set((students || []).map((s) => s.program_id).filter(Boolean))]

    const [{ data: profiles }, { data: colleges }, { data: programs }] = await Promise.all([
        userIds.length ? supabase.from('profiles').select('user_id, first_name, last_name, email').in('user_id', userIds) : Promise.resolve({ data: [] }),
        collegeIds.length ? supabase.from('colleges').select('college_id, college_name').in('college_id', collegeIds) : Promise.resolve({ data: [] }),
        programIds.length ? supabase.from('programs').select('program_id, program_name').in('program_id', programIds) : Promise.resolve({ data: [] }),
    ])

    const profileByUserId = Object.fromEntries((profiles || []).map((p) => [p.user_id, p]))
    const collegeNameById = Object.fromEntries((colleges || []).map((c) => [c.college_id, c.college_name]))
    const programNameById = Object.fromEntries((programs || []).map((p) => [p.program_id, p.program_name]))

    const rows = (students || []).map((s) => {
        const profile = profileByUserId[s.user_id] || {}
        return {
            student_number: s.student_number,
            name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
            email: profile.email || '',
            college: collegeNameById[s.college_id] || '',
            program: programNameById[s.program_id] || '',
            year_level: s.year_level || '',
            student_type: s.student_type,
            status: s.status,
            verification_status: s.verification_status,
        }
    })

    await downloadExcelReport(`certichain-students-${today()}.xlsx`, [{
        name: 'Students',
        columns: [
            { header: 'Student #', key: 'student_number', width: 14 },
            { header: 'Name', key: 'name', width: 26 },
            { header: 'Email', key: 'email', width: 28 },
            { header: 'College', key: 'college', width: 22 },
            { header: 'Program', key: 'program', width: 26 },
            { header: 'Year Level', key: 'year_level', width: 12 },
            { header: 'Type', key: 'student_type', width: 10 },
            { header: 'Status', key: 'status', width: 12 },
            { header: 'Verification', key: 'verification_status', width: 14 },
        ],
        rows,
    }], ['Students export', `Generated ${new Date().toLocaleString('en-PH')} · ${rows.length} student(s)`])

    return rows.length
}

export async function exportAllEmployees() {
    const { data: employees } = await supabase
        .from('employees')
        .select('*')
        .order('employee_number', { ascending: true })

    const userIds = [...new Set((employees || []).map((e) => e.user_id))]
    const employeeIds = (employees || []).map((e) => e.employee_id)

    const [{ data: profiles }, { data: assignments }] = await Promise.all([
        userIds.length ? supabase.from('profiles').select('user_id, first_name, last_name, email').in('user_id', userIds) : Promise.resolve({ data: [] }),
        employeeIds.length ? supabase.from('employee_assignments').select('employee_id, college_id, program_id, is_primary, status').in('employee_id', employeeIds) : Promise.resolve({ data: [] }),
    ])

    const collegeIds = [...new Set((assignments || []).map((a) => a.college_id).filter(Boolean))]
    const programIds = [...new Set((assignments || []).map((a) => a.program_id).filter(Boolean))]
    const [{ data: colleges }, { data: programs }] = await Promise.all([
        collegeIds.length ? supabase.from('colleges').select('college_id, college_name').in('college_id', collegeIds) : Promise.resolve({ data: [] }),
        programIds.length ? supabase.from('programs').select('program_id, program_name').in('program_id', programIds) : Promise.resolve({ data: [] }),
    ])

    const profileByUserId = Object.fromEntries((profiles || []).map((p) => [p.user_id, p]))
    const collegeNameById = Object.fromEntries((colleges || []).map((c) => [c.college_id, c.college_name]))
    const programNameById = Object.fromEntries((programs || []).map((p) => [p.program_id, p.program_name]))
    const primaryByEmployeeId = {}
    for (const a of assignments || []) {
        if (a.is_primary && a.status === 'active') primaryByEmployeeId[a.employee_id] = a
    }

    const rows = (employees || []).map((e) => {
        const profile = profileByUserId[e.user_id] || {}
        const primary = primaryByEmployeeId[e.employee_id]
        return {
            employee_number: e.employee_number,
            name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
            email: profile.email || '',
            position_title: e.position_title || '',
            access_scope: e.access_scope,
            primary_college: primary ? collegeNameById[primary.college_id] || '' : '',
            primary_program: primary ? programNameById[primary.program_id] || '' : '',
            status: e.status,
        }
    })

    await downloadExcelReport(`certichain-employees-${today()}.xlsx`, [{
        name: 'Employees',
        columns: [
            { header: 'Employee #', key: 'employee_number', width: 14 },
            { header: 'Name', key: 'name', width: 26 },
            { header: 'Email', key: 'email', width: 28 },
            { header: 'Position', key: 'position_title', width: 22 },
            { header: 'Access scope', key: 'access_scope', width: 12 },
            { header: 'Primary college', key: 'primary_college', width: 22 },
            { header: 'Primary program', key: 'primary_program', width: 26 },
            { header: 'Status', key: 'status', width: 12 },
        ],
        rows,
    }], ['Employees export', `Generated ${new Date().toLocaleString('en-PH')} · ${rows.length} employee(s)`])

    return rows.length
}

export async function exportAllRequests() {
    const { data: requests } = await supabase
        .from('document_requests')
        .select('request_number, status, quantity, total_amount, purpose, requested_at, completed_at, document_type_id, student_id')
        .order('requested_at', { ascending: false })

    const docTypeIds = [...new Set((requests || []).map((r) => r.document_type_id).filter(Boolean))]
    const studentIds = [...new Set((requests || []).map((r) => r.student_id).filter(Boolean))]

    const [{ data: docTypes }, { data: students }] = await Promise.all([
        docTypeIds.length ? supabase.from('document_types').select('document_type_id, document_name').in('document_type_id', docTypeIds) : Promise.resolve({ data: [] }),
        studentIds.length ? supabase.from('students').select('student_id, student_number').in('student_id', studentIds) : Promise.resolve({ data: [] }),
    ])

    const docNameById = Object.fromEntries((docTypes || []).map((d) => [d.document_type_id, d.document_name]))
    const studentNumberById = Object.fromEntries((students || []).map((s) => [s.student_id, s.student_number]))

    const rows = (requests || []).map((r) => ({
        request_number: r.request_number,
        student_number: studentNumberById[r.student_id] || '',
        document: docNameById[r.document_type_id] || '',
        quantity: r.quantity,
        total_amount: r.total_amount,
        status: r.status,
        purpose: r.purpose || '',
        requested_at: r.requested_at ? new Date(r.requested_at) : null,
        completed_at: r.completed_at ? new Date(r.completed_at) : null,
    }))

    await downloadExcelReport(`certichain-requests-${today()}.xlsx`, [{
        name: 'Document Requests',
        columns: [
            { header: 'Request #', key: 'request_number', width: 16 },
            { header: 'Student #', key: 'student_number', width: 14 },
            { header: 'Document', key: 'document', width: 28 },
            { header: 'Quantity', key: 'quantity', width: 10 },
            { header: 'Total Amount', key: 'total_amount', width: 14, format: 'peso' },
            { header: 'Status', key: 'status', width: 18 },
            { header: 'Purpose', key: 'purpose', width: 24 },
            { header: 'Requested At', key: 'requested_at', width: 20, format: 'datetime' },
            { header: 'Completed At', key: 'completed_at', width: 20, format: 'datetime' },
        ],
        rows,
    }], ['Document requests export', `Generated ${new Date().toLocaleString('en-PH')} · ${rows.length} request(s)`])

    return rows.length
}

export async function exportAllCredentials() {
    // Deliberately excludes the `signature` column -- it's not secret, just
    // not relevant to a records export; integrity status is covered by the
    // Security Center's own tooling, not this page.
    const { data: credentials } = await supabase
        .from('credentials')
        .select('credential_number, status, student_id, document_type_id, generated_at, released_at, revoked_at, revocation_reason')
        .order('generated_at', { ascending: false })

    const docTypeIds = [...new Set((credentials || []).map((c) => c.document_type_id).filter(Boolean))]
    const studentIds = [...new Set((credentials || []).map((c) => c.student_id).filter(Boolean))]

    const [{ data: docTypes }, { data: students }] = await Promise.all([
        docTypeIds.length ? supabase.from('document_types').select('document_type_id, document_name').in('document_type_id', docTypeIds) : Promise.resolve({ data: [] }),
        studentIds.length ? supabase.from('students').select('student_id, student_number').in('student_id', studentIds) : Promise.resolve({ data: [] }),
    ])

    const docNameById = Object.fromEntries((docTypes || []).map((d) => [d.document_type_id, d.document_name]))
    const studentNumberById = Object.fromEntries((students || []).map((s) => [s.student_id, s.student_number]))

    const rows = (credentials || []).map((c) => ({
        credential_number: c.credential_number,
        student_number: studentNumberById[c.student_id] || '',
        document: docNameById[c.document_type_id] || '',
        status: c.status,
        generated_at: c.generated_at ? new Date(c.generated_at) : null,
        released_at: c.released_at ? new Date(c.released_at) : null,
        revoked_at: c.revoked_at ? new Date(c.revoked_at) : null,
        revocation_reason: c.revocation_reason || '',
    }))

    await downloadExcelReport(`certichain-credentials-${today()}.xlsx`, [{
        name: 'Credentials',
        columns: [
            { header: 'Credential #', key: 'credential_number', width: 18 },
            { header: 'Student #', key: 'student_number', width: 14 },
            { header: 'Document', key: 'document', width: 28 },
            { header: 'Status', key: 'status', width: 12 },
            { header: 'Generated At', key: 'generated_at', width: 20, format: 'datetime' },
            { header: 'Released At', key: 'released_at', width: 20, format: 'datetime' },
            { header: 'Revoked At', key: 'revoked_at', width: 20, format: 'datetime' },
            { header: 'Revocation Reason', key: 'revocation_reason', width: 26 },
        ],
        rows,
    }], ['Credentials export', `Generated ${new Date().toLocaleString('en-PH')} · ${rows.length} credential(s)`])

    return rows.length
}
