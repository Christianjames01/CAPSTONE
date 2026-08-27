import { useMemo, useRef, useState } from 'react'
import './DashboardCharts.css'

// ==========================================
// SHARED HELPERS
// ==========================================

const formatDayLabel = (isoDate) =>
    new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })

const niceMax = (value) => {
    if (value <= 0) return 4
    const magnitude = Math.pow(10, Math.floor(Math.log10(value)))
    const step = value / magnitude <= 2 ? magnitude / 2 : magnitude
    return Math.ceil(value / step) * step
}

const polarToCartesian = (cx, cy, r, angleDeg) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

const donutSegmentPath = (cx, cy, rOuter, rInner, startAngle, endAngle) => {
    const startOuter = polarToCartesian(cx, cy, rOuter, endAngle)
    const endOuter = polarToCartesian(cx, cy, rOuter, startAngle)
    const startInner = polarToCartesian(cx, cy, rInner, endAngle)
    const endInner = polarToCartesian(cx, cy, rInner, startAngle)
    const largeArc = endAngle - startAngle > 180 ? 1 : 0

    return [
        `M ${startOuter.x} ${startOuter.y}`,
        `A ${rOuter} ${rOuter} 0 ${largeArc} 0 ${endOuter.x} ${endOuter.y}`,
        `L ${endInner.x} ${endInner.y}`,
        `A ${rInner} ${rInner} 0 ${largeArc} 1 ${startInner.x} ${startInner.y}`,
        'Z',
    ].join(' ')
}

// ==========================================
// STATUS DONUT CHART (part-to-whole, <= 6 segments)
// ==========================================

