import { useEffect, useRef, useState } from 'react'
import certichainLogo from '../../assets/certichain-logo.png'
import { QrMark } from '../../components/explainer/parts'
import { createWorkflowAudio } from '../workflow/workflowAudio'
import { speakLine, stopVoice } from '../showreel/reelVoice'
import { DURATION, SCENES, STEP_COUNT, sceneAt } from './timeline'
import { clamp, lerp, outBack, outExpo, seg } from './motion'
import { LoginScreen, PaymentScreen, PickupScreen, RequestScreen, RequirementsScreen, TrackScreen, VerifyScreen } from './PhoneScreens'
import { Footage } from './Footage'
import './DemoVideo.css'

// CertiChain animated demo video (/demo-video), in the style of a capstone
// app demo: logo intro, then a split screen -- the app on a phone (left) and
// the person using it in real life (right) -- step by step, with a female
// voice-over, captions, music and sound effects, then a logo outro.
// 1920x1080 stage scaled to fit. ?t=30 freezes a frame.

const SCREENS = {
    login: LoginScreen,
    request: RequestScreen,
    requirements: RequirementsScreen,
    payment: PaymentScreen,
    track: TrackScreen,
    pickup: PickupScreen,
}

function LogoCard({ l, outro }) {
    const pop = outBack(seg(l, 0.2, 0.9))
    const ring = seg(l, 0.3, 1.6)
    const word = 'CERTICHAIN'
    return (
        <div className="dv-logo-card">
            {[0, 1].map((i) => {
                const r = outExpo(clamp(ring * 1.2 - i * 0.25))
                return <span key={i} className="dv-logo-ring" style={{ transform: `translate(-50%, -50%) scale(${0.3 + r * 2})`, opacity: (1 - r) * 0.7 }} />
            })}
            <div className="dv-logo-badge" style={{ transform: `scale(${pop}) rotate(${(1 - pop) * -30}deg)` }}>
                <img src={certichainLogo} alt="Holy Cross of Davao College" />
            </div>
            <div className="dv-logo-word">
                {[...word].map((ch, i) => {
                    const k = outExpo(seg(l, 0.9 + i * 0.05, 1.4 + i * 0.05))
                    return <span key={i} className={i >= 5 ? 'is-blue' : ''} style={{ opacity: k, transform: `translateY(${(1 - k) * 60}px)` }}>{ch}</span>
                })}
            </div>
            <div className="dv-logo-tag" style={{ opacity: seg(l, 1.8, 2.3) }}>
                {outro ? 'Your records, verified and provable.' : 'Online Registrar · Holy Cross of Davao College'}
            </div>
            {outro && (
                <div className="dv-logo-url" style={{ opacity: seg(l, 2.4, 2.8) }}>onlineregistrar.vercel.app</div>
            )}
            {!outro && (
                <div className="dv-logo-sub" style={{ opacity: seg(l, 2.6, 3.0), transform: `translateY(${(1 - outExpo(seg(l, 2.6, 3.2))) * 20}px)` }}>
                    Student demo · request to release in 7 steps
                </div>
            )}
        </div>
    )
}

