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
                if (!isFirstCheck) announce(current.queue_number)
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
        <div
            style={{
                minHeight: '100vh',
                background: '#0B1220',
                color: '#F5F7FA',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                fontFamily: 'system-ui, sans-serif',
                padding: '32px 24px',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 40 }}>
                <img src={hcdcLogo} alt="" style={{ width: 56, height: 56, borderRadius: '50%' }} />
                <div>
                    <div style={{ fontSize: 22, fontWeight: 700 }}>CertiChain Registrar</div>
                    <div style={{ fontSize: 14, opacity: 0.65 }}>
                        {clock.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })}
                        {' · '}
                        {clock.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
                    </div>
                </div>
            </div>

            <div style={{ fontSize: 24, letterSpacing: 2, opacity: 0.7, marginBottom: 12 }}>NOW SERVING</div>

            <div
                key={nowServing}
                style={{
                    fontSize: 'min(28vw, 220px)',
                    fontWeight: 800,
                    lineHeight: 1,
                    color: nowServing ? '#6FA8F5' : 'rgba(245,247,250,0.3)',
                    animation: nowServing ? 'queue-pulse 1.4s ease-out' : 'none',
                }}
            >
                {nowServing ? formatQueueNumber(nowServing) : '—'}
            </div>

            <div style={{ marginTop: 56, width: '100%', maxWidth: 900 }}>
                <div style={{ fontSize: 18, letterSpacing: 1.5, opacity: 0.6, marginBottom: 16, textAlign: 'center' }}>UP NEXT</div>

                {upNext.length === 0 ? (
                    <div style={{ textAlign: 'center', opacity: 0.5, fontSize: 18 }}>No one else is waiting.</div>
                ) : (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 20, flexWrap: 'wrap' }}>
                        {upNext.map((n) => (
                            <div
                                key={n}
                                style={{
                                    fontSize: 32,
                                    fontWeight: 700,
                                    background: 'rgba(255,255,255,0.06)',
                                    border: '1px solid rgba(255,255,255,0.12)',
                                    borderRadius: 12,
                                    padding: '14px 22px',
                                }}
                            >
                                {formatQueueNumber(n)}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <style>{`
                @keyframes queue-pulse {
                    0% { transform: scale(0.9); opacity: 0.4; }
                    30% { transform: scale(1.06); opacity: 1; }
                    100% { transform: scale(1); opacity: 1; }
                }
            `}</style>
        </div>
    )
}

export default QueueDisplay
