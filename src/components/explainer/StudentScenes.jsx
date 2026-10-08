import certichainLogo from '../../assets/certichain-logo.png'
import { Icon } from './icons'
import { CtaButton, QrMark, Window } from './parts'

// Student story scenes, following the real request journey:
// Submitted -> Payment & requirements -> Registrar review -> Processing ->
// Ready for release -> Completed (the same six steps the student portal shows).

export function SceneIntro() {
    return (
        <div className="lpx-scene lpx-intro">
            <div className="lpx-queue">
                <span className="lpx-queue-label">Before</span>
                <div className="lpx-queue-line">
                    {[0, 1, 2, 3, 4].map((i) => <span key={i} className="lpx-person" style={{ "--i": i }}>{Icon.user}</span>)}
                    <span className="lpx-counter">Registrar<br />counter</span>
                </div>
                <div className="lpx-queue-clock">{Icon.clock}<b>Long lines, repeat visits</b></div>
            </div>

            <svg className="lpx-bridge" viewBox="0 0 120 40" aria-hidden="true"><path d="M4 20 C 40 0, 80 40, 116 20" /></svg>

            <div className="lpx-intro-brand">
                <span className="lpx-queue-label is-after">With CertiChain</span>
                <div className="lpx-seal"><img src={certichainLogo} alt="" /></div>
                <strong>CertiChain</strong>
                <small>HCDC Registrar Services</small>
                <div className="lpx-intro-tags">
                    <span>Request</span><span>Track</span><span>Verify</span>
                </div>
            </div>
        </div>
    )
}

export function SceneAccount() {
    return (
        <div className="lpx-scene lpx-account">
            <Window title="Create account" className="lpx-pop">
                <div className="lpx-field"><small>Student number</small><span className="lpx-type" style={{ "--chars": 8, "--delay": "0.4s" }}>59984080</span></div>
                <div className="lpx-field"><small>Full name</small><span className="lpx-type" style={{ "--chars": 14, "--delay": "1.2s" }}>Juan Dela Cruz</span></div>
                <div className="lpx-field"><small>Email</small><span className="lpx-type" style={{ "--chars": 20, "--delay": "2s" }}>juan@hcdc.edu.ph</span></div>
                <div className="lpx-btn lpx-press" style={{ "--delay": "3s" }}>Create account</div>
            </Window>
            <div className="lpx-badge-pop" style={{ "--delay": "3.6s" }}>
                <span>{Icon.check}</span>
                <div><strong>Student record verified</strong><small>by the Registrar</small></div>
            </div>
        </div>
    )
}

export function SceneRequest() {
    return (
        <div className="lpx-scene lpx-request">
            <Window title="Request a document" className="lpx-pop">
                <div className="lpx-doc-list">
                    {["Certificate of Enrollment", "Transcript of Records", "Certificate of Good Standing"].map((d, i) => (
                        <div key={d} className={`lpx-doc${i === 1 ? " is-pick" : ""}`}>{Icon.doc}<span>{d}</span><b>₱{i === 1 ? "150" : "60"}</b></div>
                    ))}
                </div>
                <div className="lpx-form-row">
                    <div className="lpx-field"><small>Copies</small><span className="lpx-type" style={{ "--chars": 1, "--delay": "1.9s" }}>2</span></div>
                    <div className="lpx-field is-grow"><small>Purpose</small><span className="lpx-type" style={{ "--chars": 22, "--delay": "2.4s" }}>Scholarship application</span></div>
                </div>
                <div className="lpx-before" style={{ "--delay": "1.2s" }}>
                    <small>Before you continue — you'll need:</small>
                    <span>{Icon.check} Signed clearance form</span>
                    <span>{Icon.check} Valid school ID</span>
                </div>
                <div className="lpx-btn lpx-press" style={{ "--delay": "3.9s" }}>Add to list</div>
            </Window>
            <div className="lpx-side-stack">
                <div className="lpx-cart" style={{ "--delay": "4.3s" }}>
                    <small>Your list</small>
                    <div><strong>Transcript of Records</strong><span>2 copies · ₱300.00</span></div>
                    <div className="lpx-btn is-red">Submit Request</div>
                </div>
                <div className="lpx-badge-pop" style={{ "--delay": "5.4s" }}>
                    <span>{Icon.check}</span>
                    <div><strong>Request submitted</strong><small>REQ-000124 · next: requirements</small></div>
                </div>
            </div>
            <span className="lpx-cursor" />
        </div>
    )
}

export function SceneRequirements() {
    return (
        <div className="lpx-scene lpx-requirements">
            <Window title="Upload requirements" className="lpx-pop">
                <div className="lpx-req">
                    <div className="lpx-req-main">
                        <strong>Signed clearance form</strong>
                        <span className="lpx-reason-swap">
                            <small className="lpx-req-reason">Rejected: the photo is blurry — please upload a clearer one.</small>
                            <small className="lpx-req-sent">New file sent — waiting for review</small>
                        </span>
                    </div>
                    <span className="lpx-chip-swap">
                        <i className="lpx-chip is-bad">Rejected</i>
                        <i className="lpx-chip is-wait">Under review</i>
                    </span>
                </div>
                <div className="lpx-drop lpx-drop-small">
                    <span>{Icon.upload}</span>
                    <small>clearance-form.jpg · ready to upload</small>
                    <div className="lpx-progress"><b /></div>
                </div>
                <div className="lpx-req">
                    <div className="lpx-req-main"><strong>Valid school ID</strong><small>id-front.jpg</small></div>
                    <span className="lpx-chip is-ok">Approved</span>
                </div>
            </Window>
            <div className="lpx-badge-pop" style={{ "--delay": "4s" }}>
                <span>{Icon.check}</span>
                <div><strong>New file received</strong><small>The Registrar will check it again</small></div>
            </div>
        </div>
    )
}

