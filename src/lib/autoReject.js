// Flagged requests the student never acts on are rejected automatically, and
// removed later (20260929070000_auto_reject_flagged_requests).
export const AUTO_REJECT_DAYS = 7
export const AUTO_DELETE_DAYS = 7

const DAY_MS = 24 * 60 * 60 * 1000

// { rejectOn, deleteOn } (Dates) for a request, or nulls.
export function autoRejectDates(request) {
    const rejectOn = request?.status === 'lacking_requirements' && request.flagged_at
        ? new Date(new Date(request.flagged_at).getTime() + AUTO_REJECT_DAYS * DAY_MS)
        : null
    const deleteOn = request?.status === 'rejected' && request.auto_rejected_at
        ? new Date(new Date(request.auto_rejected_at).getTime() + AUTO_DELETE_DAYS * DAY_MS)
        : null
    return { rejectOn, deleteOn }
}
