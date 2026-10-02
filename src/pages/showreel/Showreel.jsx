import { useEffect, useRef, useState } from 'react'
import { createReelAudio } from './reelAudio'
import './Showreel.css'

// CertiChain showreel: an 18-second, beat-synced (120 BPM) motion graphics
// loop, rendered live from one timeline (no video file). Designed on a
// 1920x1080 stage scaled to fit. ?t=7.5 freezes a frame (for stills).
//
//  0.0  Kinetic type      YOUR RECORDS, / VERIFIED.
//  2.5  Logo build        certificate + seal link draw, check, wordmark
//  5.5  The journey       five steps, camera whip-pan
//  9.5  Proof             QR assembles, scan, SIGNATURE VALID
// 12.5  Word storm        NO LINES. NO REPEAT VISITS. REQUEST. TRACK. VERIFY.
// 15.0  End card          lockup, tagline, URL

const DURATION = 18
const BEAT = 0.5
const CUTS = [2.5, 5.5, 9.5, 12.5, 15]

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
const seg = (t, a, b) => clamp((t - a) / (b - a))
const outExpo = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x))
const inOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
const outBack = (x) => {
    const c1 = 1.9
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}
const inExpo = (x) => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10))
const lerp = (a, b, k) => a + (b - a) * k

// Deterministic pseudo-random.
const rand = (i) => {
    const x = Math.sin(i * 127.1 + 311.7) * 43758.5453
    return x - Math.floor(x)
}

// QR-like 21x21 pattern with finder squares.
const QR_N = 21
const QR = (() => {
    const cells = []
    for (let y = 0; y < QR_N; y++) {
        for (let x = 0; x < QR_N; x++) {
            let on
            const finder = [[0, 0], [14, 0], [0, 14]].find(([fx, fy]) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7)
            if (finder) {
                const dx = x - finder[0]
                const dy = y - finder[1]
                const ring = Math.min(dx, dy, 6 - dx, 6 - dy)
                on = ring === 0 || ring >= 2
            } else {
                on = rand(x * 31 + y * 7) < 0.47
            }
            if (on) cells.push({ x, y, i: cells.length })
        }
    }
    return cells
})()

const PARTICLES = Array.from({ length: 46 }, (_, i) => ({
    x: rand(i) * 1920,
    y: rand(i + 99) * 1080,
    s: 2 + rand(i + 7) * 5,
    v: 20 + rand(i + 3) * 70,
    hue: rand(i + 11) < 0.25 ? 'gold' : rand(i + 13) < 0.5 ? 'red' : 'blue',
}))

// ---- The mark, drawn with progress values -------------------------------------
function Mark({ size, cert = 1, lines = 1, link = 1, ribbons = 1, check = 1, light = false }) {
    const ink = light ? '#FFFFFF' : '#0B2A5B'
    const blue = light ? '#7DB3FF' : '#2563EB'
    const gold = light ? '#F2C75C' : '#C9A23A'
    const dash = (p) => ({ strokeDasharray: 1, strokeDashoffset: 1 - p })
    return (
        <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
            <defs>
                <mask id="rm-a" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64"><rect width="64" height="64" fill="#fff" /><rect x="37" y="15.6" width="6" height="8.8" fill="#000" /></mask>
                <mask id="rm-b" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64"><rect width="64" height="64" fill="#fff" /><rect x="27" y="33.6" width="6" height="8.8" fill="#000" /></mask>
            </defs>
            <rect x="4" y="8" width="36" height="30" rx="7" fill="none" stroke={ink} strokeWidth="5" pathLength="1" mask="url(#rm-a)" style={dash(cert)} />
            <path d="M11 16.5H25M11 23H23M11 29.5H19" fill="none" stroke={blue} strokeWidth="3.6" strokeLinecap="round" pathLength="1" style={dash(lines)} />
            <rect x="30" y="20" width="28" height="28" rx="9" fill="none" stroke={blue} strokeWidth="5" pathLength="1" mask="url(#rm-b)" style={dash(link)} />
            <g style={{ transformOrigin: '44px 50px', transform: `scaleY(${ribbons})`, opacity: ribbons > 0 ? 1 : 0 }}>
                <path d="M36.5 50.5 34.5 61 38.4 58.6 41.6 61 42.2 50.5ZM51.5 50.5 53.5 61 49.6 58.6 46.4 61 45.8 50.5Z" fill={blue} />
            </g>
            <path d="M38.4 34.6 42.4 38.6 49.8 30.8" fill="none" stroke={gold} strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" pathLength="1" style={dash(check)} />
        </svg>
    )
}

