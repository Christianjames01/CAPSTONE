// Easing and timing helpers for the demo video.
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
export const seg = (t, a, b) => clamp((t - a) / (b - a))
export const outExpo = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x))
export const inOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
export const outBack = (x) => {
    const c1 = 1.7
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}
export const lerp = (a, b, k) => a + (b - a) * k

// Text typed out between a and b.
export const typed = (text, l, a, b) => text.slice(0, Math.round(seg(l, a, b) * text.length))
