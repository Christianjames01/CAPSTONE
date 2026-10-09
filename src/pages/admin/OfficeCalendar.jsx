import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activityLog'
import { notifyError, notifySuccess, notifyWarning, confirmModal } from '../../lib/notify'
import { claimDate, claimTime, eachDateInRange, formatDate, getToday, isWeekendDate } from '../../lib/officeCalendar'
import CalendarBoard from '../../components/officeCalendar/CalendarBoard'
import DayModal from '../../components/officeCalendar/DayModal'
import RangeModal from '../../components/officeCalendar/RangeModal'
import DeleteRangeModal from '../../components/officeCalendar/DeleteRangeModal'
import './AdminPages.css'
import { useLiveRefresh } from '../../lib/useLiveRefresh'
import { formatHours, isMissingHoursColumn, noteWithHours, writeWithHours } from '../../lib/officeHours'
import { adminPath } from '../../lib/portalPaths'
import { blockedForReadOnlyViewer } from '../../lib/viewOnlyGuard'
import { friendlyError } from '../../lib/friendlyError'

function OfficeCalendar() {
    const { role } = useOutletContext() || {}
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
    const [removingGroupKey, setRemovingGroupKey] = useState(null)

    const [showRangeModal, setShowRangeModal] = useState(false)
    const [rangeStart, setRangeStart] = useState('')
    const [rangeEnd, setRangeEnd] = useState('')
    const [rangeTitle, setRangeTitle] = useState('')
    const [rangeNote, setRangeNote] = useState('')
    const [addingRange, setAddingRange] = useState(false)

    const [showDeleteRangeModal, setShowDeleteRangeModal] = useState(false)
    const [deleteRangeStart, setDeleteRangeStart] = useState('')
    const [deleteRangeEnd, setDeleteRangeEnd] = useState('')
    const [removingRange, setRemovingRange] = useState(false)

    useLiveRefresh(['office_events', 'office_open_days', 'claim_schedules'], (options) => loadAll(options))

    useEffect(() => {
        loadAll()
    }, [])

    const loadAll = async ({ silent = false } = {}) => {
        try {
            if (!silent) setLoading(true)
            setError('')

            // Fetch all open days/events, not just today-and-future, so the
            // registrar head can also mark past weekends open or add past
            // events/notes (e.g. backfilling something that was missed),
            // and so those past entries render correctly on the calendar
            // grid and are recognized as "already set" when toggling.
            const [openDaysRes, eventsRes, claimSchedulesRes] = await Promise.all([
                supabase
                    .from('office_open_days')
                    .select('*')
                    .order('open_date', { ascending: true }),
                supabase
                    .from('office_events')
                    .select('event_id, event_date, title, note')
                    .order('event_date', { ascending: true }),
                supabase
                    .from('claim_schedules')
                    .select('claim_schedule_id, request_id, student_id, status, scheduled_date, scheduled_time, claim_date, claim_time, document_requests(request_number)')
                    .neq('status', 'cancelled'),
            ])

            if (openDaysRes.error) throw new Error(openDaysRes.error.message)
            if (eventsRes.error) throw new Error(eventsRes.error.message)
            if (claimSchedulesRes.error) throw new Error(claimSchedulesRes.error.message)

            setOpenDays(openDaysRes.data || [])
            setEvents(eventsRes.data || [])
            setClaimSchedules(claimSchedulesRes.data || [])
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
    // otherwise the original scheduled_date -- same fallback used on the
    // request details page.
    const claimSchedulesByDate = useMemo(() => {
        const map = {}
        for (const cs of claimSchedules) {
            const date = claimDate(cs)
            if (!date) continue
            if (!map[date]) map[date] = []
            map[date].push(cs)
        }
        for (const list of Object.values(map)) {
            list.sort((a, b) => (claimTime(a) || '').localeCompare(claimTime(b) || ''))
        }
        return map
    }, [claimSchedules])

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

    const toggleOpenDay = async (hours) => {
        if (blockedForReadOnlyViewer(role)) return
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
                const { error: insertError, hoursSaved } = await writeWithHours(
                    (row) => supabase.from('office_open_days').insert(row),
                    { open_date: dayModalDate, created_by: user.id },
                    hours,
                    { hoursInNote: true }
                )

                if (insertError) throw new Error(insertError.message)

                await logActivity({
                    userId: user.id,
                    action: 'add_office_open_day',
                    tableName: 'office_open_days',
                    recordId: null,
                    description: `Marked ${formatDate(dayModalDate)} as an office open day${hoursSaved ? ` (${formatHours(hours.open, hours.close)})` : ''}.`,
                })

                notifySuccess('Marked as open for claiming.')
            }

            await loadAll()

        } catch (err) {
            console.error('TOGGLE OPEN DAY ERROR:', err)
            notifyError(friendlyError(err, 'Failed to update open status.'))
        } finally {
            setTogglingOpen(false)
        }
    }

    // Change the hours of a day already marked open. Returns true on success.
    const saveOpenDayHours = async (hours) => {
        if (blockedForReadOnlyViewer(role)) return
        const existing = openDaysByDate[dayModalDate]
        if (!existing) return false

        try {
            setTogglingOpen(true)
            const { data: { user } } = await supabase.auth.getUser()

            const update = (values) => supabase.from('office_open_days').update(values).eq('open_day_id', existing.open_day_id)
            let { error: updateError } = await update({ open_time: hours.open, close_time: hours.close })

            // Before the office-hours migration: keep the hours in the note.
            if (updateError && isMissingHoursColumn(updateError)) {
                ({ error: updateError } = await update({ note: noteWithHours(existing.note, hours) }))
            }

            if (updateError) throw new Error(updateError.message)

            await logActivity({
                userId: user?.id,
                action: 'update_office_open_day',
                tableName: 'office_open_days',
                recordId: null,
                description: `Set office hours on ${formatDate(dayModalDate)} to ${formatHours(hours.open, hours.close)}.`,
            })

            notifySuccess('Office hours saved.')
            await loadAll()
            return true
        } catch (err) {
            console.error('SAVE OPEN DAY HOURS ERROR:', err)
            notifyError(friendlyError(err, 'Failed to save office hours.'))
            return false
        } finally {
            setTogglingOpen(false)
        }
    }

    const removeOpenDayFromSidebar = async (day) => {
        if (blockedForReadOnlyViewer(role)) return
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
            notifyError(friendlyError(err, 'Failed to remove open day.'))
        } finally {
            setRemovingOpenDayId(null)
        }
    }

    const addEvent = async () => {
        if (blockedForReadOnlyViewer(role)) return
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
            notifyError(friendlyError(err, 'Failed to add event.'))
        } finally {
            setSaving(false)
        }
    }

    const removeEvent = async (event) => {
        if (blockedForReadOnlyViewer(role)) return
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
            notifyError(friendlyError(err, 'Failed to remove event.'))
        } finally {
            setRemovingEventId(null)
        }
    }

    const removeEventGroup = async (groupEvents, groupKey) => {
        if (blockedForReadOnlyViewer(role)) return

        const first = groupEvents[0]
        const last = groupEvents[groupEvents.length - 1]
        const confirmed = await confirmModal(
            `Remove "${first.title}" from all ${groupEvents.length} days (${formatDate(first.event_date)} to ${formatDate(last.event_date)})?`,
            { title: 'Remove event?', confirmButtonText: 'Remove', icon: 'warning' }
        )
        if (!confirmed) return

        try {
            setRemovingGroupKey(groupKey)

            const { data: { user } } = await supabase.auth.getUser()

            const ids = groupEvents.map((ev) => ev.event_id)
            const { error: deleteError } = await supabase
                .from('office_events')
                .delete()
                .in('event_id', ids)

            if (deleteError) throw new Error(deleteError.message)

            await logActivity({
                userId: user?.id,
                action: 'remove_office_event',
                tableName: 'office_events',
                recordId: null,
                description: `Removed office event "${first.title}" from ${ids.length} day(s), ${formatDate(first.event_date)} to ${formatDate(last.event_date)}.`,
            })

            notifySuccess(`Removed from ${ids.length} day${ids.length === 1 ? '' : 's'}.`)
            await loadAll()

        } catch (err) {
            console.error('REMOVE EVENT GROUP ERROR:', err)
            notifyError(friendlyError(err, 'Failed to remove this event.'))
        } finally {
            setRemovingGroupKey(null)
        }
    }

    const openRangeModal = () => {
        setRangeStart(getToday())
        setRangeEnd(getToday())
        setRangeTitle('')
        setRangeNote('')
        setShowRangeModal(true)
    }

    const addRangeEvent = async () => {
        if (blockedForReadOnlyViewer(role)) return
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
            notifyError(friendlyError(err, 'Failed to add event to the selected range.'))
        } finally {
            setAddingRange(false)
        }
    }

    const closeDayModal = () => {
        if (saving || togglingOpen) return
        setShowDayModal(false)
    }

    const closeRangeModal = () => {
        if (addingRange) return
        setShowRangeModal(false)
    }

    const openDeleteRangeModal = () => {
        if (blockedForReadOnlyViewer(role)) return
        setDeleteRangeStart(getToday())
        setDeleteRangeEnd(getToday())
        setShowDeleteRangeModal(true)
    }

    const closeDeleteRangeModal = () => {
        if (removingRange) return
        setShowDeleteRangeModal(false)
    }

    const deleteRangeMatches = useMemo(() => {
        if (!deleteRangeStart || !deleteRangeEnd || deleteRangeStart > deleteRangeEnd) return []
        return events.filter((ev) => ev.event_date >= deleteRangeStart && ev.event_date <= deleteRangeEnd)
    }, [events, deleteRangeStart, deleteRangeEnd])

    const removeRangeEvents = async () => {
        if (blockedForReadOnlyViewer(role)) return
        if (deleteRangeMatches.length === 0) return

        const confirmed = await confirmModal(
            `Delete ${deleteRangeMatches.length} event${deleteRangeMatches.length === 1 ? '' : 's'} from ${formatDate(deleteRangeStart)} to ${formatDate(deleteRangeEnd)}? This cannot be undone.`,
            { title: 'Delete events in range?', confirmButtonText: 'Delete', icon: 'warning' }
        )
        if (!confirmed) return

        try {
            setRemovingRange(true)

            const { data: { user } } = await supabase.auth.getUser()

            const ids = deleteRangeMatches.map((ev) => ev.event_id)
            const { error: deleteError } = await supabase
                .from('office_events')
                .delete()
                .in('event_id', ids)

            if (deleteError) throw new Error(deleteError.message)

            await logActivity({
                userId: user?.id,
                action: 'remove_office_event',
                tableName: 'office_events',
                recordId: null,
                description: `Removed ${ids.length} office event(s) from ${formatDate(deleteRangeStart)} to ${formatDate(deleteRangeEnd)}.`,
            })

            notifySuccess(`Deleted ${ids.length} event${ids.length === 1 ? '' : 's'}.`)
            setShowDeleteRangeModal(false)
            await loadAll()

        } catch (err) {
            console.error('REMOVE RANGE EVENTS ERROR:', err)
            notifyError(friendlyError(err, 'Failed to delete events in the selected range.'))
        } finally {
            setRemovingRange(false)
        }
    }

    return (
        <div>
            <div className="admin-page-header-row">
                <div>
                    <h1 style={{ fontSize: 26, marginBottom: 6 }}>Office Calendar</h1>
                    <p>
                        Tap a day to add an event or note. Mondays, Saturdays and Sundays are closed unless you
                        open them — claims can then be scheduled there, and missed ones move to the next open day.
                    </p>
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button className="admin-secondary-button ocal-pill" onClick={openRangeModal}>+ Add for a Range</button>
                    <button className="admin-secondary-button ocal-pill" onClick={openDeleteRangeModal}>- Delete a Range</button>
                    <button className="admin-primary-button ocal-pill" onClick={() => openDayModal(getToday())}>+ Manage a Day</button>
                </div>
            </div>

            <CalendarBoard
                loading={loading}
                error={error}
                viewDate={viewDate}
                onMonthChange={goToMonth}
                onToday={goToToday}
                openDaysByDate={openDaysByDate}
                eventsByDate={eventsByDate}
                claimSchedulesByDate={claimSchedulesByDate}
                upcomingEvents={upcomingEvents}
                upcomingOpenDays={upcomingOpenDays}
                onDayClick={openDayModal}
                onRemoveEvent={removeEvent}
                onRemoveEventGroup={removeEventGroup}
                onRemoveOpenDay={removeOpenDayFromSidebar}
                removingEventId={removingEventId}
                removingOpenDayId={removingOpenDayId}
                removingGroupKey={removingGroupKey}
            />

            {showDayModal && (
                <DayModal
                    portal="admin"
                    date={dayModalDate}
                    events={eventsByDate[dayModalDate] || []}
                    claims={claimSchedulesByDate[dayModalDate] || []}
                    openEntry={isWeekendDate(dayModalDate) ? openDaysByDate[dayModalDate] : null}
                    onClose={closeDayModal}
                    onToggleOpen={toggleOpenDay}
                    onSaveHours={saveOpenDayHours}
                    togglingOpen={togglingOpen}
                    onRemoveEvent={removeEvent}
                    removingEventId={removingEventId}
                    onOpenRequest={(cs) => navigate(adminPath(`/requests/${cs.request_id}`))}
                    eventTitle={newEventTitle}
                    onEventTitleChange={setNewEventTitle}
                    eventNote={newEventNote}
                    onEventNoteChange={setNewEventNote}
                    onAddEvent={addEvent}
                    saving={saving}
                />
            )}

            {showRangeModal && (
                <RangeModal
                    portal="admin"
                    start={rangeStart}
                    end={rangeEnd}
                    onStartChange={setRangeStart}
                    onEndChange={setRangeEnd}
                    title={rangeTitle}
                    onTitleChange={setRangeTitle}
                    note={rangeNote}
                    onNoteChange={setRangeNote}
                    onSubmit={addRangeEvent}
                    onClose={closeRangeModal}
                    adding={addingRange}
                />
            )}

            {showDeleteRangeModal && (
                <DeleteRangeModal
                    portal="admin"
                    start={deleteRangeStart}
                    end={deleteRangeEnd}
                    onStartChange={setDeleteRangeStart}
                    onEndChange={setDeleteRangeEnd}
                    matchingEvents={deleteRangeMatches}
                    onSubmit={removeRangeEvents}
                    onClose={closeDeleteRangeModal}
                    removing={removingRange}
                />
            )}
        </div>
    )
}

export default OfficeCalendar
