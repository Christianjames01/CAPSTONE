import { useEffect, useMemo, useState } from 'react'
import { SkeletonList } from '../Skeleton'
import { loadStudentsById } from '../../lib/studentNames'
import {
    buildMonthGrid,
    claimTime,
    formatDate,
    formatTime,
    getToday,
    groupConsecutiveEvents,
    relativeDayLabel,
} from '../../lib/officeCalendar'
import './OfficeCalendar.css'

const WEEKDAY_HEADS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Chips shown inside a day cell before collapsing the rest into "+N more",
// so busy days don't stretch the whole week's row.
const MAX_CELL_CHIPS = 2

// How many "Coming up" entries to show before the "Show all" toggle.
const UPCOMING_PREVIEW = 6

// "Upcoming Claiming": how many days to list before "Show all", and how
// many students to name per day before "+N more".
const CLAIM_DAYS_PREVIEW = 5
const CLAIM_NAMES_PER_DAY = 3

// Claim appointments still ahead (not claimed, missed, or cancelled).
const INACTIVE_CLAIM_STATUSES = ['claimed', 'missed', 'cancelled', 'completed']

const ChevronLeft = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
)

const ChevronRight = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
)

const CloseIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
)

function monthDay(dateStr) {
    const d = new Date(`${dateStr}T00:00:00`)
    return {
        month: d.toLocaleDateString('en-PH', { month: 'short' }),
        day: d.getDate(),
        weekday: d.toLocaleDateString('en-PH', { weekday: 'short' }),
    }
}

function rangeLabel(start, end) {
    if (start === end) return monthDay(start).weekday
    const s = monthDay(start)
    const e = monthDay(end)
    return s.month === e.month ? `${s.month} ${s.day}–${e.day}` : `${s.month} ${s.day} – ${e.month} ${e.day}`
}

function plural(n, word) {
    return `${n} ${word}${n === 1 ? '' : 's'}`
}

