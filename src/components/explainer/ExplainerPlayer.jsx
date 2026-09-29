import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from './icons'
import { narrationSupported, readSoundPref, say, speaking, stopSpeaking, writeSoundPref } from '../../lib/narration'
import './Explainer.css'

// A video-style motion walkthrough (no video file): animated copies of the
// app's screens, one scene per chapter, with chapters, pause/play and
// replay. It plays once it's scrolled into view; pausing freezes the scene
// animations too. Visitors who prefer reduced motion get still scenes they
// can step through.
//
// scenes: [{ key, chapter, title, text, ms, View }] -- View receives `cta`.
// onEnd: called when the last scene finishes.
// soundKey / defaultSound: the voice-over (Sound button) -- remembered per key.
// cta: { title?, caption?, primary: { label, href | onClick }, secondary? } for
// the last scene (key "cta").

const reducedMotion = () =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function useSeen(ref, threshold) {
    const [seen, setSeen] = useState(false)

    useEffect(() => {
        const el = ref.current
        if (!el || !('IntersectionObserver' in window)) return undefined
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setSeen(true)
                observer.disconnect()
            }
        }, { threshold })
        observer.observe(el)
        return () => observer.disconnect()
    }, [ref, threshold])

    return seen || typeof IntersectionObserver === 'undefined'
}

function ExplainerPlayer({ scenes, cta, autoplay = true, label = 'Walkthrough', onEnd, soundKey = 'walkthrough', defaultSound = false }) {
    const rootRef = useRef(null)
    const inView = useSeen(rootRef, 0.45)
    // One clock: which scene, how far into it, and whether the end was reached.
    const [clock, setClock] = useState({ scene: 0, elapsed: 0, ended: false, run: 0 })
    // null until the viewer presses play/pause: until then it autoplays the
    // first time the player is on screen.
    const [choice, setChoice] = useState(null)
    const playing = !clock.ended && (choice === null ? autoplay && inView && !reducedMotion() : choice)
    const { scene, elapsed, ended, run } = clock

    // Voice-over: each scene waits for the narrator to finish.
    const [soundOn, setSoundOn] = useState(() => narrationSupported() && readSoundPref(soundKey, defaultSound))
    const soundRef = useRef(soundOn)
    useEffect(() => { soundRef.current = soundOn })

    useEffect(() => {
        if (!playing) return undefined
        let frame
        let last = performance.now()
        const tick = (now) => {
            const delta = now - last
            last = now
            setClock((c) => {
                const next = c.elapsed + delta
                if (next < scenes[c.scene].ms) return { ...c, elapsed: next }
                if (soundRef.current && speaking()) return { ...c, elapsed: scenes[c.scene].ms }
                if (c.scene < scenes.length - 1) return { ...c, scene: c.scene + 1, elapsed: 0 }
                return { ...c, elapsed: scenes[c.scene].ms, ended: true }
            })
            frame = requestAnimationFrame(tick)
        }
        frame = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(frame)
    }, [playing, scenes])

    // Tell the page when the last scene has finished (e.g. the lobby TV
    // goes back to the queue).
    const onEndRef = useRef(onEnd)
    useEffect(() => { onEndRef.current = onEnd })
    useEffect(() => { if (ended) onEndRef.current?.() }, [ended])

    const current = scenes[scene]
    const narration = `${current.title}. ${current.key === 'cta' && cta?.caption ? cta.caption : current.text}`

    // Say each scene once. Only a replay (run changes) says it again; a
    // re-render doesn't restart it.
    const spokenRunRef = useRef(run)
    // Whether this player is the one talking (another player on the page
    // mustn't cut it off).
    const talkingRef = useRef(false)
    useEffect(() => {
        if (!soundOn || !playing) return
        const replay = spokenRunRef.current !== run
        spokenRunRef.current = run
        talkingRef.current = true
        say(narration, { interrupt: true, force: replay })
    }, [soundOn, playing, narration, run])

    // Quiet when paused or the sound is turned off, and when leaving.
    useEffect(() => {
        if ((!soundOn || !playing) && talkingRef.current) {
            talkingRef.current = false
            stopSpeaking()
        }
    }, [soundOn, playing])
    useEffect(() => () => { if (talkingRef.current) stopSpeaking() }, [])

    const toggleSound = () => {
        const next = !soundOn
        setSoundOn(next)
        writeSoundPref(soundKey, next)
        if (!next) stopSpeaking()
    }

    const goTo = useCallback((i) => {
        setClock((c) => ({ scene: i, elapsed: 0, ended: false, run: c.run + 1 }))
        setChoice(!reducedMotion())
    }, [])

    const togglePlay = () => {
        if (ended) goTo(0)
        else setChoice(!playing)
    }

    const View = current.View
    const sceneProgress = Math.min(1, elapsed / current.ms)

    return (
        <div className="lpx-player" ref={rootRef} aria-label={label}>
            <div
                className={`lpx-stage${playing ? '' : ' is-paused'}`}
                onClick={togglePlay}
                role="button"
                tabIndex={0}
                aria-label={playing ? 'Pause the walkthrough' : 'Play the walkthrough'}
                onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); togglePlay() } }}
            >
                <div className="lpx-stage-bg" />
                <div className="lpx-stage-grid" />

                <div className="lpx-chapter-tag" key={`tag-${scene}`}>
                    <span>{current.chapter}</span>{current.title}
                </div>

                <View key={`${current.key}-${run}`} cta={cta} />

                {!playing && (
                    <span className="lpx-big-play" aria-hidden="true">{ended ? Icon.replay : Icon.play}</span>
                )}
            </div>

            <div className="lpx-controls">
                <button type="button" className="lpx-play" onClick={togglePlay} aria-label={ended ? 'Replay' : playing ? 'Pause' : 'Play'}>
                    {ended ? Icon.replay : playing ? Icon.pause : Icon.play}
                </button>

                {narrationSupported() && (
                    <button
                        type="button"
                        className={`lpx-sound${soundOn ? ' is-on' : ''}`}
                        onClick={toggleSound}
                        aria-pressed={soundOn}
                        aria-label={soundOn ? 'Turn the voice-over off' : 'Turn the voice-over on'}
                        title={soundOn ? 'Sound on' : 'Sound off'}
                    >
                        {soundOn ? Icon.volume : Icon.mute}
                    </button>
                )}

                <div className="lpx-chapters" role="tablist" aria-label="Chapters">
                    {scenes.map((s, i) => (
                        <button
                            type="button"
                            key={s.key}
                            role="tab"
                            aria-selected={i === scene}
                            className={`lpx-chapter${i === scene ? ' is-current' : ''}${i < scene ? ' is-done' : ''}`}
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
                <p>{current.key === 'cta' && cta?.caption ? cta.caption : current.text}</p>
            </div>
        </div>
    )
}

export default ExplainerPlayer
