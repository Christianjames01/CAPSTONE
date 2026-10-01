import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FLOW, SHOTS, STEPS } from './shots'
import { createWorkflowScene } from './workflowScene'
import { createWorkflowAudio } from './workflowAudio'
import { availableVoices, createNarrator, isNaturalVoice, recordingsAvailable, whenVoicesReady } from './workflowNarration'
import certichainLogo from '../../assets/certichain-logo.png'
import './SystemWorkflow.css'

// A narrated 3D presentation of the CertiChain request workflow, for the
// capstone defense / system demo. Public page: /system-workflow
//
// Keys: Space pause/resume · ← → previous/next · F full screen · M sound.

const NO_3D_MESSAGE = '3D graphics are not available in this browser. Try the latest Chrome or Edge with hardware acceleration turned on.'

function webglAvailable() {
    try {
        const canvas = document.createElement('canvas')
        return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'))
    } catch {
        return false
    }
}

const NARRATION_DELAY_MS = 1300 // let the camera arrive first
const TICK_MS = 50

function SystemWorkflow() {
    const stageRef = useRef(null)
    const sceneRef = useRef(null)
    const audioRef = useRef(null)
    const narratorRef = useRef(null)

    const [started, setStarted] = useState(false)
    const [shotIndex, setShotIndex] = useState(0)
    const [playing, setPlaying] = useState(false)
    const [ended, setEnded] = useState(false)
    const [voiceOn, setVoiceOn] = useState(true)
    const [musicOn, setMusicOn] = useState(true)
    const [sfxOn, setSfxOn] = useState(true)
    const [voices, setVoices] = useState([])
    const [voiceName, setVoiceName] = useState('')
    const [hasRecording, setHasRecording] = useState(false)
    const [sceneError, setSceneError] = useState(() => (webglAvailable() ? '' : NO_3D_MESSAGE))
    const [chromeHidden, setChromeHidden] = useState(false)

    // Sequencer state (refs: read inside the ticking loop).
    const seq = useRef({ elapsed: 0, cuesFired: 0, narrationStarted: false, narrationDone: false, shot: 0 })
    const playingRef = useRef(false)
    const voiceOnRef = useRef(true)
    useEffect(() => { playingRef.current = playing }, [playing])
    useEffect(() => { voiceOnRef.current = voiceOn }, [voiceOn])

    // ---- Set up the 3D scene, audio and narrator ------------------------------
    useEffect(() => {
        let scene = null
        if (webglAvailable()) {
            try {
                scene = createWorkflowScene(stageRef.current)
                sceneRef.current = scene
            } catch (err) {
                console.error('WORKFLOW SCENE ERROR:', err)
                queueMicrotask(() => setSceneError(NO_3D_MESSAGE))
            }
        }
        narratorRef.current = createNarrator()

        let cancelled = false
        whenVoicesReady().then((list) => {
            if (cancelled) return
            setVoices(list)
            if (list[0]) {
                setVoiceName(list[0].name)
                narratorRef.current.setVoice(list[0])
            }
        })
        recordingsAvailable(SHOTS.map((s) => s.audio)).then((ok) => {
            if (cancelled) return
            setHasRecording(ok)
            narratorRef.current.setMode(ok ? 'recording' : 'voice')
        })

        return () => {
            cancelled = true
            narratorRef.current?.stop()
            audioRef.current?.dispose()
            scene?.dispose()
        }
    }, [])

    const shot = SHOTS[shotIndex]

    // ---- Moving to a shot -------------------------------------------------------
    const goToShot = useCallback((index) => {
        const i = Math.max(0, Math.min(SHOTS.length - 1, index))
        narratorRef.current?.stop()
        audioRef.current?.setDucked(false)
        seq.current = { elapsed: 0, cuesFired: 0, narrationStarted: false, narrationDone: !SHOTS[i].narration, shot: i }
        setShotIndex(i)
        setEnded(false)
        sceneRef.current?.setShot(SHOTS[i].id)
    }, [])

    // ---- The sequencer: cues, narration, advancing ------------------------------
    useEffect(() => {
        if (!started) return undefined
        const timer = setInterval(() => {
            if (!playingRef.current) return
            const s = seq.current
            const current = SHOTS[s.shot]
            s.elapsed += TICK_MS

            // Sound cues.
            while (s.cuesFired < current.cues.length && s.elapsed >= current.cues[s.cuesFired][0] * 1000) {
                audioRef.current?.play(current.cues[s.cuesFired][1])
                s.cuesFired += 1
            }

            // Narration once the camera has arrived.
            if (!s.narrationStarted && s.elapsed >= NARRATION_DELAY_MS) {
                s.narrationStarted = true
                if (current.narration && voiceOnRef.current) {
                    const mine = s.shot
                    audioRef.current?.setDucked(true)
                    narratorRef.current.speak(current).then(() => {
                        if (seq.current.shot !== mine) return
                        seq.current.narrationDone = true
                        audioRef.current?.setDucked(false)
                    })
                } else {
                    // Voice off: give people time to read the subtitle.
                    const readMs = (current.narration || '').length * 55
                    s.narrationDone = false
                    s.readUntil = NARRATION_DELAY_MS + readMs
                }
            }
            if (s.readUntil && s.elapsed >= s.readUntil) {
                s.narrationDone = true
                s.readUntil = 0
            }

            // Next shot when the time is up and the narrator has finished.
            if (s.narrationStarted && s.narrationDone && s.elapsed >= current.minMs) {
                if (s.shot < SHOTS.length - 1) {
                    goToShot(s.shot + 1)
                } else {
                    setEnded(true)
                    s.narrationDone = false // stay on the finale
                }
            }
        }, TICK_MS)
        return () => clearInterval(timer)
    }, [started, goToShot])

    // ---- Controls ------------------------------------------------------------------
    const start = async () => {
        if (!audioRef.current) audioRef.current = createWorkflowAudio()
        audioRef.current?.setMusic(musicOn)
        audioRef.current?.setSfx(sfxOn)
        await audioRef.current?.start()
        setStarted(true)
        setPlaying(true)
        sceneRef.current?.setPaused(false)
        goToShot(0)
    }

    const togglePlay = useCallback(() => {
        if (!started) return
        if (ended) {
            goToShot(0)
            setPlaying(true)
            sceneRef.current?.setPaused(false)
            audioRef.current?.start()
            return
        }
        const next = !playingRef.current
        setPlaying(next)
        sceneRef.current?.setPaused(!next)
        if (next) {
            audioRef.current?.start()
            // Say the current line again from the start.
            const s = seq.current
            if (s.narrationStarted && !s.narrationDone) s.narrationStarted = false
        } else {
            narratorRef.current?.stop()
            audioRef.current?.pause()
        }
    }, [started, ended, goToShot])

    const step = useCallback((delta) => {
        if (!started) return
        goToShot(seq.current.shot + delta)
        if (!playingRef.current) {
            setPlaying(true)
            sceneRef.current?.setPaused(false)
            audioRef.current?.start()
        }
    }, [started, goToShot])

    const jumpToStep = (n) => {
        const i = SHOTS.findIndex((s) => s.step === n)
        if (i < 0) return
        goToShot(i)
        if (!playingRef.current) {
            setPlaying(true)
            sceneRef.current?.setPaused(false)
            audioRef.current?.start()
        }
    }

    const toggleVoice = () => {
        const next = !voiceOn
        setVoiceOn(next)
        if (!next) {
            narratorRef.current?.stop()
            audioRef.current?.setDucked(false)
            seq.current.narrationDone = true
        }
    }
    const toggleMusic = () => {
        const next = !musicOn
        setMusicOn(next)
        audioRef.current?.setMusic(next)
    }
    const toggleSfx = () => {
        const next = !sfxOn
        setSfxOn(next)
        audioRef.current?.setSfx(next)
    }
    const toggleFullscreen = () => {
        const el = document.documentElement
        if (!document.fullscreenElement) el.requestFullscreen?.().catch(() => {})
        else document.exitFullscreen?.()
    }

    const chooseVoice = (name) => {
        setVoiceName(name)
        const v = availableVoices().find((x) => x.name === name)
        if (v) narratorRef.current?.setVoice(v)
    }

    // Keyboard.
    useEffect(() => {
        const onKey = (e) => {
            if (e.target.closest?.('select, input, textarea')) return
            if (e.code === 'Space') { e.preventDefault(); togglePlay() }
            else if (e.key === 'ArrowRight') step(1)
            else if (e.key === 'ArrowLeft') step(-1)
            else if (e.key === 'f' || e.key === 'F') toggleFullscreen()
            else if (e.key === 'h' || e.key === 'H') setChromeHidden((v) => !v)
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [togglePlay, step])

    useEffect(() => {
        document.title = 'System Workflow · CertiChain'
    }, [])

    const currentVoice = voices.find((v) => v.name === voiceName)
    const voiceLabel = hasRecording
        ? 'Recorded narration'
        : currentVoice
            ? `${currentVoice.name.replace(/^Microsoft\s+/i, '').replace(/\s*-\s*English.*$/i, '')}${isNaturalVoice(currentVoice) ? '' : ' (basic voice)'}`
            : 'Browser voice'

    return (
        <div className={`wf-root${started ? ' is-started' : ''}${chromeHidden ? ' is-clean' : ''}`}>
            <div className="wf-stage" ref={stageRef} aria-hidden="true" />
            <div className="wf-vignette" aria-hidden="true" />

            {sceneError && <div className="wf-error">{sceneError}</div>}

            {/* Top bar */}
            {started && (
                <header className="wf-top">
                    <div className="wf-brand">
                        <span className="wf-brand-mark"><img src={certichainLogo} alt="CertiChain" /></span>
                        <div>
                            <strong>CertiChain</strong>
                            <span>Academic Registrar System · Workflow</span>
                        </div>
                    </div>
                    <div className="wf-controls">
                        <button type="button" onClick={() => step(-1)} aria-label="Previous step" title="Previous (←)">‹</button>
                        <button type="button" className="wf-play" onClick={togglePlay} aria-label={playing && !ended ? 'Pause' : 'Play'} title="Play / pause (Space)">
                            {ended ? '↻' : playing ? '❚❚' : '▶'}
                        </button>
                        <button type="button" onClick={() => step(1)} aria-label="Next step" title="Next (→)">›</button>
                        <span className="wf-divider" />
                        <button type="button" className={voiceOn ? 'is-on' : ''} onClick={toggleVoice} title="Narrator voice">Voice</button>
                        <button type="button" className={musicOn ? 'is-on' : ''} onClick={toggleMusic} title="Background music">Music</button>
                        <button type="button" className={sfxOn ? 'is-on' : ''} onClick={toggleSfx} title="Sound effects">SFX</button>
                        <button type="button" onClick={toggleFullscreen} title="Full screen (F)">⛶</button>
                    </div>
                </header>
            )}

            {/* Subtitle + stage */}
            {started && !ended && shot.id !== 'finale' && (
                <section className="wf-caption" key={shot.id}>
                    {shot.step > 0 && <span className="wf-caption-step">Step {shot.step} of 9</span>}
                    <h2>{shot.title}</h2>
                    {shot.narration && <p>{shot.narration}</p>}
                </section>
            )}

            {/* Timeline */}
            {started && (
                <nav className="wf-timeline" aria-label="Workflow steps">
                    {STEPS.map((label, i) => {
                        const n = i + 1
                        const state = ended || shot.id === 'finale' ? 'done' : shot.step === n ? 'active' : shot.step > n ? 'done' : ''
                        return (
                            <button key={label} type="button" className={`wf-chip ${state}`} onClick={() => jumpToStep(n)} title={label}>
                                <span className="wf-chip-num">{state === 'done' ? '✓' : n}</span>
                                <span className="wf-chip-label">{label}</span>
                            </button>
                        )
                    })}
                </nav>
            )}

            {/* Final summary */}
            {started && shot.id === 'finale' && (
                <section className={`wf-finale${ended ? ' is-ended' : ''}`}>
                    <span className="wf-finale-check">✓</span>
                    <h1>Request Completed</h1>
                    <ol className="wf-flow">
                        {FLOW.map((label, i) => (
                            <li key={label} style={{ animationDelay: `${0.5 + i * 0.35}s` }}>
                                <span>{label}</span>
                            </li>
                        ))}
                    </ol>
                    {ended && (
                        <div className="wf-finale-actions">
                            <button type="button" className="wf-btn is-primary" onClick={togglePlay}>Replay</button>
                            <Link to="/" className="wf-btn">Back to CertiChain</Link>
                        </div>
                    )}
                </section>
            )}

            {/* Start screen */}
            {!started && (
                <div className="wf-start">
                    <div className="wf-start-card">
                        <span className="wf-eyebrow">CertiChain · Capstone Presentation</span>
                        <h1>System Workflow</h1>
                        <p className="wf-start-sub">
                            A narrated 3D walkthrough of how an academic document request moves through the online
                            registrar system: request, credentials, record check, processing, verification, release and
                            completion.
                        </p>

                        <div className="wf-start-voice">
                            <span>Narrator</span>
                            {hasRecording ? (
                                <strong>Recorded human narration</strong>
                            ) : voices.length > 0 ? (
                                <select value={voiceName} onChange={(e) => chooseVoice(e.target.value)} aria-label="Narrator voice">
                                    {voices.slice(0, 14).map((v) => (
                                        <option key={v.name} value={v.name}>
                                            {v.name.replace(/^Microsoft\s+/i, '')}{isNaturalVoice(v) ? ' ★' : ''}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <strong>Browser voice</strong>
                            )}
                        </div>
                        {!hasRecording && currentVoice && !isNaturalVoice(currentVoice) && (
                            <p className="wf-start-hint">
                                For the most natural voice, open this page in Microsoft Edge (its “Natural” voices sound
                                human) or add recorded narration.
                            </p>
                        )}

                        <button type="button" className="wf-btn is-primary wf-start-btn" onClick={start} disabled={!!sceneError}>
                            ▶ Start presentation
                        </button>
                        <p className="wf-start-keys">
                            <kbd>Space</kbd> pause · <kbd>←</kbd> <kbd>→</kbd> steps · <kbd>F</kbd> full screen · <kbd>H</kbd> hide controls
                        </p>
                        <p className="wf-start-voicehint">Voice: {voiceLabel}</p>
                    </div>
                </div>
            )}
        </div>
    )
}

export default SystemWorkflow
