import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatQueueNumber, todayStr } from '../lib/queue'
import hcdcLogo from '../assets/hcdc-logo.png'

const POLL_MS = 4000

// A short two-tone chime via the Web Audio API -- no audio file asset
// needed, and it works the instant the page loads (assuming the kiosk
// browser/TV has already had a user interaction to unlock audio, which a
// one-time tap to open the page satisfies in every major browser).
function playChime() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)()
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

function announce(queueNumber) {
    if (!window.speechSynthesis) return

    playChime()

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
    const lastAnnouncedKey = useRef(null)

    useEffect(() => {
        loadQueue()
        const poll = setInterval(loadQueue, POLL_MS)
        const clockTick = setInterval(() => setClock(new Date()), 1000)
        return () => {
            clearInterval(poll)
            clearInterval(clockTick)
        }
    }, [])

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
                    announce(current.queue_number)
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
            <div className="qd-glow" />

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
                    <div key={nowServing} className={`qd-now-number${nowServing ? ' is-active' : ' is-idle'}`}>
                        {nowServing ? formatQueueNumber(nowServing) : '—'}
                    </div>
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
                    {/* Repeated enough times that even half this row (the
                        distance the -50% loop travels) is wider than any
                        realistic screen, so the ticker fills the full width
                        edge to edge instead of leaving blank space. */}
                    {Array.from({ length: 16 }).map((_, i) => (
                        <span key={i}>Please keep your ticket ready and listen for your number to be announced.</span>
                    ))}
                </div>
            </footer>

            <style>{`
                .qd-root {
                    position: relative;
                    min-height: 100vh;
                    display: flex;
                    flex-direction: column;
                    color: #0B1220;
                    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
                    background: #FFFFFF;
                    overflow: hidden;
                }

                .qd-glow {
                    position: absolute;
                    top: 30%;
                    left: 50%;
                    width: 900px;
                    height: 900px;
                    margin: -450px 0 0 -450px;
                    background: radial-gradient(circle, rgba(111,168,245,0.14) 0%, rgba(111,168,245,0) 70%);
                    pointer-events: none;
                    animation: qd-drift 9s ease-in-out infinite alternate;
                }

                .qd-header {
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 16px;
                    padding: 22px clamp(20px, 4vw, 56px);
                    border-bottom: 1px solid rgba(11,18,32,0.08);
                    background: #FAFBFD;
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
                    box-shadow: 0 0 0 2px rgba(11,18,32,0.08);
                }

                .qd-brand-name {
                    font-size: 19px;
                    font-weight: 700;
                    letter-spacing: 0.2px;
                    color: #0B1220;
                }

                .qd-brand-tag {
                    font-size: 12.5px;
                    color: rgba(11,18,32,0.55);
                    margin-top: 1px;
                }

                .qd-clock {
                    text-align: right;
                }

                .qd-clock-time {
                    font-size: 22px;
                    font-weight: 700;
                    font-variant-numeric: tabular-nums;
                    color: #0B1220;
                }

                .qd-clock-date {
                    font-size: 12.5px;
                    color: rgba(11,18,32,0.55);
                    margin-top: 1px;
                }

                .qd-main {
                    position: relative;
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: clamp(24px, 4vw, 48px) 24px;
                    gap: clamp(28px, 5vh, 56px);
                }

                .qd-eyebrow {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-size: clamp(15px, 1.6vw, 20px);
                    font-weight: 700;
                    letter-spacing: 4px;
                    color: rgba(11,18,32,0.6);
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
                    background: #6FA8F5;
                }

                .qd-eyebrow-ping {
                    position: absolute;
                    inset: 0;
                    border-radius: 50%;
                    background: #6FA8F5;
                    animation: qd-ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
                }

                .qd-now-card {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 14px;
                    padding: clamp(28px, 5vw, 56px) clamp(40px, 10vw, 120px);
                    border-radius: 32px;
                    background: linear-gradient(180deg, #F5F8FE, #EEF3FB);
                    border: 1px solid rgba(11,18,32,0.08);
                    box-shadow: 0 30px 70px -35px rgba(15,30,60,0.25);
                }

                .qd-now-card.is-flash {
                    animation: qd-flash 1s ease-in-out 3;
                }

                .qd-now-card.is-floating {
                    animation: qd-float 4.5s ease-in-out infinite;
                }

                .qd-now-number {
                    font-size: min(30vw, 260px);
                    font-weight: 800;
                    line-height: 1;
                    letter-spacing: -2px;
                    font-variant-numeric: tabular-nums;
                }

                .qd-now-number.is-active {
                    color: #123B78;
                    text-shadow: 0 0 50px rgba(111,168,245,0.35);
                    animation: qd-pulse-in 1.2s ease-out;
                }

                .qd-now-number.is-idle {
                    color: rgba(11,18,32,0.18);
                }

                .qd-now-sub {
                    font-size: clamp(14px, 1.8vw, 20px);
                    color: rgba(11,18,32,0.55);
                    letter-spacing: 0.3px;
                }

                .qd-upnext {
                    width: 100%;
                    max-width: 1000px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 18px;
                }

                .qd-upnext-label {
                    font-size: 15px;
                    font-weight: 700;
                    letter-spacing: 3px;
                    color: rgba(11,18,32,0.4);
                }

                .qd-upnext-empty {
                    font-size: 16px;
                    color: rgba(11,18,32,0.35);
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
                    padding: 14px 26px;
                    border-radius: 14px;
                    background: #F7F9FC;
                    border: 1px solid rgba(11,18,32,0.08);
                    color: rgba(11,18,32,0.8);
                }

                .qd-chip.is-next {
                    background: rgba(111,168,245,0.14);
                    border-color: rgba(111,168,245,0.45);
                    color: #123B78;
                    animation: qd-chip-glow 2.4s ease-in-out infinite;
                }

                .qd-chip-in {
                    animation: qd-chip-in 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
                }

                .qd-footer {
                    overflow: hidden;
                    font-size: 13px;
                    color: rgba(11,18,32,0.4);
                    letter-spacing: 0.3px;
                    padding: 14px 0 calc(14px + env(safe-area-inset-bottom, 0px));
                    border-top: 1px solid rgba(11,18,32,0.06);
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
                    padding-right: 64px;
                    flex-shrink: 0;
                }

                @keyframes qd-pulse-in {
                    0% { transform: scale(0.88); opacity: 0; }
                    45% { transform: scale(1.05); opacity: 1; }
                    100% { transform: scale(1); opacity: 1; }
                }

                @keyframes qd-flash {
                    0%, 100% { box-shadow: 0 30px 70px -35px rgba(15,30,60,0.25); }
                    50% { box-shadow: 0 0 0 6px rgba(111,168,245,0.35), 0 30px 70px -35px rgba(15,30,60,0.25); }
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
