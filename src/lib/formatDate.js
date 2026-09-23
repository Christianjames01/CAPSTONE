// Readable dates used across the app, e.g. "Sep 24, 2026" and
// "Sep 24, 2026, 10:38 PM" -- instead of the browser default "9/24/2026".

export function formatDisplayDate(value) {
    if (!value) return ''
    return new Date(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatDisplayDateTime(value) {
    if (!value) return ''
    return new Date(value).toLocaleString('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    })
}
