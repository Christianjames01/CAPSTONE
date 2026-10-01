import certichainLogo from '../../assets/certichain-logo.png'
import { Icon } from './icons'
import { CtaButton, QrMark, Window } from './parts'

// Employee story: an assigned request from receipt to release.

const ROWS = [
    { who: 'JD', name: 'Juan Dela Cruz', req: 'REQ-000124 · Transcript', pill: 'Receipt uploaded', tone: 'blue' },
    { who: 'MS', name: 'Maria Santos', req: 'REQ-000121 · Good Moral', pill: 'Processing', tone: 'amber' },
    { who: 'AL', name: 'Ana Lim', req: 'REQ-000118 · Enrollment', pill: 'Ready for claiming', tone: 'green' },
]

export function SceneEmpIntro() {
    return (
        <div className="lpx-scene">
            <Window title="Assigned requests" className="lpx-pop lpx-wide">
                <ul className="lpx-rows">
                    {ROWS.map((r, i) => (
                        <li key={r.req} className="lpx-row" style={{ '--i': i }}>
                            <span className="lpx-avatar">{r.who}</span>
                            <div><strong>{r.name}</strong><small>{r.req}</small></div>
                            <span className={`lpx-tag is-${r.tone}`}>{r.pill}</span>
                        </li>
                    ))}
                </ul>
            </Window>
            <div className="lpx-side-stack">
                <div className="lpx-note" style={{ '--delay': '1.6s' }}>
                    <span>{Icon.bell}</span>
                    <div><strong>3 new today</strong><small>Routed to you by program</small></div>
                </div>
                <div className="lpx-note" style={{ '--delay': '2.4s' }}>
                    <span>{Icon.users}</span>
                    <div><strong>Only your students</strong><small>Your assigned colleges and programs</small></div>
                </div>
            </div>
        </div>
    )
}

export function SceneEmpVerify() {
    return (
        <div className="lpx-scene">
            <div className="lpx-receipt is-still">
                <small>HCDC Finance Office</small>
                <strong>Official Receipt</strong>
                <span>OR No. 0045128</span>
                <div className="lpx-receipt-lines"><i /><i /><i /></div>
                <b>₱300.00</b>
                <span className="lpx-scan-line" />
            </div>
            <Window title="Verify payment · REQ-000124" className="lpx-pop">
                <ol className="lpx-steps">
                    {['Receipt number entered', 'Amount matches ₱300.00', 'Receipt not used on another request', 'Photo is clear and complete'].map((s, i) => (
                        <li key={s} style={{ '--i': i }}><span>{Icon.check}</span>{s}</li>
                    ))}
                </ol>
                <div className="lpx-btn lpx-press" style={{ '--delay': '4.6s' }}>Verify payment</div>
            </Window>
            <div className="lpx-stamp" style={{ '--delay': '5s' }}>Payment verified</div>
        </div>
    )
}

export function SceneEmpProcess() {
    return (
        <div className="lpx-scene">
            <Window title="REQ-000124 · Transcript of Records" className="lpx-pop">
                <div className="lpx-track-head">
                    <span className="lpx-doc-ic">{Icon.doc}</span>
                    <div><strong>Juan Dela Cruz</strong><small>2 copies · BS Information Technology</small></div>
                    <span className="lpx-pill-cycle"><i>Processing</i><i>Ready</i><i>Ready for claiming</i></span>
                </div>
                <div className="lpx-sched">
                    <small>Claim schedule</small>
                    <div className="lpx-sched-row">
                        <span className="lpx-chip-date" style={{ '--delay': '2.2s' }}>{Icon.cal} Oct 2, 2026</span>
                        <span className="lpx-chip-date" style={{ '--delay': '2.6s' }}>{Icon.clock} 9:00 AM</span>
                    </div>
                </div>
                <div className="lpx-btn lpx-press" style={{ '--delay': '3.4s' }}>Save schedule</div>
            </Window>
            <div className="lpx-side-stack">
                <div className="lpx-note" style={{ '--delay': '3.8s' }}>
                    <span>{Icon.bell}</span>
                    <div><strong>Student notified</strong><small>Ready for claiming · Oct 2, 9:00 AM</small></div>
                </div>
            </div>
        </div>
    )
}

export function SceneEmpRelease() {
    return (
        <div className="lpx-scene">
            <div className="lpx-ticket lpx-pop">
                <small>Now serving</small>
                <strong>Q-012</strong>
                <span>Juan Dela Cruz · REQ-000124</span>
            </div>
            <Window title="Release document" className="lpx-pop">
                <ol className="lpx-steps">
                    {['Valid ID checked', 'Original official receipt', 'Document handed over'].map((s, i) => (
                        <li key={s} style={{ '--i': i }}><span>{Icon.check}</span>{s}</li>
                    ))}
                </ol>
                <div className="lpx-btn lpx-press" style={{ '--delay': '3.6s' }}>Mark as claimed</div>
            </Window>
            <div className="lpx-result" style={{ '--delay': '4.2s' }}>
                <QrMark size={44} />
                <div><strong>Credential issued</strong><small>CERT-000124 · QR-verifiable</small></div>
            </div>
        </div>
    )
}

export function SceneEmpChat() {
    return (
        <div className="lpx-scene">
            <Window title="Messages · Juan Dela Cruz" className="lpx-pop lpx-wide">
                <div className="lpx-chat">
                    <div className="lpx-bubble is-them" style={{ '--delay': '0.5s' }}>
                        <em>Status inquiry</em>
                        Hi! What’s the status of REQ-000124?
                    </div>
                    <div className="lpx-typing" style={{ '--delay': '1.4s' }}><i /><i /><i /></div>
                    <div className="lpx-bubble is-me" style={{ '--delay': '3s' }}>
                        <q>Status inquiry: REQ-000124</q>
                        Automatic status update: Ready for claiming. Claim on Oct 2 at 9:00 AM with a valid ID.
                    </div>
                    <div className="lpx-bubble is-me is-small" style={{ '--delay': '4.4s' }}>See you then! 👋</div>
                </div>
            </Window>
            <div className="lpx-side-stack">
                <div className="lpx-note" style={{ '--delay': '3.3s' }}>
                    <span>{Icon.msg}</span>
                    <div><strong>Answered for you</strong><small>Status inquiries reply automatically</small></div>
                </div>
            </div>
        </div>
    )
}

export function SceneStaffCta({ cta }) {
    return (
        <div className="lpx-scene lpx-cta">
            <div className="lpx-cta-ring"><img src={certichainLogo} alt="" /></div>
            <strong>{cta?.title}</strong>
            <div className="lpx-cta-buttons">
                <CtaButton action={cta?.primary} className="lpx-cta-primary" />
                <CtaButton action={cta?.secondary} className="lpx-cta-secondary" />
            </div>
        </div>
    )
}
