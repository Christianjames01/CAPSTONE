import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activityLog'
import { notifyError, notifySuccess, confirmModal } from '../../lib/notify'
import { SkeletonList } from '../../components/Skeleton'
import './AdminPages.css'

function formatDate(dateStr) {
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-PH', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    })
}

function getToday() {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function OfficeCalendar() {
    const [openDays, setOpenDays] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

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

    const addOpenDay = async (e) => {
        e.preventDefault()

        if (!newDate) {
            notifyError('Please select a date.')
            return
        }

        const day = new Date(`${newDate}T00:00:00`).getDay()

        if (day !== 0 && day !== 6) {
            notifyError('Only Saturdays and Sundays need to be marked here — weekdays are already treated as open.')
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
        const confirmed = await confirmModal(`Remove ${formatDate(day.open_date)} as an office open day?`)
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

    return (
        <div>
            <div className="admin-page-header">
                <h1>Office Calendar</h1>
                <p>
                    Missed claiming appointments are automatically rescheduled to the next weekday. Mark a
                    Saturday or Sunday here if the Registrar's Office will actually be open that day (e.g.
                    during enrollment), so it can be offered instead of being skipped.
                </p>
            </div>

            <div className="admin-card" style={{ maxWidth: 560 }}>
                <h2 style={{ fontSize: 15, marginBottom: 14 }}>Add an Open Weekend Day</h2>

                <form onSubmit={addOpenDay}>
                    <div className="form-group">
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
                    </div>

                    <div className="form-group">
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

                    <button type="submit" className="admin-primary-button" disabled={saving}>
                        {saving ? 'Adding...' : 'Add Open Day'}
                    </button>
                </form>
            </div>

            <h2 style={{ fontSize: 15, margin: '24px 0 14px' }}>Upcoming Open Weekend Days</h2>

            {error && <div className="admin-error-box">{error}</div>}

            {loading ? (
                <SkeletonList count={2} />
            ) : openDays.length === 0 ? (
                <div className="admin-empty">No upcoming weekend open days have been added.</div>
            ) : (
                openDays.map((day) => (
                    <div className="admin-list-card" key={day.open_day_id}>
                        <div className="admin-list-card-header">
                            <div>
                                <h3>{formatDate(day.open_date)}</h3>
                                {day.note && <p>{day.note}</p>}
                            </div>
                        </div>

                        <button
                            className="admin-danger-button"
                            onClick={() => removeOpenDay(day)}
                            disabled={removing === day.open_day_id}
                        >
                            {removing === day.open_day_id ? 'Removing...' : 'Remove'}
                        </button>
                    </div>
                ))
            )}
        </div>
    )
}

export default OfficeCalendar
