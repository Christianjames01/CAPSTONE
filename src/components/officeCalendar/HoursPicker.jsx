import { HOURS_PRESETS } from '../../lib/officeHours'
import './OfficeCalendar.css'

// Office hours for an open day: quick picks (8–5, 8–6, …) plus exact
// opening and closing times. `value` is { open: 'HH:MM', close: 'HH:MM' }.
function HoursPicker({ value, onChange, disabled, label = 'Office hours' }) {
    const invalid = value.open && value.close && value.open >= value.close

    return (
        <div className="hours-picker">
            <span className="hours-picker-label">{label}</span>
            <div className="hours-presets">
                {HOURS_PRESETS.map((p) => {
                    const active = value.open === p.open && value.close === p.close
                    return (
                        <button
                            key={p.label}
                            type="button"
                            className={`hours-chip${active ? ' is-active' : ''}`}
                            onClick={() => onChange({ open: p.open, close: p.close })}
                            disabled={disabled}
                            aria-pressed={active}
                        >
                            {p.label}
                        </button>
                    )
                })}
            </div>
            <div className="hours-times">
                <label>
                    <span>Opens</span>
                    <input type="time" value={value.open} onChange={(e) => onChange({ ...value, open: e.target.value })} disabled={disabled} />
                </label>
                <span className="hours-dash" aria-hidden="true">–</span>
                <label>
                    <span>Closes</span>
                    <input type="time" value={value.close} onChange={(e) => onChange({ ...value, close: e.target.value })} disabled={disabled} />
                </label>
            </div>
            {invalid && <small className="hours-error">Closing time must be after opening time.</small>}
        </div>
    )
}

export default HoursPicker
