import { useId, useMemo, useState } from 'react'
import './DashboardCharts.css'

const formatDayLabel = (isoDate) =>
    new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })

const formatDayLong = (isoDate) =>
    new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })

// Whole-number axis ticks for request counts: never "1, 1, 2, 2" from
// rounding fractional steps. Aims for about 4 intervals.
const integerTicks = (max) => {
    const top = Math.max(max, 1)
    const rawStep = top / 4
    const magnitude = Math.pow(10, Math.floor(Math.log10(Math.max(rawStep, 1))))
    const step = Math.max(1, [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= rawStep) || magnitude * 10)
    const ceiling = Math.ceil(top / step) * step
    const ticks = []
    for (let v = 0; v <= ceiling; v += step) ticks.push(v)
    return { ticks, ceiling }
}

// Catmull-Rom through the points, converted to cubic Beziers: a smooth
// curve that still passes through every real data point (no overshoot
// smoothing that would imply counts the data doesn't have).
const smoothLinePath = (points) => {
    if (points.length === 0) return ''
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`

    let d = `M ${points[0].x} ${points[0].y}`
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i === 0 ? i : i - 1]
        const p1 = points[i]
        const p2 = points[i + 1]
        const p3 = points[i + 2 < points.length ? i + 2 : i + 1]
        const cp1x = p1.x + (p2.x - p0.x) / 6
        const cp1y = p1.y + (p2.y - p0.y) / 6
        const cp2x = p2.x - (p3.x - p1.x) / 6
        const cp2y = p2.y - (p3.y - p1.y) / 6
        d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`
    }
    return d
}

function ChartHead({ title, subtitle, showTable, onToggle }) {
    return (
        <div className="dash-chart-head">
            <div>
                <h3>{title}</h3>
                <p>{subtitle}</p>
            </div>
            <button className="dash-table-toggle" onClick={onToggle} aria-pressed={showTable}>
                {showTable ? 'View chart' : 'View as table'}
            </button>
        </div>
    )
}