export function ScenePayment() {
    return (
        <div className="lpx-scene lpx-payment">
            <div className="lpx-receipt">
                <small>HCDC Finance Office</small>
                <strong>Official Receipt</strong>
                <span>OR No. 0045128</span>
                <div className="lpx-receipt-lines"><i /><i /><i /></div>
                <b>₱300.00</b>
            </div>
            <svg className="lpx-arc" viewBox="0 0 200 60" aria-hidden="true"><path d="M10 50 C 70 -10, 130 -10, 190 50" /></svg>
            <Window title="Upload receipt" className="lpx-pop">
                <div className="lpx-drop">
                    <span>{Icon.upload}</span>
                    <small>Photo of your official receipt</small>
                    <div className="lpx-progress"><b /></div>
                </div>
                <div className="lpx-verified" style={{ "--delay": "3.8s" }}>
                    <span>{Icon.check}</span> Receipt received — the Registrar will check it
                </div>
            </Window>
        </div>
    )
}

const JOURNEY = ['Submitted', 'Payment & requirements', 'Registrar review', 'Processing', 'Ready for release', 'Completed']

export function SceneTracking() {
    return (
        <div className="lpx-scene lpx-tracking">
            <Window title="My requests · REQ-000124" className="lpx-pop lpx-journey-win">
                <div className="lpx-track-head">
                    <span className="lpx-doc-ic">{Icon.doc}</span>
                    <div><strong>Transcript of Records</strong><small>REQ-000124 · 2 copies</small></div>
                    <span className="lpx-pill-cycle"><i>Under review</i><i>Processing</i><i>Ready</i></span>
                </div>
                <ol className="lpx-journey">
                    {JOURNEY.map((label, i) => (
                        <li key={label} style={{ "--i": i }}>
                            <span>{i < 5 ? Icon.check : i + 1}</span>
                            <small>{label}</small>
                        </li>
                    ))}
                </ol>
                <div className="lpx-now">
                    <small>What's happening now?</small>
                    <span className="lpx-now-cycle">
                        <i>The Registrar is checking your receipt and requirements.</i>
                        <i>The Registrar is preparing your document.</i>
                        <i>Your document is ready — pickup on Oct 2, 9:00 AM.</i>
                    </span>
                </div>
            </Window>
            <div className="lpx-notes">
                <div className="lpx-note" style={{ "--delay": "1.6s" }}><span>{Icon.bell}</span><div><strong>Payment verified</strong><small>Your request is now being processed.</small></div></div>
                <div className="lpx-note" style={{ "--delay": "4.2s" }}><span>{Icon.bell}</span><div><strong>Ready for pickup</strong><small>Thu, Oct 2 · 9:00 AM · Window 2</small></div></div>
            </div>
        </div>
    )
}

export function SceneSchedule() {
    return (
        <div className="lpx-scene lpx-claim">
            <div className="lpx-date-card lpx-pop">
                <span>{Icon.cal}</span>
                <small>Pickup schedule</small>
                <strong>Oct 2</strong>
                <em>9:00 AM · Window 2</em>
            </div>
            <div className="lpx-bring" style={{ "--delay": "0.9s" }}>
                <small>What to bring</small>
                <span style={{ "--d": "1.4s" }}>{Icon.check} A valid ID</span>
                <span style={{ "--d": "2s" }}>{Icon.check} Your Official Receipt</span>
                <span style={{ "--d": "2.6s" }}>{Icon.user} Can't go? Add a representative — they bring your signed letter and their ID</span>
            </div>
        </div>
    )
}

export function SceneClaim() {
    return (
        <div className="lpx-scene lpx-claim">
            <div className="lpx-badge-pop" style={{ "--delay": "0.3s" }}>
                <span>{Icon.check}</span>
                <div><strong>Claimed · request completed</strong><small>Released at the Registrar's Office</small></div>
            </div>

            <div className="lpx-doc-final" style={{ "--delay": "1s" }}>
                <div className="lpx-doc-paper">
                    <img src={certichainLogo} alt="" />
                    <strong>Transcript of Records</strong>
                    <i /><i /><i />
                    <div className="lpx-doc-qr"><QrMark size={46} /></div>
                </div>
                <div className="lpx-scan-phone" style={{ "--delay": "2.2s" }}>
                    <span className="lpx-scan-beam" />
                    {Icon.phone}
                </div>
            </div>

            <div className="lpx-result" style={{ "--delay": "3.6s" }}>
                <span>{Icon.check}</span>
                <div><strong>Verified credential</strong><small>CERT-000124 · Signature valid</small></div>
            </div>
        </div>
    )
}

export function SceneCta({ cta }) {
    return (
        <div className="lpx-scene lpx-cta">
            <div className="lpx-cta-ring"><img src={certichainLogo} alt="" /></div>
            <strong>{cta?.title || <>Your records, <em>verified and provable.</em></>}</strong>
            <div className="lpx-cta-buttons">
                <CtaButton action={cta?.primary} className="lpx-cta-primary" />
                <CtaButton action={cta?.secondary} className="lpx-cta-secondary" />
            </div>
        </div>
    )
}
