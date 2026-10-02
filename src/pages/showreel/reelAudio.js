// A synthesized soundtrack for the showreel (Web Audio, no files): 120 BPM
// kick + hats + bass, a riser into each cut, an impact on the cut, and a
// chime for the stamp and the end card. restart(offset) schedules the loop
// from that point.

export function createReelAudio({ duration, beat, cuts }) {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return null
    const ctx = new Ctx()
    const master = ctx.createGain()
    master.gain.value = 0.55
    master.connect(ctx.destination)

    let bus = null
    const noiseBuffer = (() => {
        const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
        const d = b.getChannelData(0)
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
        return b
    })()

    const env = (node, at, peak, attack, release) => {
        node.gain.setValueAtTime(0, at)
        node.gain.linearRampToValueAtTime(peak, at + attack)
        node.gain.exponentialRampToValueAtTime(0.0008, at + attack + release)
    }

    const kick = (at) => {
        const o = ctx.createOscillator()
        const g = ctx.createGain()
        o.frequency.setValueAtTime(150, at)
        o.frequency.exponentialRampToValueAtTime(42, at + 0.18)
        env(g, at, 0.9, 0.004, 0.32)
        o.connect(g).connect(bus)
        o.start(at)
        o.stop(at + 0.4)
    }

    const hat = (at, level = 0.12) => {
        const s = ctx.createBufferSource()
        s.buffer = noiseBuffer
        const f = ctx.createBiquadFilter()
        f.type = 'highpass'
        f.frequency.value = 7000
        const g = ctx.createGain()
        env(g, at, level, 0.002, 0.05)
        s.connect(f).connect(g).connect(bus)
        s.start(at, Math.random() * 0.5)
        s.stop(at + 0.08)
    }

    const bass = (at, freq) => {
        const o = ctx.createOscillator()
        o.type = 'sawtooth'
        o.frequency.value = freq
        const f = ctx.createBiquadFilter()
        f.type = 'lowpass'
        f.frequency.setValueAtTime(900, at)
        f.frequency.exponentialRampToValueAtTime(180, at + 0.25)
        const g = ctx.createGain()
        env(g, at, 0.18, 0.01, 0.28)
        o.connect(f).connect(g).connect(bus)
        o.start(at)
        o.stop(at + 0.35)
    }

    const riser = (at, len) => {
        const s = ctx.createBufferSource()
        s.buffer = noiseBuffer
        s.loop = true
        const f = ctx.createBiquadFilter()
        f.type = 'bandpass'
        f.Q.value = 2
        f.frequency.setValueAtTime(400, at)
        f.frequency.exponentialRampToValueAtTime(6000, at + len)
        const g = ctx.createGain()
        g.gain.setValueAtTime(0, at)
        g.gain.linearRampToValueAtTime(0.22, at + len)
        g.gain.linearRampToValueAtTime(0, at + len + 0.02)
        s.connect(f).connect(g).connect(bus)
        s.start(at)
        s.stop(at + len + 0.05)
    }

    const impact = (at) => {
        kick(at)
        const s = ctx.createBufferSource()
        s.buffer = noiseBuffer
        const f = ctx.createBiquadFilter()
        f.type = 'lowpass'
        f.frequency.value = 1800
        const g = ctx.createGain()
        env(g, at, 0.35, 0.003, 0.5)
        s.connect(f).connect(g).connect(bus)
        s.start(at)
        s.stop(at + 0.6)
    }

    const chime = (at, notes) => {
        notes.forEach((freq, i) => {
            const o = ctx.createOscillator()
            o.type = 'triangle'
            o.frequency.value = freq
            const g = ctx.createGain()
            env(g, at + i * 0.07, 0.16, 0.005, 1.1)
            o.connect(g).connect(bus)
            o.start(at + i * 0.07)
            o.stop(at + i * 0.07 + 1.3)
        })
    }

    // A minor-ish progression for the bass, one note per bar (4 beats).
    const BASS = [55, 55, 65.4, 49]

    function schedule(offset) {
        const start = ctx.currentTime + 0.05 - offset
        const at = (time) => start + time
        const inRange = (time) => time >= offset - 0.001 && time < duration
        for (let i = 0; i * beat < duration; i++) {
            const time = i * beat
            if (!inRange(time)) continue
            if (time < duration - 1.5) kick(at(time))
            hat(at(time + beat / 2))
            if (i % 2 === 1) hat(at(time + beat * 0.75), 0.06)
            bass(at(time), BASS[Math.floor(i / 4) % BASS.length])
        }
        cuts.forEach((c) => {
            if (c - 0.6 >= offset) riser(at(c - 0.6), 0.6)
            if (inRange(c)) impact(at(c))
        })
        if (inRange(11.6)) chime(at(11.6), [987.8, 1318.5])
        if (inRange(15.8)) chime(at(15.8), [523.3, 659.3, 784, 1046.5])
    }

    return {
        async restart(offset = 0) {
            if (ctx.state === 'suspended') await ctx.resume()
            if (bus) {
                const old = bus
                old.gain.setTargetAtTime(0, ctx.currentTime, 0.02)
                setTimeout(() => old.disconnect(), 300)
            }
            bus = ctx.createGain()
            bus.connect(master)
            schedule(offset)
        },
        stop() {
            if (!bus) return
            const old = bus
            bus = null
            old.gain.setTargetAtTime(0, ctx.currentTime, 0.02)
            setTimeout(() => old.disconnect(), 300)
        },
        dispose() {
            try { ctx.close() } catch { /* closed */ }
        },
    }
}
