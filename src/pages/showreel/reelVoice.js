// Female voice-over for the showreel, using the browser's speech voices.
// Prefers natural/neural female English voices (Edge: Aria, Jenny, Ava, Emma,
// Michelle, Sonia, Libby; Chrome: Google UK English Female; Apple: Samantha).

const FEMALE = /aria|jenny|ava|emma|michelle|sonia|libby|natasha|clara|aria|zira|samantha|karen|moira|tessa|fiona|victoria|serena|female|woman|girl|salli|joanna|kendra|kimberly|ivy|hazel|susan|catherine|nicky/i
const MALE = /david|mark|guy|andrew|brian|ryan|william|daniel|george|james|fred|alex\b|tom\b|male\b/i

function score(v) {
    const name = `${v.name} ${v.voiceURI}`
    if (!/^en/i.test(v.lang)) return -1
    let s = 0
    if (FEMALE.test(name)) s += 100
    if (MALE.test(name) && !FEMALE.test(name)) s -= 200
    if (/natural|neural|online/i.test(name)) s += 60
    if (/google/i.test(name)) s += 25
    if (/en[-_](us|gb|au|ph)/i.test(v.lang)) s += 5
    return s
}

export function pickFemaleVoice() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null
    const voices = window.speechSynthesis.getVoices().filter((v) => score(v) >= 0)
    voices.sort((a, b) => score(b) - score(a))
    return voices[0] || null
}

export function speakLine(text, { onStart, onEnd } = {}) {
    if (!('speechSynthesis' in window)) return
    const synth = window.speechSynthesis
    synth.cancel()
    const u = new SpeechSynthesisUtterance(text)
    const voice = pickFemaleVoice()
    if (voice) {
        u.voice = voice
        u.lang = voice.lang
    } else {
        u.lang = 'en-US'
    }
    // Brighter and a touch quicker, like a promo read.
    u.pitch = voice && /natural|neural|online/i.test(voice.name) ? 1.05 : 1.2
    u.rate = 1.05
    u.onstart = () => onStart?.()
    u.onend = () => onEnd?.()
    u.onerror = () => onEnd?.()
    synth.speak(u)
}

export function stopVoice() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
}

// Voices load asynchronously in Chrome.
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.getVoices()
    window.speechSynthesis.addEventListener?.('voiceschanged', () => window.speechSynthesis.getVoices())
}
