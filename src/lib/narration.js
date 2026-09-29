// Spoken voice-over for the demos (the walkthrough videos and the guided
// demo), using the browser's built-in text-to-speech -- no audio files.
// Browsers only allow sound after a click, so each player has a Sound
// button; the choice is remembered on this device.

export const narrationSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window

const PREF_KEY = (name) => `certichain_demo_sound:${name}`

export function readSoundPref(name, fallback = false) {
    try {
        const v = localStorage.getItem(PREF_KEY(name))
        return v === null ? fallback : v === '1'
    } catch {
        return fallback
    }
}

export function writeSoundPref(name, on) {
    try { localStorage.setItem(PREF_KEY(name), on ? '1' : '0') } catch { /* storage unavailable */ }
}

// An English voice, preferring Philippine, then US, then any English.
let cachedVoice = null
function pickVoice() {
    if (cachedVoice) return cachedVoice
    const voices = window.speechSynthesis.getVoices()
    const english = voices.filter((v) => /^en/i.test(v.lang))
    cachedVoice =
        english.find((v) => /en[-_]PH/i.test(v.lang)) ||
        english.find((v) => /en[-_]US/i.test(v.lang) && /google|natural|online/i.test(v.name)) ||
        english.find((v) => /en[-_]US/i.test(v.lang)) ||
        english[0] ||
        null
    return cachedVoice
}

if (narrationSupported()) {
    window.speechSynthesis.addEventListener?.('voiceschanged', () => { cachedVoice = null })
}

// Symbols read badly aloud.
function forSpeech(text) {
    return String(text)
        .replace(/₱\s?(\d[\d,.]*)/g, '$1 pesos')
        .replace(/\bREQ-0*(\d+)/g, 'request $1')
        .replace(/\bQ-0*(\d+)/g, 'number $1')
        .replace(/\s*[—–]\s*/g, ', ')
        .replace(/→|›|▶/g, '')
        .replace(/\s+/g, ' ')
        .trim()
}

// Lines already said (or queued) for the current scene/step. The players
// can ask for the same line again when they re-render; it's only said once.
let saidLines = new Set()
// Who asked for what is being said (so one player stopping doesn't cut off
// another's voice).
let currentOwner = null

// interrupt: stop whatever is being said first (a new scene or step);
// otherwise it's queued after it (captions within a step).
// force: say it again even if it was already said (the viewer replayed it).
// owner: who is talking, for stopSpeaking(owner).
export function say(text, { interrupt = false, force = false, owner = null } = {}) {
    if (!narrationSupported() || !text) return
    const line = forSpeech(text)
    if (!line) return
    if (saidLines.has(line) && !force) return

    const synth = window.speechSynthesis
    if (interrupt) {
        synth.cancel()
        saidLines = new Set()
    }
    saidLines.add(line)
    currentOwner = owner

    const u = new SpeechSynthesisUtterance(line)
    const voice = pickVoice()
    if (voice) u.voice = voice
    u.lang = voice?.lang || 'en-US'
    u.rate = 1
    u.pitch = 1
    synth.speak(u)
}

// Pause / sound off / leaving: stop, and let the lines be said again later.
// With an owner, only if that owner is the one talking.
export function stopSpeaking(owner) {
    if (owner !== undefined && owner !== currentOwner) return
    currentOwner = null
    saidLines = new Set()
    if (narrationSupported()) window.speechSynthesis.cancel()
}

// Still talking (or about to)?
export function speaking() {
    return narrationSupported() && (window.speechSynthesis.speaking || window.speechSynthesis.pending)
}
