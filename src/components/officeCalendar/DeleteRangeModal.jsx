import Modal from '../Modal'
import { IconCalendar } from '../UiIcons'
import { formatDate, formatDateShort } from '../../lib/officeCalendar'
import './OfficeCalendar.css'

// Counterpart to RangeModal (which adds the same event to every day in a
// range): removes every office event already in that range in one action,
// so a whole holiday/closure range can be cleared without deleting each day
// one at a time.
function DeleteRangeModal({
    portal,
    start,
    end,
    onStartChange,
    onEndChange,
    matchingEvents,
    onSubmit,
    onClose,
    removing,
}) {
    const invalidRange = Boolean(start && end && start > end)

    const handleStartChange = (value) => {
        onStartChange(value)
        if (value && end && value > end) onEndChange(value)
    }

    const submit = (e) => {
        e.preventDefault()
        onSubmit()
    }

    return (
        <Modal title="Delete events in a range of days" subtitle="Removes every event already on the calendar in that range." icon={IconCalendar} maxWidth={520} onClose={onClose}>
            <form className="ocal-day" onSubmit={submit}>
                <p className="ocal-day-empty" style={{ marginTop: 0 }}>
                    Pick a start and end date. Every event currently on the calendar within that range will be removed — open/closed-day settings are not affected.
                </p>

                <div className="ocal-range-dates">
                    <div className="form-group">
                        <label className="form-label" htmlFor="delete-range-start">Start date</label>
                        <input
                            id="delete-range-start"
                            type="date"
                            className="form-input"
                            value={start}
                            onChange={(e) => handleStartChange(e.target.value)}
                            disabled={removing}
                        />
                    </div>

                    <span className="ocal-range-arrow" aria-hidden="true">→</span>

                    <div className="form-group">
                        <label className="form-label" htmlFor="delete-range-end">End date</label>
                        <input
                            id="delete-range-end"
                            type="date"
                            className="form-input"
                            value={end}
                            min={start || undefined}
                            onChange={(e) => onEndChange(e.target.value)}
                            disabled={removing}
                            aria-invalid={invalidRange || undefined}
                        />
                    </div>
                </div>

                {invalidRange ? (
                    <p className="ocal-range-summary is-error" role="alert">The start date must be on or before the end date.</p>
                ) : start && end && (
                    matchingEvents.length > 0 ? (
                        <>
                            <p className="ocal-range-summary">
                                <strong>{matchingEvents.length} event{matchingEvents.length === 1 ? '' : 's'}</strong> will be deleted, {formatDateShort(start)} to {formatDateShort(end)}:
                            </p>
                            <ul className="ocal-day-empty" style={{ marginTop: 0, paddingLeft: 18 }}>
                                {matchingEvents.slice(0, 8).map((ev) => (
                                    <li key={ev.event_id}>{formatDate(ev.event_date)} — {ev.title}</li>
                                ))}
                                {matchingEvents.length > 8 && <li>…and {matchingEvents.length - 8} more</li>}
                            </ul>
                        </>
                    ) : (
                        <p className="ocal-range-summary">No events found in that range.</p>
                    )
                )}

                <div className="ocal-form-footer">
                    <button type="button" className={`${portal}-secondary-button`} onClick={onClose} disabled={removing}>
                        Cancel
                    </button>
                    <button type="submit" className={`${portal}-primary-button`} disabled={removing || invalidRange || matchingEvents.length === 0}>
                        {removing ? 'Deleting...' : `Delete ${matchingEvents.length} event${matchingEvents.length === 1 ? '' : 's'}`}
                    </button>
                </div>
            </form>
        </Modal>
    )
}

export default DeleteRangeModal
