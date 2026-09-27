import './TourPreview.css'
import { IconBox, IconCash, IconCheck, IconFile, IconSearch, IconUpload } from './UiIcons'

// Small illustrated mock-ups of CertiChain screens, shown in the middle of
// each demo-tour step (components/ProductTour.jsx). Purely visual; the data
// is sample data.

const Check = () => <span className="tp-check" aria-hidden="true"><IconCheck /></span>

const Row = ({ title, sub, pill, tone = 'blue' }) => (
    <div className="tp-row">
        <div className="tp-row-main">
            <strong>{title}</strong>
            <span>{sub}</span>
        </div>
        {pill && <span className={`tp-pill is-${tone}`}>{pill}</span>}
    </div>
)

const PREVIEWS = {
    welcome: () => (
        <div className="tp-flow">
            {[[IconFile, 'Request'], [IconCash, 'Pay at Finance'], [IconUpload, 'Upload receipt'], [IconBox, 'Claim']].map(([Icon, label], i) => (
                <div className="tp-flow-step" key={label} style={{ animationDelay: `${i * 0.15}s` }}>
                    <span className="tp-flow-icon"><Icon /></span>
                    <span>{label}</span>
                </div>
            ))}
        </div>
    ),

    dashboard: () => (
        <div className="tp-stack">
            <div className="tp-tiles">
                <div className="tp-tile"><strong>1</strong><span>Active request</span></div>
                <div className="tp-tile"><strong>0</strong><span>To claim</span></div>
                <div className="tp-tile is-accent"><strong>1</strong><span>Next step</span></div>
            </div>
            <div className="tp-announce is-open">
                <span className="tp-pill is-green">Office open · Sat, Oct 4</span>
                <strong>Open for claiming, 8:00 AM – 5:00 PM</strong>
                <span>Office days: Tuesday to Friday</span>
            </div>
            <Row title="Transcript of Records" sub="REQ-000012 · Next: upload your receipt" pill="Payment pending" tone="amber" />
        </div>
    ),

    request: () => (
        <div className="tp-form">
            <label><span>Document</span><div className="tp-input">Transcript of Records <em>▾</em></div></label>
            <div className="tp-form-grid">
                <label><span>Copies</span><div className="tp-input">1</div></label>
                <label><span>Fee</span><div className="tp-input is-muted">₱60.00</div></label>
            </div>
            <label><span>Purpose</span><div className="tp-input tp-typing">Scholarship application</div></label>
            <div className="tp-button tp-pulse">Submit request</div>
        </div>
    ),

    payment: () => (
        <div className="tp-pay">
            <div className="tp-receipt">
                <span className="tp-receipt-head">HCDC Finance Office</span>
                <strong>Official Receipt</strong>
                <div className="tp-receipt-line"><span>Transcript of Records</span><span>₱60.00</span></div>
                <div className="tp-receipt-line is-total"><span>Paid</span><span>₱60.00</span></div>
            </div>
            <div className="tp-upload">
                <span className="tp-or">OR No. 0045821</span>
                <span className="tp-cover"><Check /> + REQ-000013</span>
                <span className="tp-upload-icon"><IconUpload /></span>
                <span>receipt-photo.jpg</span>
                <div className="tp-bar"><span className="tp-bar-fill" /></div>
                <span className="tp-upload-done"><Check /> Uploaded — waiting for verification</span>
            </div>
        </div>
    ),

    track: () => (
        <ol className="tp-stepper">
            {[['Submitted', 'done'], ['Payment verified', 'done'], ['Processing', 'active'], ['Ready for claiming', ''], ['Claimed', '']].map(([label, state]) => (
                <li key={label} className={state ? `is-${state}` : ''}>
                    <span className="tp-dot">{state === 'done' && <IconCheck />}</span>
                    <span>{label}</span>
                    {state === 'active' && <span className="tp-pill is-blue">Now</span>}
                </li>
            ))}
        </ol>
    ),

    claim: () => (
        <div className="tp-claim">
            <div className="tp-ticket">
                <span className="tp-ticket-month">SEP</span>
                <strong>30</strong>
                <span>Tuesday</span>
            </div>
            <div className="tp-claim-info">
                <strong>1:00 PM · Window 3</strong>
                <span>ORRM Counter 3</span>
                <ul>
                    <li><Check /> Valid ID</li>
                    <li><Check /> Original official receipt</li>
                    <li><Check /> Or an approved representative</li>
                </ul>
            </div>
        </div>
    ),

    messages: () => (
        <div className="tp-chat">
            <div className="tp-bubble is-self">Status inquiry: REQ-000012 (Transcript of Records). May I know the status?</div>
            <div className="tp-bubble">
                <span className="tp-quote">sar replied to you</span>
                Automatic status update: Processing. Your request is being processed by the Registrar.
            </div>
            <div className="tp-bubble tp-typing-dots is-other"><span /><span /><span /></div>
            <span className="tp-chip">Ask about a request ▾</span>
        </div>
    ),

    notifications: () => (
        <div className="tp-stack">
            <Row title="Receipt verified" sub="REQ-000012 · just now" pill="New" tone="red" />
            <Row title="Ready for claiming" sub="Sep 29 at 1:00 PM · Window 3" />
            <Row title="New message from sar" sub="Yes — it’s scheduled for…" />
        </div>
    ),

    guide: () => (
        <div className="tp-stack">
            <div className="tp-input"><IconSearch className="is-leading" />Search the guide…</div>
            {['Requesting a document', 'Paying and uploading your receipt', 'Claiming your document'].map((t, i) => (
                <div className="tp-guide-row" key={t}><span>{i + 1}</span>{t}</div>
            ))}
        </div>
    ),

    done: () => (
        <div className="tp-done">
            <span className="tp-done-check"><IconCheck /></span>
            <span className="tp-confetti" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <i key={i} />)}</span>
        </div>
    ),

    // ---- staff ----
    assigned: () => (
        <div className="tp-stack">
            <Row title="Juan Dela Cruz · Transcript of Records" sub="REQ-000012 · Requested Sep 25, 3:42 PM" pill="Receipt uploaded" />
            <Row title="Maria Santos · Certificate of Enrollment" sub="REQ-000013 · Requested Sep 25, 4:10 PM" pill="Processing" />
            <Row title="Ana Reyes · Diploma (CTC)" sub="REQ-000014 · Requested Sep 26, 9:05 AM" pill="Pending" tone="amber" />
        </div>
    ),

    verify: () => (
        <div className="tp-pay">
            <div className="tp-receipt">
                <span className="tp-receipt-head">Uploaded receipt</span>
                <strong>OR No. 0045821</strong>
                <div className="tp-receipt-line is-total"><span>Amount</span><span>₱60.00</span></div>
            </div>
            <div className="tp-verify-actions">
                <span className="tp-note is-group">Covers REQ-000012 &amp; REQ-000013 — check it shows ₱120.00</span>
                <span className="tp-note is-warn">Same photo used on REQ-000009</span>
                <div className="tp-button is-green tp-pulse"><IconCheck className="is-leading" />Verify both</div>
                <div className="tp-button is-ghost">Mark invalid…</div>
            </div>
        </div>
    ),

    process: () => (
        <div className="tp-credential">
            <div className="tp-qr" aria-hidden="true">{Array.from({ length: 25 }, (_, i) => <i key={i} className={(i * 7) % 3 === 0 ? 'on' : ''} />)}</div>
            <div className="tp-claim-info">
                <strong>CERT-000123</strong>
                <span>Transcript of Records · Juan Dela Cruz</span>
                <span className="tp-pill is-green"><IconCheck className="is-leading" />Signed</span>
            </div>
        </div>
    ),

    staffClaim: () => (
        <div className="tp-stack">
            <Row title="Juan Dela Cruz · Transcript of Records" sub="Today 1:00 PM · Window 3" pill="Scheduled" />
            <div className="tp-rep">Representative: Maria Dela Cruz (Parent) · Approved</div>
            <div className="tp-button is-green">Mark as claimed</div>
        </div>
    ),

    headDashboard: () => (
        <div className="tp-tiles">
            <div className="tp-tile"><strong>128</strong><span>Requests</span></div>
            <div className="tp-tile"><strong>14</strong><span>In progress</span></div>
            <div className="tp-tile is-accent"><strong>3</strong><span>Unassigned</span></div>
        </div>
    ),

    assign: () => (
        <div className="tp-stack">
            {[['Yul', 90, true], ['sar', 45, false], ['Maria', 35, false]].map(([name, pct, heavy]) => (
                <div className="tp-load" key={name}>
                    <span className="tp-avatar">{name[0]}</span>
                    <div>
                        <span>{name}{heavy && <em> · Overloaded</em>}</span>
                        <div className="tp-bar"><span style={{ width: `${pct}%` }} className={heavy ? 'is-heavy' : ''} /></div>
                    </div>
                </div>
            ))}
            <div className="tp-button tp-pulse">Apply suggested rebalance</div>
        </div>
    ),

    employees: () => (
        <div className="tp-stack">
            <Row title="Yul · Registrar Staff" sub="BSIT, BSCS" pill="Active" tone="green" />
            <Row title="New employee · EMP-0042" sub="Registered today" pill="Activate" tone="amber" />
        </div>
    ),

    students: () => (
        <div className="tp-stack">
            <Row title="Juan Dela Cruz · 2021-00123" sub="BS Information Technology" pill="Pending" tone="amber" />
            <div className="tp-inline-actions">
                <div className="tp-button is-green tp-pulse">Approve</div>
                <div className="tp-button is-ghost">Reject</div>
            </div>
        </div>
    ),

    documents: () => (
        <div className="tp-stack">
            <Row title="Transcript of Records" sub="7 working days" pill="₱60.00" />
            <Row title="Certificate of Enrollment" sub="7 working days" pill="₱60.00" />
            <Row title="Print-out of Grades" sub="Within the day" pill="₱10.00" />
        </div>
    ),

    requests: () => (
        <div className="tp-stack">
            <Row title="REQ-000012 · Transcript of Records" sub="Juan Dela Cruz · Yul" pill="Processing" />
            <Row title="REQ-000015 · Diploma (CTC)" sub="Ana Reyes · Unassigned" pill="Pending" tone="amber" />
        </div>
    ),

    schedules: () => (
        <div className="tp-stack">
            <Row title="Today · 1:00 PM" sub="Juan Dela Cruz · Transcript of Records" pill="Scheduled" />
            <Row title="Sep 26 · 10:00 AM" sub="Maria Santos · Reschedule requested" pill="Reschedule" tone="amber" />
        </div>
    ),

    announcements: () => (
        <div className="tp-stack">
            <div className="tp-announce">
                <span className="tp-pill is-red">Announcement</span>
                <strong>Office closed on Oct 1 (holiday)</strong>
                <span>Claiming scheduled that day moves to Oct 2.</span>
            </div>
            <div className="tp-announce is-open">
                <span className="tp-pill is-green">Office open · Sat, Oct 4</span>
                <strong>Enrollment Saturday</strong>
                <span>Office hours: 8:00 AM – 6:00 PM</span>
            </div>
            <div className="tp-button tp-pulse">Publish to students</div>
        </div>
    ),

    programs: () => (
        <div className="tp-stack">
            <Row title="College of Engineering and Technology" sub="BS Information Technology · BS Computer Science" pill="2 programs" />
            <Row title="College of Business Education" sub="BS Accountancy · BS Business Administration" pill="2 programs" />
            <Row title="College of Education" sub="BEEd · BSEd" pill="2 programs" />
        </div>
    ),

    // Sun-Sat; Mondays and weekends closed unless opened (with hours).
    calendar: () => (
        <div className="tp-cal is-week" aria-hidden="true">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={`h${i}`} className="tp-cal-head">{d}</span>)}
            {Array.from({ length: 14 }, (_, i) => {
                const day = 21 + i
                const dow = i % 7
                const label = day > 30 ? day - 30 : day
                const cls = day === 27 ? ' is-open' : day === 30 ? ' is-claim' : dow === 0 || dow === 1 || dow === 6 ? ' is-closed' : ''
                return <span key={day} className={`tp-cal-day${cls}`}>{day === 27 ? '8–5' : label}</span>
            })}
            <span className="tp-cal-legend"><i className="is-claim" /> Claiming <i className="is-open" /> Opened, 8 AM – 5 PM <i className="is-closed" /> Closed</span>
        </div>
    ),

    // Mirrors the Walk-in Queue page and the Queue Display screen.
    queue: () => (
        <div className="tp-queue-layout">
            <div className="tp-queue">
                <span className="tp-queue-label">Now serving</span>
                <strong className="tp-queue-number">Q-024</strong>
                <span className="tp-queue-sub">Please proceed to the counter</span>
                <span className="tp-queue-next">Up next <b>Q-025</b> <b>Q-026</b></span>
            </div>
            <div className="tp-stack">
                <div className="tp-queue-row">
                    <div className="tp-row-main">
                        <strong>Q-025 — Juan Dela Cruz</strong>
                        <span>Student 2021-00123 · REQ-000012</span>
                    </div>
                    <div className="tp-button tp-pulse">Call</div>
                </div>
                <div className="tp-queue-row">
                    <div className="tp-row-main">
                        <strong>Q-026</strong>
                        <span>Walk-in</span>
                    </div>
                    <div className="tp-button">Call</div>
                </div>
            </div>
        </div>
    ),

    receipts: () => (
        <div className="tp-stack">
            <Row title="OR No. 0045821 · ₱60.00" sub="Juan Dela Cruz · REQ-000012" pill="Uploaded" tone="amber" />
            <Row title="OR No. 0045790 · ₱10.00" sub="Maria Santos · REQ-000011" pill="Verified" tone="green" />
            <span className="tp-note is-group">One receipt for REQ-000012 &amp; REQ-000013 · ₱120.00</span>
            <span className="tp-note is-warn">Receipt number also on REQ-000009</span>
        </div>
    ),

    staffMessages: () => (
        <div className="tp-chat">
            <div className="tp-bubble"><em>Juan Dela Cruz</em>Status inquiry: REQ-000012. May I know the status?</div>
            <div className="tp-bubble is-self">
                <span className="tp-quote is-self">You replied to Juan</span>
                Ready for claiming — Tue, Sep 30, 1:00 PM at Window 3.
            </div>
            <span className="tp-chip">Reply with status of REQ-000012</span>
        </div>
    ),

    staffNotifications: () => (
        <div className="tp-stack">
            <Row title="New request assigned to you" sub="REQ-000016 · Certificate of Enrollment" pill="New" tone="red" />
            <Row title="Representative to review" sub="REQ-000012 · Maria Dela Cruz (Parent)" />
            <Row title="New note on REQ-000014" sub="Absence / coverage — covering for Yul" />
        </div>
    ),

    activity: () => (
        <div className="tp-stack">
            <Row title="Yul verified the receipt for REQ-000012" sub="Sep 26, 10:14 AM" />
            <Row title="sar created a claiming schedule for REQ-000011" sub="Sep 29, 1:00 PM · Sep 26, 9:52 AM" />
            <Row title="Registrar Head reassigned REQ-000015" sub="from Yul to sar · Sep 26, 9:30 AM" />
        </div>
    ),

    studentList: () => (
        <div className="tp-stack">
            <Row title="Juan Dela Cruz · 2021-00123" sub="BS Information Technology · 3 requests" pill="Verified" tone="green" />
            <Row title="Maria Santos · 2022-00456" sub="BS Accountancy · 1 request" pill="Verified" tone="green" />
        </div>
    ),

    profile: () => (
        <div className="tp-profile">
            <span className="tp-avatar is-large">JD</span>
            <div className="tp-stack">
                <div className="tp-input">Juan Dela Cruz</div>
                <div className="tp-input is-muted">juan.delacruz@hcdc.edu.ph</div>
                <div className="tp-button is-ghost">Change password</div>
            </div>
        </div>
    ),

    help: () => (
        <div className="tp-stack">
            <div className="tp-guide-row"><span>?</span>How do I pay for my request?</div>
            <div className="tp-guide-row"><span>?</span>How long does processing take?</div>
            <Row title="Registrar’s Office (ORRM)" sub="registrar@hcdc.edu.ph · (082) 221-9071" />
        </div>
    ),

    reports: () => (
        <div className="tp-report">
            <div className="tp-chart" aria-hidden="true">
                {[40, 65, 50, 80, 95, 70].map((h, i) => <span key={i} style={{ height: `${h}%`, animationDelay: `${i * 0.08}s` }} />)}
            </div>
            <div className="tp-verify-actions">
                <div className="tp-button is-ghost">Export PDF</div>
                <div className="tp-button tp-pulse">Export Excel</div>
            </div>
        </div>
    ),
}

function TourPreview({ name }) {
    const Preview = PREVIEWS[name]
    if (!Preview) return null
    return (
        <div className="tp-frame" aria-hidden="true">
            <div className="tp-frame-bar"><i /><i /><i /><span>CertiChain</span></div>
            <div className="tp-frame-body"><Preview /></div>
        </div>
    )
}

export default TourPreview