function Frame({ t }) {
    const scene = sceneAt(t)
    const l = t - scene.a
    const out = seg(l, scene.b - scene.a - 0.35, scene.b - scene.a)
    const qr = <QrMark size={150} />

    if (scene.id === 'intro' || scene.id === 'outro') {
        return (
            <div className="dv-frame is-logo" style={{ opacity: scene.id === 'outro' ? 1 - seg(t, DURATION - 0.6, DURATION) : 1 - out }}>
                <div className="dv-logo-bg" />
                <LogoCard l={l} outro={scene.id === 'outro'} />
            </div>
        )
    }

    const Screen = SCREENS[scene.id]
    const enter = outExpo(seg(l, 0, 0.5))
    return (
        <div className="dv-frame">
            <div className="dv-bg" />

            <header className="dv-top">
                <div className="dv-brand"><img src={certichainLogo} alt="" /><span><b>CertiChain</b><small>Student demo</small></span></div>
                <div className="dv-step" key={scene.id}>
                    <span className="dv-step-num">Step {scene.step} of {STEP_COUNT}</span>
                    <strong>{scene.title}</strong>
                </div>
                <ol className="dv-dots" aria-hidden="true">
                    {Array.from({ length: STEP_COUNT }, (_, i) => <li key={i} className={i + 1 < scene.step ? 'is-done' : i + 1 === scene.step ? 'is-now' : ''} />)}
                </ol>
            </header>

            <div className="dv-phone-wrap" style={{ transform: `translateY(${(1 - enter) * 40}px) rotate(${lerp(-2, 0, enter)}deg) scale(0.9)`, opacity: 1 - out * 0.6 }}>
                <div className="dv-phone">
                    <span className="dv-notch" />
                    <div className="dv-status"><b>9:41</b><span>▮▮▮ ◢ ▬</span></div>
                    {scene.id === 'verify' ? <VerifyScreen l={l} qr={qr} /> : <Screen l={l} />}
                </div>
                <span className="dv-phone-label">{scene.id === 'verify' ? 'The employer’s phone' : 'The student’s phone'}</span>
            </div>

            <div className="dv-right" style={{ opacity: 1 - out * 0.6 }}>
                <Footage scene={scene} l={l} t={t} qr={<QrMark size={120} />} />
            </div>

            <Caption scene={scene} l={l} />
        </div>
    )
}

function Caption({ scene, l }) {
    if (!scene.voice) return null
    const len = scene.b - scene.a
    const k = seg(l, scene.voice.at, scene.voice.at + 0.3) * (1 - seg(l, len - 0.5, len - 0.2))
    if (k <= 0) return null
    return <div className="dv-caption" style={{ opacity: k }}>{scene.voice.text}</div>
}

const FROZEN = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('t') : null

