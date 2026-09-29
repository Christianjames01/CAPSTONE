import { useRef } from "react";
import hcdcLogo from "../../assets/hcdc-logo.png";
import { prefersReducedMotion, useInView, useTicker } from "./motion";

// The hero's product visualization: a small copy of the student portal
// with one request moving through its real statuses, the notification the
// student gets at each step, and the QR-verified credential it ends in.

const STAGES = [
    { status: "Pending", tone: "blue", note: "Request submitted — pay at the Finance Office." },
    { status: "Receipt verified", tone: "blue", note: "Your official receipt was verified." },
    { status: "Processing", tone: "blue", note: "The Registrar is preparing your document." },
    { status: "Ready for claiming", tone: "green", note: "Claim on Oct 2 · 9:00 AM with a valid ID." },
    { status: "Completed", tone: "green", note: "Claimed. Your credential is QR-verifiable." },
];

// A decorative, QR-looking pattern: three finder squares plus a fixed
// pseudo-random fill (same every render).
const QR_N = 21;
const QR_CELLS = (() => {
    const finder = (x, y) => {
        for (const [fx, fy] of [[0, 0], [QR_N - 7, 0], [0, QR_N - 7]]) {
            const dx = x - fx;
            const dy = y - fy;
            if (dx >= 0 && dx < 7 && dy >= 0 && dy < 7) {
                const ring = Math.min(dx, dy, 6 - dx, 6 - dy);
                return ring === 0 || ring >= 2 ? 1 : 0;
            }
            if (dx >= -1 && dx <= 7 && dy >= -1 && dy <= 7) return 0;
        }
        return null;
    };
    let seed = 7;
    const cells = [];
    for (let y = 0; y < QR_N; y++) {
        for (let x = 0; x < QR_N; x++) {
            const f = finder(x, y);
            seed = (seed * 16807) % 2147483647;
            if (f === 1 || (f === null && seed % 100 < 46)) cells.push([x, y]);
        }
    }
    return cells;
})();

export function QrMark({ size = 64 }) {
    return (
        <svg className="lpm-qr" viewBox={`-1 -1 ${QR_N + 2} ${QR_N + 2}`} width={size} height={size} aria-hidden="true" shapeRendering="crispEdges">
            <rect x="-1" y="-1" width={QR_N + 2} height={QR_N + 2} fill="#fff" />
            {QR_CELLS.map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#0A2450" />)}
        </svg>
    );
}

function HeroVisual() {
    const ref = useRef(null);
    const inView = useInView(ref, { threshold: 0.2, once: false });
    const tick = useTicker(inView && !prefersReducedMotion(), 2400);
    const stage = prefersReducedMotion() ? STAGES.length - 1 : tick % STAGES.length;
    const current = STAGES[stage];
    const done = stage === STAGES.length - 1;

    return (
        <div className="lpm-hero-visual" ref={ref} aria-hidden="true">
            <div className="lpm-orbit lpm-orbit-a" />
            <div className="lpm-orbit lpm-orbit-b" />

            <div className="lpm-app">
                <div className="lpm-app-bar">
                    <span /><span /><span />
                    <div className="lpm-app-url">onlineregistrar.vercel.app/student</div>
                </div>

                <div className="lpm-app-body">
                    <aside className="lpm-app-side">
                        <img src={hcdcLogo} alt="" />
                        <i className="is-active" /><i /><i /><i /><i />
                    </aside>

                    <div className="lpm-app-main">
                        <div className="lpm-app-greet">
                            <small>Good morning,</small>
                            <strong>Juan Dela Cruz</strong>
                        </div>

                        <div className="lpm-req-card">
                            <div className="lpm-req-head">
                                <span className="lpm-doc-icon">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /><path d="M14 3v4h4M9 12h6M9 15.5h6" /></svg>
                                </span>
                                <div>
                                    <strong>Transcript of Records</strong>
                                    <small>REQ-000124 · 2 copies</small>
                                </div>
                                <span key={current.status} className={`lpm-pill is-${current.tone}`}>{current.status}</span>
                            </div>

                            <div className="lpm-stepper">
                                {STAGES.map((s, i) => (
                                    <span key={s.status} className={i < stage ? "is-done" : i === stage ? "is-now" : ""} />
                                ))}
                                <b style={{ width: `${(stage / (STAGES.length - 1)) * 100}%` }} />
                            </div>
                        </div>

                        <div className="lpm-mini-row">
                            <div><small>Requests</small><strong>3</strong></div>
                            <div><small>In progress</small><strong>{done ? 0 : 1}</strong></div>
                            <div><small>Completed</small><strong>{done ? 3 : 2}</strong></div>
                        </div>
                    </div>
                </div>
            </div>

            <div key={`n-${stage}`} className="lpm-toast">
                <span className="lpm-toast-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15Z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></svg>
                </span>
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

            <svg className="lpm-connector" viewBox="0 0 100 100" preserveAspectRatio="none">
                <path d="M78 58 C 92 70, 88 84, 70 92" />
            </svg>
        </div>
    );
}

export default HeroVisual;
