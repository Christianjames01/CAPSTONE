import hcdcBackground from '../../assets/hcdc-background.png'
import footerBuilding from '../../assets/footer-building.jpg'
import { clamp, inOut, lerp, outBack, outExpo, seg } from './motion'

// The "real life" half of the demo: what the person is doing while the phone
// shows the app. Flat illustrated people over HCDC photos and offices.
// l = seconds into the scene, t = global time (for idle motion).

// A flat person. pose: 'phone' (looks at a phone held up), 'show' (holds an
// item out), 'give' (hands something across), 'stand'.
export function Person({ t, x, y, scale = 1, shirt = '#123B78', hair = '#2A1A12', skin = '#E0B48F', pose = 'phone', flip = false, item = null, glow = 0, dress = false }) {
    const breathe = 1 + Math.sin(t * 2.2 + x) * 0.012
    const nod = Math.sin(t * 1.3 + x) * 2
    const phoneArm = pose === 'phone'
    return (
        <svg className="dv-person" viewBox="0 0 200 420" style={{ left: x, top: y, width: 200 * scale, height: 420 * scale, transform: flip ? 'scaleX(-1)' : undefined }} aria-hidden="true">
            {/* legs */}
            <rect x="72" y="270" width="24" height="130" rx="12" fill="#1F2937" />
            <rect x="104" y="270" width="24" height="130" rx="12" fill="#1F2937" />
            <rect x="64" y="390" width="36" height="16" rx="8" fill="#111827" />
            <rect x="100" y="390" width="36" height="16" rx="8" fill="#111827" />
            <g style={{ transformOrigin: '100px 270px', transform: `scaleY(${breathe})` }}>
                {/* body */}
                {dress
                    ? <path d="M58 140 Q100 118 142 140 L156 290 Q100 304 44 290 Z" fill={shirt} />
                    : <rect x="56" y="126" width="88" height="160" rx="40" fill={shirt} />}
                <path d="M86 126 L100 150 L114 126" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="5" strokeLinejoin="round" />
                {/* back arm */}
                <rect x="138" y="138" width="22" height="104" rx="11" fill={shirt} style={{ transformOrigin: '149px 148px', transform: `rotate(${pose === 'give' ? -70 : pose === 'show' ? -55 : 8}deg)` }} />
                {/* front arm (holding) */}
                <g style={{ transformOrigin: '52px 148px', transform: `rotate(${phoneArm ? -28 : pose === 'stand' ? 6 : -10}deg)` }}>
                    <rect x="41" y="138" width="22" height="64" rx="11" fill={shirt} />
                    <g style={{ transformOrigin: '52px 196px', transform: `rotate(${phoneArm ? -95 : 0}deg)` }}>
                        <rect x="41" y="186" width="22" height="58" rx="11" fill={skin} />
                        {phoneArm && (
                            <g>
                                <rect x="38" y="226" width="30" height="50" rx="6" fill="#0F172A" />
                                <rect x="41" y="230" width="24" height="40" rx="3" fill={`rgba(125,179,255,${0.55 + glow * 0.45})`} />
                            </g>
                        )}
                    </g>
                </g>
                {/* head */}
                <g style={{ transformOrigin: '100px 110px', transform: `rotate(${phoneArm ? 10 + nod : nod}deg)` }}>
                    <rect x="90" y="96" width="20" height="24" rx="8" fill={skin} />
                    <circle cx="100" cy="70" r="36" fill={skin} />
                    <path d="M62 66 Q66 26 102 28 Q140 30 138 70 Q128 50 104 48 Q80 48 68 74 Z" fill={hair} />
                    <circle cx="112" cy="72" r="3.4" fill="#1F2937" />
                    <path d="M108 88 Q116 92 122 86" fill="none" stroke="#9A5B3E" strokeWidth="3" strokeLinecap="round" />
                </g>
            </g>
            {item}
        </svg>
    )
}

const Pin = () => (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" fill="currentColor" /><circle cx="12" cy="10" r="2.6" fill="#fff" /></svg>
)

// Photo background with a slow drone-like push.
function PhotoBg({ src, l, from = [1.08, 0, 0], to = [1.2, -40, -20] }) {
    const k = inOut(seg(l, 0, 10))
    return (
        <div className="dv-photo" style={{ backgroundImage: `url(${src})`, transform: `scale(${lerp(from[0], to[0], k)}) translate(${lerp(from[1], to[1], k)}px, ${lerp(from[2], to[2], k)}px)` }} />
    )
}

// An office counter with a sign and a staff member behind it.
function Counter({ t, sign, staffShirt = '#C8102E' }) {
    return (
        <>
            <div className="dv-office-wall" />
            <div className="dv-office-sign">{sign}</div>
            <div className="dv-office-window" />
            <Person t={t} x={470} y={250} scale={1.05} shirt={staffShirt} hair="#0F0A08" skin="#C68E66" pose="stand" flip />
            <div className="dv-office-counter" />
        </>
    )
}

// A floating notification bubble next to the person.
function Bubble({ show, x, y, title, sub }) {
    const k = outBack(show)
    if (show <= 0) return null
    return (
        <div className="dv-bubble" style={{ left: x, top: y, transform: `scale(${k})`, opacity: clamp(show * 2) }}>
            <span className="dv-bubble-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15ZM10 20.5a2 2 0 0 0 4 0" /></svg>
            </span>
            <div><b>{title}</b><small>{sub}</small></div>
        </div>
    )
}

