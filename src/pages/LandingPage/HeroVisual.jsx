import { useEffect, useRef, useState } from "react";
import certichainLogo from "../../assets/certichain-logo.png";
import { QrMark } from "../../components/explainer/parts";
import { prefersReducedMotion, useInView, useTicker } from "./motion";

// The hero's product visualization: a small copy of the real student portal
// (navy sidebar with the menu, "Welcome back", announcement, stat cards and
// a request card with the Submitted -> Completed stepper). One request moves
// through its real statuses, with the notification the student gets at each
// step and the QR-verified credential it ends in.

const STAGES = [
    { status: "Receipt uploaded", tone: "blue", step: 0, note: "Your receipt was uploaded and is waiting for verification." },
    { status: "Payment verified", tone: "blue", step: 0, note: "Your official receipt was verified." },
    { status: "Processing", tone: "blue", step: 1, note: "The Registrar is preparing your document." },
    { status: "Ready for claiming", tone: "green", step: 2, note: "Claim on Oct 2 · 9:00 AM with a valid ID." },
    { status: "Completed", tone: "green", step: 3, note: "Claimed. Your credential is QR-verifiable." },
];

const STEPS = ["Submitted", "Processing", "Ready", "Completed"];

const Svg = ({ children }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);

const I = {
    home: <Svg><path d="M4 11.5 12 4l8 7.5" /><path d="M6 10v9a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-9" /></Svg>,
    plus: <Svg><path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /><path d="M12 12.5v5M9.5 15h5" /></Svg>,
    list: <Svg><path d="M9 6h10M9 12h10M9 18h10" /><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" /></Svg>,
    cal: <Svg><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></Svg>,
    receipt: <Svg><path d="M6 3h12v18l-3-2-3 2-3-2-3 2Z" /><path d="M9 8h6M9 11.5h6" /></Svg>,
    msg: <Svg><path d="M5 5h14a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 17H9l-4 3.5V6.5A1.5 1.5 0 0 1 5 5Z" /></Svg>,
    bell: <Svg><path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15Z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></Svg>,
    clock: <Svg><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Svg>,
    check: <Svg><circle cx="12" cy="12" r="8.5" /><path d="m8.5 12.2 2.4 2.4 4.6-4.8" /></Svg>,
    doc: <Svg><path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /><path d="M14 3v4h4M9 12h6M9 15.5h6" /></Svg>,
    megaphone: <Svg><path d="M4 10v4h3l7 4V6L7 10Z" /><path d="M17.5 9a4 4 0 0 1 0 6" /></Svg>,
    user: <Svg><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="10" r="3" /><path d="M6.8 18.2a6 6 0 0 1 10.4 0" /></Svg>,
    book: <Svg><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5Z" /><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3" /></Svg>,
    help: <Svg><circle cx="12" cy="12" r="8.5" /><path d="M9.8 9.5a2.3 2.3 0 0 1 4.4.9c0 1.6-2.2 2-2.2 3.4" /><path d="M12 16.8h.01" /></Svg>,
};

const NAV = [
    { icon: I.home, label: "Dashboard", active: true },
    { icon: I.plus, label: "Request a Document" },
    { icon: I.list, label: "My Requests" },
    { icon: I.cal, label: "Claim Schedule" },
    { icon: I.receipt, label: "Upload Receipt" },
    { icon: I.msg, label: "Messages", badge: "msg" },
    { icon: I.bell, label: "Notifications", badge: "notif" },
    { icon: I.user, label: "Profile" },
    { icon: I.book, label: "User Guide" },
    { icon: I.help, label: "Help / Support" },
];

const RECENT = [
    { name: "Certificate of Enrollment", no: "REQ-000119 · 1 copy", status: "Completed", tone: "green" },
    { name: "Good Moral Certificate", no: "REQ-000112 · 1 copy", status: "Completed", tone: "green" },
];

// The 3D certificate needs WebGL; without it the portal mock is shown.
function webglAvailable() {
    try {
        const canvas = document.createElement("canvas");
        return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
    } catch {
        return false;
    }
}

