// Building blocks shared by the explainer scenes.

// A small app window: traffic-light dots, a title and a body.
export function Window({ title, children, className = '' }) {
    return (
        <div className={`lpx-window ${className}`}>
            <div className="lpx-window-bar"><span /><span /><span /><em>{title}</em></div>
            <div className="lpx-window-body">{children}</div>
        </div>
    )
}

// A decorative, QR-looking pattern: three finder squares plus a fixed
// pseudo-random fill (same every render).
const QR_N = 21
const QR_CELLS = (() => {
    const finder = (x, y) => {
        for (const [fx, fy] of [[0, 0], [QR_N - 7, 0], [0, QR_N - 7]]) {
            const dx = x - fx
            const dy = y - fy
            if (dx >= 0 && dx < 7 && dy >= 0 && dy < 7) {
                const ring = Math.min(dx, dy, 6 - dx, 6 - dy)
                return ring === 0 || ring >= 2 ? 1 : 0
            }
            if (dx >= -1 && dx <= 7 && dy >= -1 && dy <= 7) return 0
        }
        return null
    }
    let seed = 7
    const cells = []
    for (let y = 0; y < QR_N; y++) {
        for (let x = 0; x < QR_N; x++) {
            const f = finder(x, y)
            seed = (seed * 16807) % 2147483647
            if (f === 1 || (f === null && seed % 100 < 46)) cells.push([x, y])
        }
    }
    return cells
})()

export function QrMark({ size = 64 }) {
    return (
        <svg className="lpm-qr" viewBox={`-1 -1 ${QR_N + 2} ${QR_N + 2}`} width={size} height={size} aria-hidden="true" shapeRendering="crispEdges">
            <rect x="-1" y="-1" width={QR_N + 2} height={QR_N + 2} fill="#fff" />
            {QR_CELLS.map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#0A2450" />)}
        </svg>
    )
}

// The last scene's buttons: a link (href) or an action (onClick).
export function CtaButton({ action, className }) {
    if (!action) return null
    return action.href
        ? <a className={className} href={action.href}>{action.label}</a>
        : <button type="button" className={className} onClick={(e) => { e.stopPropagation(); action.onClick?.() }}>{action.label}</button>
}
