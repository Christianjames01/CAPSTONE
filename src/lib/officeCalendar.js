import { supabase } from './supabase'
import { formatHours } from './officeHours'

// Date helpers shared by the admin and employee Office Calendar pages.
// Dates are handled as local 'YYYY-MM-DD' strings throughout so they compare
// cleanly with the office_open_days / office_events / claim_schedules columns.

export function formatLocal(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function toDate(dateStr) {
    return new Date(`${dateStr}T00:00:00`)
}

export function formatDate(dateStr) {
    return toDate(dateStr).toLocaleDateString('en-PH', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    })
}

export function formatDateShort(dateStr) {
    return toDate(dateStr).toLocaleDateString('en-PH', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    })
}

export function formatTime(time) {
    if (!time) return ''
    const [hours, minutes] = time.split(':')
    const date = new Date()
    date.setHours(Number(hours), Number(minutes), 0, 0)
    return date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
}

export function getToday() {
    return formatLocal(new Date())
}

// Days of the week the office is closed unless a date is marked open in
// office_open_days: Sunday, Monday and Saturday. Tuesday-Friday are open by
// default. Mirrored in supabase/functions/mark-missed-claims.
export const CLOSED_WEEKDAYS = [0, 1, 6]

export function isClosedWeekday(dow) {
    return CLOSED_WEEKDAYS.includes(dow)
}

// True for dates that are closed by default (Mondays and weekends) -- the
// ones staff can mark open in the Office Calendar.
export function isWeekendDate(dateStr) {
    return isClosedWeekday(toDate(dateStr).getDay())
}

export function weekdayName(dateStr) {
    return toDate(dateStr).toLocaleDateString('en-PH', { weekday: 'long' })
}

// For staff scheduling a claim: true when the date is closed by default and
// nobody has marked it open in the Office Calendar.
export async function isClosedWithoutOpening(dateStr) {
    if (!isWeekendDate(dateStr)) return false

    const { data } = await supabase
        .from('office_open_days')
        .select('open_day_id')
        .eq('open_date', dateStr)
        .maybeSingle()

    return !data
}

export function addDays(dateStr, delta) {
    const d = toDate(dateStr)
    return formatLocal(new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta))
}

// Every date from start to end, inclusive, as 'YYYY-MM-DD' strings -- used
// to apply one event/note to a whole span of days (e.g. the 20th to the
// 26th) in a single action instead of one day at a time.
export function eachDateInRange(startStr, endStr) {
    const dates = []
    let cursor = toDate(startStr)
    const end = toDate(endStr)
    while (cursor <= end) {
        dates.push(formatLocal(cursor))
        cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1)
    }
    return dates
}

// Full weeks (Sun-Sat) covering the month, including the trailing/leading
// days of the neighboring months so the grid is always a clean rectangle.
export function buildMonthGrid(viewDate) {
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()
    const startWeekday = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7

    const cells = []
    for (let i = 0; i < totalCells; i++) {
        const date = new Date(year, month, 1 - startWeekday + i)
        cells.push({ date, dateStr: formatLocal(date), inMonth: date.getMonth() === month })
    }
    return cells
}

// "Today", "Tomorrow", "In 5 days" -- for the upcoming list.
export function relativeDayLabel(dateStr, today = getToday()) {
    const diff = Math.round((toDate(dateStr) - toDate(today)) / 86400000)
    if (diff === 0) return 'Today'
    if (diff === 1) return 'Tomorrow'
    if (diff > 1 && diff < 7) return `In ${diff} days`
    return null
}

// A range event is stored as one row per day; collapse runs of the same
// title on consecutive days so "Enrollment Week" shows once, not 7 times.
// Expects `events` sorted by event_date; overlapping ranges with different
// titles are tracked separately.
export function groupConsecutiveEvents(events) {
    const groups = []
    const openByTitle = new Map()

    for (const ev of events) {
        const open = openByTitle.get(ev.title)
        if (open && addDays(open.endDate, 1) === ev.event_date) {
            open.endDate = ev.event_date
            open.events.push(ev)
            continue
        }

        const group = { key: ev.event_id, title: ev.title, note: ev.note, startDate: ev.event_date, endDate: ev.event_date, events: [ev] }
        groups.push(group)
        openByTitle.set(ev.title, group)
    }

    return groups
}

export function claimDate(cs) {
    return cs.claim_date || cs.scheduled_date
}

export function claimTime(cs) {
    return cs.claim_time || cs.scheduled_time
}

// Quick-fill presets for the most common day notes, so staff don't have to
// retype the same wording each time (e.g. every fiesta/holiday closure).
export const EVENT_PRESETS = [
    'Mental Health Break',
    'Office Closed — Fiesta',
    'Office Closed — Holiday',
    'Enrollment Week',
    'System Maintenance',
]

const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

// Automatic notices for the student dashboard, shaped like announcements so
// they render with AnnouncementNotice:
//   - "closed today" on a Monday/weekend that nobody opened,
//   - one "office open" notice per Monday/weekend staff opened in the next
//     two weeks (office_open_days),
//   - a standing reminder of the regular office days.
// If office_open_days can't be read (migration not applied yet), the
// weekday rule alone is used.
export async function fetchOfficeScheduleNotices() {
    const today = getToday()
    const until = addDays(today, 14)

    const { data, error } = await supabase
        .from('office_open_days')
        .select('*')
        .gte('open_date', today)
        .lte('open_date', until)
        .order('open_date')

    const openDays = error ? [] : (data || []).filter((d) => isWeekendDate(d.open_date))
    const openSet = new Set(openDays.map((d) => d.open_date))
    const isOpen = (dateStr) => !isWeekendDate(dateStr) || openSet.has(dateStr)

    const notices = []

    if (!isOpen(today)) {
        let next = addDays(today, 1)
        while (!isOpen(next)) next = addDays(next, 1)

        notices.push({
            announcement_id: `office-closed-${today}`,
            announcement_date: today,
            is_closed: true,
            title: `The Registrar's Office is closed today (${weekdayName(today)})`,
            message: `We're closed on Mondays, Saturdays and Sundays. Claiming and walk-in queuing resume on <strong>${formatDate(next)}</strong>.`,
        })
    }

    for (const day of openDays) {
        const hours = formatHours(day.open_time, day.close_time)
        notices.push({
            announcement_id: `office-open-${day.open_date}`,
            announcement_date: day.open_date,
            is_closed: false,
            open_time: day.open_time,
            close_time: day.close_time,
            title: `The Registrar's Office is open on ${weekdayName(day.open_date)}${hours ? `, ${hours}` : ''}`,
            message: day.note
                ? escapeHtml(day.note)
                : `Although ${weekdayName(day.open_date)}s are normally closed, the office will be open this day${hours ? ` from <strong>${hours}</strong>` : ''} for claiming and walk-ins.`,
        })
    }

    notices.push({
        announcement_id: 'office-days',
        announcement_date: null,
        is_closed: false,
        title: 'Office days: Tuesday to Friday',
        message: "The Registrar's Office is closed every <strong>Monday, Saturday and Sunday</strong> unless it's announced here as open.",
    })

    return notices
}