const Word = ({ text, t, start, step = 0.045, className = '' }) => (
    <span className={`rl-word ${className}`}>
        {[...text].map((ch, i) => {
            const k = outBack(seg(t, start + i * step, start + i * step + 0.42))
            return (
                <span key={i} style={{ opacity: clamp(k * 1.4), transform: `translateY(${(1 - k) * 110}%) rotate(${(1 - k) * 8}deg)` }}>
                    {ch === ' ' ? ' ' : ch}
                </span>
            )
        })}
    </span>
)

const STEPS = [
    { n: '01', label: 'Request', sub: 'Pick a document', icon: 'doc' },
    { n: '02', label: 'Requirements', sub: 'Upload a photo or PDF', icon: 'up' },
    { n: '03', label: 'Pay', sub: 'Official Receipt, uploaded', icon: 'peso' },
    { n: '04', label: 'Review', sub: 'Registrar checks it live', icon: 'eye' },
    { n: '05', label: 'Pick up', sub: 'Date, time, window', icon: 'cal' },
]

const ICONS = {
    doc: <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM14 3v4h4M9 12h6M9 15.5h6" />,
    up: <path d="M12 16V5M7 10l5-5 5 5M5 19h14" />,
    peso: <path d="M8 20V4h5a4 4 0 0 1 0 8H8M5 8h12M5 11h12" />,
    eye: <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12ZM12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Z" />,
    cal: <path d="M4 6.5h16V20H4zM4 10.5h16M8.5 3.5v5M15.5 3.5v5" />,
}

const STORM = [
    { text: 'NO LINES.', bg: '#C8102E', fg: '#FFFFFF' },
    { text: 'NO REPEAT VISITS.', bg: '#0B2A5B', fg: '#FFFFFF' },
    { text: 'REQUEST.', bg: '#F6F1E4', fg: '#0B2A5B' },
    { text: 'TRACK.', bg: '#2563EB', fg: '#FFFFFF' },
    { text: 'VERIFY.', bg: '#C9A23A', fg: '#0B2A5B' },
]

// ---- Frame ----------------------------------------------------------------------
function Frame({ t }) {
    // Beat pulse (0..1, decays after each beat).
    const beatPhase = (t % BEAT) / BEAT
    const pulse = Math.pow(1 - beatPhase, 3)

    // Camera shake on hits.
    const hit = CUTS.reduce((m, c) => Math.max(m, t >= c && t < c + 0.35 ? 1 - (t - c) / 0.35 : 0), 0)
    const shake = hit * 10
    const camera = `translate(${Math.sin(t * 90) * shake}px, ${Math.cos(t * 77) * shake}px)`

    return (
        <div className="rl-frame" style={{ transform: camera }}>
            {/* Background: drifting blobs + perspective grid */}
            <div className="rl-bg" style={{ '--p': pulse }}>
                <span className="rl-blob is-red" style={{ transform: `translate(${Math.sin(t * 0.6) * 160}px, ${Math.cos(t * 0.5) * 90}px)` }} />
                <span className="rl-blob is-blue" style={{ transform: `translate(${Math.cos(t * 0.45) * 200}px, ${Math.sin(t * 0.7) * 120}px)` }} />
                <span className="rl-blob is-gold" style={{ transform: `translate(${Math.sin(t * 0.8 + 2) * 140}px, ${Math.cos(t * 0.6 + 1) * 140}px)` }} />
                <div className="rl-grid" style={{ backgroundPosition: `0 ${(t * 120) % 80}px` }} />
            </div>

            <div className="rl-particles">
                {PARTICLES.map((p, i) => {
                    const y = (p.y - t * p.v) % 1080
                    return <i key={i} className={`is-${p.hue}`} style={{ left: p.x, top: y < 0 ? y + 1080 : y, width: p.s, height: p.s }} />
                })}
            </div>

            <SceneKinetic t={t} />
            <SceneLogo t={t} />
            <SceneJourney t={t} />
            <SceneProof t={t} />
            <SceneStorm t={t} />
            <SceneEnd t={t} />

            {/* Transition wipes at each cut */}
            {CUTS.map((c) => {
                const k = seg(t, c - 0.32, c + 0.32)
                if (k <= 0 || k >= 1) return null
                return (
                    <div key={c} className="rl-wipe">
                        {['#C8102E', '#C9A23A', '#2563EB', '#0B2A5B'].map((col, i) => {
                            const local = clamp(k * 1.35 - i * 0.09)
                            const x = lerp(-130, 130, inOut(local))
                            return <span key={col} style={{ background: col, transform: `translateX(${x}%) skewX(-18deg)` }} />
                        })}
                    </div>
                )
            })}

            {/* Flash frames on the hits */}
            <div className="rl-flash" style={{ opacity: hit * 0.35 }} />
            <div className="rl-vignette" />
        </div>
    )
}

