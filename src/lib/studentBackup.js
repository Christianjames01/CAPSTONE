import { supabase } from './supabase'
import { downloadExcelReport } from './reportExport'

const toDate = (v) => (v ? new Date(v) : null)

// Exports everything about one student before their account is permanently
// deleted: profile, every document request, receipt and credential on file,
// and claim schedules. This Excel file is the only record left afterward --
// deleting the account removes all of this from the database (see
// deleteStudentAccount / delete-student-account).
export async function exportStudentBackup(student) {
    const studentId = student.student_id

    const [{ data: requests }, { data: receipts }, { data: credentials }, { data: schedules }, { data: docTypes }] = await Promise.all([
        supabase.from('document_requests').select('*').eq('student_id', studentId).order('requested_at', { ascending: true }),
        supabase.from('official_receipts').select('*').eq('student_id', studentId).order('uploaded_at', { ascending: true }),
        supabase.from('credentials').select('*').eq('student_id', studentId).order('generated_at', { ascending: true }),
        supabase.from('claim_schedules').select('*').eq('student_id', studentId).order('created_at', { ascending: true }),
        supabase.from('document_types').select('document_type_id, document_name'),
    ])

    const docNameById = Object.fromEntries((docTypes || []).map((d) => [d.document_type_id, d.document_name]))

    const sheets = [
        {
            name: 'Profile',
            columns: [
                { header: 'Field', key: 'field', width: 24 },
                { header: 'Value', key: 'value', width: 50 },
            ],
            rows: [
                { field: 'Full Name', value: student.fullName },
                { field: 'Student Number', value: student.student_number },
                { field: 'Email', value: student.email },
                { field: 'College', value: student.collegeName || '' },
                { field: 'Program', value: student.programName || '' },
                {
                    field: 'Year Level / Type',
                    value: student.student_type === 'alumni'
                        ? `Alumni, Class of ${student.graduation_year || 'N/A'}`
                        : (student.year_level || ''),
                },
                { field: 'Status', value: student.status },
                { field: 'Backup Generated At', value: new Date().toLocaleString('en-PH') },
            ],
        },
        {
            name: 'Document Requests',
            columns: [
                { header: 'Request #', key: 'request_number', width: 16 },
                { header: 'Document', key: 'document', width: 28 },
                { header: 'Quantity', key: 'quantity', width: 10 },
                { header: 'Total Amount', key: 'total_amount', width: 14, format: 'peso' },
                { header: 'Status', key: 'status', width: 18 },
                { header: 'Purpose', key: 'purpose', width: 24 },
                { header: 'Requested At', key: 'requested_at', width: 20, format: 'datetime' },
                { header: 'Completed At', key: 'completed_at', width: 20, format: 'datetime' },
            ],
            rows: (requests || []).map((r) => ({
                request_number: r.request_number,
                document: docNameById[r.document_type_id] || 'Document',
                quantity: r.quantity,
                total_amount: Number(r.total_amount || 0),
                status: r.status,
                purpose: r.purpose || '',
                requested_at: toDate(r.requested_at),
                completed_at: toDate(r.completed_at),
            })),
        },
        {
            name: 'Official Receipts',
            columns: [
                { header: 'Receipt #', key: 'receipt_number', width: 18 },
                { header: 'Amount Paid', key: 'amount_paid', width: 14, format: 'peso' },
                { header: 'Status', key: 'status', width: 14 },
                { header: 'Uploaded At', key: 'uploaded_at', width: 20, format: 'datetime' },
                { header: 'Verified At', key: 'verified_at', width: 20, format: 'datetime' },
                { header: 'Rejection Reason', key: 'rejection_reason', width: 30 },
            ],
            rows: (receipts || []).map((r) => ({
                receipt_number: r.receipt_number || '',
                amount_paid: Number(r.amount_paid || 0),
                status: r.status,
                uploaded_at: toDate(r.uploaded_at),
                verified_at: toDate(r.verified_at),
                rejection_reason: r.rejection_reason || '',
            })),
        },
        {
            name: 'Credentials',
            columns: [
                { header: 'Credential #', key: 'credential_number', width: 18 },
                { header: 'Status', key: 'status', width: 14 },
                { header: 'Generated At', key: 'generated_at', width: 20, format: 'datetime' },
                { header: 'Released At', key: 'released_at', width: 20, format: 'datetime' },
                { header: 'Revoked At', key: 'revoked_at', width: 20, format: 'datetime' },
                { header: 'Revocation Reason', key: 'revocation_reason', width: 30 },
            ],
            rows: (credentials || []).map((c) => ({
                credential_number: c.credential_number,
                status: c.status,
                generated_at: toDate(c.generated_at),
                released_at: toDate(c.released_at),
                revoked_at: toDate(c.revoked_at),
                revocation_reason: c.revocation_reason || '',
            })),
        },
        {
            name: 'Claim Schedules',
            columns: [
                { header: 'Claim Date', key: 'claim_date', width: 16 },
                { header: 'Claim Time', key: 'claim_time', width: 12 },
                { header: 'Status', key: 'status', width: 16 },
                { header: 'Claiming Counter', key: 'claiming_counter', width: 18 },
                { header: 'Claimed At', key: 'claimed_at', width: 20, format: 'datetime' },
            ],
            rows: (schedules || []).map((s) => ({
                claim_date: s.claim_date || s.scheduled_date || '',
                claim_time: s.claim_time || s.scheduled_time || '',
                status: s.status,
                claiming_counter: s.claiming_counter || '',
                claimed_at: toDate(s.claimed_at),
            })),
        },
    ]

    const fileName = `student-backup-${student.student_number || studentId}-${new Date().toISOString().slice(0, 10)}.xlsx`

    await downloadExcelReport(fileName, sheets, [
        `Student Account Backup — ${student.fullName}`,
        `Student Number: ${student.student_number} · Generated ${new Date().toLocaleString('en-PH')}`,
        'This file is the only record kept once this account is permanently deleted.',
    ])
}
