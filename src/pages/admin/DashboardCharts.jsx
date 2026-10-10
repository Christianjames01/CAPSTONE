import { useMemo, useState } from 'react'
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

const polarToCartesian = (cx, cy, r, angleDeg) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

const donutSegmentPath = (cx, cy, rOuter, rInner, startAngle, endAngle) => {
    // A full circle can't be drawn as one arc; nudge it just short of 360.
    const end = endAngle - startAngle >= 360 ? startAngle + 359.99 : endAngle
    const startOuter = polarToCartesian(cx, cy, rOuter, end)
    const endOuter = polarToCartesian(cx, cy, rOuter, startAngle)
    const startInner = polarToCartesian(cx, cy, rInner, end)
    const endInner = polarToCartesian(cx, cy, rInner, startAngle)
    const largeArc = end - startAngle > 180 ? 1 : 0

    return [
        `M ${startOuter.x} ${startOuter.y}`,
        `A ${rOuter} ${rOuter} 0 ${largeArc} 0 ${endOuter.x} ${endOuter.y}`,
        `L ${endInner.x} ${endInner.y}`,
        `A ${rInner} ${rInner} 0 ${largeArc} 1 ${startInner.x} ${startInner.y}`,
        'Z',
    ].join(' ')
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

export function StatusDonutChart({ data }) {
    const [hoverKey, setHoverKey] = useState(null)
    const [showTable, setShowTable] = useState(false)

    const total = data.reduce((sum, d) => sum + d.value, 0)
    const pctOf = (v) => (total > 0 ? (v / total) * 100 : 0)

    const cx = 100
    const cy = 100
    const rOuter = 90
    const rInner = 66

    const wedges = data
        .filter((d) => d.value > 0)
        .reduce((acc, d) => {
            const start = acc.length ? acc[acc.length - 1].end : 0
            acc.push({ ...d, start, end: start + (d.value / total) * 360 })
            return acc
        }, [])

    const hovered = hoverKey ? data.find((d) => d.key === hoverKey) : null

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
                <div className="dash-donut-row">
                    <div className="dash-donut-wrap">
                        <svg viewBox="0 0 200 200" className="dash-donut-svg" role="img" aria-label={`Requests by status, ${total} total`}>
                            {wedges.map((w) => (
                                <path
                                    key={w.key}
                                    d={donutSegmentPath(cx, cy, hoverKey === w.key ? rOuter + 4 : rOuter, rInner, w.start, w.end)}
                                    style={{ fill: w.color }}
                                    className={`dash-donut-segment${hoverKey && hoverKey !== w.key ? ' is-dimmed' : ''}`}
                                    onMouseEnter={() => setHoverKey(w.key)}
                                    onMouseLeave={() => setHoverKey(null)}
                                    tabIndex={0}
                                    aria-label={`${w.label}: ${w.value} requests, ${pctOf(w.value).toFixed(0)}%`}
                                    onFocus={() => setHoverKey(w.key)}
                                    onBlur={() => setHoverKey(null)}
                                />
                            ))}
                        </svg>

                        {/* Center readout follows the hovered status, otherwise the total. */}
                        <div className="dash-donut-center" aria-hidden="true">
                            <span className="dash-donut-center-value">{hovered ? hovered.value : total}</span>
                            <span className="dash-donut-center-label">
                                {hovered ? `${hovered.label} · ${pctOf(hovered.value).toFixed(0)}%` : 'Total requests'}
                            </span>
                        </div>
                    </div>

                    <ul className="dash-legend">
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

    const width = 640
    const height = 250
    const padLeft = 34
    const padRight = 12
    const padTop = 14
    const padBottom = 34

    const plotWidth = width - padLeft - padRight
    const plotHeight = height - padTop - padBottom

    const { ticks, ceiling } = useMemo(() => integerTicks(Math.max(...data.map((d) => d.count), 0)), [data])

    const slot = data.length ? plotWidth / data.length : 0
    const barWidth = Math.min(28, Math.max(6, slot * 0.56))
    const xCenter = (i) => padLeft + slot * i + slot / 2
    const yAt = (v) => padTop + plotHeight - (v / ceiling) * plotHeight

    const totalInPeriod = data.reduce((sum, d) => sum + d.count, 0)
    const peak = data.reduce((best, d) => (d.count > (best?.count ?? -1) ? d : best), null)
    const labelEvery = data.length > 10 ? 2 : 1
    const lastIndex = data.length - 1

    const hovered = hoverIndex !== null ? data[hoverIndex] : null

    // Rounded top corners only, so each column sits flat on the baseline.
    const columnPath = (x, y, w, h) => {
        const r = Math.min(4, w / 2, h)
        return `M ${x} ${y + h} V ${y + r} Q ${x} ${y} ${x + r} ${y} H ${x + w - r} Q ${x + w} ${y} ${x + w} ${y + r} V ${y + h} Z`
    }

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
                                <text key={d.date} x={xCenter(i)} y={height - 10} textAnchor="middle" className={`dash-axis-label${i === lastIndex ? ' is-today' : ''}`}>
                                    {i === lastIndex ? 'Today' : formatDayLabel(d.date)}
                                </text>
                            ) : null
                        )}

                        {data.map((d, i) => {
                            const x = xCenter(i) - barWidth / 2
                            const y = yAt(d.count)
                            const h = padTop + plotHeight - y
                            return (
                                <g key={d.date}>
                                    {/* Full-height hit area so thin or empty days are easy to hover. */}
                                    <rect
                                        x={padLeft + slot * i}
                                        y={padTop}
                                        width={slot}
                                        height={plotHeight}
                                        className={`dash-column-hit${hoverIndex === i ? ' is-hover' : ''}`}
                                        onMouseEnter={() => setHoverIndex(i)}
                                    />
                                    {d.count > 0 && (
                                        <path
                                            d={columnPath(x, y, barWidth, h)}
                                            className={`dash-column${i === lastIndex ? ' is-today' : ''}${hoverIndex !== null && hoverIndex !== i ? ' is-dimmed' : ''}`}
                                        />
                                    )}
                                </g>
                            )
                        })}
                    </svg>

                    {hovered && (
                        <div
                            className="dash-tooltip"
                            style={{
                                left: `${(xCenter(hoverIndex) / width) * 100}%`,
                                top: `${(yAt(hovered.count) / height) * 100}%`,
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
