import { supabase } from './supabase'
import { downloadExcelReport } from './reportExport'

const toDate = (v) => (v ? new Date(v) : null)

// Exports everything about one request before it's permanently deleted
// from All Requests (delete_resolved_request) -- the official receipt,
// requirement files, claim schedule and any issued credential, all as one
// Excel workbook. Mirrors exportStudentBackup/exportEmployeeBackup.
export async function exportRequestBackup(request) {
    const requestId = request.request_id

    const [{ data: receipts }, { data: requirements }, { data: schedules }, { data: credentials }] = await Promise.all([
        supabase.from('official_receipts').select('*').eq('request_id', requestId).order('uploaded_at', { ascending: true }),
        supabase.from('request_requirements').select('*').eq('request_id', requestId).order('created_at', { ascending: true }),
        supabase.from('claim_schedules').select('*').eq('request_id', requestId).order('created_at', { ascending: true }),
        supabase.from('credentials').select('*').eq('request_id', requestId),
    ])

    const sheets = [
        {
            name: 'Request',
            columns: [
                { header: 'Field', key: 'field', width: 24 },
                { header: 'Value', key: 'value', width: 50 },
            ],
            rows: [
                { field: 'Request #', value: request.request_number },
                { field: 'Student', value: request.studentName || '' },
                { field: 'Student Number', value: request.studentNumber || '' },
                { field: 'Document', value: request.documentName || '' },
                { field: 'Quantity', value: request.quantity },
                { field: 'Total Amount', value: `₱${Number(request.total_amount || 0).toFixed(2)}` },
                { field: 'Status', value: request.status },
                { field: 'Purpose', value: request.purpose || '' },
                { field: 'Assigned Employee', value: request.employeeName || '' },
                { field: 'Requested At', value: request.requested_at ? new Date(request.requested_at).toLocaleString('en-PH') : '' },
                { field: 'Completed At', value: request.completed_at ? new Date(request.completed_at).toLocaleString('en-PH') : '' },
                { field: 'Backup Generated At', value: new Date().toLocaleString('en-PH') },
            ],
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
            name: 'Requirements',
            columns: [
                { header: 'Requirement', key: 'requirement_name', width: 28 },
                { header: 'Status', key: 'status', width: 16 },
                { header: 'Uploaded At', key: 'uploaded_at', width: 20, format: 'datetime' },
                { header: 'Rejection Reason', key: 'rejection_reason', width: 30 },
            ],
            rows: (requirements || []).map((r) => ({
                requirement_name: r.requirement_name || r.file_name || '',
                status: r.status,
                uploaded_at: toDate(r.uploaded_at || r.created_at),
                rejection_reason: r.rejection_reason || '',
            })),
        },
        {
            name: 'Claim Schedule',
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
        {
            name: 'Credential',
            columns: [
                { header: 'Credential #', key: 'credential_number', width: 18 },
                { header: 'Status', key: 'status', width: 14 },
                { header: 'Generated At', key: 'generated_at', width: 20, format: 'datetime' },
                { header: 'Released At', key: 'released_at', width: 20, format: 'datetime' },
                { header: 'Revoked At', key: 'revoked_at', width: 20, format: 'datetime' },
            ],
            rows: (credentials || []).map((c) => ({
                credential_number: c.credential_number,
                status: c.status,
                generated_at: toDate(c.generated_at),
                released_at: toDate(c.released_at),
                revoked_at: toDate(c.revoked_at),
            })),
        },
    ]

    const fileName = `request-backup-${request.request_number || requestId}-${new Date().toISOString().slice(0, 10)}.xlsx`

    await downloadExcelReport(fileName, sheets, [
        `Request Backup — ${request.request_number}`,
        `${request.documentName || 'Document'} · ${request.studentName || request.studentNumber || ''} · Generated ${new Date().toLocaleString('en-PH')}`,
        'This file is the only record kept once this request is permanently deleted. Any issued credential stays in the system and verifiable.',
    ])
}
