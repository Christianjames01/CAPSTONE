// Office hours ("8:00 AM – 5:00 PM") for days the office is open: set on an
// Office Calendar open day or an "Office open" announcement, and shown to
// students on their dashboard. Times are 'HH:MM' strings (Postgres `time`).

export const DEFAULT_HOURS = { open: '08:00', close: '17:00' }

export const HOURS_PRESETS = [
    { label: '8 AM – 5 PM', open: '08:00', close: '17:00' },
    { label: '8 AM – 6 PM', open: '08:00', close: '18:00' },
    { label: '8 AM – 12 NN', open: '08:00', close: '12:00' },
    { label: '1 PM – 5 PM', open: '13:00', close: '17:00' },
]

function formatClock(time) {
    if (!time) return ''
    const [h, m] = String(time).split(':').map(Number)
    const d = new Date()
    d.setHours(h, m || 0, 0, 0)
    if (h === 12 && !m) return '12:00 NN'
    return d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
}

// "8:00 AM – 5:00 PM", or '' when not set.
export function formatHours(open, close) {
    if (!open || !close) return ''
    return `${formatClock(open)} – ${formatClock(close)}`
}

// Until the office-hours migration is applied, an open day's hours are kept
// in its note as "Office hours: 8:00 AM – 5:00 PM".
const NOTE_HOURS = /\s*(?:·\s*)?Office hours: ([^·]+)/

export function hoursOf(row) {
    return formatHours(row?.open_time, row?.close_time) || row?.note?.match(NOTE_HOURS)?.[1]?.trim() || ''
}

export function noteWithoutHours(note) {
    return (note || '').replace(NOTE_HOURS, '').trim()
}

export function noteWithHours(note, hours) {
    const base = noteWithoutHours(note)
    const tag = `Office hours: ${formatHours(hours.open, hours.close)}`
    return base ? `${base} · ${tag}` : tag
}

export function validHours(hours) {
    return !!hours?.open && !!hours?.close && hours.open < hours.close
}

// open_time / close_time columns come from a migration; until it's applied
// the write is retried without them so opening a day still works.
const missingHoursColumn = (error) => /open_time|close_time/i.test(error?.message || '')

// `hoursInNote`: when the columns are missing, keep the hours in the row's
// note instead (open days), so students still see them.
export async function writeWithHours(run, row, hours, { hoursInNote = false } = {}) {
    const withHours = validHours(hours) ? { ...row, open_time: hours.open, close_time: hours.close } : row
    let result = await run(withHours)
    if (result.error && withHours !== row && missingHoursColumn(result.error)) {
        result = await run(hoursInNote ? { ...row, note: noteWithHours(row.note, hours) } : row)
        return { ...result, hoursSaved: hoursInNote && !result.error }
    }
    return { ...result, hoursSaved: withHours !== row }
}

export function isMissingHoursColumn(error) {
    return missingHoursColumn(error)
}