export function StatusDonutChart({ data }) {
    const [hoverKey, setHoverKey] = useState(null)
    const [tooltip, setTooltip] = useState(null)
    const [showTable, setShowTable] = useState(false)
    const containerRef = useRef(null)

    const total = data.reduce((sum, d) => sum + d.value, 0)
    const segments = data.filter((d) => d.value > 0)

    const cx = 100
    const cy = 100
    const rOuter = 92
    const rInner = 58
    const gapDeg = 2.5

    const wedges = segments.reduce((acc, d) => {
        const cursor = acc.length ? acc[acc.length - 1].cursorEnd : 0
        const span = total > 0 ? (d.value / total) * 360 : 0
        const gap = Math.min(gapDeg, span * 0.3)
        const start = cursor + gap / 2
        const end = cursor + span - gap / 2

        acc.push({ ...d, start, end, cursorEnd: cursor + span, pct: total > 0 ? (d.value / total) * 100 : 0 })
        return acc
    }, [])

    const showMouse = (e, wedge) => {
        const rect = containerRef.current.getBoundingClientRect()
        setTooltip({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            label: wedge.label,
            value: wedge.value,
            pct: wedge.pct,
        })
    }

    return (
        <div className="dash-chart-card">
            <div className="dash-chart-head">
                <div>
                    <h3>Requests by Status</h3>
                    <p>Current distribution across the request lifecycle.</p>
                </div>
                <button className="dash-table-toggle" onClick={() => setShowTable((v) => !v)}>
                    {showTable ? 'View chart' : 'View as table'}
                </button>
            </div>

            {showTable ? (
                <table className="dash-data-table">
                    <thead>
                        <tr>
                            <th>Status</th>
                            <th>Requests</th>
                            <th>Share</th>
                        </tr>
                    </thead>
                    <tbody>
                        {segments.map((d) => (
                            <tr key={d.key}>
                                <td>
                                    <span className="dash-data-table-status-cell">
                                        <span className="dash-legend-key" style={{ background: d.color }} />
                                        {d.label}
                                    </span>
                                </td>
                                <td>{d.value}</td>
                                <td>{total > 0 ? ((d.value / total) * 100).toFixed(1) : '0.0'}%</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : (
                <div className="dash-donut-row">
                    <div className="dash-donut-wrap" ref={containerRef}>
                        {total === 0 ? (
                            <div className="dash-chart-empty">No requests yet.</div>
                        ) : (
                            <svg viewBox="0 0 200 200" className="dash-donut-svg" role="img" aria-label="Requests by status">
                                {wedges.map((w) => (
                                    <path
                                        key={w.key}
                                        d={donutSegmentPath(cx, cy, hoverKey === w.key ? rOuter + 3 : rOuter, rInner, w.start, w.end)}
                                        fill={w.color}
                                        className="dash-donut-segment"
                                        onMouseEnter={() => setHoverKey(w.key)}
                                        onMouseMove={(e) => showMouse(e, w)}
                                        onMouseLeave={() => { setHoverKey(null); setTooltip(null) }}
                                        tabIndex={0}
                                        onFocus={(e) => { setHoverKey(w.key); showMouse(e, w) }}
                                        onBlur={() => { setHoverKey(null); setTooltip(null) }}
                                    />
                                ))}
                                <text x={cx} y={cy - 6} textAnchor="middle" className="dash-donut-total">{total}</text>
                                <text x={cx} y={cy + 16} textAnchor="middle" className="dash-donut-total-label">requests</text>
                            </svg>
                        )}

                        {tooltip && (
                            <div className="dash-tooltip" style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}>
                                <strong>{tooltip.value}</strong> {tooltip.label}
                                <span className="dash-tooltip-sub">{tooltip.pct.toFixed(1)}% of total</span>
                            </div>
                        )}
                    </div>

                    <ul className="dash-legend">
                        {segments.map((d) => (
                            <li key={d.key} className={hoverKey === d.key ? 'active' : ''}>
                                <span className="dash-legend-key" style={{ background: d.color }} />
                                <span className="dash-legend-label">{d.label}</span>
                                <span className="dash-legend-value">{d.value}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    )
}

// ==========================================
// REQUESTS TREND LINE CHART (single series, over time)
// ==========================================

export function RequestsTrendChart({ data }) {
    const [hoverIndex, setHoverIndex] = useState(null)
    const [showTable, setShowTable] = useState(false)
    const svgRef = useRef(null)

    const width = 640
    const height = 240
    const padLeft = 36
    const padRight = 16
    const padTop = 16
    const padBottom = 34

    const plotWidth = width - padLeft - padRight
    const plotHeight = height - padTop - padBottom

    const maxValue = useMemo(() => niceMax(Math.max(...data.map((d) => d.count), 0)), [data])
    const stepX = data.length > 1 ? plotWidth / (data.length - 1) : 0

    const xAt = (i) => padLeft + stepX * i
    const yAt = (v) => padTop + plotHeight - (maxValue === 0 ? 0 : (v / maxValue) * plotHeight)

    const linePath = data
        .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i)} ${yAt(d.count)}`)
        .join(' ')

    const areaPath =
        `${linePath} L ${xAt(data.length - 1)} ${padTop + plotHeight} L ${xAt(0)} ${padTop + plotHeight} Z`

    const gridSteps = [0, 0.25, 0.5, 0.75, 1]

    const labelEvery = data.length > 10 ? 2 : 1

    const handleMove = (e) => {
        if (!svgRef.current || data.length === 0) return

        const rect = svgRef.current.getBoundingClientRect()
        const relX = ((e.clientX - rect.left) / rect.width) * width
        const idx = Math.round((relX - padLeft) / (stepX || 1))

        setHoverIndex(Math.min(Math.max(idx, 0), data.length - 1))
    }

    const hovered = hoverIndex !== null ? data[hoverIndex] : null
    const last = data[data.length - 1]

    return (
        <div className="dash-chart-card">
            <div className="dash-chart-head">
                <div>
                    <h3>New Requests — Last {data.length} Days</h3>
                    <p>Daily volume of submitted document requests.</p>
                </div>
                <button className="dash-table-toggle" onClick={() => setShowTable((v) => !v)}>
                    {showTable ? 'View chart' : 'View as table'}
                </button>
            </div>

            {showTable ? (
                <table className="dash-data-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Requests</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((d) => (
                            <tr key={d.date}>
                                <td>{formatDayLabel(d.date)}</td>
                                <td>{d.count}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : data.every((d) => d.count === 0) ? (
                <div className="dash-chart-empty">No requests in this period.</div>
            ) : (
                <div className="dash-line-wrap">
                    <svg
                        ref={svgRef}
                        viewBox={`0 0 ${width} ${height}`}
                        className="dash-line-svg"
                        role="img"
                        aria-label="New requests per day"
                        onMouseMove={handleMove}
                        onMouseLeave={() => setHoverIndex(null)}
                    >
                        {gridSteps.map((g) => {
                            const y = padTop + plotHeight - g * plotHeight
                            return (
                                <g key={g}>
                                    <line x1={padLeft} y1={y} x2={width - padRight} y2={y} className="dash-gridline" />
                                    <text x={padLeft - 8} y={y + 4} textAnchor="end" className="dash-axis-label">
                                        {Math.round(maxValue * g).toLocaleString()}
                                    </text>
                                </g>
                            )
                        })}

                        {data.map((d, i) =>
                            i % labelEvery === 0 ? (
                                <text key={d.date} x={xAt(i)} y={height - 10} textAnchor="middle" className="dash-axis-label">
                                    {formatDayLabel(d.date)}
                                </text>
                            ) : null
                        )}

                        <path d={areaPath} className="dash-area-fill" />
                        <path d={linePath} className="dash-line-stroke" />

                        <circle cx={xAt(data.length - 1)} cy={yAt(last.count)} r="4" className="dash-line-end-dot" />
                        <text x={xAt(data.length - 1) - 8} y={yAt(last.count) - 10} textAnchor="end" className="dash-line-end-label">
                            {last.count}
                        </text>

                        {hovered && (
                            <g>
                                <line
                                    x1={xAt(hoverIndex)} y1={padTop}
                                    x2={xAt(hoverIndex)} y2={padTop + plotHeight}
                                    className="dash-crosshair"
                                />
                                <circle cx={xAt(hoverIndex)} cy={yAt(hovered.count)} r="5" className="dash-hover-dot" />
                            </g>
                        )}
                    </svg>

                    {hovered && (
                        <div
                            className="dash-tooltip"
                            style={{
                                left: `${(xAt(hoverIndex) / width) * 100}%`,
                                top: `${(yAt(hovered.count) / height) * 100}%`,
                            }}
                        >
                            <strong>{hovered.count}</strong> requests
                            <span className="dash-tooltip-sub">{formatDayLabel(hovered.date)}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
