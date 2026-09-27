import { supabase } from './supabase'

// "What's the status of my request?" in Messages. A student picks a request
// and sends a status inquiry; the automatic reply comes from the
// auto_reply_request_status() database function. Staff get a one-click
// "Reply with status" that fills in the same wording.

// Same wording as the student's request page (and the database function).
const STATUS_TEXT = {
    pending: ['Pending', 'Your request is waiting for Registrar processing. Pay at the Finance Office and upload your official receipt.'],
    payment_pending: ['Payment Pending', 'Pay at the Finance Office, then upload your official receipt so the Registrar can verify it.'],
    receipt_uploaded: ['Receipt Uploaded', 'Your official receipt has been uploaded and is waiting for the Registrar to verify your payment.'],
    receipt_verified: ['Payment Verified', 'Your payment has been verified. Your request will begin processing soon.'],
    processing: ['Processing', 'Your request is currently being processed by the Registrar.'],
    lacking_requirements: ['Requirements Needed', 'Some required documents are still missing or need to be re-submitted. Please check the Requirements on your request.'],
    ready_for_claiming: ['Ready for Claiming', 'Your document has been prepared. You will be notified once a claiming schedule is set.'],
    completed: ['Completed', 'Your document request has been completed and claimed.'],
    rejected: ['Rejected', 'Your official receipt could not be verified. Please upload a new receipt to continue your request.'],
    cancelled: ['Cancelled', 'This request has been cancelled.'],
}

export const requestStatusLabel = (status) => STATUS_TEXT[status]?.[0] || (status || '').replace(/_/g, ' ')

const CLOSED = ['completed', 'cancelled']
export const isOpenRequest = (r) => !CLOSED.includes(r.status)

const INQUIRY = /^Status inquiry: ([A-Z]+-[\w-]+|all my requests)/

// Asking about every request at once.
export const ALL_REQUESTS = 'ALL'

export function inquiryText(request) {
    if (request === ALL_REQUESTS) {
        return 'Status inquiry: all my requests. Hi! May I know the current status of all my document requests?'
    }
    const doc = request.documentName ? ` (${request.documentName})` : ''
    return `Status inquiry: ${request.request_number}${doc}. Hi! May I know the current status of my request?`
}

// The request number a message asks about, ALL_REQUESTS, or null.
export function inquiryRequestNumber(text) {
    const found = (text || '').match(INQUIRY)?.[1] || null
    return found === 'all my requests' ? ALL_REQUESTS : found
}

export const inquiryLabel = (number) => (number === ALL_REQUESTS ? 'all their requests' : number)

// Groups for the "Ask about a request" menu.
export function groupRequests(requests) {
    const groups = [
        { key: 'open', label: 'In progress', items: requests.filter((r) => !['completed', 'cancelled', 'rejected'].includes(r.status)) },
        { key: 'rejected', label: 'Needs attention', items: requests.filter((r) => r.status === 'rejected') },
        { key: 'completed', label: 'Completed', items: requests.filter((r) => r.status === 'completed') },
        { key: 'cancelled', label: 'Cancelled', items: requests.filter((r) => r.status === 'cancelled') },
    ]
    return groups.filter((g) => g.items.length > 0)
}

// "Status update for your requests:" with one line per request, for staff
// answering an all-requests inquiry from `studentUserId`.
async function summaryReplyFor(studentUserId) {
    const { data: student, error } = await supabase
        .from('students')
        .select('student_id')
        .eq('user_id', studentUserId)
        .maybeSingle()
    if (error) throw new Error(error.message)
    if (!student) throw new Error('Student record not found.')

    const { data: requests, error: requestError } = await supabase
        .from('document_requests')
        .select('request_number, status, document_type_id, requested_at')
        .eq('student_id', student.student_id)
        .order('requested_at', { ascending: false })
    if (requestError) throw new Error(requestError.message)

    const typeIds = [...new Set((requests || []).map((r) => r.document_type_id).filter(Boolean))]
    const { data: types } = typeIds.length
        ? await supabase.from('document_types').select('document_type_id, document_name').in('document_type_id', typeIds)
        : { data: [] }
    const docName = Object.fromEntries((types || []).map((t) => [t.document_type_id, t.document_name]))

    if (!requests?.length) return 'Status update for your requests: you have no document requests yet.'
    return ['Status update for your requests:', ...requests.map((r) =>
        `- ${r.request_number}${docName[r.document_type_id] ? ` (${docName[r.document_type_id]})` : ''}: ${requestStatusLabel(r.status)}`
    )].join('\n')
}

// The newest unanswered status inquiry message in a conversation (sent by
// someone other than `selfId` with no reply from `selfId` after it), or null.
export function pendingInquiry(messages, selfId) {
    for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i]
        if (m.sender_user_id === selfId) return null
        if (m.deleted_at) continue
        if (inquiryRequestNumber(m.message)) return m
    }
    return null
}

// "Status update for REQ-000123 (Transcript of Records): Processing. ..."
// for staff to send. Throws if the request can't be read.
export async function statusReplyFor(requestNumber, studentUserId) {
    if (requestNumber === ALL_REQUESTS) return summaryReplyFor(studentUserId)

    const { data: request, error } = await supabase
        .from('document_requests')
        .select('request_id, request_number, status, document_type_id')
        .eq('request_number', requestNumber)
        .maybeSingle()

    if (error) throw new Error(error.message)
    if (!request) throw new Error(`Request ${requestNumber} was not found.`)

    const [{ data: doc }, { data: schedules }] = await Promise.all([
        supabase.from('document_types').select('document_name').eq('document_type_id', request.document_type_id).maybeSingle(),
        supabase.from('claim_schedules').select('*').eq('request_id', request.request_id).eq('status', 'scheduled').order('created_at', { ascending: false }).limit(1),
    ])

    const [label, defaultNext] = STATUS_TEXT[request.status] || [requestStatusLabel(request.status), '']
    let next = defaultNext

    const schedule = schedules?.[0]
    const date = schedule && (schedule.claim_date || schedule.scheduled_date)
    if (date) {
        const time = schedule.claim_time || schedule.scheduled_time
        const d = new Date(`${date}T${time || '00:00'}`)
        const when = d.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
            + (time ? ` at ${d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}` : '')
        next = `Your claiming schedule is ${when}. Bring your official receipt and a valid ID.`
    }

    const docName = doc?.document_name ? ` (${doc.document_name})` : ''
    return `Status update for ${request.request_number}${docName}: ${label}. ${next}`.trim()
}