function HeroVisual() {
    const ref = useRef(null);
    const stageRef = useRef(null);
    const sceneRef = useRef(null);
    const [mode, setMode] = useState(() => (webglAvailable() ? "3d" : "mock"));
    const [sceneReady, setSceneReady] = useState(false);
    const inView = useInView(ref, { threshold: 0.2, once: false });
    const tick = useTicker(inView && !prefersReducedMotion(), 2600);
    const stage = prefersReducedMotion() ? STAGES.length - 1 : tick % STAGES.length;
    const current = STAGES[stage];
    const done = stage === STAGES.length - 1;
    const ready = current.step === 2;
    // One new notification per status change.
    const unread = stage + 1;

    // Load the 3D certificate separately (three.js is big) and mount it.
    useEffect(() => {
        if (mode !== "3d") return undefined;
        let cancelled = false;
        import("./heroCertificateScene")
            .then(({ createHeroCertificate }) => {
                if (cancelled || !stageRef.current) return;
                sceneRef.current = createHeroCertificate(stageRef.current, { reducedMotion: prefersReducedMotion() });
                setSceneReady(true);
            })
            .catch((err) => {
                console.error("HERO 3D ERROR:", err);
                if (!cancelled) setMode("mock");
            });
        return () => {
            cancelled = true;
            sceneRef.current?.dispose();
            sceneRef.current = null;
        };
    }, [mode]);

    // Follow the status cycle; pause when the hero is off screen.
    useEffect(() => { sceneRef.current?.setStage(stage); }, [stage, sceneReady]);
    useEffect(() => { sceneRef.current?.setActive(inView); }, [inView, sceneReady]);

    return (
        <div className="lpm-hero-visual" ref={ref} aria-hidden="true">
            {/* A faint, static enlargement of the same QR mark every real
                credential carries -- what the system actually produces,
                not an abstract decoration. */}
            <div className="lpm-qr-bg"><QrMark size={360} /></div>

            {mode === "3d" ? (
                <div className={`lpc-stage${sceneReady ? " is-ready" : ""}`} ref={stageRef} />
            ) : (
            <div className="lpv-app">
                <div className="lpv-bar">
                    <span /><span /><span />
                    <div className="lpv-url">onlineregistrar.vercel.app/student/dashboard</div>
                </div>

                <div className="lpv-body">
                    <aside className="lpv-side">
                        <div className="lpv-brand">
                            <img src={certichainLogo} alt="" />
                            <div><strong>CertiChain</strong><small>Student Portal</small></div>
                        </div>
                        <nav>
                            {NAV.map((n) => (
                                <span key={n.label} className={`lpv-nav${n.active ? " is-active" : ""}`}>
                                    {n.icon}
                                    <em>{n.label}</em>
                                    {n.badge === "notif" && <b key={unread} className="lpv-badge">{unread}</b>}
                                    {n.badge === "msg" && ready && <b className="lpv-badge">1</b>}
                                </span>
                            ))}
                        </nav>
                        <div className="lpv-user">
                            <span>JD</span>
                            <div><strong>Juan Dela Cruz</strong><small>Student Account</small></div>
                        </div>
                    </aside>

                    <main className="lpv-main">
                        <div className="lpv-head">
                            <strong>Welcome back, Juan</strong>
                            <small>Here’s what you can do with your CertiChain account today.</small>
                        </div>

                        <div className="lpv-announce">
                            <span>{I.megaphone}</span>
                            <div><strong>Office open on Monday</strong><small>8:00 AM – 5:00 PM</small></div>
                        </div>

                        <div className="lpv-stats">
                            <div style={{ "--c": "#123B78", "--t": "#EAF1FB" }}>
                                <span>{I.list}</span><strong>3</strong><small>Total Requests</small>
                            </div>
                            <div style={{ "--c": "#B45309", "--t": "#FFF4DB" }}>
                                <span>{I.clock}</span><strong key={`p-${done}`}>{done || ready ? 0 : 1}</strong><small>In Progress</small>
                            </div>
                            <div style={{ "--c": "#1E8A5F", "--t": "#E7F4EE" }}>
                                <span>{I.check}</span><strong key={`r-${ready}`}>{ready ? 1 : 0}</strong><small>Ready for Claiming</small>
                            </div>
                        </div>

                        <div className="lpv-card">
                            <div className="lpv-card-head">
                                <span className="lpv-doc">{I.doc}</span>
                                <div>
                                    <strong>Transcript of Records</strong>
                                    <small>REQ-000124 · 2 copies</small>
                                </div>
                                <span key={current.status} className={`lpv-pill is-${current.tone}`}>{current.status}</span>
                            </div>

                            <div className="lpv-stepper">
                                {STEPS.map((label, i) => (
                                    <div key={label} className={`lpv-step${i <= current.step ? " is-on" : ""}${i === current.step ? " is-now" : ""}`}>
                                        <div className="lpv-step-row">
                                            {i > 0 && <i className={i <= current.step ? "is-on" : ""} />}
                                            <b />
                                        </div>
                                        <small>{label}</small>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Like the real dashboard's Recent Requests list. */}
                        <div className="lpv-card lpv-recent">
                            <strong className="lpv-recent-title">Recent Requests</strong>
                            {RECENT.map((r) => (
                                <div key={r.no} className="lpv-recent-row">
                                    <span className="lpv-doc">{I.doc}</span>
                                    <div>
                                        <strong>{r.name}</strong>
                                        <small>{r.no}</small>
                                    </div>
                                    <span className={`lpv-pill is-${r.tone}`}>{r.status}</span>
                                </div>
                            ))}
                        </div>
                    </main>
                </div>
            </div>
            )}

            <div key={`n-${stage}`} className="lpm-toast">
                <span className="lpm-toast-icon">{I.bell}</span>
                <div>
                    <strong>{current.status}</strong>
                    <small>{current.note}</small>
                </div>
            </div>

            <div className={`lpm-cred${done ? " is-verified" : ""}`}>
                <QrMark size={58} />
                <div>
                    <small>CERT-000124</small>
                    <strong>{done ? "Verified credential" : "Credential pending"}</strong>
                    <span className="lpm-cred-status">
                        <i /> {done ? "Signature valid" : "Issued when claimed"}
                    </span>
                </div>
            </div>
        </div>
    );
}

export default HeroVisual;
