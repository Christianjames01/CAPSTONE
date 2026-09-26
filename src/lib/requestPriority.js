import { supabase } from './supabase'

// Request priority helpers, shared by staff request pages and request
// lists. Priority is 'normal' | 'urgent', set by staff.

export function isUrgent(request) {
    return request?.priority === 'urgent'
}

// Urgent first, keeping the existing order otherwise (sort is stable).
export function sortByUrgency(list) {
    return [...list].sort((a, b) => Number(isUrgent(b)) - Number(isUrgent(a)))
}

export async function setRequestPriority(requestId, priority) {
    const { error } = await supabase
        .from('document_requests')
        .update({ priority, updated_at: new Date().toISOString() })
        .eq('request_id', requestId)

    if (error) throw new Error('Failed to update priority: ' + error.message)
}