export function Footage({ scene, l, t, qr }) {
    const id = scene.id
    const tapGlow = (at) => seg(l, at - 0.1, at) * (1 - seg(l, at, at + 0.5))

    let body = null
    if (id === 'login' || id === 'request') {
        const taps = id === 'login' ? [4.0, 5.8] : [1.2, 5.0, 6.2, 7.6]
        const glow = Math.max(0.3, ...taps.map(tapGlow))
        body = (
            <>
                <PhotoBg src={hcdcBackground} l={l} from={[1.15, 60, 0]} to={[1.28, -60, -10]} />
                <div className="dv-ground" />
                <Person t={t} x={330} y={300} scale={1.25} glow={glow} />
                {id === 'request' && <Bubble show={seg(l, 8.2, 8.6)} x={560} y={300} title="Request submitted" sub="REQ-000124" />}
            </>
        )
    } else if (id === 'requirements') {
        const flash = Math.max(seg(l, 1.55, 1.6) * (1 - seg(l, 1.6, 1.9)), seg(l, 6.15, 6.2) * (1 - seg(l, 6.2, 6.5)))
        const showClearance = l > 5
        body = (
            <>
                <PhotoBg src={footerBuilding} l={l} />
                <div className="dv-tint" />
                <div className="dv-desk" />
                <div className="dv-paper" style={{ left: showClearance ? 420 : 470, transform: `rotate(${showClearance ? -6 : 4}deg)` }}>
                    {showClearance
                        ? <><b>CLEARANCE FORM</b><i /><i /><i /><em>signed ✓</em></>
                        : <><b>HCDC · STUDENT ID</b><span className="dv-id-photo" /><i /><i /></>}
                </div>
                <Person t={t} x={170} y={210} scale={1.2} pose="phone" glow={0.5 + flash} />
                <span className="dv-camera-flash" style={{ opacity: flash }} />
            </>
        )
    } else if (id === 'payment') {
        const slide = inOut(seg(l, 0.6, 2.0))
        const flash = seg(l, 3.45, 3.5) * (1 - seg(l, 3.5, 3.8))
        body = (
            <>
                <Counter t={t} sign="HCDC FINANCE OFFICE · CASHIER" staffShirt="#1E8A5F" />
                <div className="dv-receipt" style={{ left: lerp(520, 300, slide), top: lerp(590, 600, slide), transform: `rotate(${lerp(8, -4, slide)}deg)` }}>
                    <small>HCDC Finance Office</small><b>Official Receipt</b><span>OR No. 0045128</span><em>₱150.00</em>
                </div>
                <Person t={t} x={90} y={300} scale={1.15} pose={l > 2.6 ? 'phone' : 'show'} glow={0.4 + flash} />
                <span className="dv-camera-flash" style={{ opacity: flash }} />
            </>
        )
    } else if (id === 'track') {
        body = (
            <>
                <PhotoBg src={footerBuilding} l={l} from={[1.25, 40, 30]} to={[1.1, -40, 0]} />
                <div className="dv-tint" />
                <div className="dv-ground" />
                <Person t={t} x={260} y={300} scale={1.25} glow={0.5} shirt="#123B78" />
                <Bubble show={seg(l, 2.6, 3.0)} x={540} y={250} title="Payment verified" sub="Now being processed" />
                <Bubble show={seg(l, 6.2, 6.6)} x={540} y={400} title="Ready for pickup" sub="Thu, Oct 8 · 9:00 AM" />
            </>
        )
    } else if (id === 'pickup') {
        const give = inOut(seg(l, 3.6, 5.0))
        const idShow = seg(l, 1.6, 2.2) * (1 - seg(l, 3.4, 3.8))
        body = (
            <>
                <Counter t={t} sign="REGISTRAR’S OFFICE · WINDOW 2" />
                <div className="dv-cert" style={{ left: lerp(520, 300, give), top: lerp(560, 585, give), transform: `rotate(${lerp(-6, 3, give)}deg)` }}>
                    <b>TRANSCRIPT OF RECORDS</b><i /><i /><i /><span className="dv-cert-seal" /><span className="dv-cert-qr" />
                </div>
                <Person t={t} x={90} y={300} scale={1.15} pose={idShow > 0 ? 'show' : give > 0.6 ? 'give' : 'stand'} />
                {idShow > 0 && <div className="dv-idcard" style={{ opacity: idShow }}><b>STUDENT ID</b><span className="dv-id-photo" /></div>}
                {l > 5.5 && <span className="dv-confetti" style={{ opacity: 1 - seg(l, 7.5, 9) }}>{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ '--i': i }} />)}</span>}
            </>
        )
    } else if (id === 'verify') {
        const scan = seg(l, 0.6, 3.0)
        body = (
            <>
                <div className="dv-office-wall is-hr" />
                <div className="dv-office-sign is-hr">HR DEPARTMENT · EMPLOYMENT</div>
                <div className="dv-desk is-hr" />
                <div className="dv-cert is-flat" style={{ left: 330, top: 640 }}>
                    <b>TRANSCRIPT OF RECORDS</b><i /><i /><span className="dv-cert-qr is-big">{qr}</span>
                </div>
                <Person t={t} x={430} y={190} scale={1.2} pose="phone" shirt="#374151" hair="#3B2416" skin="#D9A57E" dress glow={0.4 + scan * 0.4} flip />
                {scan > 0 && scan < 1 && <span className="dv-scan-cone" style={{ opacity: 0.6 }} />}
                {l > 3.4 && <span className="dv-big-check" style={{ transform: `scale(${outBack(seg(l, 3.4, 3.9))})` }}>✓</span>}
            </>
        )
    }

    const enter = outExpo(seg(l, 0, 0.6))
    return (
        <div className="dv-footage" style={{ opacity: enter }}>
            {body}
            {scene.place && (
                <div className="dv-place" style={{ transform: `translateX(${(1 - outExpo(seg(l, 0.3, 0.9))) * -60}px)`, opacity: seg(l, 0.3, 0.7) }}>
                    <Pin />{scene.place}
                </div>
            )}
        </div>
    )
}
