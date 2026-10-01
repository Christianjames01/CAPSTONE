import { useEffect, useRef, useState } from 'react'
import { IconVolume } from '../components/UiIcons'
import { supabase } from '../lib/supabase'
import { formatQueueNumber, todayStr } from '../lib/queue'
import certichainLogo from '../assets/certichain-logo.png'
import hcdcBackground from '../assets/footer-building.jpg'
import ExplainerPlayer from '../components/explainer/ExplainerPlayer'
import { facebookEmbedUrl, loadLobbyVideos } from '../lib/lobbyVideos'
import { useLiveRefresh } from '../lib/useLiveRefresh'
import { STUDENT_SCENES } from '../components/explainer/sceneLists'
import './QueueDisplay.css'

const POLL_MS = 4000

// Between calls the TV plays the student walkthrough (how to request
// documents online) with the queue shrunk into a side panel; a new call
// brings the full queue back at once. ?nodemo on the URL turns this off.
// Every 2 minutes the TV takes a turn: the next lobby video (Facebook videos
// the Registrar Head added on the Queue page), then the walkthrough demo,
// then the first video again.
// ?every=30 on the URL changes the wait (10-600 seconds).
const EVERY_PARAM = typeof window === 'undefined' ? null : Number(new URLSearchParams(window.location.search).get('every'))
const QUEUE_BEFORE_DEMO_MS = EVERY_PARAM ? Math.min(600, Math.max(10, EVERY_PARAM)) * 1000 : 120000
const DEMO_ENABLED = typeof window === 'undefined' || !new URLSearchParams(window.location.search).has('nodemo')
// ?demoaudio also reads the walkthrough aloud on the TV.
const DEMO_AUDIO = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('demoaudio')
const TV_CTA = {
    title: <>Request online at <em>onlineregistrar.vercel.app</em></>,
    caption: 'Create a free CertiChain account on your phone and request your documents without queuing.',
}

// Rotated through instead of repeating one line back-to-back, so the
// footer ticker reads as a handful of distinct announcements rather than
// the same sentence spammed edge to edge.
const MARQUEE_MESSAGES = [
    'Please keep your ticket ready and listen for your number to be announced.',
    'Log in to CertiChain to track your document request online.',
    'Numbers reset daily — walk-in tickets are only valid for today.',
]

// A short two-tone chime via the Web Audio API -- no audio file asset
// needed. `ctx` must be a context created/resumed from a real user gesture
// (see handleStart below): browsers create a fresh AudioContext in a
// "suspended" state and silently drop anything played through it until a
// tap/click resumes it, so a kiosk page that's opened once and never
// touched again would otherwise play nothing at all, with no error to
// explain why.
function playChime(ctx) {
    try {
        const now = ctx.currentTime

            ;[880, 660].forEach((freq, i) => {
                const osc = ctx.createOscillator()
                const gain = ctx.createGain()
                osc.frequency.value = freq
                osc.type = 'sine'
                gain.gain.setValueAtTime(0.2, now + i * 0.28)
                gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.28 + 0.25)
                osc.connect(gain)
                gain.connect(ctx.destination)
                osc.start(now + i * 0.28)
                osc.stop(now + i * 0.28 + 0.26)
            })
    } catch (err) {
        console.error('CHIME ERROR:', err)
    }
}

function announce(queueNumber, ctx) {
    if (ctx) playChime(ctx)

    if (!window.speechSynthesis) return

    // Cut off the walkthrough's voice-over, if any, before announcing.
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(
        `Now serving number ${queueNumber}. Please proceed to the counter.`
    )
    utterance.rate = 0.95

    // Chime first, then speak once it's had a moment to finish.
    setTimeout(() => window.speechSynthesis.speak(utterance), 900)
}

