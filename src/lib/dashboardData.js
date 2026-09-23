// Shared numbers for the head and employee dashboards, so both count the
// same statuses the same way.

// Colors are theme variables (see components/DashboardStats.css) with
// separate, validated light and dark steps. Cancelled (neutral gray) sits
// between Completed (green) and Rejected (red) so those two never touch
// in the donut -- red/green is the pair color-blind readers confuse.
export const STATUS_BUCKETS = [
    { key: 'pending', label: 'Pending', statuses: ['pending', 'payment_pending'], color: 'var(--status-pending)' },
    { key: 'verification', label: 'In Verification', statuses: ['receipt_uploaded', 'receipt_verified'], color: 'var(--status-verification)' },
    { key: 'processing', label: 'Processing', statuses: ['processing', 'lacking_requirements'], color: 'var(--status-processing)' },
    { key: 'ready', label: 'Ready for Claiming', statuses: ['ready_for_claiming'], color: 'var(--status-ready)' },
    { key: 'completed', label: 'Completed', statuses: ['completed'], color: 'var(--status-completed)' },
    { key: 'cancelled', label: 'Cancelled', statuses: ['cancelled'], color: 'var(--status-cancelled)' },
    { key: 'rejected', label: 'Rejected', statuses: ['rejected'], color: 'var(--status-rejected)' },
]

// Local (Philippine) calendar day as 'YYYY-MM-DD'. toISOString() is UTC and
// would file anything before 8 AM under the previous day.
export const localDay = (date = new Date()) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export const countByStatus = (requests, statuses) =>
    requests.filter((r) => statuses.includes(r.status)).length

export const statusChartData = (requests) =>
    STATUS_BUCKETS.map((bucket) => ({
        key: bucket.key,
        label: bucket.label,
        color: bucket.color,
        value: countByStatus(requests, bucket.statuses),
    }))

// New requests per local day for the last `days` days, oldest first.
export const dailyTrend = (requests, days = 14) => {
    const keys = []
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        keys.push(localDay(d))
    }

    const counts = Object.fromEntries(keys.map((k) => [k, 0]))
    for (const r of requests) {
        if (!r.requested_at) continue
        const key = localDay(new Date(r.requested_at))
        if (key in counts) counts[key] += 1
    }

    return keys.map((date) => ({ date, count: counts[date] }))
}

// Requests received in the last 7 days vs the 7 days before.
export const weeklyChange = (requests) => {
    const now = Date.now()
    const week = 7 * 24 * 60 * 60 * 1000
    let current = 0
    let previous = 0
    for (const r of requests) {
        if (!r.requested_at) continue
        const age = now - new Date(r.requested_at).getTime()
        if (age < week) current += 1
        else if (age < 2 * week) previous += 1
    }
    return { current, previous, change: current - previous }
}
