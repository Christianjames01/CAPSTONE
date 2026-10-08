// Turns technical errors into sentences a student understands.
// friendlyError(err, 'We couldn't submit your request.')
//   -> "We couldn't submit your request. Please check your internet connection and try again."
// Messages the app wrote for people (no codes or table names) pass through.

const RULES = [
    [/failed to fetch|networkerror|network request failed|load failed|timeout|timed out/i, 'Please check your internet connection and try again.'],
    [/jwt|token (is )?expired|not logged in|session/i, 'Your session has ended. Please log in again.'],
    [/42501|permission denied|row-level security|not allowed|violates row-level/i, 'You are not allowed to do this. If you think this is a mistake, please message the Registrar.'],
    [/payload too large|file size|too large|exceed/i, 'The file is too large. Please choose a smaller file.'],
    [/mime|file type|not allowed type|invalid file/i, 'This file type is not accepted. Please use a JPG, PNG or PDF file.'],
    [/storage|bucket|object/i, 'The file could not be uploaded. Please try again.'],
]

// Looks technical (codes, SQL words, stack-ish text): don't show it as is.
const TECHNICAL = /\b(error|exception|sql|relation|column|constraint|violat|syntax|null value|uuid|pgrst|supabase|status \d{3}|code \d+)\b/i

// Postgres includes the offending column/value separately from its main
// message, e.g. details: 'Key (employee_number)=(EMP-2024-001) already exists.'
// -- read it when present so the modal can name the actual duplicate instead
// of a generic "this already exists".
const DUPLICATE_KEY = /23505|duplicate key/i
const DUPLICATE_DETAIL = /Key \(([a-z0-9_]+)\)=\(([^)]*)\) already exists/i

const humanizeColumn = (column) => column.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())

export function friendlyError(err, lead = 'Something went wrong.') {
    const raw = (typeof err === 'string' ? err : err?.message) || ''
    const details = (typeof err === 'object' && err?.details) ? String(err.details) : ''

    if (DUPLICATE_KEY.test(raw) || DUPLICATE_KEY.test(details)) {
        const match = DUPLICATE_DETAIL.exec(details) || DUPLICATE_DETAIL.exec(raw)
        if (match) {
            const [, column, value] = match
            return `${lead} ${humanizeColumn(column)} "${value}" is already in use.`
        }
        return `${lead} This already exists. Please use a different one.`
    }

    for (const [pattern, message] of RULES) {
        if (pattern.test(raw)) return `${lead} ${message}`
    }
    if (raw && !TECHNICAL.test(raw) && raw.length < 220) return raw
    return `${lead} Please try again. If it keeps happening, message the Registrar.`
}