export function StatusBreakdownChart({ data }) {
    const [hoverKey, setHoverKey] = useState(null)
    const [showTable, setShowTable] = useState(false)

    const total = data.reduce((sum, d) => sum + d.value, 0)
    const pctOf = (v) => (total > 0 ? (v / total) * 100 : 0)

    const segments = data
        .filter((d) => d.value > 0)
        .reduce((acc, d) => {
            const pct = pctOf(d.value)
            const start = acc.length ? acc[acc.length - 1].end : 0
            acc.push({ ...d, pct, start, end: start + pct })
            return acc
        }, [])

    return (
        <div className="dash-chart-card">
            <ChartHead
                title="Requests by Status"
                subtitle="Where every request currently sits in the process."
                showTable={showTable}
                onToggle={() => setShowTable((v) => !v)}
            />

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
                        {data.map((d) => (
                            <tr key={d.key}>
                                <td>
                                    <span className="dash-data-table-status-cell">
                                        <span className="dash-legend-key" style={{ background: d.color }} />
                                        {d.label}
                                    </span>
                                </td>
                                <td>{d.value}</td>
                                <td>{pctOf(d.value).toFixed(1)}%</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : total === 0 ? (
                <div className="dash-chart-empty">No requests yet.</div>
            ) : (
                <div className="dash-status-block">
                    <div className="dash-stackbar-total">
                        <span className="dash-stackbar-total-value">{total.toLocaleString()}</span>
                        <span className="dash-stackbar-total-label">total request{total === 1 ? '' : 's'}</span>
                    </div>

                    <div
                        className="dash-stackbar"
                        role="img"
                        aria-label={`Requests by status, ${total} total`}
                        onMouseLeave={() => setHoverKey(null)}
                    >
                        {segments.map((s) => (
                            <div
                                key={s.key}
                                className={`dash-stackbar-seg${hoverKey && hoverKey !== s.key ? ' is-dimmed' : ''}`}
                                style={{ width: `${s.pct}%`, background: s.color }}
                                onMouseEnter={() => setHoverKey(s.key)}
                                onFocus={() => setHoverKey(s.key)}
                                onBlur={() => setHoverKey(null)}
                                tabIndex={0}
                                role="img"
                                aria-label={`${s.label}: ${s.value} requests, ${s.pct.toFixed(0)}%`}
                            />
                        ))}
                    </div>

                    <ul className="dash-stack-legend">
                        {data.map((d) => (
                            <li
                                key={d.key}
                                className={[
                                    hoverKey === d.key ? 'active' : '',
                                    d.value === 0 ? 'is-empty' : '',
                                ].join(' ')}
                                onMouseEnter={() => d.value > 0 && setHoverKey(d.key)}
                                onMouseLeave={() => setHoverKey(null)}
                            >
                                <span className="dash-legend-key" style={{ background: d.color }} />
                                <span className="dash-legend-label">{d.label}</span>
                                <span className="dash-legend-value">{d.value}</span>
                                <span className="dash-legend-pct">{pctOf(d.value).toFixed(0)}%</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    )
}

export function RequestsTrendChart({ data }) {
    const [hoverIndex, setHoverIndex] = useState(null)
    const [showTable, setShowTable] = useState(false)
    const gradientId = useId()

    const width = 640
    const height = 250
    const padLeft = 34
    const padRight = 12
    const padTop = 14
    const padBottom = 34

    const plotWidth = width - padLeft - padRight
    const plotHeight = height - padTop - padBottom
    const baselineY = padTop + plotHeight

    const { ticks, ceiling } = useMemo(() => integerTicks(Math.max(...data.map((d) => d.count), 0)), [data])

    const slot = data.length > 1 ? plotWidth / (data.length - 1) : plotWidth
    const xAt = (i) => (data.length > 1 ? padLeft + slot * i : padLeft + plotWidth / 2)
    const yAt = (v) => padTop + plotHeight - (v / ceiling) * plotHeight

    const points = useMemo(
        () => data.map((d, i) => ({ x: xAt(i), y: yAt(d.count) })),
        [data, ceiling]
    )

    const linePath = useMemo(() => smoothLinePath(points), [points])
    const areaPath = points.length
        ? `${linePath} L ${points[points.length - 1].x} ${baselineY} L ${points[0].x} ${baselineY} Z`
        : ''

    const totalInPeriod = data.reduce((sum, d) => sum + d.count, 0)
    const peak = data.reduce((best, d) => (d.count > (best?.count ?? -1) ? d : best), null)
    const labelEvery = data.length > 10 ? 2 : 1
    const lastIndex = data.length - 1

    const hovered = hoverIndex !== null ? data[hoverIndex] : null
    const hoverPoint = hoverIndex !== null ? points[hoverIndex] : null

    return (
        <div className="dash-chart-card">
            <ChartHead
                title={`New Requests — Last ${data.length} Days`}
                subtitle={
                    totalInPeriod > 0
                        ? `${totalInPeriod} submitted · busiest day ${formatDayLabel(peak.date)} (${peak.count})`
                        : 'Daily volume of submitted document requests.'
                }
                showTable={showTable}
                onToggle={() => setShowTable((v) => !v)}
            />

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
                                <td>{formatDayLong(d.date)}</td>
                                <td>{d.count}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : totalInPeriod === 0 ? (
                <div className="dash-chart-empty">No requests in this period.</div>
            ) : (
                <div className="dash-line-wrap">
                    <svg
                        viewBox={`0 0 ${width} ${height}`}
                        className="dash-line-svg"
                        role="img"
                        aria-label={`New requests per day, ${totalInPeriod} in the last ${data.length} days`}
                        onMouseLeave={() => setHoverIndex(null)}
                    >
                        <defs>
                            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="var(--blue-accent, var(--blue))" stopOpacity="0.32" />
                                <stop offset="100%" stopColor="var(--blue-accent, var(--blue))" stopOpacity="0" />
                            </linearGradient>
                        </defs>

                        {ticks.map((t) => {
                            const y = yAt(t)
                            return (
                                <g key={t}>
                                    <line x1={padLeft} y1={y} x2={width - padRight} y2={y} className={t === 0 ? 'dash-baseline' : 'dash-gridline'} />
                                    <text x={padLeft - 8} y={y + 4} textAnchor="end" className="dash-axis-label">{t}</text>
                                </g>
                            )
                        })}

                        {data.map((d, i) =>
                            i % labelEvery === (lastIndex % labelEvery) ? (
                                <text key={d.date} x={xAt(i)} y={height - 10} textAnchor="middle" className={`dash-axis-label${i === lastIndex ? ' is-today' : ''}`}>
                                    {i === lastIndex ? 'Today' : formatDayLabel(d.date)}
                                </text>
                            ) : null
                        )}

                        <path d={areaPath} className="dash-area-fill" fill={`url(#${gradientId})`} />
                        <path d={linePath} className="dash-area-line" fill="none" />

                        {points.map((p, i) => {
                            const hitX = Math.max(padLeft, p.x - slot / 2)
                            const hitRight = Math.min(padLeft + plotWidth, p.x + slot / 2)
                            return (
                                <rect
                                    key={data[i].date}
                                    x={hitX}
                                    y={padTop}
                                    width={Math.max(0, hitRight - hitX)}
                                    height={plotHeight}
                                    className="dash-point-hit"
                                    onMouseEnter={() => setHoverIndex(i)}
                                />
                            )
                        })}

                        {hoverPoint && (
                            <line x1={hoverPoint.x} y1={padTop} x2={hoverPoint.x} y2={baselineY} className="dash-hover-line" />
                        )}

                        {points.map((p, i) => (
                            <circle
                                key={`dot-${data[i].date}`}
                                cx={p.x}
                                cy={p.y}
                                r={i === lastIndex ? 3.5 : 2.5}
                                className={`dash-area-dot${i === lastIndex ? ' is-today' : ''}${hoverIndex !== null && hoverIndex !== i ? ' is-dimmed' : ''}`}
                            />
                        ))}

                        {hoverPoint && (
                            <circle cx={hoverPoint.x} cy={hoverPoint.y} r={5.5} className="dash-area-dot is-hover" />
                        )}
                    </svg>

                    {hovered && hoverPoint && (
                        <div
                            className="dash-tooltip"
                            style={{
                                left: `${(hoverPoint.x / width) * 100}%`,
                                top: `${(hoverPoint.y / height) * 100}%`,
                            }}
                        >
                            <strong>{hovered.count} {hovered.count === 1 ? 'request' : 'requests'}</strong>
                            <span className="dash-tooltip-sub">{formatDayLong(hovered.date)}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