function QueueDisplay() {
    const [nowServing, setNowServing] = useState(null)
    const [upNext, setUpNext] = useState([])
    const [clock, setClock] = useState(new Date())
    const [justCalled, setJustCalled] = useState(false)
    const [soundReady, setSoundReady] = useState(false)
    const [demo, setDemo] = useState(false) // walkthrough on, queue in the side panel
    const [demoRun, setDemoRun] = useState(0)
    const [back, setBack] = useState(false) // the queue growing back to full size
    // Kept in a ref: re-checking the list (about every minute) must never
    // restart the 2-minute countdown.
    const videosRef = useRef([])
    const [video, setVideo] = useState(null) // the lobby video playing now (else the demo)
    const turnRef = useRef(0)
    const lastAnnouncedKey = useRef(null)
    const audioCtxRef = useRef(null)
    const wakeLockRef = useRef(null)

    const refreshVideos = () =>
        loadLobbyVideos()
            .then(({ videos: list }) => { videosRef.current = list })
            .catch((err) => console.error('LOBBY VIDEOS ERROR:', err))

    useEffect(() => {
        let cancelled = false
        const run = () => loadLobbyVideos()
            .then(({ videos: list }) => { if (!cancelled) videosRef.current = list })
            .catch((err) => console.error('LOBBY VIDEOS ERROR:', err))
        run()
        const t = setInterval(run, 10 * 60 * 1000)
        return () => { cancelled = true; clearInterval(t) }
    }, [])

    useLiveRefresh(['lobby_videos'], refreshVideos)

    useEffect(() => {
        loadQueue()
        const poll = setInterval(loadQueue, POLL_MS)
        const clockTick = setInterval(() => setClock(new Date()), 1000)
        return () => {
            clearInterval(poll)
            clearInterval(clockTick)
        }
    }, [])

    // Left running unattended on a lobby TV, this is exactly the kind of
    // page the OS/browser will try to dim or sleep after a period of no
    // touch input, and a hidden/suspended tab has its timers throttled --
    // both would silently stop the "now serving" number from updating.
    // Wake Lock keeps the screen on; re-requesting it (it auto-releases
    // whenever the tab goes hidden) and refreshing immediately on
    // visibilitychange covers a background tab that gets refocused too.
    useEffect(() => {
        const requestWakeLock = async () => {
            try {
                if ('wakeLock' in navigator) {
                    wakeLockRef.current = await navigator.wakeLock.request('screen')
                }
            } catch (err) {
                console.error('WAKE LOCK ERROR:', err)
            }
        }

        requestWakeLock()

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                requestWakeLock()
                loadQueue()
            }
        }

        document.addEventListener('visibilitychange', handleVisibility)

        return () => {
            document.removeEventListener('visibilitychange', handleVisibility)
            wakeLockRef.current?.release().catch(() => { })
        }
    }, [])

    // One tap is all it takes, and it only needs to happen once per time the
    // display is opened -- this is what actually lets audio/speech play at
    // all afterward, since the browser requires a real user gesture before
    // either will produce sound, silently otherwise.
    const enableSound = () => {
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext
            const ctx = audioCtxRef.current || new Ctx()
            audioCtxRef.current = ctx
            if (ctx.state === 'suspended') ctx.resume()

            if (window.speechSynthesis) {
                const warmUp = new SpeechSynthesisUtterance(' ')
                warmUp.volume = 0
                window.speechSynthesis.speak(warmUp)
            }
        } catch (err) {
            console.error('ENABLE SOUND ERROR:', err)
        } finally {
            setSoundReady(true)
        }
    }

    // After 2 quiet minutes on the queue, take the next turn: a lobby video
    // or the walkthrough (restarts whenever the number being served changes).
    useEffect(() => {
        if (!DEMO_ENABLED || !soundReady || demo || justCalled) return undefined
        const t = setTimeout(() => {
            const rotation = [...videosRef.current, null] // null = the walkthrough demo
            const next = rotation[turnRef.current % rotation.length]
            turnRef.current += 1
            setVideo(next)
            setDemo(true)
            setDemoRun((r) => r + 1)
        }, QUEUE_BEFORE_DEMO_MS)
        return () => clearTimeout(t)
    }, [soundReady, demo, justCalled, nowServing])

    const endDemo = () => {
        setDemo(false)
        setVideo(null)
        setBack(true)
        setTimeout(() => setBack(false), 1200)
    }

    // A video plays for the length the head set, then the queue comes back.
    useEffect(() => {
        if (!demo || !video) return undefined
        const t = setTimeout(endDemo, Math.max(10, video.play_seconds || 60) * 1000)
        return () => clearTimeout(t)
    }, [demo, video, demoRun])

    const loadQueue = async () => {
        const today = todayStr()

        const { data: activeRows } = await supabase
            .from('walk_in_queue')
            .select('queue_id, queue_number, status, called_at')
            .eq('queue_date', today)
            .in('status', ['called', 'serving'])
            .order('called_at', { ascending: false })
            .limit(1)

        const current = activeRows?.[0] || null

        if (current) {
            const key = `${current.queue_id}-${current.called_at}`
            // Skip announcing on the very first poll after the page opens --
            // only announce actual new calls/recalls that happen while the
            // display is already up, not whatever was already "now serving"
            // when the TV was turned on.
            const isFirstCheck = lastAnnouncedKey.current === null
            if (key !== lastAnnouncedKey.current) {
                lastAnnouncedKey.current = key
                if (!isFirstCheck) {
                    setDemo(false)
                    announce(current.queue_number, audioCtxRef.current)
                    setJustCalled(true)
                    setTimeout(() => setJustCalled(false), 6000)
                }
            }
            setNowServing(current.queue_number)
        } else {
            setNowServing(null)
        }

        const { data: waitingRows } = await supabase
            .from('walk_in_queue')
            .select('queue_number')
            .eq('queue_date', today)
            .eq('status', 'waiting')
            .order('queue_number', { ascending: true })
            .limit(5)

        setUpNext((waitingRows || []).map((r) => r.queue_number))
    }

    const idleText = upNext.length > 0 ? 'Waiting for the next number to be called' : 'No one in line right now'

    return (
        <div className="qd-root" style={{ '--qd-photo': `url(${hcdcBackground})` }}>
            {!soundReady && (
                <button className="qd-unlock" onClick={enableSound}>
                    <span className="qd-unlock-card">
                        <img src={certichainLogo} alt="" className="qd-unlock-logo" />
                        <span className="qd-unlock-title">Start the Queue Display</span>
                        <span className="qd-unlock-sub">Tap once so number announcements can play sound.</span>
                        <span className="qd-unlock-button">
                            <span className="qd-unlock-icon"><IconVolume /></span>
                            Tap to start
                        </span>
                    </span>
                </button>
            )}

            <header className="qd-header">
                <div className="qd-brand">
                    <img src={certichainLogo} alt="" className="qd-logo" />
                    <div>
                        <div className="qd-brand-name">Registrar's Office</div>
                        <div className="qd-brand-tag">Holy Cross of Davao College · Walk-in Queue</div>
                    </div>
                </div>

                <div className="qd-clock">
                    <div className="qd-clock-time">
                        {clock.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
                    </div>
                    <div className="qd-clock-date">
                        {clock.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </div>
                </div>
            </header>

            <main className={`qd-main${demo ? ' is-demo' : ''}${back ? ' is-back' : ''}`}>
                {demo && video && (
                    <section className="qd-demo qd-video" aria-label={video.title || 'Video from Holy Cross of Davao College'}>
                        <div className="qd-demo-head">
                            <span className="qd-demo-badge">Holy Cross of Davao College</span>
                            <strong>{video.title || 'Latest from HCDC'}</strong>
                        </div>
                        <div className="qd-video-frame">
                            <iframe
                                key={demoRun}
                                src={facebookEmbedUrl(video.url)}
                                title={video.title || 'Video from Holy Cross of Davao College'}
                                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                                allowFullScreen
                                scrolling="no"
                            />
                        </div>
                    </section>
                )}

                {demo && !video && (
                    <section className="qd-demo" aria-label="How to request documents online">
                        <div className="qd-demo-head">
                            <span className="qd-demo-badge">While you wait</span>
                            <strong>How to request your documents online</strong>
                        </div>
                        <ExplainerPlayer key={demoRun} scenes={STUDENT_SCENES} cta={TV_CTA} label="How to request documents online" onEnd={endDemo} soundKey="tv" defaultSound={DEMO_AUDIO} />
                    </section>
                )}

                <section className={`qd-now-card${justCalled ? ' is-flash' : ''}${nowServing ? '' : ' is-idle'}`} aria-live="polite">
                    <div className="qd-now-head">
                        <span className="qd-live">
                            <span className="qd-live-dot-wrap">
                                <span className="qd-live-ping" />
                                <span className="qd-live-dot" />
                            </span>
                            Now serving
                        </span>
                    </div>

                    <img src={certichainLogo} alt="" className="qd-now-watermark" />

                    <div className="qd-now-body">
                        {nowServing ? (
                            <div key={nowServing} className="qd-now-number is-active">
                                {formatQueueNumber(nowServing)}
                            </div>
                        ) : (
                            <div className="qd-idle-icon-wrap">
                                {upNext.length > 0 ? (
                                    <svg className="qd-idle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="9" />
                                        <path d="M12 7v5l3.2 2" />
                                    </svg>
                                ) : (
                                    <svg className="qd-idle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M9 12.5 11 14.5 15.5 9.5" />
                                        <path d="M4.5 8.5V6.8A2.3 2.3 0 0 1 6.8 4.5h10.4A2.3 2.3 0 0 1 19.5 6.8v10.4a2.3 2.3 0 0 1-2.3 2.3H6.8a2.3 2.3 0 0 1-2.3-2.3V15.5" />
                                    </svg>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="qd-now-sub">
                        {nowServing ? 'Please proceed to the Registrar counter' : idleText}
                    </div>
                </section>

                <aside className="qd-upnext" aria-label="Up next">
                    <div className="qd-upnext-head">
                        <h2>Up Next</h2>
                        {upNext.length > 0 && <span className="qd-upnext-count">{upNext.length}</span>}
                    </div>

                    {upNext.length === 0 ? (
                        <div className="qd-upnext-empty">No one else is waiting</div>
                    ) : (
                        <ol className="qd-upnext-list">
                            {upNext.map((n, i) => (
                                <li
                                    className={`qd-ticket qd-chip-in${i === 0 ? ' is-next' : ''}`}
                                    key={n}
                                    style={{ animationDelay: `${i * 90}ms` }}
                                >
                                    <span className="qd-ticket-pos">{i === 0 ? 'Next' : `#${i + 1}`}</span>
                                    <span className="qd-ticket-num">{formatQueueNumber(n)}</span>
                                </li>
                            ))}
                        </ol>
                    )}

                    <p className="qd-upnext-hint">Please stay nearby — your number will be called and announced.</p>
                </aside>
            </main>

            <footer className="qd-footer">
                <span className="qd-footer-label">Reminders</span>
                <div className="qd-marquee-viewport">
                    <div className="qd-marquee">
                        {/* Cycled through the message list and repeated enough
                            times that even half this row (the distance the
                            -50% loop travels) is wider than any realistic
                            screen, so the ticker fills the full width edge to
                            edge without ever showing the same line twice in a
                            row. */}
                        {Array.from({ length: 16 }).map((_, i) => (
                            <span key={i}>
                                {MARQUEE_MESSAGES[i % MARQUEE_MESSAGES.length]}
                                <span className="qd-marquee-dot">•</span>
                            </span>
                        ))}
                    </div>
                </div>
            </footer>
        </div>
    )
}

export default QueueDisplay
