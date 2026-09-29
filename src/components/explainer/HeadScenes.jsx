import { Icon } from './icons'
import { Window } from './parts'

// Registrar Head story: overview, assignment, publishing, office days,
// oversight.

const TILES = [
    { label: 'Requests', value: '128', tone: 'blue' },
    { label: 'Pending', value: '12', tone: 'amber' },
    { label: 'Processing', value: '23', tone: 'blue' },
    { label: 'Completed', value: '93', tone: 'green' },
]

const BARS = [38, 52, 44, 70, 62, 84, 76]

export function SceneHeadDash() {
    return (
        <div className="lpx-scene lpx-col">
            <div className="lpx-tiles">
                {TILES.map((t, i) => (
                    <div key={t.label} className={`lpx-tile is-${t.tone}`} style={{ '--i': i }}>
                        <small>{t.label}</small>
                        <strong>{t.value}</strong>
                    </div>
                ))}
            </div>
            <Window title="Requests this week" className="lpx-pop lpx-wide" >
                <div className="lpx-bars">
                    {BARS.map((h, i) => (
                        <span key={i} style={{ '--h': `${h}%`, '--i': i }}><b /></span>
                    ))}
                </div>
                <div className="lpx-bars-days"><i>Mon</i><i>Tue</i><i>Wed</i><i>Thu</i><i>Fri</i><i>Sat</i><i>Sun</i></div>
            </Window>
        </div>
    )
}

export function SceneHeadAssign() {
    return (
        <div className="lpx-scene lpx-assign">
            <div className="lpx-inbox">
                <small>Unassigned</small>
                {['REQ-000131', 'REQ-000132', 'REQ-000133'].map((r, i) => (
                    <span key={r} className="lpx-req-chip" style={{ '--i': i }}>{Icon.doc}{r}</span>
                ))}
                <span className="lpx-inbox-done">{Icon.check} All assigned</span>
            </div>
            <svg className="lpx-assign-lines" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true">
                <path d="M0 30 C 40 30, 50 12, 100 12" />
                <path d="M0 30 C 40 30, 50 48, 100 48" />
            </svg>
            <div className="lpx-staff-col">
                <div className="lpx-staff">
                    <span className="lpx-avatar is-blue">SR</span>
                    <div><strong>Sar</strong><small>CCIS · 2 programs</small></div>
                    <b className="lpx-count" style={{ '--delay': '2.6s' }}>+2</b>
                </div>
                <div className="lpx-staff">
                    <span className="lpx-avatar is-red">YL</span>
                    <div><strong>Yul</strong><small>CBA · 3 programs</small></div>
                    <b className="lpx-count" style={{ '--delay': '3.2s' }}>+1</b>
                </div>
            </div>
        </div>
    )
}

export function SceneHeadPublish() {
    return (
        <div className="lpx-scene lpx-publish">
            <Window title="New announcement" className="lpx-pop">
                <div className="lpx-field"><small>Title</small><span className="lpx-type" style={{ '--chars': 21, '--delay': '0.5s' }}>Office open on Monday</span></div>
                <div className="lpx-field">
                    <small>Office hours</small>
                    <div className="lpx-sched-row">
                        <span className="lpx-chip-date is-pick" style={{ '--delay': '1.9s' }}>{Icon.clock} 8 AM – 5 PM</span>
                    </div>
                </div>
                <div className="lpx-btn is-red lpx-press" style={{ '--delay': '2.8s' }}>Publish</div>
            </Window>
            <div className="lpx-phone" style={{ '--delay': '3.2s' }}>
                <small>Student dashboard</small>
                <div className="lpx-phone-card">
                    <span>{Icon.megaphone}</span>
                    <div><strong>Office open on Monday</strong><em>8:00 AM – 5:00 PM</em></div>
                </div>
                <i /><i />
            </div>
        </div>
    )
}

export function SceneHeadCalendar() {
    const days = Array.from({ length: 14 }, (_, i) => i + 4)
    return (
        <div className="lpx-scene">
            <Window title="Office calendar · October" className="lpx-pop lpx-wide">
                <div className="lpx-cal">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
                        <em key={d} className={[0, 1, 6].includes(i) ? 'is-closed' : ''}>{d}</em>
                    ))}
                    {days.map((d, i) => {
                        const dow = i % 7
                        const closed = [0, 1, 6].includes(dow)
                        const opening = d === 12
                        return (
                            <span key={d} className={`${closed ? 'is-closed' : ''}${opening ? ' is-opening' : ''}`}>
                                <b>{d}</b>
                                {opening && <i>Open 8–5</i>}
                                {d === 7 && <i className="is-event">Enrollment</i>}
                            </span>
                        )
                    })}
                </div>
            </Window>
            <div className="lpx-side-stack">
                <div className="lpx-note" style={{ '--delay': '2.6s' }}>
                    <span>{Icon.cal}</span>
                    <div><strong>Monday opened</strong><small>Claims can be scheduled on Oct 12</small></div>
                </div>
            </div>
        </div>
    )
}

export function SceneHeadOversee() {
    const log = [
        ['SR', 'Sar verified payment for REQ-000124', '9:05 AM'],
        ['YL', 'Yul set a claim schedule for REQ-000119', '10:30 AM'],
        ['SR', 'Sar released REQ-000108 · credential issued', '11:05 AM'],
        ['RH', 'You opened Monday, Oct 12 (8 AM – 5 PM)', '1:40 PM'],
    ]
    return (
        <div className="lpx-scene">
            <Window title="Activity log" className="lpx-pop lpx-wide">
                <ul className="lpx-rows is-log">
                    {log.map(([who, text, time], i) => (
                        <li key={text} className="lpx-row" style={{ '--i': i }}>
                            <span className={`lpx-avatar${who === 'RH' ? ' is-red' : ''}`}>{who}</span>
                            <div><strong>{text}</strong><small>Today · {time}</small></div>
                        </li>
                    ))}
                </ul>
            </Window>
            <div className="lpx-side-stack">
                <div className="lpx-note" style={{ '--delay': '3.2s' }}>
                    <span>{Icon.shield}</span>
                    <div><strong>Every change recorded</strong><small>Who did what, and when</small></div>
                </div>
                <div className="lpx-note" style={{ '--delay': '3.8s' }}>
                    <span>{Icon.chart}</span>
                    <div><strong>Reports</strong><small>Export requests and revenue</small></div>
                </div>
            </div>
        </div>
    )
}
