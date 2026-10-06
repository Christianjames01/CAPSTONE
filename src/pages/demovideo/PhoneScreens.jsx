import certichainLogo from '../../assets/certichain-logo.png'
import { clamp, inOut, lerp, outBack, outExpo, seg, typed } from './motion'

// What the phone shows in each scene. l = seconds into the scene.
// Each screen is 372 x 780 px.

const Check = ({ size = 14 }) => (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true"><path d="M5 12.5 10 17.5 19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
)

// A finger tap: ripple at (x, y) when l passes `at`.
export function Tap({ l, at, x, y }) {
    const k = seg(l, at - 0.25, at + 0.45)
    if (k <= 0 || k >= 1) return null
    const press = l < at ? seg(l, at - 0.25, at) : 1
    const ring = seg(l, at, at + 0.45)
    return (
        <span className="dv-tap" style={{ left: x, top: y }}>
            <i className="dv-tap-finger" style={{ transform: `translate(-50%, -50%) scale(${lerp(1.4, 1, press)})`, opacity: 1 - ring }} />
            <i className="dv-tap-ring" style={{ transform: `translate(-50%, -50%) scale(${0.4 + ring * 1.6})`, opacity: (1 - ring) * 0.9 }} />
        </span>
    )
}

const Header = ({ title, back }) => (
    <div className="dv-app-head">
        {back ? <span className="dv-back">‹</span> : <img src={certichainLogo} alt="" />}
        <strong>{title}</strong>
        <span className="dv-bell">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15ZM10 20.5a2 2 0 0 0 4 0" /></svg>
        </span>
    </div>
)

const Toast = ({ show, title, sub, tone = 'ok' }) => (
    <div className={`dv-toast is-${tone}`} style={{ transform: `translateY(${(1 - outBack(show)) * -140}px)`, opacity: clamp(show * 2) }}>
        <span><Check /></span>
        <div><strong>{title}</strong><small>{sub}</small></div>
    </div>
)

// ---- 1. Sign in --------------------------------------------------------------
export function LoginScreen({ l }) {
    const knob = inOut(seg(l, 3.8, 5.0))
    const solved = l >= 5.1
    const dash = outExpo(seg(l, 6.4, 7.0))
    return (
        <div className="dv-screen">
            <div className="dv-login" style={{ transform: `translateX(${-dash * 100}%)` }}>
                <div className="dv-login-top">
                    <img src={certichainLogo} alt="" />
                    <strong>Welcome back</strong>
                    <small>Log in to manage your document requests.</small>
                </div>
                <label className="dv-field"><span>Email</span><b>{typed('juan.delacruz@hcdc.edu.ph', l, 0.8, 2.2)}<i className="dv-caret" style={{ opacity: l > 0.6 && l < 2.3 ? 1 : 0 }} /></b></label>
                <label className="dv-field"><span>Password</span><b>{'•'.repeat(Math.round(seg(l, 2.4, 3.4) * 10))}</b></label>
                <div className={`dv-captcha${solved ? ' is-ok' : ''}`}>
                    <small>{solved ? 'Verified — you’re human' : 'Slide the piece into the gap'}</small>
                    <div className="dv-captcha-track">
                        <span className="dv-captcha-gap" />
                        <span className="dv-captcha-knob" style={{ left: `${knob * 72}%` }}>{solved ? <Check /> : '›'}</span>
                    </div>
                </div>
                <div className="dv-btn is-primary">Log in</div>
            </div>
            <div className="dv-dash" style={{ transform: `translateX(${(1 - dash) * 100}%)` }}>
                <Header title="Dashboard" />
                <div className="dv-hello"><strong>Good morning, Juan</strong><small>Your requests, payments and pickups in one place.</small></div>
                <div className="dv-btn is-primary dv-big">+ Request a Document</div>
                <div className="dv-cards">
                    <div><b>0</b><small>Active</small></div>
                    <div><b>0</b><small>Need you</small></div>
                    <div><b>0</b><small>Ready</small></div>
                </div>
            </div>
            <Tap l={l} at={4.0} x={80} y={496} />
            <Tap l={l} at={5.8} x={186} y={592} />
        </div>
    )
}

