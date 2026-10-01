// What a request means for the STUDENT, in plain words: where it is on the
// six-step journey, what's happening now, what (if anything) they need to do,
// and what comes next. Used by the dashboard, My Requests and the request
// page so every screen answers the same four questions the same way.
//
// describeRequest(request, extras?)
//   request: { request_id, status, auto_rejected_at?, rejection_reason? }
//   extras (optional, when the page knows them):
//     requirements: [{ status }]  -- request_requirements rows
//     schedule: { claim_date|scheduled_date, claim_time|scheduled_time, status }
//     credential: { credential_number, status }

export const PROGRESS_STEPS = [
    { key: 'submitted', label: 'Request submitted' },
    { key: 'payment', label: 'Payment & requirements' },
    { key: 'review', label: 'Registrar review' },
    { key: 'processing', label: 'Processing' },
    { key: 'ready', label: 'Ready for release' },
    { key: 'completed', label: 'Completed' },
]

const uploadReceipt = (id) => ({ label: 'Upload Receipt', to: `/student/request/${id}/upload-receipt` })
const uploadRequirements = (id) => ({ label: 'Upload Requirements', to: `/student/request/${id}/requirements` })

function formatDate(date) {
    if (!date) return ''
    return new Date(`${date}T00:00:00`).toLocaleDateString('en-PH', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })
}

function formatTime(time) {
    if (!time) return ''
    const [h, m] = time.split(':')
    const d = new Date()
    d.setHours(Number(h), Number(m), 0, 0)
    return d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
}

/**
 * Returns {
 *   step: 0..5 current step index (null when stopped),
 *   stopped: 'cancelled' | 'rejected' | null,
 *   statusLabel: short friendly status,
 *   tone: 'action' | 'waiting' | 'success' | 'stopped',
 *   now: "What's happening now?",
 *   todo: "What should I do?" (string),
 *   action: { label, to } | null  -- the button when the student must act,
 *   next: "What happens next?",
 * }
 */
