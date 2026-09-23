import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activityLog'
import { notifyError, notifySuccess, notifyWarning, confirmModal } from '../../lib/notify'
import { SkeletonList } from '../../components/Skeleton'
import Modal from '../../components/Modal'
import './EmployeePages.css'

const WEEKDAY_HEADS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Quick-fill presets for the most common day notes, so staff don't have
// to retype the same wording each time (e.g. every fiesta/holiday closure).
const EVENT_PRESETS = [
    'Mental Health Break',
    'Office Closed — Fiesta',
    'Office Closed — Holiday',
    'Enrollment Week',
    'System Maintenance',
]

function formatLocal(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatDate(dateStr) {
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-PH', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    })
}

function formatDateShort(dateStr) {
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-PH', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    })
}

function formatTime(time) {
    if (!time) return ''
    const [hours, minutes] = time.split(':')
    const date = new Date()
    date.setHours(Number(hours), Number(minutes), 0, 0)
    return date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
}

function getToday() {
    return formatLocal(new Date())
}

function isWeekendDate(dateStr) {
    const dow = new Date(`${dateStr}T00:00:00`).getDay()
    return dow === 0 || dow === 6
}

// Every date from start to end, inclusive, as 'YYYY-MM-DD' strings -- used
// to apply one event/note to a whole span of days (e.g. the 20th to the
// 26th) in a single action instead of one day at a time.
function eachDateInRange(startStr, endStr) {
    const dates = []
    let cursor = new Date(`${startStr}T00:00:00`)
    const end = new Date(`${endStr}T00:00:00`)
    while (cursor <= end) {
        dates.push(formatLocal(cursor))
        cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1)
    }
    return dates
}