// ---- 2. Request a document -----------------------------------------------------
const DOCS = [['Certificate of Enrollment', '₱60'], ['Transcript of Records', '₱150'], ['Certificate of Good Standing', '₱60'], ['Certification of Grades', '₱80']]

export function RequestScreen({ l }) {
    const picked = l >= 1.2
    const reqs = outExpo(seg(l, 1.6, 2.1))
    const added = l >= 5.0
    const modal = outBack(seg(l, 6.5, 6.9)) * (1 - seg(l, 7.7, 7.95))
    const done = seg(l, 8.1, 8.5)
    return (
        <div className="dv-screen">
            <Header title="Request a Document" back />
            <div className="dv-steps-mini"><i className="is-done" /><i className={picked ? 'is-done' : ''} /><i className={added ? 'is-on' : ''} /></div>
            <div className="dv-search">Search documents…</div>
            <div className="dv-doc-list">
                {DOCS.map(([name, fee], i) => (
                    <div key={name} className={`dv-doc${picked && i === 1 ? ' is-picked' : ''}`}><span>{name}</span><b>{fee}</b></div>
                ))}
            </div>
            <div className="dv-before" style={{ opacity: reqs, transform: `translateY(${(1 - reqs) * 20}px)` }}>
                <strong>Before you continue — you’ll need:</strong>
                <span><Check /> Valid school ID</span>
                <span><Check /> Signed clearance form</span>
            </div>
            <div className="dv-row">
                <label className="dv-field is-small"><span>Copies</span><b>{l >= 2.4 ? '1' : ''}</b></label>
                <label className="dv-field"><span>Purpose</span><b>{typed('Employment', l, 3.0, 4.4)}</b></label>
            </div>
            <div className="dv-btn is-outline">{added ? '✓ Added to your list' : '+ Add to request list'}</div>
            <div className="dv-cart" style={{ opacity: added ? 1 : 0.35 }}>
                <span>Transcript of Records · 1 copy</span><b>₱150.00</b>
                <div className="dv-btn is-red">Submit Request</div>
            </div>
            {modal > 0 && (
                <div className="dv-modal-back" style={{ opacity: clamp(modal) }}>
                    <div className="dv-modal" style={{ transform: `scale(${lerp(0.8, 1, modal)})` }}>
                        <strong>Submit your request?</strong>
                        <small>Transcript of Records (1 copy). Total to pay at the Finance Office: ₱150.00</small>
                        <div className="dv-modal-btns"><span>Cancel</span><span className="is-primary">Submit Request</span></div>
                    </div>
                </div>
            )}
            <Toast show={done} title="Request submitted" sub="REQ-000124 · next: requirements & payment" />
            <Tap l={l} at={1.2} x={186} y={232} />
            <Tap l={l} at={5.0} x={186} y={572} />
            <Tap l={l} at={6.2} x={186} y={688} />
            <Tap l={l} at={7.6} x={262} y={452} />
        </div>
    )
}

// ---- 3. Upload requirements --------------------------------------------------------
function ReqItem({ l, name, start }) {
    const flash = seg(l, start + 0.55, start + 0.6) * (1 - seg(l, start + 0.6, start + 0.9))
    const chosen = l >= start + 1.2
    const up = seg(l, start + 2.2, start + 3.4)
    const done = l >= start + 3.6
    return (
        <div className={`dv-req${done ? ' is-done' : ''}`}>
            <div className="dv-req-head">
                <strong>{name}</strong>
                <span className={`dv-chip ${done ? 'is-wait' : 'is-need'}`}>{done ? 'Under review' : 'Needed'}</span>
            </div>
            {chosen ? (
                <div className="dv-file">
                    <span className="dv-file-thumb" />
                    <div><b>{name === 'Valid school ID' ? 'id-front.jpg' : 'clearance.jpg'}</b><small>{done ? 'Uploaded' : up > 0 ? `Uploading ${Math.round(up * 100)}%` : 'Ready to upload'}</small></div>
                    {up > 0 && !done && <i className="dv-file-bar"><b style={{ width: `${up * 100}%` }} /></i>}
                </div>
            ) : (
                <div className="dv-drop"><span>⇪</span><b>Tap to take a photo</b><small>JPG, PNG or PDF · up to 5 MB</small></div>
            )}
            {!done && <div className={`dv-btn is-primary is-sm${chosen ? '' : ' is-off'}`}>Upload</div>}
            {flash > 0 && <span className="dv-flash" style={{ opacity: flash }} />}
        </div>
    )
}

