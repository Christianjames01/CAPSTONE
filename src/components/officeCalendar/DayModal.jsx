import Modal from '../Modal'
import { EVENT_PRESETS, claimTime, formatDate, formatTime, getToday, isWeekendDate } from '../../lib/officeCalendar'
import './OfficeCalendar.css'

const TrashIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 12.5h9l1-12.5M10 11v5M14 11v5" />
    </svg>
)

// Detail view for one calendar day: weekend open/closed status, claim
// appointments, events/notes, and the add-event form. `portal` ('admin' or
// 'employee') picks the matching button/pill classes for that layout.
function DayModal({
    portal,
    date,
    events,
    claims,
    openEntry,
    onClose,
    onToggleOpen,
    togglingOpen,
    onRemoveEvent,
    removingEventId,
    onOpenRequest,
    eventTitle,
    onEventTitleChange,
    eventNote,
    onEventNoteChange,
    onAddEvent,
    saving,
}) {
    const isWeekend = isWeekendDate(date)
    const isPast = date < getToday()
    const isToday = date === getToday()

    const status = isWeekend
        ? openEntry
            ? { tone: 'open', label: 'Open for claiming' }
            : { tone: 'closed', label: 'Weekend · closed' }
        : { tone: 'workday', label: 'Regular office day' }

    const submitEvent = (e) => {
        e.preventDefault()
        onAddEvent()
    }

    return (
        <Modal title={formatDate(date)} maxWidth={520} onClose={onClose}>
            <div className="ocal-day">
                <div className="ocal-day-badges">
                    <span className={`ocal-badge is-${status.tone}`}>{status.label}</span>
                    {isToday && <span className="ocal-badge is-today">Today</span>}
                    {isPast && <span className="ocal-badge is-past">Past date</span>}
                </div>

                {isWeekend && (
                    <div className={`ocal-status-card${openEntry ? ' is-open' : ''}`}>
                        <div>
                            <strong>{openEntry ? 'Office is open for claiming' : 'Office closed by default'}</strong>
                            <p>
                                {isPast
                                    ? openEntry
                                        ? 'This past date is recorded as an open day.'
                                        : 'Backfill this past date as an open day if claiming actually happened.'
                                    : openEntry
                                        ? 'Missed claims can be auto-rescheduled to this date.'
                                        : 'Missed claims will skip this date unless you mark it open.'}
                            </p>
                        </div>
                        <button
                            type="button"
                            className={openEntry ? `${portal}-secondary-button` : `${portal}-primary-button`}
                            onClick={onToggleOpen}
                            disabled={togglingOpen}
                        >
                            {togglingOpen ? 'Saving...' : openEntry ? 'Remove open status' : 'Mark open'}
                        </button>
                    </div>
                )}

                <section className="ocal-day-section">
                    <h3>
                        Claiming appointments
                        <span className="ocal-count">{claims.length}</span>
                    </h3>

                    {claims.length === 0 ? (
                        <p className="ocal-day-empty">No students scheduled to claim this day.</p>
                    ) : (
                        <ul className="ocal-day-list">
                            {claims.map((cs) => (
                                <li key={cs.claim_schedule_id}>
                                    <button type="button" className="ocal-claim-row" onClick={() => onOpenRequest(cs)}>
                                        <span className="ocal-time-pill">{formatTime(claimTime(cs)) || 'No time'}</span>
                                        <span className="ocal-claim-number">{cs.document_requests?.request_number || 'Request'}</span>
                                        {cs.status && (
                                            <span className={`${portal}-status-pill status-${cs.status}`}>{cs.status.replace(/_/g, ' ')}</span>
                                        )}
                                        <span className="ocal-claim-open" aria-hidden="true">Open →</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <section className="ocal-day-section">
                    <h3>
                        Events &amp; notes
                        <span className="ocal-count">{events.length}</span>
                    </h3>

                    {events.length === 0 ? (
                        <p className="ocal-day-empty">No events added for this day yet.</p>
                    ) : (
                        <ul className="ocal-day-list">
                            {events.map((ev) => (
                                <li key={ev.event_id} className="ocal-event-row">
                                    <span className="ocal-event-bar" aria-hidden="true" />
                                    <div className="ocal-event-text">
                                        <strong>{ev.title}</strong>
                                        {ev.note && <p>{ev.note}</p>}
                                    </div>
                                    <button
                                        type="button"
                                        className="ocal-icon-button is-danger"
                                        onClick={() => onRemoveEvent(ev)}
                                        disabled={removingEventId === ev.event_id}
                                        aria-label={`Remove ${ev.title}`}
                                        title="Remove"
                                    >
                                        <TrashIcon />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <form className="ocal-add-form" onSubmit={submitEvent}>
                    <h3>Add an event or note</h3>
                    {isPast && <p className="ocal-day-empty">This is a past date — you can still add a note for the record.</p>}

                    <div className="ocal-presets" aria-label="Quick fill">
                        {EVENT_PRESETS.map((preset) => (
                            <button
                                type="button"
                                key={preset}
                                className={`ocal-preset${eventTitle === preset ? ' is-selected' : ''}`}
                                onClick={() => onEventTitleChange(preset)}
                                disabled={saving}
                            >
                                {preset}
                            </button>
                        ))}
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="event-title">Title</label>
                        <input
                            id="event-title"
                            type="text"
                            className="form-input"
                            value={eventTitle}
                            onChange={(e) => onEventTitleChange(e.target.value)}
                            placeholder="e.g. Enrollment Week, Office Closed — Holiday"
                            disabled={saving}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="event-note">Note <span className="ocal-optional">Optional</span></label>
                        <textarea
                            id="event-note"
                            className="form-input"
                            rows={2}
                            value={eventNote}
                            onChange={(e) => onEventNoteChange(e.target.value)}
                            placeholder="Any additional details"
                            disabled={saving}
                        />
                    </div>

                    <div className="ocal-form-footer">
                        <button type="submit" className={`${portal}-primary-button`} disabled={saving || !eventTitle.trim()}>
                            {saving ? 'Adding...' : 'Add event'}
                        </button>
                    </div>
                </form>
            </div>
        </Modal>
    )
}

export default DayModal