function buildMonthGrid(viewDate) {
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const startWeekday = firstDay.getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    const cells = []
    for (let i = 0; i < startWeekday; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
    return cells
}

function OfficeCalendar() {
    const navigate = useNavigate()
    const [openDays, setOpenDays] = useState([])
    const [events, setEvents] = useState([])
    const [claimSchedules, setClaimSchedules] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const [viewDate, setViewDate] = useState(() => {
        const d = new Date()
        return new Date(d.getFullYear(), d.getMonth(), 1)
    })

    const [showDayModal, setShowDayModal] = useState(false)
    const [dayModalDate, setDayModalDate] = useState('')
    const [newEventTitle, setNewEventTitle] = useState('')
    const [newEventNote, setNewEventNote] = useState('')
    const [saving, setSaving] = useState(false)
    const [togglingOpen, setTogglingOpen] = useState(false)
    const [removingEventId, setRemovingEventId] = useState(null)
    const [removingOpenDayId, setRemovingOpenDayId] = useState(null)

    const [showRangeModal, setShowRangeModal] = useState(false)
    const [rangeStart, setRangeStart] = useState('')
    const [rangeEnd, setRangeEnd] = useState('')
    const [rangeTitle, setRangeTitle] = useState('')
    const [rangeNote, setRangeNote] = useState('')
    const [addingRange, setAddingRange] = useState(false)

    useEffect(() => {
        loadAll()
    }, [])

    const loadAll = async () => {
        try {
            setLoading(true)
            setError('')

            // Fetch all open days/events, not just today-and-future, so
            // staff can also mark past weekends open or add past
            // events/notes (e.g. backfilling something that was missed),
            // and so those past entries render correctly on the calendar
            // grid and are recognized as "already set" when toggling.
            const {
                data: { user },
            } = await supabase.auth.getUser()

            if (!user) throw new Error('You are not logged in.')

            const [openDaysRes, eventsRes, claimSchedulesRes, employeeRes] = await Promise.all([
                supabase
                    .from('office_open_days')
                    .select('open_day_id, open_date, note')
                    .order('open_date', { ascending: true }),
                supabase
                    .from('office_events')
                    .select('event_id, event_date, title, note')
                    .order('event_date', { ascending: true }),
                supabase
                    .from('claim_schedules')
                    .select('claim_schedule_id, request_id, status, scheduled_by, scheduled_date, scheduled_time, claim_date, claim_time, document_requests(request_number, assigned_employee_id)')
                    .neq('status', 'cancelled'),
                supabase
                    .from('employees')
                    .select('employee_id, access_scope')
                    .eq('user_id', user.id)
                    .single(),
            ])

            if (openDaysRes.error) throw new Error(openDaysRes.error.message)
            if (eventsRes.error) throw new Error(eventsRes.error.message)
            if (claimSchedulesRes.error) throw new Error(claimSchedulesRes.error.message)
            if (employeeRes.error || !employeeRes.data) throw new Error('Employee record could not be found.')

            // Same scoping as the Claim Schedule page: releasing staff work
            // the front desk and see every claim office-wide; everyone else
            // sees claims for requests assigned to them or that they scheduled.
            const me = employeeRes.data
            const visibleClaims = (claimSchedulesRes.data || []).filter(
                (cs) =>
                    me.access_scope === 'releasing' ||
                    cs.scheduled_by === me.employee_id ||
                    cs.document_requests?.assigned_employee_id === me.employee_id
            )

            setOpenDays(openDaysRes.data || [])
            setEvents(eventsRes.data || [])
            setClaimSchedules(visibleClaims)
        } catch (err) {
            console.error('LOAD OFFICE CALENDAR ERROR:', err)
            setError(err.message || 'Failed to load office calendar.')
        } finally {
            setLoading(false)
        }
    }

    const openDaysByDate = useMemo(() => {
        const map = {}
        for (const day of openDays) map[day.open_date] = day
        return map
    }, [openDays])

    const eventsByDate = useMemo(() => {
        const map = {}
        for (const ev of events) {
            if (!map[ev.event_date]) map[ev.event_date] = []
            map[ev.event_date].push(ev)
        }
        return map
    }, [events])

    // Grouped by claim_date when the appointment's been rescheduled,
    // otherwise the original scheduled_date -- same as the admin calendar.
    const claimSchedulesByDate = useMemo(() => {
        const map = {}
        for (const cs of claimSchedules) {
            const date = cs.claim_date || cs.scheduled_date
            if (!date) continue
            if (!map[date]) map[date] = []
            map[date].push(cs)
        }
        for (const list of Object.values(map)) {
            list.sort((a, b) => (a.claim_time || a.scheduled_time || '').localeCompare(b.claim_time || b.scheduled_time || ''))
        }
        return map
    }, [claimSchedules])

    const monthGrid = useMemo(() => buildMonthGrid(viewDate), [viewDate])

    // The sidebar is meant as an at-a-glance look-ahead, so it stays
    // upcoming-only even though `events`/`openDays` now also hold past
    // entries (needed for the calendar grid and for past-day editing).
    const upcomingEvents = useMemo(() => events.filter((ev) => ev.event_date >= getToday()), [events])
    const upcomingOpenDays = useMemo(() => openDays.filter((d) => d.open_date >= getToday()), [openDays])

    const goToMonth = (delta) => {
        setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1))
    }

    const goToToday = () => {
        const d = new Date()
        setViewDate(new Date(d.getFullYear(), d.getMonth(), 1))
    }

    const openDayModal = (dateStr) => {
        setDayModalDate(dateStr || getToday())
        setNewEventTitle('')
        setNewEventNote('')
        setShowDayModal(true)
    }

    const toggleOpenDay = async () => {
        if (!isWeekendDate(dayModalDate)) return

        const existing = openDaysByDate[dayModalDate]

        try {
            setTogglingOpen(true)

            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser()

            if (userError || !user) throw new Error('You are not logged in.')

            if (existing) {
                const { error: deleteError } = await supabase
                    .from('office_open_days')
                    .delete()
                    .eq('open_day_id', existing.open_day_id)

                if (deleteError) throw new Error(deleteError.message)

                await logActivity({
                    userId: user.id,
                    action: 'remove_office_open_day',
                    tableName: 'office_open_days',
                    recordId: null,
                    description: `Removed ${formatDate(dayModalDate)} as an office open day.`,
                })

                notifySuccess('Open status removed.')
            } else {
                const { error: insertError } = await supabase
                    .from('office_open_days')
                    .insert({ open_date: dayModalDate, created_by: user.id })

                if (insertError) throw new Error(insertError.message)

                await logActivity({
                    userId: user.id,
                    action: 'add_office_open_day',
                    tableName: 'office_open_days',
                    recordId: null,
                    description: `Marked ${formatDate(dayModalDate)} as an office open day.`,
                })

                notifySuccess('Marked as open for claiming.')
            }

            await loadAll()

        } catch (err) {
            console.error('TOGGLE OPEN DAY ERROR:', err)
            notifyError(err.message || 'Failed to update open status.')
        } finally {
            setTogglingOpen(false)
        }
    }

    const removeOpenDayFromSidebar = async (day) => {
        const confirmed = await confirmModal(
            `Remove ${formatDate(day.open_date)} as an office open day?`,
            { title: 'Remove open day?', confirmButtonText: 'Remove', icon: 'warning' }
        )
        if (!confirmed) return

        try {
            setRemovingOpenDayId(day.open_day_id)

            const { data: { user } } = await supabase.auth.getUser()

            const { error: deleteError } = await supabase
                .from('office_open_days')
                .delete()
                .eq('open_day_id', day.open_day_id)

            if (deleteError) throw new Error(deleteError.message)

            await logActivity({
                userId: user?.id,
                action: 'remove_office_open_day',
                tableName: 'office_open_days',
                recordId: null,
                description: `Removed ${formatDate(day.open_date)} as an office open day.`,
            })

            notifySuccess('Open day removed.')
            await loadAll()

        } catch (err) {
            console.error('REMOVE OPEN DAY ERROR:', err)
            notifyError(err.message || 'Failed to remove open day.')
        } finally {
            setRemovingOpenDayId(null)
        }
    }

    const addEvent = async () => {
        if (!newEventTitle.trim()) {
            notifyWarning('Please enter a title for this event.')
            return
        }

        try {
            setSaving(true)

            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser()

            if (userError || !user) throw new Error('You are not logged in.')

            const { error: insertError } = await supabase
                .from('office_events')
                .insert({
                    event_date: dayModalDate,
                    title: newEventTitle.trim(),
                    note: newEventNote.trim() || null,
                    created_by: user.id,
                })

            if (insertError) throw new Error(insertError.message)

            await logActivity({
                userId: user.id,
                action: 'add_office_event',
                tableName: 'office_events',
                recordId: null,
                description: `Added office event "${newEventTitle.trim()}" on ${formatDate(dayModalDate)}.`,
            })

            notifySuccess('Event added.')
            setNewEventTitle('')
            setNewEventNote('')
            await loadAll()

        } catch (err) {
            console.error('ADD EVENT ERROR:', err)
            notifyError(err.message || 'Failed to add event.')
        } finally {
            setSaving(false)
        }
    }

    const removeEvent = async (event) => {
        const confirmed = await confirmModal(
            `Remove "${event.title}" from ${formatDate(event.event_date)}?`,
            { title: 'Remove event?', confirmButtonText: 'Remove', icon: 'warning' }
        )
        if (!confirmed) return

        try {
            setRemovingEventId(event.event_id)

            const { data: { user } } = await supabase.auth.getUser()

            const { error: deleteError } = await supabase
                .from('office_events')
                .delete()
                .eq('event_id', event.event_id)

            if (deleteError) throw new Error(deleteError.message)

            await logActivity({
                userId: user?.id,
                action: 'remove_office_event',
                tableName: 'office_events',
                recordId: null,
                description: `Removed office event "${event.title}" from ${formatDate(event.event_date)}.`,
            })

            notifySuccess('Event removed.')
            await loadAll()

        } catch (err) {
            console.error('REMOVE EVENT ERROR:', err)
            notifyError(err.message || 'Failed to remove event.')
        } finally {
            setRemovingEventId(null)
        }
    }

    const openRangeModal = () => {
        setRangeStart(getToday())
        setRangeEnd(getToday())
        setRangeTitle('')
        setRangeNote('')
        setShowRangeModal(true)
    }

    const rangeDates = rangeStart && rangeEnd && rangeStart <= rangeEnd ? eachDateInRange(rangeStart, rangeEnd) : []

    const addRangeEvent = async () => {
        if (!rangeTitle.trim()) {
            notifyWarning('Please enter a title for this event.')
            return
        }

        if (!rangeStart || !rangeEnd) {
            notifyWarning('Please pick a start and end date.')
            return
        }

        if (rangeStart > rangeEnd) {
            notifyWarning('The start date must be on or before the end date.')
            return
        }

        const dates = eachDateInRange(rangeStart, rangeEnd)

        const confirmed = await confirmModal(
            `Add "${rangeTitle.trim()}" to every day from ${formatDate(rangeStart)} to ${formatDate(rangeEnd)}? (${dates.length} day${dates.length === 1 ? '' : 's'})`
        )
        if (!confirmed) return

        try {
            setAddingRange(true)

            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser()

            if (userError || !user) throw new Error('You are not logged in.')

            const rows = dates.map((event_date) => ({
                event_date,
                title: rangeTitle.trim(),
                note: rangeNote.trim() || null,
                created_by: user.id,
            }))

            const { error: insertError } = await supabase.from('office_events').insert(rows)
            if (insertError) throw new Error(insertError.message)

            await logActivity({
                userId: user.id,
                action: 'add_office_event',
                tableName: 'office_events',
                recordId: null,
                description: `Added office event "${rangeTitle.trim()}" to ${dates.length} day(s), ${formatDate(rangeStart)} to ${formatDate(rangeEnd)}.`,
            })

            notifySuccess(`Added to ${dates.length} day${dates.length === 1 ? '' : 's'}.`)
            setShowRangeModal(false)
            await loadAll()

        } catch (err) {
            console.error('ADD RANGE EVENT ERROR:', err)
            notifyError(err.message || 'Failed to add event to the selected range.')
        } finally {
            setAddingRange(false)
        }
    }

    const monthLabel = viewDate.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
    const today = getToday()

    const dayModalEvents = eventsByDate[dayModalDate] || []
    const dayModalClaims = claimSchedulesByDate[dayModalDate] || []
    const dayModalIsWeekend = dayModalDate ? isWeekendDate(dayModalDate) : false
    const dayModalOpenEntry = dayModalDate ? openDaysByDate[dayModalDate] : null
    const dayModalIsPast = dayModalDate ? dayModalDate < today : false

    return (
        <div>
            <div className="employee-page-header-row">
                <div>
                    <h1 style={{ fontSize: 26, marginBottom: 6 }}>Office Calendar</h1>
                    <p>
                        Tap any day to add an event or note (e.g. "Enrollment Week," "Office Closed —
                        Holiday"). For Saturdays and Sundays, you can also mark the office open for
                        claiming, so missed appointments get auto-rescheduled there instead of skipped.
                    </p>
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button className="employee-secondary-button" onClick={openRangeModal}>+ Add for a Range</button>
                    <button className="employee-primary-button" onClick={() => openDayModal(getToday())}>+ Manage a Day</button>
                </div>
            </div>

            <div className="office-calendar-layout">
                <aside className="office-calendar-sidebar">
                    <div className="office-calendar-sidebar-section">
                        <div className="office-calendar-sidebar-title">Legend</div>
                        <div className="office-calendar-legend">
                            <div className="office-calendar-legend-item">
                                <span className="office-calendar-legend-swatch" style={{ background: 'var(--blue-tint)', border: '1px solid var(--blue-accent, var(--blue))' }} />
                                Weekend marked open for claiming
                            </div>
                            <div className="office-calendar-legend-item">
                                <span className="office-calendar-legend-swatch" style={{ background: 'var(--warning-bg, rgba(255,193,7,0.18))', border: '1px solid var(--warning-text, #FFCF66)' }} />
                                Has an event or note
                            </div>
                            <div className="office-calendar-legend-item">
                                <span className="office-calendar-legend-swatch" style={{ background: 'transparent', border: '1px dashed var(--slate)' }} />
                                Weekend, closed
                            </div>
                            <div className="office-calendar-legend-item">
                                <span className="office-calendar-legend-swatch" style={{ background: 'transparent', border: '2px solid var(--red)' }} />
                                Today
                            </div>
                        </div>
                    </div>

                    <div className="office-calendar-sidebar-section">
                        <div className="office-calendar-sidebar-title">Upcoming Events</div>

                        {loading ? (
                            <SkeletonList count={2} />
                        ) : upcomingEvents.length === 0 ? (
                            <div className="office-calendar-sidebar-empty">No upcoming events added yet.</div>
                        ) : (
                            <div className="office-calendar-sidebar-list">
                                {upcomingEvents.map((ev) => (
                                    <div className="office-calendar-sidebar-item office-calendar-sidebar-item-event" key={ev.event_id}>
                                        <div>
                                            <div className="office-calendar-sidebar-item-date">{formatDateShort(ev.event_date)}</div>
                                            <div className="office-calendar-sidebar-item-note">{ev.title}</div>
                                        </div>
                                        <button
                                            className="office-calendar-sidebar-remove"
                                            onClick={() => removeEvent(ev)}
                                            disabled={removingEventId === ev.event_id}
                                            aria-label={`Remove ${ev.title}`}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="office-calendar-sidebar-section">
                        <div className="office-calendar-sidebar-title">Upcoming Open Days</div>

                        {loading ? (
                            <SkeletonList count={2} />
                        ) : upcomingOpenDays.length === 0 ? (
                            <div className="office-calendar-sidebar-empty">None added yet — tap a weekend on the calendar.</div>
                        ) : (
                            <div className="office-calendar-sidebar-list">
                                {upcomingOpenDays.map((day) => (
                                    <div className="office-calendar-sidebar-item" key={day.open_day_id}>
                                        <div>
                                            <div className="office-calendar-sidebar-item-date">{formatDateShort(day.open_date)}</div>
                                            {day.note && <div className="office-calendar-sidebar-item-note">{day.note}</div>}
                                        </div>
                                        <button
                                            className="office-calendar-sidebar-remove"
                                            onClick={() => removeOpenDayFromSidebar(day)}
                                            disabled={removingOpenDayId === day.open_day_id}
                                            aria-label={`Remove ${formatDate(day.open_date)}`}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </aside>

                <main className="office-calendar-main">
                    <div className="office-calendar-toolbar">
                        <div className="office-calendar-nav-controls">
                            <button className="office-calendar-nav-button" onClick={() => goToMonth(-1)} aria-label="Previous month">‹</button>
                            <span className="office-calendar-month-label">{monthLabel}</span>
                            <button className="office-calendar-nav-button" onClick={() => goToMonth(1)} aria-label="Next month">›</button>
                        </div>
                        <button className="office-calendar-today-button" onClick={goToToday}>Today</button>
                    </div>

                    {error && <div className="employee-error-box" style={{ marginBottom: 16 }}>{error}</div>}

                    <div className="office-calendar-grid">
                        {WEEKDAY_HEADS.map((h) => (
                            <div className="office-calendar-weekday-head" key={h}>{h}</div>
                        ))}

                        {monthGrid.map((date, i) => {
                            if (!date) {
                                return <div className="office-calendar-cell is-empty" key={`empty-${i}`} />
                            }

                            const dateStr = formatLocal(date)
                            const dow = date.getDay()
                            const isWeekend = dow === 0 || dow === 6
                            const isPast = dateStr < today
                            const isToday = dateStr === today
                            const openEntry = openDaysByDate[dateStr]
                            const dayEvents = eventsByDate[dateStr] || []
                            const dayClaims = claimSchedulesByDate[dateStr] || []

                            const classes = ['office-calendar-cell', 'is-clickable']
                            if (isPast) classes.push('is-past')
                            if (isToday) classes.push('is-today')

                            if (isWeekend && openEntry) {
                                classes.push('is-weekend-open')
                            } else if (isWeekend) {
                                classes.push('is-weekend-closed')
                            }

                            if (dayEvents.length > 0) {
                                classes.push('is-has-event')
                            }

                            const itemCount = (dayEvents.length > 0 ? dayEvents.length : (openEntry && isWeekend ? 1 : 0)) + (dayClaims.length > 0 ? 1 : 0)
                            const cellStyle = itemCount > 1 ? { minHeight: `${84 + (itemCount - 1) * 26}px` } : undefined

                            return (
                                <div
                                    className={classes.join(' ')}
                                    key={dateStr}
                                    style={cellStyle}
                                    onClick={() => openDayModal(dateStr)}
                                >
                                    <span className="office-calendar-cell-daynum">{date.getDate()}</span>

                                    {dayEvents.map((ev) => (
                                        <span className="office-calendar-cell-chip office-calendar-cell-chip-event" key={ev.event_id} title={ev.note || ev.title}>
                                            <span className="office-calendar-cell-chip-dot office-calendar-cell-chip-dot-event" />
                                            {ev.title}
                                        </span>
                                    ))}

                                    {openEntry && dayEvents.length === 0 && (
                                        <span className="office-calendar-cell-chip" title={openEntry.note || 'Marked open'}>
                                            <span className="office-calendar-cell-chip-dot" />
                                            Open for claiming
                                        </span>
                                    )}

                                    {dayClaims.length > 0 && (
                                        <span
                                            className="office-calendar-cell-chip office-calendar-cell-chip-claim"
                                            title={`${dayClaims.length} student${dayClaims.length === 1 ? '' : 's'} scheduled to claim`}
                                        >
                                            <span className="office-calendar-cell-chip-dot office-calendar-cell-chip-dot-claim" />
                                            {dayClaims.length} claiming
                                        </span>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </main>
            </div>

            {showDayModal && (
                <Modal
                    title={formatDate(dayModalDate)}
                    maxWidth={480}
                    onClose={() => { if (saving || togglingOpen) return; setShowDayModal(false) }}
                >
                    {dayModalIsWeekend && (
                        <div
                            className="employee-notice"
                            style={{
                                marginBottom: 20,
                                background: dayModalOpenEntry ? 'var(--blue-tint)' : 'var(--paper)',
                                border: `1px solid ${dayModalOpenEntry ? 'var(--blue-accent, var(--blue))' : 'var(--line)'}`,
                            }}
                        >
                            <strong>{dayModalOpenEntry ? 'Office is open for claiming this day' : 'Weekend — office closed by default'}</strong>
                            <p style={{ marginBottom: 12 }}>
                                {dayModalIsPast
                                    ? dayModalOpenEntry
                                        ? 'This past date is recorded as an open day.'
                                        : 'Backfill this past date as an open day if claiming actually happened.'
                                    : dayModalOpenEntry
                                        ? 'Missed claims can be auto-rescheduled to this date.'
                                        : 'Missed claims will skip this date unless marked open.'}
                            </p>
                            <button
                                className={dayModalOpenEntry ? 'employee-danger-button' : 'employee-primary-button'}
                                onClick={toggleOpenDay}
                                disabled={togglingOpen}
                            >
                                {togglingOpen
                                    ? 'Saving...'
                                    : dayModalOpenEntry
                                        ? 'Remove Open Status'
                                        : 'Mark Open for Claiming'}
                            </button>
                        </div>
                    )}

                    <h3 style={{ fontSize: 14, marginBottom: 10 }}>Claiming Appointments</h3>

                    {dayModalClaims.length === 0 ? (
                        <p style={{ fontSize: 13, color: 'var(--slate)', marginBottom: 16 }}>No students scheduled to claim this day.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                            {dayModalClaims.map((cs) => (
                                <div key={cs.claim_schedule_id} className="employee-list-card" style={{ marginBottom: 0, padding: 12 }}>
                                    <div className="employee-list-card-header" style={{ marginBottom: 0 }}>
                                        <div>
                                            <h3 style={{ fontSize: 13.5 }}>{cs.document_requests?.request_number || 'Request'}</h3>
                                            <p style={{ fontSize: 12.5 }}>
                                                {formatTime(cs.claim_time || cs.scheduled_time) || 'No time set'}
                                            </p>
                                        </div>
                                        <button
                                            className="employee-link-button"
                                            style={{ padding: '6px 12px', fontSize: 12.5 }}
                                            onClick={() => navigate(`/employee/requests/${cs.request_id}`)}
                                        >
                                            Open →
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <h3 style={{ fontSize: 14, marginBottom: 10 }}>Events &amp; Notes</h3>

                    {dayModalEvents.length === 0 ? (
                        <p style={{ fontSize: 13, color: 'var(--slate)', marginBottom: 16 }}>No events added for this day yet.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                            {dayModalEvents.map((ev) => (
                                <div key={ev.event_id} className="employee-list-card" style={{ marginBottom: 0, padding: 12 }}>
                                    <div className="employee-list-card-header" style={{ marginBottom: 0 }}>
                                        <div>
                                            <h3 style={{ fontSize: 13.5 }}>{ev.title}</h3>
                                            {ev.note && <p style={{ fontSize: 12.5 }}>{ev.note}</p>}
                                        </div>
                                        <button
                                            className="employee-danger-button"
                                            style={{ padding: '6px 12px', fontSize: 12.5 }}
                                            onClick={() => removeEvent(ev)}
                                            disabled={removingEventId === ev.event_id}
                                        >
                                            {removingEventId === ev.event_id ? '...' : 'Remove'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {dayModalIsPast && (
                        <p style={{ fontSize: 12, color: 'var(--slate)', marginBottom: 12 }}>
                            This is a past date — you can still add a note for the record.
                        </p>
                    )}

                    <div className="form-group" style={{ marginBottom: 12 }}>
                        <label className="form-label" htmlFor="event-title">Add an Event</label>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                            {EVENT_PRESETS.map((preset) => (
                                <button
                                    type="button"
                                    key={preset}
                                    className="employee-filter-chip"
                                    style={{ fontSize: 12 }}
                                    onClick={() => setNewEventTitle(preset)}
                                    disabled={saving}
                                >
                                    {preset}
                                </button>
                            ))}
                        </div>

                        <input
                            id="event-title"
                            type="text"
                            className="form-input"
                            value={newEventTitle}
                            onChange={(e) => setNewEventTitle(e.target.value)}
                            placeholder="e.g. Enrollment Week, Office Closed — Holiday"
                            disabled={saving}
                        />
                    </div>

                    <div className="form-group" style={{ marginBottom: 16 }}>
                        <label className="form-label" htmlFor="event-note">Note (optional)</label>
                        <textarea
                            id="event-note"
                            className="form-input"
                            rows={2}
                            value={newEventNote}
                            onChange={(e) => setNewEventNote(e.target.value)}
                            placeholder="Any additional details"
                            disabled={saving}
                        />
                    </div>

                    <button className="employee-secondary-button" onClick={addEvent} disabled={saving}>
                        {saving ? 'Adding...' : '+ Add Event'}
                    </button>
                </Modal>
            )}

            {showRangeModal && (
                <Modal
                    title="Add Event to a Range of Days"
                    maxWidth={480}
                    onClose={() => { if (addingRange) return; setShowRangeModal(false) }}
                >
                    <p style={{ fontSize: 13, color: 'var(--slate)', marginBottom: 16 }}>
                        Applies the same event/note to every day in the range (e.g. the 20th to the
                        26th), including weekends, so you don't have to add it one day at a time.
                    </p>

                    <div className="employee-info-grid" style={{ marginBottom: 14 }}>
                        <div className="form-group">
                            <label className="form-label" htmlFor="range-start">Start Date</label>
                            <input
                                id="range-start"
                                type="date"
                                className="form-input"
                                value={rangeStart}
                                onChange={(e) => setRangeStart(e.target.value)}
                                disabled={addingRange}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="range-end">End Date</label>
                            <input
                                id="range-end"
                                type="date"
                                className="form-input"
                                value={rangeEnd}
                                onChange={(e) => setRangeEnd(e.target.value)}
                                disabled={addingRange}
                            />
                        </div>
                    </div>

                    {rangeStart && rangeEnd && rangeStart > rangeEnd && (
                        <p style={{ fontSize: 12.5, color: 'var(--red)', marginBottom: 12 }}>
                            Start date must be on or before the end date.
                        </p>
                    )}

                    <div className="form-group" style={{ marginBottom: 12 }}>
                        <label className="form-label" htmlFor="range-title">Event Title</label>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                            {EVENT_PRESETS.map((preset) => (
                                <button
                                    type="button"
                                    key={preset}
                                    className="employee-filter-chip"
                                    style={{ fontSize: 12 }}
                                    onClick={() => setRangeTitle(preset)}
                                    disabled={addingRange}
                                >
                                    {preset}
                                </button>
                            ))}
                        </div>

                        <input
                            id="range-title"
                            type="text"
                            className="form-input"
                            value={rangeTitle}
                            onChange={(e) => setRangeTitle(e.target.value)}
                            placeholder="e.g. Mental Health Break"
                            disabled={addingRange}
                        />
                    </div>

                    <div className="form-group" style={{ marginBottom: 16 }}>
                        <label className="form-label" htmlFor="range-note">Note (optional)</label>
                        <textarea
                            id="range-note"
                            className="form-input"
                            rows={2}
                            value={rangeNote}
                            onChange={(e) => setRangeNote(e.target.value)}
                            placeholder="Any additional details"
                            disabled={addingRange}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <button className="employee-primary-button" onClick={addRangeEvent} disabled={addingRange}>
                            {addingRange
                                ? 'Adding...'
                                : `Add to ${rangeDates.length} Day${rangeDates.length === 1 ? '' : 's'}`}
                        </button>
                        <button className="employee-danger-button" onClick={() => setShowRangeModal(false)} disabled={addingRange}>
                            Cancel
                        </button>
                    </div>
                </Modal>
            )}
        </div>
    )
}

export default OfficeCalendar