export function RequirementsScreen({ l }) {
    return (
        <div className="dv-screen">
            <Header title="Upload Requirements" back />
            <div className="dv-how"><b>How this works</b> Upload each → Registrar reviews → Approved</div>
            <ReqItem l={l} name="Valid school ID" start={1.0} />
            <ReqItem l={l} name="Signed clearance form" start={5.6} />
            <Tap l={l} at={1.0} x={186} y={232} />
            <Tap l={l} at={3.0} x={70} y={322} />
            <Tap l={l} at={5.6} x={186} y={470} />
            <Tap l={l} at={7.6} x={70} y={560} />
        </div>
    )
}

// ---- 4. Payment ------------------------------------------------------------------------
export function PaymentScreen({ l }) {
    const flash = seg(l, 3.45, 3.5) * (1 - seg(l, 3.5, 3.8))
    const photo = l >= 4.0
    const up = seg(l, 5.4, 6.4)
    const done = l >= 6.6
    return (
        <div className="dv-screen">
            <Header title="Upload Official Receipt" back />
            <div className="dv-how dv-how-steps">
                <span className="is-done"><Check /> Pay</span><i /><span className={done ? 'is-done' : 'is-on'}>{done ? <Check /> : '2'} Upload</span><i /><span>3 Check</span>
            </div>
            <div className="dv-amount"><small>Amount to pay</small><b>₱150.00</b><small>REQ-000124 · Transcript of Records</small></div>
            <label className="dv-field"><span>OR number</span><b>{typed('0045128', l, 1.2, 2.6)}</b></label>
            <div className="dv-drop is-photo">
                {photo ? (
                    <div className="dv-receipt-thumb"><small>HCDC Finance Office</small><b>Official Receipt</b><span>OR No. 0045128</span><i /><i /><em>₱150.00</em></div>
                ) : (
                    <><span>⇪</span><b>Photo of your Official Receipt</b></>
                )}
            </div>
            {up > 0 && !done && <i className="dv-file-bar is-wide"><b style={{ width: `${up * 100}%` }} /></i>}
            {done ? (
                <div className="dv-lock"><span><Check /></span><div><b>Receipt received</b><small>The Registrar will check it. You can’t change it while it’s under review.</small></div></div>
            ) : (
                <div className="dv-btn is-primary">Submit receipt</div>
            )}
            {flash > 0 && <span className="dv-flash" style={{ opacity: flash }} />}
            <Tap l={l} at={3.0} x={186} y={430} />
            <Tap l={l} at={5.2} x={186} y={600} />
        </div>
    )
}

