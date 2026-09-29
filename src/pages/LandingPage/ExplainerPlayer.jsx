import { useCallback, useEffect, useRef, useState } from "react";
import hcdcLogo from "../../assets/hcdc-logo.png";
import { QrMark } from "./HeroVisual";
import { prefersReducedMotion, useInView } from "./motion";

// The "explainer video": an in-page motion piece (no video file) that walks
// through the real CertiChain flow with animated copies of its screens.
// Plays when scrolled into view; chapters, pause/play and replay work like a
// video player. Pausing also freezes the scene animations.

const SCENES = [
    { key: "intro", chapter: "Intro", title: "Registrar documents, without the counter line", text: "CertiChain is HCDC’s online registrar service. Request, track and verify academic documents from one account instead of queuing at the office.", ms: 6000 },
    { key: "account", chapter: "Step 1", title: "Create your account", text: "Register with your student details. The Registrar verifies your record, so only real students can request.", ms: 5500 },
    { key: "request", chapter: "Step 2", title: "Submit a request", text: "Pick the document, type how many copies and the purpose, add it to your list and submit — all online.", ms: 6500 },
    { key: "payment", chapter: "Step 3", title: "Pay, then upload the receipt", text: "Pay at the HCDC Finance Office and upload a photo of your official receipt. The Registrar verifies it online.", ms: 6500 },
    { key: "tracking", chapter: "Step 4", title: "Track it live", text: "Every status change appears instantly, with a notification — and you can message the Registrar anytime.", ms: 6000 },
    { key: "claim", chapter: "Result", title: "Claim it — and prove it’s genuine", text: "Claim on your scheduled date with a valid ID. The QR code lets any school or employer verify it in seconds.", ms: 6500 },
    { key: "cta", chapter: "Start", title: "Your records, verified and provable", text: "Create a free account and request your first document today.", ms: 5000 },
];

const Icon = {
    doc: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /><path d="M14 3v4h4M9 12h6M9 15.5h6" /></svg>,
    user: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c1.2-3.8 4-5.8 7-5.8s5.8 2 7 5.8" /></svg>,
    check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>,
    bell: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15Z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></svg>,
    upload: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15.5V4" /><path d="m7.5 8.3 4.5-4.5 4.5 4.5" /><path d="M5 15.5v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" /></svg>,
    clock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>,
    cal: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></svg>,
    msg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 5h14a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 17H9l-4 3.5V6.5A1.5 1.5 0 0 1 5 5Z" /></svg>,
    phone: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="6.5" y="2.5" width="11" height="19" rx="2.5" /><path d="M10.5 18.5h3" /></svg>,
    play: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5Z" /></svg>,
    pause: <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5" width="4" height="14" rx="1" /><rect x="13.5" y="5" width="4" height="14" rx="1" /></svg>,
    replay: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12a8 8 0 1 0 2.4-5.7" /><path d="M4 4v4.5h4.5" /></svg>,
};

function Window({ title, children, className = "" }) {
    return (
        <div className={`lpx-window ${className}`}>
            <div className="lpx-window-bar"><span /><span /><span /><em>{title}</em></div>
            <div className="lpx-window-body">{children}</div>
        </div>
    );
}

function SceneIntro() {
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
                <div className="lpx-seal"><img src={hcdcLogo} alt="" /></div>
                <strong>CertiChain</strong>
                <small>HCDC Registrar Services</small>
                <div className="lpx-intro-tags">
                    <span>Request</span><span>Track</span><span>Verify</span>
                </div>
            </div>
        </div>
    );
}

function SceneAccount() {
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
    );
}

function SceneRequest() {
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
                <div className="lpx-btn lpx-press" style={{ "--delay": "3.9s" }}>Add to list</div>
            </Window>
            <div className="lpx-cart" style={{ "--delay": "4.3s" }}>
                <small>Your list</small>
                <div><strong>Transcript of Records</strong><span>2 copies · ₱300.00</span></div>
                <div className="lpx-btn is-red">Submit request</div>
            </div>
            <span className="lpx-cursor" />
        </div>
    );
}

function ScenePayment() {
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
                    <span>{Icon.check}</span> Receipt verified by the Registrar
                </div>
            </Window>
        </div>
    );
}

function SceneTracking() {
    const steps = ["Submitted", "Receipt verified", "Processing", "Ready for claiming"];
    return (
        <div className="lpx-scene lpx-tracking">
            <Window title="My requests" className="lpx-pop">
                <div className="lpx-track-head">
                    <span className="lpx-doc-ic">{Icon.doc}</span>
                    <div><strong>Transcript of Records</strong><small>REQ-000124</small></div>
                    <span className="lpx-pill-cycle"><i>Receipt verified</i><i>Processing</i><i>Ready for claiming</i></span>
                </div>
                <ol className="lpx-steps">
                    {steps.map((s, i) => <li key={s} style={{ "--i": i }}><span>{Icon.check}</span>{s}</li>)}
                </ol>
            </Window>
            <div className="lpx-notes">
                <div className="lpx-note" style={{ "--delay": "1.2s" }}><span>{Icon.bell}</span><div><strong>Processing</strong><small>The Registrar is preparing your document.</small></div></div>
                <div className="lpx-note" style={{ "--delay": "3.2s" }}><span>{Icon.msg}</span><div><strong>Registrar</strong><small>Your document is ready for claiming.</small></div></div>
            </div>
        </div>
    );
}

