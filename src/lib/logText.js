// Older activity-log descriptions stored raw values, e.g.
//   Created claiming schedule for request "REQ-000002" on "2026-09-29" at "13:00".
// Rewrite quoted ISO dates and 24-hour times into readable ones when shown:
//   ... on "September 29, 2026" at "1:00 PM".

const QUOTED_DATE = /"(\d{4})-(\d{2})-(\d{2})"/g
const QUOTED_TIME = /"([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?"/g

export function readableLogText(text) {
    if (!text) return text

    return text
        .replace(QUOTED_DATE, (match, y, m, d) => {
            const date = new Date(Number(y), Number(m) - 1, Number(d))
            if (Number.isNaN(date.getTime())) return match
            return `"${date.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}"`
        })
        .replace(QUOTED_TIME, (match, h, min) => {
            const date = new Date()
            date.setHours(Number(h), Number(min), 0, 0)
            return `"${date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}"`
        })
}