// Sidebar + month grid for the Office Calendar. Purely presentational: the
// admin and employee pages own the data, scoping, and every mutation.
function CalendarBoard({
    loading,
    error,
    viewDate,
    onMonthChange,
    onToday,
    openDaysByDate,
    eventsByDate,
    claimSchedulesByDate,
    upcomingEvents,
    upcomingOpenDays,
    onDayClick,
    onRemoveEvent,
    onRemoveOpenDay,
    removingEventId,
    removingOpenDayId,
}) {
    const [showAllUpcoming, setShowAllUpcoming] = useState(false)

    const today = getToday()
    const monthGrid = useMemo(() => buildMonthGrid(viewDate), [viewDate])
    const monthLabel = viewDate.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
    const isCurrentMonth = viewDate.getFullYear() === new Date().getFullYear() && viewDate.getMonth() === new Date().getMonth()

    const monthSummary = useMemo(() => {
        let eventDays = 0
        let openDays = 0
        let claims = 0
        for (const { dateStr, inMonth } of monthGrid) {
            if (!inMonth) continue
            if (eventsByDate[dateStr]?.length) eventDays++
            if (openDaysByDate[dateStr]) openDays++
            claims += claimSchedulesByDate[dateStr]?.length || 0
        }
        return { eventDays, openDays, claims }
    }, [monthGrid, eventsByDate, openDaysByDate, claimSchedulesByDate])

    // One "Coming up" timeline: range events collapsed into a single entry,
    // plus weekend open days, in date order.
    const upcoming = useMemo(() => {
        const eventItems = groupConsecutiveEvents(upcomingEvents).map((g) => ({
            type: 'event',
            key: `event-${g.key}`,
            date: g.startDate,
            endDate: g.endDate,
            title: g.title,
            note: g.note,
            events: g.events,
        }))
        const openItems = upcomingOpenDays.map((day) => ({
            type: 'open',
            key: `open-${day.open_day_id}`,
            date: day.open_date,
            endDate: day.open_date,
            title: 'Open for claiming',
            note: day.note,
            day,
        }))
        return [...eventItems, ...openItems].sort((a, b) => a.date.localeCompare(b.date))
    }, [upcomingEvents, upcomingOpenDays])

    const visibleUpcoming = showAllUpcoming ? upcoming : upcoming.slice(0, UPCOMING_PREVIEW)

    // Upcoming claiming days, soonest first, each with its appointments by time.
    const upcomingClaimDays = useMemo(() => Object.entries(claimSchedulesByDate)
        .filter(([date]) => date >= today)
        .map(([date, list]) => ({
            date,
            claims: list
                .filter((cs) => !INACTIVE_CLAIM_STATUSES.includes(cs.status))
                .sort((a, b) => (claimTime(a) || '').localeCompare(claimTime(b) || '')),
        }))
        .filter((d) => d.claims.length > 0)
        .sort((a, b) => a.date.localeCompare(b.date)), [claimSchedulesByDate, today])

    const [showAllClaimDays, setShowAllClaimDays] = useState(false)
    const [studentsById, setStudentsById] = useState({})

    // Names for the students on upcoming claim days.
    useEffect(() => {
        const ids = upcomingClaimDays.flatMap((d) => d.claims.map((cs) => cs.student_id)).filter(Boolean)
        if (ids.length === 0) return undefined
        let cancelled = false
        loadStudentsById(ids).then((map) => { if (!cancelled) setStudentsById(map) })
        return () => { cancelled = true }
    }, [upcomingClaimDays])

    const visibleClaimDays = showAllClaimDays ? upcomingClaimDays : upcomingClaimDays.slice(0, CLAIM_DAYS_PREVIEW)
    const totalUpcomingClaims = upcomingClaimDays.reduce((sum, d) => sum + d.claims.length, 0)

    const claimLabel = (cs) => {
        const name = studentsById[cs.student_id]?.name
        const number = cs.document_requests?.request_number
        if (name && number) return name + ' (' + number + ')'
        return name || number || 'Student'
    }

    const renderUpcomingItem = (item) => {
        const { month, day } = monthDay(item.date)
        const relative = relativeDayLabel(item.date, today)
        const dayCount = item.type === 'event' ? item.events.length : 1
        const removing = item.type === 'open'
            ? removingOpenDayId === item.day.open_day_id
            : removingEventId === item.events[0].event_id

        return (
            <li key={item.key} className={`ocal-upcoming-item is-${item.type}`}>
                <button type="button" className="ocal-upcoming-main" onClick={() => onDayClick(item.date)}>
                    <span className="ocal-date-badge" aria-hidden="true">
                        <span>{month}</span>
                        <strong>{day}</strong>
                    </span>
                    <span className="ocal-upcoming-text">
                        <span className="ocal-upcoming-title">{item.title}</span>
                        <span className="ocal-upcoming-meta">
                            {relative && <span className="ocal-upcoming-relative">{relative}</span>}
                            {rangeLabel(item.date, item.endDate)}
                            {dayCount > 1 && ` · ${dayCount} days`}
                        </span>
                        {item.note && <span className="ocal-upcoming-note">{item.note}</span>}
                    </span>
                </button>

                {/* A collapsed multi-day entry is removed day by day from the
                    day view, so only single entries get a quick remove. */}
                {dayCount === 1 && (
                    <button
                        type="button"
                        className="ocal-icon-button ocal-upcoming-remove"
                        onClick={() => (item.type === 'open' ? onRemoveOpenDay(item.day) : onRemoveEvent(item.events[0]))}
                        disabled={removing}
                        aria-label={`Remove ${item.title} on ${formatDate(item.date)}`}
                        title="Remove"
                    >
                        <CloseIcon />
                    </button>
                )}
            </li>
        )
    }

    const renderCell = ({ date, dateStr, inMonth }) => {
        const dow = date.getDay()
        const isWeekend = dow === 0 || dow === 6
        const isPast = dateStr < today
        const isToday = dateStr === today
        const openEntry = isWeekend ? openDaysByDate[dateStr] : null
        const dayEvents = eventsByDate[dateStr] || []
        const dayClaims = claimSchedulesByDate[dateStr] || []

        const chips = []
        if (openEntry) chips.push({ key: 'open', type: 'open', label: 'Open for claiming', title: openEntry.note || 'Marked open for claiming' })
        dayEvents.forEach((ev) => chips.push({ key: ev.event_id, type: 'event', label: ev.title, title: ev.note || ev.title }))
        if (dayClaims.length > 0) chips.push({ key: 'claims', type: 'claim', label: `${dayClaims.length} claiming`, title: `${plural(dayClaims.length, 'student')} scheduled to claim` })

        const shownChips = chips.slice(0, MAX_CELL_CHIPS)
        const hiddenCount = chips.length - shownChips.length

        const classes = ['ocal-cell']
        if (!inMonth) classes.push('is-outside')
        if (isPast) classes.push('is-past')
        if (isToday) classes.push('is-today')
        if (isWeekend) classes.push(openEntry ? 'is-weekend-open' : 'is-weekend-closed')

        const summary = [
            openEntry && 'open for claiming',
            isWeekend && !openEntry && 'weekend, office closed',
            dayEvents.length > 0 && plural(dayEvents.length, 'event'),
            dayClaims.length > 0 && plural(dayClaims.length, 'claim appointment'),
        ].filter(Boolean).join(', ')

        return (
            <button
                type="button"
                key={dateStr}
                className={classes.join(' ')}
                onClick={() => onDayClick(dateStr)}
                aria-label={`${formatDate(dateStr)}${isToday ? ' (today)' : ''}${summary ? ` — ${summary}` : ''}`}
                aria-current={isToday ? 'date' : undefined}
            >
                <span className="ocal-cell-head">
                    <span className="ocal-daynum">{date.getDate()}</span>
                    {isWeekend && !openEntry && inMonth && <span className="ocal-cell-tag">Closed</span>}
                </span>

                <span className="ocal-chips">
                    {shownChips.map((chip) => (
                        <span key={chip.key} className={`ocal-chip is-${chip.type}`} title={chip.title}>
                            {chip.label}
                        </span>
                    ))}
                    {hiddenCount > 0 && <span className="ocal-chip-more">+{hiddenCount} more</span>}
                </span>

                {/* Phones have no room for text chips -- show one dot per kind. */}
                {chips.length > 0 && (
                    <span className="ocal-dots" aria-hidden="true">
                        {openEntry && <span className="ocal-dot is-open" />}
                        {dayEvents.length > 0 && <span className="ocal-dot is-event" />}
                        {dayClaims.length > 0 && <span className="ocal-dot is-claim" />}
                    </span>
                )}
            </button>
        )
    }

    return (
        <div className="ocal-layout">
            <aside className="ocal-sidebar" aria-label="Coming up">
                <div className="ocal-sidebar-head">
                    <h2>Coming up</h2>
                    {!loading && upcoming.length > 0 && <span className="ocal-count">{upcoming.length}</span>}
                </div>

                {loading ? (
                    <SkeletonList count={3} />
                ) : upcoming.length === 0 ? (
                    <div className="ocal-sidebar-empty">
                        Nothing scheduled yet. Tap a day to add an event, or tap a weekend to open it for claiming.
                    </div>
                ) : (
                    <>
                        <ul className="ocal-upcoming-list">
                            {visibleUpcoming.map(renderUpcomingItem)}
                        </ul>
                        {upcoming.length > UPCOMING_PREVIEW && (
                            <button type="button" className="ocal-text-button" onClick={() => setShowAllUpcoming((v) => !v)}>
                                {showAllUpcoming ? 'Show less' : `Show all ${upcoming.length}`}
                            </button>
                        )}
                    </>
                )}

                <div className="ocal-sidebar-head ocal-sidebar-head-section">
                    <h2>Upcoming Claiming</h2>
                    {!loading && totalUpcomingClaims > 0 && <span className="ocal-count">{totalUpcomingClaims}</span>}
                </div>

                {loading ? (
                    <SkeletonList count={2} />
                ) : upcomingClaimDays.length === 0 ? (
                    <div className="ocal-sidebar-empty">No upcoming claiming appointments.</div>
                ) : (
                    <>
                        <ul className="ocal-upcoming-list">
                            {visibleClaimDays.map(({ date, claims }) => {
                                const { month, day, weekday } = monthDay(date)
                                const relative = relativeDayLabel(date, today)
                                const shown = claims.slice(0, CLAIM_NAMES_PER_DAY)
                                const more = claims.length - shown.length

                                return (
                                    <li key={date} className="ocal-upcoming-item is-claim">
                                        <button type="button" className="ocal-upcoming-main" onClick={() => onDayClick(date)}>
                                            <span className="ocal-date-badge" aria-hidden="true">
                                                <span>{month}</span>
                                                <strong>{day}</strong>
                                            </span>
                                            <span className="ocal-upcoming-text">
                                                <span className="ocal-upcoming-title">{plural(claims.length, 'student')} claiming</span>
                                                <span className="ocal-upcoming-meta">
                                                    {relative && <span className="ocal-upcoming-relative">{relative}</span>}
                                                    {weekday}
                                                </span>
                                                {shown.map((cs) => (
                                                    <span key={cs.claim_schedule_id} className="ocal-upcoming-note">
                                                        {formatTime(claimTime(cs)) || 'No time'} · {claimLabel(cs)}
                                                    </span>
                                                ))}
                                                {more > 0 && <span className="ocal-upcoming-note">+{more} more</span>}
                                            </span>
                                        </button>
                                    </li>
                                )
                            })}
                        </ul>
                        {upcomingClaimDays.length > CLAIM_DAYS_PREVIEW && (
                            <button type="button" className="ocal-text-button" onClick={() => setShowAllClaimDays((v) => !v)}>
                                {showAllClaimDays ? 'Show less' : `Show all ${upcomingClaimDays.length} days`}
                            </button>
                        )}
                    </>
                )}
            </aside>

            <section className="ocal-main" aria-label="Month view">
                <div className="ocal-toolbar">
                    <div className="ocal-nav">
                        <button type="button" className="ocal-icon-button is-bordered" onClick={() => onMonthChange(-1)} aria-label="Previous month">
                            <ChevronLeft />
                        </button>
                        <button type="button" className="ocal-icon-button is-bordered" onClick={() => onMonthChange(1)} aria-label="Next month">
                            <ChevronRight />
                        </button>
                        <h2 className="ocal-month-label" aria-live="polite">{monthLabel}</h2>
                    </div>

                    <button type="button" className="ocal-today-button" onClick={onToday} disabled={isCurrentMonth}>
                        Today
                    </button>
                </div>

                <div className="ocal-summary">
                    <span><span className="ocal-dot is-event" aria-hidden="true" />{plural(monthSummary.eventDays, 'day')} with events</span>
                    <span><span className="ocal-dot is-open" aria-hidden="true" />{plural(monthSummary.openDays, 'open weekend')}</span>
                    <span><span className="ocal-dot is-claim" aria-hidden="true" />{plural(monthSummary.claims, 'claim appointment')}</span>
                </div>

                {error && <div className="ocal-error" role="alert">{error}</div>}

                <div className={`ocal-grid${loading ? ' is-loading' : ''}`} aria-busy={loading || undefined}>
                    {WEEKDAY_HEADS.map((h, i) => (
                        <div className={`ocal-weekday${i === 0 || i === 6 ? ' is-weekend' : ''}`} key={h} aria-hidden="true">{h}</div>
                    ))}
                    {monthGrid.map(renderCell)}
                </div>

                <div className="ocal-legend" aria-label="Legend">
                    <span><span className="ocal-legend-swatch is-open" />Weekend open for claiming</span>
                    <span><span className="ocal-legend-swatch is-closed" />Weekend, closed</span>
                    <span><span className="ocal-legend-swatch is-today" />Today</span>
                </div>
            </section>
        </div>
    )
}

export default CalendarBoard
