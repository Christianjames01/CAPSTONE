import { supabase } from './supabase'

// Request priority helpers, shared by the student form, staff request pages,
// and request lists. Priority is 'normal' | 'urgent' (set by staff); the
// student can give an optional needed_by date and reason.

const CLOSED_STATUSES = ['completed', 'cancelled', 'rejected']

// Days a "needed by" date is away (negative = past), in local time.
function daysUntil(dateStr) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const target = new Date(`${dateStr}T00:00:00`)
    return Math.round((target - today) / 86400000)
}

export function formatNeededBy(dateStr) {
    if (!dateStr) return ''
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

// { label, tone } for an open request whose needed-by date is close or past;
// null otherwise. tone is 'danger' (overdue) or 'warning' (within 3 days).
export function dueInfo(request) {
    if (!request?.needed_by || CLOSED_STATUSES.includes(request.status)) return null

    const days = daysUntil(request.needed_by)
    if (days < 0) return { label: `Overdue by ${-days} day${days === -1 ? '' : 's'}`, tone: 'danger' }
    if (days === 0) return { label: 'Due today', tone: 'warning' }
    if (days <= 3) return { label: `Due in ${days} day${days === 1 ? '' : 's'}`, tone: 'warning' }
    return null
}

export function isUrgent(request) {
    return request?.priority === 'urgent'
}

// Urgent first, then the nearest needed-by date, keeping the existing order
// otherwise (Array.prototype.sort is stable).
export function sortByUrgency(list) {
    const neededAt = (r) => (r.needed_by ? new Date(`${r.needed_by}T00:00:00`).getTime() : Infinity)
    return [...list].sort((a, b) => {
        const urgent = Number(isUrgent(b)) - Number(isUrgent(a))
        if (urgent !== 0) return urgent
        return neededAt(a) - neededAt(b)
    })
}

// Inserts a request; if the needed_by columns don't exist yet (migration
// 20260925040000 not applied), retries without them so submitting still works.
export async function insertRequestWithNeededBy(payload, run) {
    const result = await run(payload)

    if (result.error && /needed_by/.test(result.error.message || '')) {
        console.warn('needed_by columns missing; submitting without them.')
        const rest = { ...payload }
        delete rest.needed_by
        delete rest.needed_by_reason
        return run(rest)
    }

    return result
}

export async function setRequestPriority(requestId, priority) {
    const { error } = await supabase
        .from('document_requests')
        .update({ priority, updated_at: new Date().toISOString() })
        .eq('request_id', requestId)

    if (error) throw new Error('Failed to update priority: ' + error.message)
}