function DemoVideo() {
    const [t, setT] = useState(FROZEN !== null ? Number(FROZEN) : 0)
    const [playing, setPlaying] = useState(false)
    const [started, setStarted] = useState(FROZEN !== null)
    const [soundOn, setSoundOn] = useState(true)
    const [scale, setScale] = useState(1)
    const tRef = useRef(t)
    const audioRef = useRef(null)
    const soundRef = useRef(true)
    const firedRef = useRef(new Set())

    useEffect(() => { soundRef.current = soundOn }, [soundOn])

    useEffect(() => {
        document.title = 'CertiChain · Demo Video'
        const fit = () => setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080))
        fit()
        window.addEventListener('resize', fit)
        return () => window.removeEventListener('resize', fit)
    }, [])

    useEffect(() => () => { stopVoice(); audioRef.current?.dispose() }, [])

    // Fire voice lines and sound cues the playhead just crossed.
    const fireBetween = (from, to) => {
        if (!soundRef.current) return
        for (const s of SCENES) {
            const v = s.voice
            if (v) {
                const at = s.a + v.at
                const key = `v-${s.id}`
                if (at > from && at <= to && !firedRef.current.has(key)) {
                    firedRef.current.add(key)
                    speakLine(v.text, {
                        onStart: () => audioRef.current?.setDucked(true),
                        onEnd: () => audioRef.current?.setDucked(false),
                    })
                }
            }
            s.cues?.forEach(([c, name], i) => {
                const at = s.a + c
                const key = `c-${s.id}-${i}`
                if (at > from && at <= to && !firedRef.current.has(key)) {
                    firedRef.current.add(key)
                    audioRef.current?.play(name)
                }
            })
        }
    }

    useEffect(() => {
        if (!playing) return undefined
        let frame
        let last = performance.now()
        const tick = (now) => {
            const dt = Math.min(0.1, (now - last) / 1000)
            last = now
            const prev = tRef.current
            let next = prev + dt
            if (next >= DURATION) {
                setPlaying(false)
                audioRef.current?.pause()
                tRef.current = DURATION - 0.001
                setT(DURATION - 0.001)
                return
            }
            fireBetween(prev, next)
            tRef.current = next
            setT(next)
            frame = requestAnimationFrame(tick)
        }
        frame = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(frame)
    }, [playing])

    const seek = (time) => {
        stopVoice()
        firedRef.current = new Set()
        // Mark everything before the new time as already played.
        fireMarkBefore(time)
        tRef.current = time
        setT(time)
    }

    const fireMarkBefore = (time) => {
        for (const s of SCENES) {
            if (s.voice && s.a + s.voice.at < time - 0.05) firedRef.current.add(`v-${s.id}`)
            s.cues?.forEach(([c], i) => { if (s.a + c < time - 0.05) firedRef.current.add(`c-${s.id}-${i}`) })
        }
    }

    const start = async () => {
        if (!audioRef.current) audioRef.current = createWorkflowAudio()
        audioRef.current?.setMusic(soundOn)
        audioRef.current?.setSfx(soundOn)
        if (soundOn) await audioRef.current?.start()
        setStarted(true)
        seek(0)
        setPlaying(true)
    }

    const togglePlay = async () => {
        if (!started) return start()
        if (tRef.current >= DURATION - 0.01) {
            seek(0)
            if (soundOn) await audioRef.current?.start()
            setPlaying(true)
            return
        }
        const next = !playing
        setPlaying(next)
        if (!next) { stopVoice(); audioRef.current?.pause() }
        else if (soundOn) await audioRef.current?.start()
    }

    const toggleSound = async () => {
        const next = !soundOn
        setSoundOn(next)
        soundRef.current = next
        if (!audioRef.current) audioRef.current = createWorkflowAudio()
        audioRef.current?.setMusic(next)
        audioRef.current?.setSfx(next)
        if (!next) stopVoice()
        else if (playing) await audioRef.current?.start()
    }

    const jump = async (s) => {
        if (!started) await start()
        seek(s.a)
        setPlaying(true)
        if (soundOn) audioRef.current?.start()
    }

    useEffect(() => {
        const onKey = (e) => {
            if (e.code === 'Space') { e.preventDefault(); togglePlay() }
            else if (e.key === 'ArrowRight') { const i = SCENES.indexOf(sceneAt(tRef.current)); if (SCENES[i + 1]) jump(SCENES[i + 1]) }
            else if (e.key === 'ArrowLeft') { const s = sceneAt(tRef.current); const i = SCENES.indexOf(s); jump(tRef.current - s.a > 1.5 || i === 0 ? s : SCENES[i - 1]) }
            else if (e.key === 'f' || e.key === 'F') {
                if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {})
                else document.exitFullscreen?.()
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    })

    const current = sceneAt(t)

    return (
        <div className="dv-root">
            <div className="dv-stage" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
                <Frame t={t} />
            </div>

            {!started && (
                <div className="dv-start">
                    <div className="dv-start-card">
                        <img src={certichainLogo} alt="" />
                        <h1>CertiChain Demo Video</h1>
                        <p>How a student requests, pays for, tracks, claims and verifies an academic document — about 80 seconds, with voice-over.</p>
                        <button type="button" onClick={start}>▶ Play demo</button>
                        <small>Space pause · ← → chapters · F full screen</small>
                    </div>
                </div>
            )}

            <div className="dv-controls" role="toolbar" aria-label="Video controls">
                <button type="button" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>{playing ? '❚❚' : '▶'}</button>
                <button type="button" onClick={toggleSound} className={soundOn ? 'is-on' : ''} aria-pressed={soundOn}>{soundOn ? 'Voice + sound on' : 'Sound off'}</button>
                <div className="dv-chapters">
                    {SCENES.map((s) => (
                        <button
                            type="button"
                            key={s.id}
                            className={s === current ? 'is-now' : t >= s.b ? 'is-done' : ''}
                            style={{ flexGrow: s.b - s.a }}
                            onClick={() => jump(s)}
                            title={s.title || (s.id === 'intro' ? 'Intro' : 'Outro')}
                        >
                            <b style={{ transform: `scaleX(${clamp((t - s.a) / (s.b - s.a))})` }} />
                        </button>
                    ))}
                </div>
                <span className="dv-time">{Math.floor(t / 60)}:{String(Math.floor(t % 60)).padStart(2, '0')} / {Math.floor(DURATION / 60)}:{String(DURATION % 60).padStart(2, '0')}</span>
            </div>
        </div>
    )
}

export default DemoVideo