function SceneClaim() {
    return (
        <div className="lpx-scene lpx-claim">
            <div className="lpx-date-card lpx-pop">
                <span>{Icon.cal}</span>
                <small>Claiming schedule</small>
                <strong>Oct 2</strong>
                <em>9:00 AM · bring a valid ID</em>
            </div>

            <div className="lpx-doc-final" style={{ "--delay": "1s" }}>
                <div className="lpx-doc-paper">
                    <img src={hcdcLogo} alt="" />
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
    );
}

function SceneCta() {
    return (
        <div className="lpx-scene lpx-cta">
            <div className="lpx-cta-ring"><img src={hcdcLogo} alt="" /></div>
            <strong>Your records, <em>verified and provable.</em></strong>
            <div className="lpx-cta-buttons">
                <a className="lpx-cta-primary" href="/register">Create an account →</a>
                <a className="lpx-cta-secondary" href="/login">Log in</a>
            </div>
        </div>
    );
}

const SCENE_VIEWS = {
    intro: SceneIntro,
    account: SceneAccount,
    request: SceneRequest,
    payment: ScenePayment,
    tracking: SceneTracking,
    claim: SceneClaim,
    cta: SceneCta,
};

function ExplainerPlayer() {
    const rootRef = useRef(null);
    const inView = useInView(rootRef, { threshold: 0.45 });
    // One clock: which scene, how far into it, and whether the end was reached.
    const [clock, setClock] = useState({ scene: 0, elapsed: 0, ended: false, run: 0 });
    // null until the visitor presses play/pause: until then it autoplays
    // the first time the player is on screen.
    const [choice, setChoice] = useState(null);
    const playing = !clock.ended && (choice === null ? inView && !prefersReducedMotion() : choice);
    const { scene, elapsed, ended, run } = clock;

    useEffect(() => {
        if (!playing) return undefined;
        let frame;
        let last = performance.now();
        const tick = (now) => {
            const delta = now - last;
            last = now;
            setClock((c) => {
                const next = c.elapsed + delta;
                if (next < SCENES[c.scene].ms) return { ...c, elapsed: next };
                if (c.scene < SCENES.length - 1) return { ...c, scene: c.scene + 1, elapsed: 0 };
                return { ...c, elapsed: SCENES[c.scene].ms, ended: true };
            });
            frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [playing]);

    const goTo = useCallback((i) => {
        setClock((c) => ({ scene: i, elapsed: 0, ended: false, run: c.run + 1 }));
        setChoice(!prefersReducedMotion());
    }, []);

    const togglePlay = () => {
        if (ended) goTo(0);
        else setChoice(!playing);
    };

    const current = SCENES[scene];
    const View = SCENE_VIEWS[current.key];
    const sceneProgress = Math.min(1, elapsed / current.ms);

    return (
        <div className="lpx-player" ref={rootRef}>
            <div
                className={`lpx-stage${playing ? "" : " is-paused"}`}
                onClick={togglePlay}
                role="button"
                tabIndex={0}
                aria-label={playing ? "Pause the walkthrough" : "Play the walkthrough"}
                onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); togglePlay(); } }}
            >
                <div className="lpx-stage-bg" />
                <div className="lpx-stage-grid" />

                <div className="lpx-chapter-tag" key={`tag-${scene}`}>
                    <span>{current.chapter}</span>{current.title}
                </div>

                <View key={`${current.key}-${run}`} />

                {!playing && (
                    <span className="lpx-big-play" aria-hidden="true">{ended ? Icon.replay : Icon.play}</span>
                )}
            </div>

            <div className="lpx-controls">
                <button type="button" className="lpx-play" onClick={togglePlay} aria-label={ended ? "Replay" : playing ? "Pause" : "Play"}>
                    {ended ? Icon.replay : playing ? Icon.pause : Icon.play}
                </button>

                <div className="lpx-chapters" role="tablist" aria-label="Chapters">
                    {SCENES.map((s, i) => (
                        <button
                            type="button"
                            key={s.key}
                            role="tab"
                            aria-selected={i === scene}
                            className={`lpx-chapter${i === scene ? " is-current" : ""}${i < scene ? " is-done" : ""}`}
                            onClick={() => goTo(i)}
                        >
                            <span className="lpx-chapter-bar"><b style={{ width: `${i < scene ? 100 : i === scene ? sceneProgress * 100 : 0}%` }} /></span>
                            <span className="lpx-chapter-name">{s.chapter}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="lpx-caption" key={`cap-${scene}`} aria-live="polite">
                <strong>{current.title}</strong>
                <p>{current.text}</p>
            </div>
        </div>
    );
}

export default ExplainerPlayer;
