import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activityLog'
import { notifyError, notifySuccess, notifyWarning, confirmModal } from '../../lib/notify'
import { SkeletonList } from '../../components/Skeleton'
import Modal from '../../components/Modal'
import './AdminPages.css'

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
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const [viewDate, setViewDate] = useState(() => {
        const d = new Date()
        return new Date(d.getFullYear(), d.getMonth(), 1)
    })

    const [showForm, setShowForm] = useState(false)
    const [newDate, setNewDate] = useState('')
    const [newNote, setNewNote] = useState('')
    const [saving, setSaving] = useState(false)
    const [removing, setRemoving] = useState(null)

    useEffect(() => {
        loadOpenDays()
    }, [])

    const loadOpenDays = async () => {
        try {
            setLoading(true)
            setError('')

            const { data, error: loadError } = await supabase
                .from('office_open_days')
                .select('open_day_id, open_date, note')
                .gte('open_date', getToday())
                .order('open_date', { ascending: true })

            if (loadError) throw new Error(loadError.message)

            setOpenDays(data || [])
        } catch (err) {
            console.error('LOAD OPEN DAYS ERROR:', err)
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

    const monthGrid = useMemo(() => buildMonthGrid(viewDate), [viewDate])

    const goToMonth = (delta) => {
        setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1))
    }

    const goToToday = () => {
        const d = new Date()
        setViewDate(new Date(d.getFullYear(), d.getMonth(), 1))
    }

    const openNewForm = (prefillDate) => {
        setNewDate(prefillDate || '')
        setNewNote('')
        setShowForm(true)
    }

    const handleCellClick = (date) => {
        const dateStr = formatLocal(date)
        const dow = date.getDay()
        const isWeekend = dow === 0 || dow === 6
        if (!isWeekend || dateStr < getToday()) return

        const existing = openDaysByDate[dateStr]
        if (existing) {
            removeOpenDay(existing)
        } else {
            openNewForm(dateStr)
        }
    }

    const addOpenDay = async () => {
        if (!newDate) {
            notifyWarning('Please select a date.')
            return
        }

        const day = new Date(`${newDate}T00:00:00`).getDay()

        if (day !== 0 && day !== 6) {
            notifyWarning('Only Saturdays and Sundays need to be marked here — weekdays are already treated as open.')
            return
        }

        try {
            setSaving(true)

            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser()

            if (userError || !user) {
                throw new Error('You are not logged in.')
            }

            const { error: insertError } = await supabase
                .from('office_open_days')
                .insert({
                    open_date: newDate,
                    note: newNote.trim() || null,
                    created_by: user.id,
                })

            if (insertError) {
                if (insertError.code === '23505') {
                    throw new Error('That date is already marked as an open day.')
                }
                throw new Error(insertError.message)
            }

            await logActivity({
                userId: user.id,
                action: 'add_office_open_day',
                tableName: 'office_open_days',
                recordId: null,
                description: `Marked ${formatDate(newDate)} as an office open day${newNote.trim() ? ` (${newNote.trim()})` : ''}.`,
            })

            notifySuccess('Open day added.')
            setShowForm(false)
            setNewDate('')
            setNewNote('')
            await loadOpenDays()

        } catch (err) {
            console.error('ADD OPEN DAY ERROR:', err)
            notifyError(err.message || 'Failed to add open day.')
        } finally {
            setSaving(false)
        }
    }

    const removeOpenDay = async (day) => {
        const confirmed = await confirmModal(
            `Remove ${formatDate(day.open_date)} as an office open day?`,
            { title: 'Remove open day?', confirmButtonText: 'Remove', icon: 'warning' }
        )
        if (!confirmed) return

        try {
            setRemoving(day.open_day_id)

            const {
                data: { user },
            } = await supabase.auth.getUser()

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
            await loadOpenDays()

        } catch (err) {
            console.error('REMOVE OPEN DAY ERROR:', err)
            notifyError(err.message || 'Failed to remove open day.')
        } finally {
            setRemoving(null)
        }
    }

    const monthLabel = viewDate.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
    const today = getToday()

    return (
        <div>
            <div className="admin-page-header-row">
                <div>
                    <h1 style={{ fontSize: 26, marginBottom: 6 }}>Office Calendar</h1>
                    <p>
                        Missed claiming appointments are automatically rescheduled to the next weekday.
                        Tap a Saturday or Sunday to mark the Registrar's Office open that day (e.g. during
                        enrollment), so it can be offered instead of being skipped.
                    </p>
                </div>

                <button className="admin-primary-button" onClick={() => openNewForm('')}>+ Add Open Day</button>
            </div>

            <div className="office-calendar-layout">
                <aside className="office-calendar-sidebar">
                    <div>
                        <div className="office-calendar-sidebar-title">Legend</div>
                        <div className="office-calendar-legend">
                            <div className="office-calendar-legend-item">
                                <span className="office-calendar-legend-swatch" style={{ background: 'var(--blue-tint)', border: '1px solid var(--blue)' }} />
                                Marked open — tap to remove
                            </div>
                            <div className="office-calendar-legend-item">
                                <span className="office-calendar-legend-swatch" style={{ background: 'transparent', border: '1px dashed var(--slate)' }} />
                                Weekend, closed — tap to mark open
                            </div>
                            <div className="office-calendar-legend-item">
                                <span className="office-calendar-legend-swatch" style={{ background: 'var(--paper)', border: '1px solid var(--line)' }} />
                                Weekday
                            </div>
                            <div className="office-calendar-legend-item">
                                <span className="office-calendar-legend-swatch" style={{ background: 'transparent', border: '2px solid var(--red)' }} />
                                Today
                            </div>
                        </div>
                    </div>

                    <div>
                        <div className="office-calendar-sidebar-title">Upcoming Open Days</div>

                        {loading ? (
                            <SkeletonList count={2} />
                        ) : openDays.length === 0 ? (
                            <div className="office-calendar-sidebar-empty">None added yet — tap a weekend on the calendar or "+ Add Open Day."</div>
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
                                            onClick={() => removeOpenDay(day)}
                                            disabled={removing === day.open_day_id}
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

                    {error && <div className="admin-error-box" style={{ marginBottom: 16 }}>{error}</div>}

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

                            const classes = ['office-calendar-cell']
                            if (isPast) classes.push('is-past')
                            if (isToday) classes.push('is-today')

                            if (isWeekend && openEntry) {
                                classes.push('is-weekend-open')
                            } else if (isWeekend) {
                                classes.push('is-weekend-closed', 'is-clickable')
                            }

                            return (
                                <div
                                    className={classes.join(' ')}
                                    key={dateStr}
                                    onClick={() => handleCellClick(date)}
                                >
                                    <span className="office-calendar-cell-daynum">{date.getDate()}</span>
                                    {openEntry && (
                                        <span className="office-calendar-cell-chip" title={openEntry.note || 'Marked open'}>
                                            <span className="office-calendar-cell-chip-dot" />
                                            {openEntry.note || 'Open'}
                                        </span>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </main>
            </div>

            {showForm && (
                <Modal
                    title="Add an Open Weekend Day"
                    maxWidth={480}
                    onClose={() => { if (saving) return; setShowForm(false) }}
                >
                    <div className="form-group" style={{ marginBottom: 16 }}>
                        <label className="form-label" htmlFor="open-day-date">Date</label>
                        <input
                            id="open-day-date"
                            type="date"
                            className="form-input"
                            value={newDate}
                            min={getToday()}
                            onChange={(e) => setNewDate(e.target.value)}
                            disabled={saving}
                        />
                        <small style={{ color: 'var(--slate)', fontSize: 12 }}>
                            Only Saturdays and Sundays — weekdays are already treated as open.
                        </small>
                    </div>

                    <div className="form-group" style={{ marginBottom: 20 }}>
                        <label className="form-label" htmlFor="open-day-note">Note (optional)</label>
                        <input
                            id="open-day-note"
                            type="text"
                            className="form-input"
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                            placeholder="e.g. Enrollment Saturday"
                            disabled={saving}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: 10 }}>
                        <button className="admin-primary-button" onClick={addOpenDay} disabled={saving}>
                            {saving ? 'Adding...' : 'Add Open Day'}
                        </button>
                        <button className="admin-secondary-button" onClick={() => setShowForm(false)} disabled={saving}>
                            Cancel
                        </button>
                    </div>
                </Modal>
            )}
        </div>
    )
}

export default OfficeCalendar
