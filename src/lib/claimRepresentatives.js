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

// The two files, each reviewed on its own (20260929030000_representative_file_review).
export const REPRESENTATIVE_FILES = [
    { key: 'letter', label: 'Signed authorization letter', short: 'authorization letter', pathKey: 'authorization_letter_path', statusKey: 'letter_status', noteKey: 'letter_note' },
    { key: 'id', label: 'Representative’s valid ID', short: 'valid ID', pathKey: 'valid_id_path', statusKey: 'id_status', noteKey: 'id_note' },
]

export const FILE_STATUS = {
    pending: { label: 'Waiting for review', tone: 'pending' },
    approved: { label: 'Approved', tone: 'approved' },
    rejected: { label: 'Rejected', tone: 'rejected' },
}

// Files have their own status once the migration is applied; before that,
// both follow the overall status.
export const hasFileReview = (rep) => !!rep && 'letter_status' in rep
export const fileStatusOf = (rep, file) => (hasFileReview(rep) ? rep[file.statusKey] : rep.status) || 'pending'
export const fileNoteOf = (rep, file) => (hasFileReview(rep) ? rep[file.noteKey] : rep.status === 'rejected' ? rep.review_note : null)

export const MAX_FILE_MB = 5
export const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp,application/pdf'

const COLUMNS = 'representative_id, request_id, student_id, full_name, relationship, contact_number, authorization_letter_path, valid_id_path, status, review_note, reviewed_at, created_at, updated_at'

// Missing table (migration not applied yet) -> null so pages can hide the feature.
const isMissingTable = (error) => error && (error.code === 'PGRST205' || error.code === '42P01')
const isMissingColumn = (error) => error && (error.code === '42703' || /letter_status|id_status/i.test(error.message || ''))

export async function loadRepresentative(requestId) {
    const query = (columns) => supabase
        .from('claim_representatives')
        .select(columns)
        .eq('request_id', requestId)
        .maybeSingle()

    let { data, error } = await query(COLUMNS + ', letter_status, letter_note, id_status, id_note')
    // Before the per-file review migration: the overall status only.
    if (isMissingColumn(error)) ({ data, error } = await query(COLUMNS))

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
