import Modal from '../Modal'
import { EVENT_PRESETS, eachDateInRange, formatDateShort, isWeekendDate } from '../../lib/officeCalendar'
import './OfficeCalendar.css'

// Apply one event/note to every day in a date range (e.g. a whole
// enrollment week) in a single action.
function RangeModal({
    portal,
    start,
    end,
    onStartChange,
    onEndChange,
    title,
    onTitleChange,
    note,
    onNoteChange,
    onSubmit,
    onClose,
    adding,
}) {
    const invalidRange = Boolean(start && end && start > end)
    const dates = start && end && !invalidRange ? eachDateInRange(start, end) : []
    const weekendCount = dates.filter(isWeekendDate).length

    const handleStartChange = (value) => {
        onStartChange(value)
        // Keep the range valid when the start jumps past the current end.
        if (value && end && value > end) onEndChange(value)
    }

    const submit = (e) => {
        e.preventDefault()
        onSubmit()
    }

    return (
        <Modal title="Add an event to a range of days" maxWidth={520} onClose={onClose}>
            <form className="ocal-day" onSubmit={submit}>
                <p className="ocal-day-empty" style={{ marginTop: 0 }}>
                    Applies the same event to every day in the range, weekends included, so you don't have to add it one day at a time.
                </p>

                <div className="ocal-range-dates">
                    <div className="form-group">
                        <label className="form-label" htmlFor="range-start">Start date</label>
                        <input
                            id="range-start"
                            type="date"
                            className="form-input"
                            value={start}
                            onChange={(e) => handleStartChange(e.target.value)}
                            disabled={adding}
                        />
                    </div>

                    <span className="ocal-range-arrow" aria-hidden="true">→</span>

                    <div className="form-group">
                        <label className="form-label" htmlFor="range-end">End date</label>
                        <input
                            id="range-end"
                            type="date"
                            className="form-input"
                            value={end}
                            min={start || undefined}
                            onChange={(e) => onEndChange(e.target.value)}
                            disabled={adding}
                            aria-invalid={invalidRange || undefined}
                        />
                    </div>
                </div>

                {invalidRange ? (
                    <p className="ocal-range-summary is-error" role="alert">The start date must be on or before the end date.</p>
                ) : dates.length > 0 && (
                    <p className="ocal-range-summary">
                        <strong>{dates.length} {dates.length === 1 ? 'day' : 'days'}</strong>
                        {dates.length > 1 && <> · {formatDateShort(start)} to {formatDateShort(end)}</>}
                        {weekendCount > 0 && <> · includes {weekendCount} weekend {weekendCount === 1 ? 'day' : 'days'}</>}
                    </p>
                )}

                <div className="ocal-presets" aria-label="Quick fill">
                    {EVENT_PRESETS.map((preset) => (
                        <button
                            type="button"
                            key={preset}
                            className={`ocal-preset${title === preset ? ' is-selected' : ''}`}
                            onClick={() => onTitleChange(preset)}
                            disabled={adding}
                        >
                            {preset}
                        </button>
                    ))}
                </div>

                <div className="form-group">
                    <label className="form-label" htmlFor="range-title">Event title</label>
                    <input
                        id="range-title"
                        type="text"
                        className="form-input"
                        value={title}
                        onChange={(e) => onTitleChange(e.target.value)}
                        placeholder="e.g. Mental Health Break"
                        disabled={adding}
                    />
                </div>

                <div className="form-group">
                    <label className="form-label" htmlFor="range-note">Note <span className="ocal-optional">Optional</span></label>
                    <textarea
                        id="range-note"
                        className="form-input"
                        rows={2}
                        value={note}
                        onChange={(e) => onNoteChange(e.target.value)}
                        placeholder="Any additional details"
                        disabled={adding}
                    />
                </div>

                <div className="ocal-form-footer">
                    <button type="button" className={`${portal}-secondary-button`} onClick={onClose} disabled={adding}>
                        Cancel
                    </button>
                    <button type="submit" className={`${portal}-primary-button`} disabled={adding || dates.length === 0 || !title.trim()}>
                        {adding ? 'Adding...' : `Add to ${dates.length} ${dates.length === 1 ? 'day' : 'days'}`}
                    </button>
                </div>
            </form>
        </Modal>
    )
}

export default RangeModal
