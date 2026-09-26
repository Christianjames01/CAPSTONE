import { supabase } from './supabase'

// Authorized representatives for claiming (20260926020000_claim_representatives).

export const REPRESENTATIVE_BUCKET = 'claim-authorizations'

export const RELATIONSHIPS = ['Parent', 'Guardian', 'Sibling', 'Spouse', 'Relative', 'Friend', 'Other']

export const REPRESENTATIVE_STATUS = {
    pending: { label: 'Pending review', tone: 'pending' },
    approved: { label: 'Approved', tone: 'approved' },
    rejected: { label: 'Not approved', tone: 'rejected' },
}

// Requests that can still be claimed by someone.
export const CLOSED_STATUSES = ['completed', 'cancelled', 'rejected']

export const MAX_FILE_MB = 5
export const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp,application/pdf'

const COLUMNS = 'representative_id, request_id, student_id, full_name, relationship, contact_number, authorization_letter_path, valid_id_path, status, review_note, reviewed_at, created_at, updated_at'

// Missing table (migration not applied yet) -> null so pages can hide the feature.
const isMissingTable = (error) => error && (error.code === 'PGRST205' || error.code === '42P01')

export async function loadRepresentative(requestId) {
    const { data, error } = await supabase
        .from('claim_representatives')
        .select(COLUMNS)
        .eq('request_id', requestId)
        .maybeSingle()

    if (isMissingTable(error)) return { unavailable: true, representative: null }
    if (error) throw error
    return { unavailable: false, representative: data }
}

// request_id -> representative, for release-window lists.
export async function loadRepresentativesByRequestIds(requestIds) {
    const ids = [...new Set((requestIds || []).filter(Boolean))]
    if (ids.length === 0) return {}

    const { data, error } = await supabase
        .from('claim_representatives')
        .select('request_id, full_name, relationship, status')
        .in('request_id', ids)

    if (error) {
        if (!isMissingTable(error)) console.error('LOAD REPRESENTATIVES ERROR:', error)
        return {}
    }
    return Object.fromEntries((data || []).map((r) => [r.request_id, r]))
}

export async function signedFileUrl(path) {
    const { data, error } = await supabase.storage.from(REPRESENTATIVE_BUCKET).createSignedUrl(path, 3600)
    if (error) throw error
    return data.signedUrl
}