export function describeRequest(request, { requirements = null, schedule = null, credential = null } = {}) {
    const id = request?.request_id
    const status = request?.status
    const missingReqs = Array.isArray(requirements)
        ? requirements.filter((r) => r.status === 'pending' || r.status === 'rejected')
        : []
    const rejectedReqs = Array.isArray(requirements) ? requirements.filter((r) => r.status === 'rejected') : []

    switch (status) {
        case 'pending':
        case 'payment_pending': {
            if (missingReqs.length > 0) {
                return {
                    step: 1, stopped: null, statusLabel: 'Action needed', tone: 'action',
                    now: 'Your request was received. The Registrar needs your requirements and proof of payment before it can be reviewed.',
                    todo: `Upload your ${missingReqs.length === 1 ? 'requirement' : `${missingReqs.length} requirements`}, then pay at the HCDC Finance Office and upload your Official Receipt.`,
                    action: uploadRequirements(id),
                    next: 'Once your requirements and receipt are uploaded, the Registrar will check them.',
                }
            }
            return {
                step: 1, stopped: null, statusLabel: 'Payment needed', tone: 'action',
                now: 'Your request was received and is waiting for your payment.',
                todo: 'Pay the fee at the HCDC Finance Office, then upload a clear photo of your Official Receipt.',
                action: uploadReceipt(id),
                next: 'The Registrar will check your receipt, then start preparing your document.',
            }
        }
        case 'lacking_requirements':
            return {
                step: 1, stopped: null, statusLabel: 'Requirements needed', tone: 'action',
                now: rejectedReqs.length > 0
                    ? 'The Registrar checked your requirements and some need to be uploaded again.'
                    : 'The Registrar is waiting for some of your requirements.',
                todo: 'Open your requirements, read the reason for any that were not accepted, and upload them again.',
                action: uploadRequirements(id),
                next: 'The Registrar will check the new files and continue with your request.',
            }
        case 'receipt_uploaded':
            return {
                step: 2, stopped: null, statusLabel: 'Under review', tone: 'waiting',
                now: 'Your Official Receipt and requirements were received. The Registrar is checking them.',
                todo: 'No action needed right now. We will notify you when the check is done.',
                action: null,
                next: 'After your payment is verified, your document will be prepared.',
            }
        case 'receipt_verified':
            return {
                step: 3, stopped: null, statusLabel: 'Payment verified', tone: 'waiting',
                now: 'Your payment was verified. Your request is in line to be prepared.',
                todo: 'No action needed right now.',
                action: null,
                next: 'The Registrar will start preparing your document.',
            }
        case 'processing':
            return {
                step: 3, stopped: null, statusLabel: 'Processing', tone: 'waiting',
                now: 'The Registrar is preparing your document.',
                todo: 'No action needed right now. We will notify you when it is ready.',
                action: null,
                next: 'When it is ready, you will get a pickup date and time.',
            }
        case 'ready_for_claiming': {
            const date = schedule?.claim_date || schedule?.scheduled_date
            const time = schedule?.claim_time || schedule?.scheduled_time
            if (schedule?.status === 'missed') {
                return {
                    step: 4, stopped: null, statusLabel: 'Pickup missed', tone: 'action',
                    now: 'You missed your pickup appointment. Your document is still waiting for you.',
                    todo: 'Visit the Registrar\'s Office as soon as possible, or message the Registrar to ask for a new schedule.',
                    action: { label: 'Message the Registrar', to: '/student/messages' },
                    next: 'Bring a valid ID and your Official Receipt when you claim it.',
                }
            }
            if (date) {
                return {
                    step: 4, stopped: null, statusLabel: 'Ready for pickup', tone: 'success',
                    now: `Your document is ready. Pickup is scheduled on ${formatDate(date)}${time ? ` at ${formatTime(time)}` : ''}.`,
                    todo: 'Go to the Registrar\'s Office on your schedule. Bring a valid ID and your Official Receipt.',
                    action: { label: 'View Pickup Schedule', to: '/student/claim-schedule' },
                    next: 'Your request will be marked completed once you claim it.',
                }
            }
            return {
                step: 4, stopped: null, statusLabel: 'Ready', tone: 'success',
                now: 'Your document is ready.',
                todo: 'No action needed right now. The Registrar will set your pickup date and time and notify you.',
                action: null,
                next: 'You will claim it at the Registrar\'s Office on your scheduled date.',
            }
        }
        case 'completed':
            return {
                step: 5, stopped: null, statusLabel: 'Completed', tone: 'success',
                now: credential?.status === 'revoked'
                    ? 'This request is completed, but its digital credential was revoked by the Registrar.'
                    : 'Your document has been released. This request is complete.',
                todo: credential && credential.status !== 'revoked'
                    ? 'You can share your credential\'s QR code so schools or employers can verify it.'
                    : 'Nothing else to do. You can request another document anytime.',
                action: credential && credential.status !== 'revoked'
                    ? { label: 'View Digital Credential', to: `/student/request/${id}#credential` }
                    : null,
                next: null,
            }
        case 'rejected':
            if (request?.auto_rejected_at) {
                return {
                    step: null, stopped: 'rejected', statusLabel: 'Rejected', tone: 'stopped',
                    now: 'This request was rejected automatically because nothing was uploaded in time.',
                    todo: 'Submit a new request when you are ready.',
                    action: { label: 'Request a Document', to: '/student/new-request' },
                    next: null,
                }
            }
            return {
                step: 1, stopped: null, statusLabel: 'Receipt not accepted', tone: 'action',
                now: request?.rejection_reason
                    ? `Your Official Receipt was not accepted. Reason: ${request.rejection_reason}`
                    : 'Your Official Receipt could not be verified.',
                todo: 'Upload a clearer or corrected photo of your Official Receipt.',
                action: { label: 'Upload Again', to: `/student/request/${id}/upload-receipt` },
                next: 'The Registrar will check the new receipt.',
            }
        case 'cancelled':
            return {
                step: null, stopped: 'cancelled', statusLabel: 'Cancelled', tone: 'stopped',
                now: 'This request was cancelled.',
                todo: 'Nothing to do. You can submit a new request anytime.',
                action: { label: 'Request a Document', to: '/student/new-request' },
                next: null,
            }
        default:
            return {
                step: 0, stopped: null, statusLabel: 'Submitted', tone: 'waiting',
                now: 'Your request was received.',
                todo: 'No action needed right now.',
                action: null,
                next: 'The Registrar will review your request.',
            }
    }
}

// Statuses that count as "active" (not finished).
export const ACTIVE_STATUSES = ['pending', 'payment_pending', 'receipt_uploaded', 'receipt_verified', 'processing', 'lacking_requirements', 'ready_for_claiming']

export const needsAction = (request, extras) => describeRequest(request, extras).tone === 'action'
