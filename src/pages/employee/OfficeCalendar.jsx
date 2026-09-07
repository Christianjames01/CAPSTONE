import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activityLog'
import { notifyError, notifySuccess, notifyWarning, confirmModal } from '../../lib/notify'
import { SkeletonList } from '../../components/Skeleton'
import Modal from '../../components/Modal'
import './EmployeePages.css'

const WEEKDAY_HEADS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

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

function getToday() {
    return formatLocal(new Date())
}

function isWeekendDate(dateStr) {
    const dow = new Date(`${dateStr}T00:00:00`).getDay()
    return dow === 0 || dow === 6
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
    const [openDays, setOpenDays] = useState([])
    const [events, setEvents] = useState([])
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

    useEffect(() => {
        loadAll()
    }, [])

    const loadAll = async () => {
        try {
            setLoading(true)
            setError('')

            const [openDaysRes, eventsRes] = await Promise.all([
                supabase
                    .from('office_open_days')
                    .select('open_day_id, open_date, note')
                    .gte('open_date', getToday())
                    .order('open_date', { ascending: true }),
                supabase
                    .from('office_events')
                    .select('event_id, event_date, title, note')
                    .gte('event_date', getToday())
                    .order('event_date', { ascending: true }),
            ])

            if (openDaysRes.error) throw new Error(openDaysRes.error.message)
            if (eventsRes.error) throw new Error(eventsRes.error.message)

            setOpenDays(openDaysRes.data || [])
            setEvents(eventsRes.data || [])
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

    const monthGrid = useMemo(() => buildMonthGrid(viewDate), [viewDate])

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

    const monthLabel = viewDate.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
    const today = getToday()

    const dayModalEvents = eventsByDate[dayModalDate] || []
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

                <button className="employee-primary-button" onClick={() => openDayModal(getToday())}>+ Manage a Day</button>
            </div>

            <div className="office-calendar-layout">
                <aside className="office-calendar-sidebar">
                    <div>
                        <div className="office-calendar-sidebar-title">Legend</div>
                        <div className="office-calendar-legend">
                            <div className="office-calendar-legend-item">
                                <span className="office-calendar-legend-swatch" style={{ background: 'var(--blue-tint)', border: '1px solid var(--blue)' }} />
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

                    <div>
                        <div className="office-calendar-sidebar-title">Upcoming Events</div>

                        {loading ? (
                            <SkeletonList count={2} />
                        ) : events.length === 0 ? (
                            <div className="office-calendar-sidebar-empty">No upcoming events added yet.</div>
                        ) : (
                            <div className="office-calendar-sidebar-list">
                                {events.map((ev) => (
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

                    <div>
                        <div className="office-calendar-sidebar-title">Upcoming Open Days</div>

                        {loading ? (
                            <SkeletonList count={2} />
                        ) : openDays.length === 0 ? (
                            <div className="office-calendar-sidebar-empty">None added yet — tap a weekend on the calendar.</div>
                        ) : (
                            <div className="office-calendar-sidebar-list">
                                {openDays.map((day) => (
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

                            return (
                                <div
                                    className={classes.join(' ')}
                                    key={dateStr}
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
                                border: `1px solid ${dayModalOpenEntry ? 'var(--blue)' : 'var(--line)'}`,
                            }}
                        >
                            <strong>{dayModalOpenEntry ? 'Office is open for claiming this day' : 'Weekend — office closed by default'}</strong>
                            <p style={{ marginBottom: 12 }}>
                                {dayModalOpenEntry
                                    ? 'Missed claims can be auto-rescheduled to this date.'
                                    : 'Missed claims will skip this date unless marked open.'}
                            </p>
                            <button
                                className={dayModalOpenEntry ? 'employee-danger-button' : 'employee-primary-button'}
                                onClick={toggleOpenDay}
                                disabled={togglingOpen || dayModalIsPast}
                            >
                                {togglingOpen
                                    ? 'Saving...'
                                    : dayModalOpenEntry
                                        ? 'Remove Open Status'
                                        : 'Mark Open for Claiming'}
                            </button>
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

                    {!dayModalIsPast && (
                        <>
                            <div className="form-group" style={{ marginBottom: 12 }}>
                                <label className="form-label" htmlFor="event-title">Add an Event</label>
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
                        </>
                    )}
                </Modal>
            )}
        </div>
    )
}

export default OfficeCalendar