function SceneKinetic({ t }) {
    if (t > 2.75) return null
    const out = inExpo(seg(t, 2.2, 2.6))
    const ring = seg(t, 1.15, 2.2)
    return (
        <div className="rl-scene rl-kinetic" style={{ transform: `scale(${1 + out * 2.2})`, opacity: 1 - out, filter: `blur(${out * 12}px)` }}>
            {[0, 1, 2].map((i) => {
                const r = outExpo(clamp(ring * 1.3 - i * 0.18))
                return <span key={i} className="rl-ring" style={{ transform: `translate(-50%, -50%) scale(${0.2 + r * 2.4})`, opacity: (1 - r) * 0.8 }} />
            })}
            <div className="rl-k-line">
                {['YOUR', 'RECORDS,'].map((w, i) => {
                    const k = outExpo(seg(t, 0.12 + i * 0.32, 0.5 + i * 0.32))
                    return (
                        <span key={w} className="rl-k-slam" style={{ opacity: k, transform: `scale(${lerp(2.6, 1, k)})`, filter: `blur(${(1 - k) * 18}px)` }}>
                            {w}
                        </span>
                    )
                })}
            </div>
            <Word text="VERIFIED." t={t} start={1.0} step={0.05} className="rl-k-gold" />
            <div className="rl-k-bar" style={{ transform: `scaleX(${outExpo(seg(t, 1.45, 2.0))})` }} />
        </div>
    )
}

function SceneLogo({ t }) {
    if (t < 2.25 || t > 5.85) return null
    const exit = inOut(seg(t, 5.15, 5.65))
    const pop = outBack(seg(t, 4.0, 4.35))
    const glow = seg(t, 4.0, 4.3) * (1 - seg(t, 4.3, 5.0))
    return (
        <div className="rl-scene rl-logo" style={{ transform: `translateY(${-exit * 140}px) scale(${1 - exit * 0.25})`, opacity: 1 - exit }}>
            <div className="rl-logo-mark" style={{ transform: `scale(${0.92 + pop * 0.08}) rotate(${(1 - seg(t, 2.5, 3.4)) * -12}deg)` }}>
                <span className="rl-logo-glow" style={{ opacity: glow }} />
                <Mark
                    size={360}
                    light
                    cert={outExpo(seg(t, 2.55, 3.35))}
                    lines={outExpo(seg(t, 3.15, 3.6))}
                    link={outExpo(seg(t, 3.35, 4.0))}
                    ribbons={outBack(seg(t, 3.85, 4.2))}
                    check={outExpo(seg(t, 3.95, 4.35))}
                />
            </div>
            <div className="rl-logo-word">
                <Word text="CERTI" t={t} start={4.2} step={0.04} />
                <Word text="CHAIN" t={t} start={4.4} step={0.04} className="is-blue" />
            </div>
            <div className="rl-logo-tag" style={{ opacity: seg(t, 4.75, 5.05), letterSpacing: `${lerp(0.9, 0.32, outExpo(seg(t, 4.75, 5.3)))}em` }}>
                ONLINE REGISTRAR · HOLY CROSS OF DAVAO COLLEGE
            </div>
        </div>
    )
}

