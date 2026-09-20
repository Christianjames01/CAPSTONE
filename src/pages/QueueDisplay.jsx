import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatQueueNumber, todayStr } from '../lib/queue'
import hcdcLogo from '../assets/hcdc-logo.png'

const POLL_MS = 4000

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
    const lastAnnouncedKey = useRef(null)
    const audioCtxRef = useRef(null)

    useEffect(() => {
        loadQueue()
        const poll = setInterval(loadQueue, POLL_MS)
        const clockTick = setInterval(() => setClock(new Date()), 1000)
        return () => {
            clearInterval(poll)
            clearInterval(clockTick)
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
            .limit(6)

        setUpNext((waitingRows || []).map((r) => r.queue_number))
    }

    return (
        <div className="qd-root">
            {!soundReady && (
                <button className="qd-unlock" onClick={enableSound}>
                    <span className="qd-unlock-icon">🔊</span>
                    <span className="qd-unlock-title">Tap to Start Display</span>
                    <span className="qd-unlock-sub">Needed once so number announcements can play sound</span>
                </button>
            )}

            <div className="qd-glow" />
            <div className="qd-grain" />

            <header className="qd-header">
                <div className="qd-brand">
                    <img src={hcdcLogo} alt="" className="qd-logo" />
                    <div>
                        <div className="qd-brand-name">CertiChain Registrar</div>
                        <div className="qd-brand-tag">Holy Cross of Davao College</div>
                    </div>
                </div>

                <div className="qd-clock">
                    <div className="qd-clock-time">
                        {clock.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
                    </div>
                    <div className="qd-clock-date">
                        {clock.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </div>
                </div>
            </header>

            <main className="qd-main">
                <div className="qd-eyebrow">
                    <span className="qd-eyebrow-dot-wrap">
                        <span className="qd-eyebrow-ping" />
                        <span className="qd-eyebrow-dot" />
                    </span>
                    NOW SERVING
                </div>

                <div className={`qd-now-card${justCalled ? ' is-flash' : ''}${nowServing ? '' : ' is-floating'}`}>
                    {nowServing ? (
                        <div key={nowServing} className="qd-now-number is-active">
                            {formatQueueNumber(nowServing)}
                        </div>
                    ) : upNext.length > 0 ? (
                        <div className="qd-idle-icon-wrap">
                            <svg className="qd-idle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="9" />
                                <path d="M12 7v5l3.2 2" />
                            </svg>
                        </div>
                    ) : (
                        <div className="qd-idle-icon-wrap">
                            <svg className="qd-idle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 12.5 11 14.5 15.5 9.5" />
                                <path d="M4.5 8.5V6.8A2.3 2.3 0 0 1 6.8 4.5h10.4A2.3 2.3 0 0 1 19.5 6.8v10.4a2.3 2.3 0 0 1-2.3 2.3H6.8a2.3 2.3 0 0 1-2.3-2.3V15.5" />
                            </svg>
                        </div>
                    )}
                    <div className="qd-now-sub">
                        {nowServing
                            ? 'Please proceed to the counter'
                            : upNext.length > 0
                                ? 'Waiting for the next number to be called'
                                : 'No one in line right now'}
                    </div>
                </div>

                <section className="qd-upnext">
                    <div className="qd-upnext-label">Up Next</div>

                    {upNext.length === 0 ? (
                        <div className="qd-upnext-empty">No one else is waiting</div>
                    ) : (
                        <div className="qd-chip-row">
                            {upNext.map((n, i) => (
                                <div
                                    className={`qd-chip qd-chip-in${i === 0 ? ' is-next' : ''}`}
                                    key={n}
                                    style={{ animationDelay: `${i * 90}ms` }}
                                >
                                    {formatQueueNumber(n)}
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </main>

            <footer className="qd-footer">
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
            </footer>

            <style>{`
                .qd-root {
                    position: fixed;
                    inset: 0;
                    display: flex;
                    flex-direction: column;
                    color: #0A1830;
                    font-family: 'Inter', system-ui, -apple-system, "Segoe UI", sans-serif;
                    background: #FDFDFE;
                    overflow: hidden;
                }

                .qd-unlock {
                    position: fixed;
                    inset: 0;
                    z-index: 50;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    width: 100%;
                    border: none;
                    background: rgba(253,253,254,0.98);
                    color: #0A1830;
                    font-family: 'Inter', system-ui, -apple-system, "Segoe UI", sans-serif;
                    cursor: pointer;
                }

                .qd-unlock-icon {
                    font-size: 56px;
                    animation: qd-unlock-pulse 1.6s ease-in-out infinite;
                }

                .qd-unlock-title {
                    font-family: 'Fraunces', serif;
                    font-size: clamp(22px, 3vw, 32px);
                    font-weight: 700;
                }

                .qd-unlock-sub {
                    font-size: 15px;
                    color: rgba(10,24,48,0.5);
                }

                @keyframes qd-unlock-pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.12); }
                }

                .qd-glow {
                    position: absolute;
                    top: 26%;
                    left: 50%;
                    width: 1000px;
                    height: 1000px;
                    margin: -500px 0 0 -500px;
                    background: radial-gradient(circle, rgba(111,168,245,0.16) 0%, rgba(157,138,245,0.05) 45%, rgba(111,168,245,0) 72%);
                    pointer-events: none;
                    animation: qd-drift 10s ease-in-out infinite alternate;
                }

                .qd-grain {
                    position: absolute;
                    inset: 0;
                    pointer-events: none;
                    opacity: 0.5;
                    background-image:
                        radial-gradient(rgba(10,24,48,0.05) 1px, transparent 1px);
                    background-size: 3px 3px;
                    mask-image: radial-gradient(ellipse 70% 60% at 50% 40%, #000 0%, transparent 75%);
                }

                .qd-header {
                    position: relative;
                    z-index: 1;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 16px;
                    padding: 22px clamp(20px, 4vw, 56px);
                    background: rgba(250,251,253,0.8);
                    backdrop-filter: blur(6px);
                    box-shadow: 0 1px 0 rgba(11,18,32,0.07), 0 18px 40px -32px rgba(15,30,60,0.35);
                    flex-wrap: wrap;
                }

                .qd-brand {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                }

                .qd-logo {
                    width: 48px;
                    height: 48px;
                    border-radius: 50%;
                    padding: 2px;
                    background: linear-gradient(140deg, rgba(111,168,245,0.55), rgba(157,138,245,0.35));
                    box-shadow: 0 4px 14px -6px rgba(15,30,60,0.35);
                }

                .qd-brand-name {
                    font-family: 'Fraunces', serif;
                    font-size: 20px;
                    font-weight: 700;
                    letter-spacing: 0.2px;
                    color: #0A1830;
                }

                .qd-brand-tag {
                    font-size: 12px;
                    font-weight: 500;
                    letter-spacing: 0.3px;
                    color: rgba(10,24,48,0.5);
                    margin-top: 2px;
                }

                .qd-clock {
                    text-align: right;
                }

                .qd-clock-time {
                    font-size: 23px;
                    font-weight: 700;
                    font-variant-numeric: tabular-nums;
                    letter-spacing: 0.2px;
                    color: #0A1830;
                }

                .qd-clock-date {
                    font-size: 12px;
                    font-weight: 500;
                    color: rgba(10,24,48,0.5);
                    margin-top: 2px;
                }

                .qd-main {
                    position: relative;
                    z-index: 1;
                    flex: 1;
                    min-height: 0;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: clamp(12px, 2.5vh, 40px) 24px;
                    gap: clamp(14px, 3.2vh, 44px);
                    overflow: hidden;
                }

                .qd-eyebrow {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 9px 20px;
                    border-radius: 999px;
                    background: rgba(111,168,245,0.1);
                    border: 1px solid rgba(111,168,245,0.22);
                    font-size: clamp(13px, 1.3vw, 15px);
                    font-weight: 700;
                    letter-spacing: 3.5px;
                    color: #2B5FA8;
                }

                .qd-eyebrow-dot-wrap {
                    position: relative;
                    width: 9px;
                    height: 9px;
                    display: inline-flex;
                }

                .qd-eyebrow-dot {
                    position: relative;
                    width: 9px;
                    height: 9px;
                    border-radius: 50%;
                    background: #4E86D9;
                }

                .qd-eyebrow-ping {
                    position: absolute;
                    inset: 0;
                    border-radius: 50%;
                    background: #6FA8F5;
                    animation: qd-ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
                }

                .qd-now-card {
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: clamp(10px, 1.8vh, 16px);
                    padding: clamp(16px, 3.5vh, 52px) clamp(36px, 8vw, 120px);
                    border-radius: 40px;
                    background: linear-gradient(165deg, #FAFCFF 0%, #F1F5FC 55%, #ECF1FA 100%);
                    border: 1px solid rgba(11,18,32,0.07);
                    box-shadow:
                        inset 0 1px 0 rgba(255,255,255,0.9),
                        0 2px 6px -2px rgba(15,30,60,0.12),
                        0 40px 80px -40px rgba(15,30,60,0.35);
                }

                .qd-now-card.is-flash {
                    animation: qd-flash 1s ease-in-out 3;
                }

                .qd-now-card.is-floating {
                    animation: qd-float 4.5s ease-in-out infinite;
                }

                .qd-now-number {
                    font-size: min(26vw, 26vh, 240px);
                    font-weight: 800;
                    line-height: 1;
                    letter-spacing: -3px;
                    font-variant-numeric: tabular-nums;
                }

                .qd-now-number.is-active {
                    color: #0F2E5C;
                    text-shadow: 0 2px 0 rgba(255,255,255,0.6), 0 0 60px rgba(111,168,245,0.4);
                    animation: qd-pulse-in 1.2s ease-out;
                }

                .qd-idle-icon-wrap {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: clamp(110px, 16vh, 200px);
                    height: clamp(110px, 16vh, 200px);
                    border-radius: 50%;
                    background: radial-gradient(circle, rgba(111,168,245,0.12) 0%, rgba(111,168,245,0) 72%);
                }

                .qd-idle-icon {
                    width: clamp(64px, 10vh, 134px);
                    height: clamp(64px, 10vh, 134px);
                    color: rgba(10,24,48,0.24);
                }

                .qd-now-sub {
                    font-size: clamp(14px, 1.8vw, 20px);
                    font-weight: 500;
                    color: rgba(10,24,48,0.5);
                    letter-spacing: 0.3px;
                }

                .qd-upnext {
                    width: 100%;
                    max-width: 1000px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 20px;
                }

                .qd-upnext-label {
                    font-family: 'Fraunces', serif;
                    font-style: italic;
                    font-size: 18px;
                    font-weight: 600;
                    letter-spacing: 0.5px;
                    color: rgba(10,24,48,0.45);
                }

                .qd-upnext-empty {
                    font-size: 16px;
                    font-weight: 500;
                    color: rgba(10,24,48,0.32);
                }

                .qd-chip-row {
                    display: flex;
                    justify-content: center;
                    gap: 16px;
                    flex-wrap: wrap;
                }

                .qd-chip {
                    font-size: clamp(22px, 2.4vw, 30px);
                    font-weight: 700;
                    font-variant-numeric: tabular-nums;
                    padding: 15px 28px;
                    border-radius: 16px;
                    background: linear-gradient(180deg, #FFFFFF, #F7F9FC);
                    border: 1px solid rgba(11,18,32,0.07);
                    box-shadow: 0 1px 0 rgba(255,255,255,0.8) inset, 0 10px 20px -16px rgba(15,30,60,0.3);
                    color: rgba(10,24,48,0.78);
                }

                .qd-chip.is-next {
                    background: linear-gradient(180deg, rgba(111,168,245,0.16), rgba(111,168,245,0.1));
                    border-color: rgba(111,168,245,0.5);
                    color: #123B78;
                    animation: qd-chip-glow 2.4s ease-in-out infinite;
                }

                .qd-chip-in {
                    animation: qd-chip-in 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
                }

                .qd-footer {
                    position: relative;
                    z-index: 1;
                    overflow: hidden;
                    font-size: 13px;
                    font-weight: 500;
                    color: rgba(10,24,48,0.38);
                    letter-spacing: 0.3px;
                    padding: 15px 0 calc(15px + env(safe-area-inset-bottom, 0px));
                    border-top: 1px solid rgba(11,18,32,0.06);
                    background: linear-gradient(180deg, transparent, rgba(111,168,245,0.03));
                    mask-image: linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent);
                }

                .qd-marquee {
                    display: flex;
                    width: max-content;
                    /* Longer than before since the row now repeats the
                       phrase enough times to span the full screen width --
                       keeps the scroll speed steady rather than racing by. */
                    animation: qd-marquee 42s linear infinite;
                    will-change: transform;
                }

                .qd-marquee span {
                    white-space: nowrap;
                    padding-right: 40px;
                    flex-shrink: 0;
                }

                .qd-marquee-dot {
                    padding-right: 0;
                    margin-left: 40px;
                    color: rgba(111,168,245,0.6);
                }

                @keyframes qd-pulse-in {
                    0% { transform: scale(0.88); opacity: 0; }
                    45% { transform: scale(1.05); opacity: 1; }
                    100% { transform: scale(1); opacity: 1; }
                }

                @keyframes qd-flash {
                    0%, 100% { box-shadow: inset 0 1px 0 rgba(255,255,255,0.9), 0 2px 6px -2px rgba(15,30,60,0.12), 0 40px 80px -40px rgba(15,30,60,0.35); }
                    50% { box-shadow: inset 0 1px 0 rgba(255,255,255,0.9), 0 0 0 6px rgba(111,168,245,0.35), 0 40px 80px -40px rgba(15,30,60,0.35); }
                }

                @keyframes qd-float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }

                @keyframes qd-drift {
                    0% { transform: translate(0, 0) scale(1); }
                    100% { transform: translate(40px, -30px) scale(1.08); }
                }

                @keyframes qd-ping {
                    0% { transform: scale(1); opacity: 0.7; }
                    75%, 100% { transform: scale(2.6); opacity: 0; }
                }

                @keyframes qd-chip-glow {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(111,168,245,0); }
                    50% { box-shadow: 0 0 0 6px rgba(111,168,245,0.16); }
                }

                @keyframes qd-chip-in {
                    0% { transform: translateY(14px); opacity: 0; }
                    100% { transform: translateY(0); opacity: 1; }
                }

                @keyframes qd-marquee {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }

                @media (max-width: 640px) {
                    .qd-header { padding: 16px 18px; }
                    .qd-main { gap: 32px; }
                }
            `}</style>
        </div>
    )
}

export default QueueDisplay