// ---- 5. Track ----------------------------------------------------------------------------
const JOURNEY = ['Submitted', 'Payment', 'Review', 'Processing', 'Ready', 'Done']
export function TrackScreen({ l }) {
    const current = l < 3 ? 2 : l < 6.5 ? 3 : 4
    const now = ['', '', 'The Registrar is checking your receipt and requirements.', 'The Registrar is preparing your document.', 'Your document is ready — pickup on Thu, Oct 8, 9:00 AM.'][current]
    return (
        <div className="dv-screen">
            <Header title="My Requests" />
            <div className="dv-track">
                <div className="dv-track-head"><div><strong>Transcript of Records</strong><small>REQ-000124</small></div><span className={`dv-chip ${current === 4 ? 'is-ok' : 'is-wait'}`}>{['', '', 'Under review', 'Processing', 'Ready'][current]}</span></div>
                <ol className="dv-journey">
                    {JOURNEY.map((s, i) => (
                        <li key={s} className={i < current ? 'is-done' : i === current ? 'is-now' : ''}>
                            <span>{i < current ? <Check size={11} /> : i + 1}</span><small>{s}</small>
                        </li>
                    ))}
                </ol>
                <div className="dv-now" key={current}><small>What’s happening now?</small><p>{now}</p></div>
            </div>
            <div className="dv-track dv-track-dim"><div className="dv-track-head"><div><strong>Certificate of Enrollment</strong><small>REQ-000119</small></div><span className="dv-chip is-ok">Completed</span></div></div>
            <Toast show={seg(l, 2.6, 2.9) * (1 - seg(l, 5.4, 5.7))} title="Payment verified" sub="Your request is now being processed." tone="info" />
            <Toast show={seg(l, 6.2, 6.5)} title="Ready for pickup" sub="Thu, Oct 8 · 9:00 AM · Window 2" />
        </div>
    )
}

// ---- 6. Pickup -------------------------------------------------------------------------------
export function PickupScreen({ l }) {
    const items = ['A valid ID', 'Your Official Receipt', 'This request number']
    const claimed = l >= 5.5
    return (
        <div className="dv-screen">
            <Header title="Pickup Schedule" />
            <div className="dv-date" style={{ transform: `scale(${lerp(0.85, 1, outBack(seg(l, 0.6, 1.1)))})` }}>
                <span className="dv-date-cal"><small>OCT</small><b>8</b></span>
                <div><strong>Thursday · 9:00 AM</strong><small>Registrar’s Office · Window 2</small><small>Arrive by 8:30 AM</small></div>
            </div>
            <div className="dv-bring">
                <strong>What to bring</strong>
                {items.map((it, i) => (
                    <span key={it} className={l >= 1.5 + i * 0.7 ? 'is-on' : ''}><i>{l >= 1.5 + i * 0.7 ? <Check /> : ''}</i>{it}</span>
                ))}
            </div>
            <div className={`dv-claim${claimed ? ' is-on' : ''}`}>
                {claimed ? <><span><Check size={20} /></span><div><b>Claimed · request completed</b><small>Thank you! Your credential is QR-verifiable.</small></div></> : <small>Show this screen and your ID at the window.</small>}
            </div>
        </div>
    )
}

// ---- 7. Verify (employer’s phone) --------------------------------------------------------------
export function VerifyScreen({ l, qr }) {
    const scan = seg(l, 0.6, 3.0)
    const result = outBack(seg(l, 3.3, 3.8))
    return (
        <div className="dv-screen is-verify">
            <div className="dv-app-head"><img src={certichainLogo} alt="" /><strong>Verify a credential</strong><span /></div>
            <div className="dv-viewfinder">
                <div className="dv-vf-qr">{qr}</div>
                <i className="dv-vf-corner is-a" /><i className="dv-vf-corner is-b" /><i className="dv-vf-corner is-c" /><i className="dv-vf-corner is-d" />
                {scan > 0 && scan < 1 && <span className="dv-vf-line" style={{ top: `${10 + scan * 80}%` }} />}
            </div>
            <small className="dv-vf-hint">{l < 3.3 ? 'Point the camera at the QR code…' : 'Scanned'}</small>
            <div className="dv-result" style={{ transform: `translateY(${(1 - result) * 260}px)`, opacity: clamp(result * 2) }}>
                <span className="dv-result-ok"><Check size={22} /></span>
                <strong>Genuine credential</strong>
                <dl>
                    <dt>Name</dt><dd>Juan Dela Cruz</dd>
                    <dt>Document</dt><dd>Transcript of Records</dd>
                    <dt>Number</dt><dd>CERT-000124</dd>
                    <dt>Issued by</dt><dd>HCDC Registrar</dd>
                </dl>
                <span className="dv-chip is-ok">Signature valid</span>
            </div>
        </div>
    )
}
