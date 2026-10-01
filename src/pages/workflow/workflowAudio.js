// Music and sound effects for the System Workflow presentation, made live
// with the Web Audio API (no audio files): a soft, slow ambient pad with a
// gentle pluck, and subtle interface sounds. The music ducks while the
// narrator speaks so the voice always stays on top.

const MUSIC_LEVEL = 0.16
const MUSIC_DUCKED = 0.05
const SFX_LEVEL = 0.32

// Cmaj9 -> Am9 -> Fmaj9 -> G6/9, voiced low and wide.
const CHORDS = [
    [48, 55, 59, 62, 64],
    [45, 52, 55, 59, 60],
    [41, 48, 52, 55, 57],
    [43, 50, 52, 57, 59],
]
const CHORD_SECONDS = 8

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12)

function makeImpulse(ctx, seconds = 3.2, decay = 3) {
    const rate = ctx.sampleRate
    const length = Math.floor(rate * seconds)
    const impulse = ctx.createBuffer(2, length, rate)
    for (let c = 0; c < 2; c++) {
        const data = impulse.getChannelData(c)
        for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay)
    }
    return impulse
}

export function createWorkflowAudio() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return null

    const ctx = new AudioCtx()
    const master = ctx.createGain()
    master.gain.value = 1
    master.connect(ctx.destination)

    // Shared soft reverb.
    const reverb = ctx.createConvolver()
    reverb.buffer = makeImpulse(ctx)
    const reverbGain = ctx.createGain()
    reverbGain.gain.value = 0.55
    reverb.connect(reverbGain).connect(master)

    const musicBus = ctx.createGain()
    musicBus.gain.value = 0
    const musicFilter = ctx.createBiquadFilter()
    musicFilter.type = 'lowpass'
    musicFilter.frequency.value = 1400
    musicBus.connect(musicFilter)
    musicFilter.connect(master)
    musicFilter.connect(reverb)

    const sfxBus = ctx.createGain()
    sfxBus.gain.value = SFX_LEVEL
    sfxBus.connect(master)
    const sfxSend = ctx.createGain()
    sfxSend.gain.value = 0.35
    sfxBus.connect(sfxSend).connect(reverb)

    let musicOn = true
    let sfxOn = true
    let ducked = false
    let musicTimer = null
    let chordIndex = 0
    let running = false

    const musicTarget = () => (!musicOn || !running ? 0 : ducked ? MUSIC_DUCKED : MUSIC_LEVEL)
    const applyMusicLevel = (seconds = 0.8) => {
        const now = ctx.currentTime
        musicBus.gain.cancelScheduledValues(now)
        musicBus.gain.setValueAtTime(musicBus.gain.value, now)
        musicBus.gain.linearRampToValueAtTime(musicTarget(), now + seconds)
    }

    // One chord: detuned soft oscillators with slow swells.
    function playChord(notes, start) {
        const dur = CHORD_SECONDS + 3
        notes.forEach((note, i) => {
            for (const detune of [-6, 5]) {
                const osc = ctx.createOscillator()
                osc.type = i === 0 ? 'sine' : 'triangle'
                osc.frequency.value = midiHz(note)
                osc.detune.value = detune
                const g = ctx.createGain()
                const peak = (i === 0 ? 0.22 : 0.07) / 2
                g.gain.setValueAtTime(0, start)
                g.gain.linearRampToValueAtTime(peak, start + 2.6)
                g.gain.setValueAtTime(peak, start + dur - 3.4)
                g.gain.linearRampToValueAtTime(0, start + dur)
                osc.connect(g).connect(musicBus)
                osc.start(start)
                osc.stop(start + dur + 0.1)
            }
        })

        // A few quiet plucks from the chord, like a slow arpeggio.
        const pluckNotes = notes.slice(2).map((n) => n + 12)
        for (let k = 0; k < 4; k++) {
            const note = pluckNotes[(k * 2 + chordIndex) % pluckNotes.length]
            const t = start + 0.6 + k * (CHORD_SECONDS / 4) + Math.random() * 0.3
            const osc = ctx.createOscillator()
            osc.type = 'sine'
            osc.frequency.value = midiHz(note)
            const g = ctx.createGain()
            g.gain.setValueAtTime(0, t)
            g.gain.linearRampToValueAtTime(0.05, t + 0.02)
            g.gain.exponentialRampToValueAtTime(0.0008, t + 2.4)
            osc.connect(g).connect(musicBus)
            osc.start(t)
            osc.stop(t + 2.5)
        }
    }

    function scheduleMusic() {
        const start = ctx.currentTime + 0.1
        playChord(CHORDS[chordIndex % CHORDS.length], start)
        chordIndex += 1
        musicTimer = setTimeout(scheduleMusic, CHORD_SECONDS * 1000)
    }

    // ---- Sound effects -------------------------------------------------
    const tone = (freq, { type = 'sine', at = 0, dur = 0.25, peak = 0.5, attack = 0.005, to = null } = {}) => {
        const t = ctx.currentTime + at
        const osc = ctx.createOscillator()
        osc.type = type
        osc.frequency.setValueAtTime(freq, t)
        if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur)
        const g = ctx.createGain()
        g.gain.setValueAtTime(0, t)
        g.gain.linearRampToValueAtTime(peak, t + attack)
        g.gain.exponentialRampToValueAtTime(0.0005, t + dur)
        osc.connect(g).connect(sfxBus)
        osc.start(t)
        osc.stop(t + dur + 0.05)
    }

    const noise = ({ at = 0, dur = 0.6, peak = 0.25, from = 400, to = 2400, q = 1.2 } = {}) => {
        const t = ctx.currentTime + at
        const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate)
        const data = buffer.getChannelData(0)
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
        const src = ctx.createBufferSource()
        src.buffer = buffer
        const filter = ctx.createBiquadFilter()
        filter.type = 'bandpass'
        filter.Q.value = q
        filter.frequency.setValueAtTime(from, t)
        filter.frequency.exponentialRampToValueAtTime(to, t + dur)
        const g = ctx.createGain()
        g.gain.setValueAtTime(0, t)
        g.gain.linearRampToValueAtTime(peak, t + dur * 0.4)
        g.gain.linearRampToValueAtTime(0, t + dur)
        src.connect(filter).connect(g).connect(sfxBus)
        src.start(t)
        src.stop(t + dur + 0.05)
    }

    const SFX = {
        click: () => { tone(2200, { dur: 0.05, peak: 0.25 }); tone(1300, { dur: 0.07, peak: 0.18, at: 0.012 }) },
        tick: () => tone(1760, { dur: 0.09, peak: 0.16, type: 'triangle' }),
        panel: () => { noise({ dur: 0.45, peak: 0.12, from: 600, to: 3200 }); tone(880, { dur: 0.4, peak: 0.08, at: 0.1, type: 'triangle' }) },
        transfer: () => noise({ dur: 0.9, peak: 0.16, from: 300, to: 3000, q: 0.8 }),
        upload: () => { tone(440, { dur: 1.6, peak: 0.07, to: 880, attack: 0.3 }); noise({ dur: 1.5, peak: 0.07, from: 500, to: 2600 }) },
        server: () => { tone(110, { dur: 1.6, peak: 0.16, attack: 0.5 }); [0.5, 0.75, 1.0].forEach((at) => tone(2600, { at, dur: 0.05, peak: 0.08 })) },
        scan: () => { tone(620, { dur: 4.2, peak: 0.05, to: 640, attack: 0.6 }); noise({ dur: 4.2, peak: 0.04, from: 1800, to: 2200, q: 6 }) },
        shimmer: () => [0, 0.12, 0.24, 0.36, 0.48].forEach((at, i) => tone(1568 * Math.pow(1.122, i), { at, dur: 0.9, peak: 0.06, type: 'sine' })),
        confirm: () => { tone(659.3, { dur: 0.6, peak: 0.22, type: 'triangle' }); tone(987.8, { at: 0.12, dur: 0.9, peak: 0.2, type: 'triangle' }) },
        notify: () => [0, 0.14, 0.28].forEach((at, i) => tone([784, 988, 1175][i], { at, dur: 0.5, peak: 0.18, type: 'sine' })),
        calendar: () => { tone(1500, { dur: 0.05, peak: 0.12 }); tone(1500, { at: 0.16, dur: 0.05, peak: 0.12 }); tone(1046.5, { at: 0.34, dur: 0.8, peak: 0.16, type: 'triangle' }) },
        complete: () => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, { at: i * 0.13, dur: 1.8, peak: 0.16, type: 'triangle' })),
        swell: () => { noise({ dur: 2.6, peak: 0.06, from: 200, to: 1600, q: 0.6 }); [523.25, 783.99, 1046.5].forEach((f, i) => tone(f, { at: 0.8 + i * 0.05, dur: 3.2, peak: 0.08, attack: 0.6 })) },
    }

    return {
        async start() {
            if (ctx.state === 'suspended') await ctx.resume()
            if (running) return
            running = true
            scheduleMusic()
            applyMusicLevel(2.5)
        },
        pause() {
            running = false
            applyMusicLevel(0.6)
            clearTimeout(musicTimer)
            musicTimer = null
        },
        play(name) {
            if (!sfxOn || !running || !SFX[name]) return
            try { SFX[name]() } catch { /* audio unavailable */ }
        },
        setDucked(value) {
            if (ducked === value) return
            ducked = value
            applyMusicLevel(value ? 0.35 : 1.4)
        },
        setMusic(on) { musicOn = on; applyMusicLevel(0.8) },
        setSfx(on) { sfxOn = on },
        dispose() {
            clearTimeout(musicTimer)
            try { ctx.close() } catch { /* already closed */ }
        },
    }
}