function SceneJourney({ t }) {
    if (t < 5.25 || t > 9.85) return null
    const enter = outExpo(seg(t, 5.4, 6.0))
    const exit = inExpo(seg(t, 9.25, 9.7))
    // Camera pans card to card, with a whip between.
    const pos = clamp((t - 5.9) / 0.62, 0, 4)
    const whole = Math.floor(pos)
    const frac = pos - whole
    const eased = whole + inOut(clamp((frac - 0.45) / 0.55))
    const speed = Math.abs(Math.sin(Math.PI * clamp((frac - 0.45) / 0.55)))
    const fill = clamp((t - 5.9) / (0.62 * 4))
    return (
        <div className="rl-scene rl-journey" style={{ opacity: 1 - exit, transform: `scale(${1 + exit * 0.4})` }}>
            <div className="rl-j-title" style={{ transform: `translateX(${(1 - enter) * -120}px)`, opacity: enter }}>
                <span className="rl-j-big">5 STEPS.</span>
                <span className="rl-j-small">From request to release — all online.</span>
            </div>
            <div className="rl-j-track" style={{ transform: `translateX(${-eased * 560}px) skewX(${-speed * 9}deg)`, filter: `blur(${speed * 3}px)` }}>
                <div className="rl-j-line"><b style={{ transform: `scaleX(${fill})` }} /></div>
                {STEPS.map((s, i) => {
                    const active = Math.round(pos) === i
                    const appear = outBack(seg(t, 5.55 + i * 0.08, 5.95 + i * 0.08))
                    return (
                        <div key={s.n} className={`rl-j-card${active ? ' is-active' : ''}${pos >= i + 0.5 ? ' is-done' : ''}`} style={{ transform: `translateY(${(1 - appear) * 160}px) scale(${active ? 1.08 : 0.9})`, opacity: appear }}>
                            <span className="rl-j-num">{s.n}</span>
                            <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{ICONS[s.icon]}</svg>
                            <strong>{s.label}</strong>
                            <small>{s.sub}</small>
                            <span className="rl-j-dot" />
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

function SceneProof({ t }) {
    if (t < 9.25 || t > 12.85) return null
    const exit = inExpo(seg(t, 12.2, 12.65))
    const assemble = seg(t, 9.5, 10.75)
    const scan = seg(t, 10.85, 11.6)
    const stamp = outBack(seg(t, 11.6, 11.9))
    const typed = Math.floor(seg(t, 11.75, 12.2) * 'CERT-000124'.length)
    const cell = 22
    return (
        <div className="rl-scene rl-proof" style={{ opacity: 1 - exit, transform: `rotate(${exit * 6}deg) scale(${1 - exit * 0.2})` }}>
            <div className="rl-qr" style={{ width: QR_N * cell, height: QR_N * cell }}>
                {QR.map((c) => {
                    const delay = (c.i % 37) / 37 * 0.45 + rand(c.i) * 0.2
                    const k = outExpo(clamp((assemble - delay) / 0.4))
                    const fx = (rand(c.i + 5) - 0.5) * 1800
                    const fy = (rand(c.i + 9) - 0.5) * 1100
                    return (
                        <i
                            key={c.i}
                            style={{
                                left: c.x * cell,
                                top: c.y * cell,
                                width: cell,
                                height: cell,
                                opacity: k,
                                transform: `translate(${(1 - k) * fx}px, ${(1 - k) * fy}px) rotate(${(1 - k) * 220}deg) scale(${lerp(2.2, 1, k)})`,
                                background: scan > 0 && Math.abs(c.y / QR_N - scan) < 0.08 ? '#7DB3FF' : undefined,
                            }}
                        />
                    )
                })}
                {scan > 0 && scan < 1 && <span className="rl-scan" style={{ top: `${scan * 100}%` }} />}
            </div>
            <div className="rl-proof-side">
                <div className="rl-proof-label" style={{ opacity: seg(t, 9.6, 9.9), transform: `translateX(${(1 - outExpo(seg(t, 9.6, 10.1))) * 80}px)` }}>
                    Every credential carries a signed QR code.
                </div>
                <div className="rl-stamp" style={{ transform: `scale(${lerp(2.4, 1, stamp)}) rotate(${-8 + stamp * 4}deg)`, opacity: clamp(stamp * 2) }}>
                    <span>✓</span> SIGNATURE VALID
                </div>
                <div className="rl-cert-no">{'CERT-000124'.slice(0, typed)}<b style={{ opacity: Math.floor(t * 4) % 2 }}>▍</b></div>
            </div>
        </div>
    )
}

function SceneStorm({ t }) {
    if (t < 12.4 || t > 15.1) return null
    const local = t - 12.55
    if (local < 0) return null
    const per = 0.5
    const idx = Math.min(STORM.length - 1, Math.floor(local / per))
    const w = STORM[idx]
    const k = outExpo(seg(local, idx * per, idx * per + 0.22))
    const prev = idx > 0 ? STORM[idx - 1] : null
    return (
        <div className="rl-scene rl-storm" style={{ background: prev ? prev.bg : 'transparent' }}>
            <div className="rl-storm-panel" style={{ background: w.bg, clipPath: `inset(0 ${(1 - k) * 100}% 0 0)` }}>
                <span className="rl-storm-text" style={{ color: w.fg, transform: `scale(${lerp(1.35, 1, k)}) translateX(${(1 - k) * 80}px)`, letterSpacing: `${lerp(0.3, -0.02, k)}em` }}>
                    {w.text}
                </span>
                <span className="rl-storm-ghost" style={{ color: w.fg }}>{w.text}</span>
            </div>
        </div>
    )
}

function SceneEnd({ t }) {
    if (t < 14.7) return null
    const enter = outExpo(seg(t, 15.0, 15.7))
    const fadeOut = seg(t, DURATION - 0.45, DURATION)
    const draw = (a, b) => outExpo(seg(t, a, b))
    return (
        <div className="rl-scene rl-end" style={{ opacity: clamp(seg(t, 14.95, 15.2)) * (1 - fadeOut) }}>
            <div className="rl-end-lockup" style={{ transform: `scale(${lerp(0.7, 1, enter)})` }}>
                <Mark size={220} light cert={draw(15.0, 15.5)} lines={draw(15.3, 15.6)} link={draw(15.35, 15.8)} ribbons={outBack(seg(t, 15.7, 16.0))} check={draw(15.8, 16.1)} />
                <div className="rl-end-word">
                    <Word text="CERTI" t={t} start={15.45} step={0.035} />
                    <Word text="CHAIN" t={t} start={15.62} step={0.035} className="is-blue" />
                </div>
            </div>
            <div className="rl-end-tag">
                <Word text="Your records, verified and provable." t={t} start={16.1} step={0.018} />
            </div>
            <div className="rl-end-url" style={{ opacity: seg(t, 16.6, 16.9), transform: `translateY(${(1 - outExpo(seg(t, 16.6, 17.1))) * 30}px)` }}>
                onlineregistrar.vercel.app
            </div>
        </div>
    )
}

// ---- Page -------------------------------------------------------------------------
const FROZEN = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('t') : null

function Showreel() {
    const [t, setT] = useState(FROZEN !== null ? Number(FROZEN) : 0)
    const [playing, setPlaying] = useState(FROZEN === null)
    const [soundOn, setSoundOn] = useState(false)
    const [scale, setScale] = useState(1)
    const audioRef = useRef(null)
    const tRef = useRef(t)

    useEffect(() => {
        document.title = 'CertiChain · Showreel'
        const fit = () => setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080))
        fit()
        window.addEventListener('resize', fit)
        return () => window.removeEventListener('resize', fit)
    }, [])

    useEffect(() => {
        if (!playing) return undefined
        let frame
        let last = performance.now()
        const tick = (now) => {
            const dt = Math.min(0.1, (now - last) / 1000)
            last = now
            let next = tRef.current + dt
            if (next >= DURATION) {
                next -= DURATION
                audioRef.current?.restart(next)
            }
            tRef.current = next
            setT(next)
            frame = requestAnimationFrame(tick)
        }
        frame = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(frame)
    }, [playing])

    useEffect(() => () => audioRef.current?.dispose(), [])

    const togglePlay = () => {
        const next = !playing
        setPlaying(next)
        if (!next) audioRef.current?.stop()
        else if (soundOn) audioRef.current?.restart(tRef.current)
    }

    const replay = () => {
        tRef.current = 0
        setT(0)
        setPlaying(true)
        if (soundOn) audioRef.current?.restart(0)
    }

    const toggleSound = async () => {
        if (soundOn) {
            audioRef.current?.stop()
            setSoundOn(false)
            return
        }
        if (!audioRef.current) audioRef.current = createReelAudio({ duration: DURATION, beat: BEAT, cuts: CUTS })
        if (!audioRef.current) return
        await audioRef.current.restart(tRef.current)
        setSoundOn(true)
    }

    useEffect(() => {
        const onKey = (e) => {
            if (e.code === 'Space') { e.preventDefault(); togglePlay() }
            if (e.key === 'r' || e.key === 'R') replay()
            if (e.key === 'm' || e.key === 'M') toggleSound()
            if (e.key === 'f' || e.key === 'F') {
                if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {})
                else document.exitFullscreen?.()
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    })

    return (
        <div className="rl-root">
            <div className="rl-stage" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
                <Frame t={t} />
            </div>

            <div className="rl-controls" role="toolbar" aria-label="Showreel controls">
                <button type="button" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>{playing ? '❚❚' : '▶'}</button>
                <button type="button" onClick={replay} aria-label="Replay">↻</button>
                <button type="button" onClick={toggleSound} className={soundOn ? 'is-on' : ''} aria-pressed={soundOn}>{soundOn ? 'Sound on' : 'Sound off'}</button>
                <span className="rl-time">{t.toFixed(1)}s / {DURATION}s</span>
                <span className="rl-progress"><b style={{ transform: `scaleX(${t / DURATION})` }} /></span>
            </div>
        </div>
    )
}

export default Showreel
