import './Skeleton.css'

// Shared loading placeholders for every role (admin, employee, student).
// Each group is wrapped in a live region so screen readers announce
// "Loading…" once, while the shimmer blocks themselves stay hidden from them.

function LoadingRegion({ label = 'Loading…', className = '', children, style }) {
    return (
        <div className={`skeleton-region ${className}`} role="status" aria-live="polite" aria-busy="true" style={style}>
            <span className="skeleton-sr-only">{label}</span>
            {children}
        </div>
    )
}

export function Skeleton({ width = '100%', height = 14, radius = 6, style, className = '' }) {
    return (
        <div
            aria-hidden="true"
            className={`skeleton-block ${className}`}
            style={{ width, height, borderRadius: radius, ...style }}
        />
    )
}

export function SkeletonPageHeader() {
    return (
        <LoadingRegion className="skeleton-page-header">
            <Skeleton width={220} height={28} radius={8} />
            <Skeleton width="min(360px, 80%)" height={14} style={{ marginTop: 10 }} />
        </LoadingRegion>
    )
}

export function SkeletonStatGrid({
    count = 5,
    gridClassName = 'skeleton-stat-grid',
    cardClassName = 'skeleton-stat-card',
    cardStyle,
    icon = true,
}) {
    return (
        <LoadingRegion className={gridClassName}>
            {Array.from({ length: count }).map((_, i) => (
                <div className={`${cardClassName} skeleton-card`} style={{ ...cardStyle, animationDelay: `${i * 60}ms` }} key={i}>
                    {icon && <Skeleton width={42} height={42} radius={12} />}
                    <div style={{ flex: 1, width: '100%' }}>
                        <Skeleton width={icon ? 44 : 56} height={icon ? 22 : 28} radius={6} style={{ marginBottom: 8 }} />
                        <Skeleton width="70%" height={11} />
                    </div>
                </div>
            ))}
        </LoadingRegion>
    )
}

// Varying widths so a stack of cards reads like real content, not a grid of clones.
const TITLE_WIDTHS = ['48%', '38%', '56%', '42%', '52%']
const SUBTITLE_WIDTHS = ['28%', '34%', '22%', '30%', '26%']

export function SkeletonList({ count = 3, fields = 3 }) {
    return (
        <LoadingRegion>
            {Array.from({ length: count }).map((_, i) => (
                <div className="skeleton-list-card skeleton-card" style={{ animationDelay: `${i * 70}ms` }} key={i}>
                    <div className="skeleton-list-card-header">
                        <div style={{ flex: 1 }}>
                            <Skeleton width={TITLE_WIDTHS[i % TITLE_WIDTHS.length]} height={16} style={{ marginBottom: 9 }} />
                            <Skeleton width={SUBTITLE_WIDTHS[i % SUBTITLE_WIDTHS.length]} height={12} />
                        </div>
                        <Skeleton width={78} height={24} radius={20} />
                    </div>
                    {fields > 0 && (
                        <div className="skeleton-list-card-fields">
                            {Array.from({ length: fields }).map((__, j) => (
                                <div key={j}>
                                    <Skeleton width="55%" height={10} style={{ marginBottom: 7 }} />
                                    <Skeleton width={j % 2 ? '70%' : '85%'} height={13} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </LoadingRegion>
    )
}

export function SkeletonForm({ rows = 3 }) {
    return (
        <LoadingRegion>
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} style={{ marginBottom: 18 }}>
                    <Skeleton width={96} height={11} style={{ marginBottom: 8 }} />
                    <Skeleton width="100%" height={42} radius={8} />
                </div>
            ))}
        </LoadingRegion>
    )
}

export function SkeletonFormRow({ rows = 2 }) {
    return (
        <LoadingRegion>
            {Array.from({ length: rows }).map((_, i) => (
                <div className="skeleton-form-row" key={i}>
                    {[0, 1].map((j) => (
                        <div key={j}>
                            <Skeleton width={96} height={11} style={{ marginBottom: 8 }} />
                            <Skeleton width="100%" height={42} radius={8} />
                        </div>
                    ))}
                </div>
            ))}
        </LoadingRegion>
    )
}

export function SkeletonDetailCard({ fields = 6 }) {
    return (
        <LoadingRegion className="skeleton-list-card skeleton-card">
            <Skeleton width="32%" height={18} radius={6} style={{ marginBottom: 20 }} />
            <div className="skeleton-list-card-fields">
                {Array.from({ length: fields }).map((_, i) => (
                    <div key={i}>
                        <Skeleton width="55%" height={10} style={{ marginBottom: 7 }} />
                        <Skeleton width={i % 3 === 1 ? '65%' : '85%'} height={13} />
                    </div>
                ))}
            </div>
        </LoadingRegion>
    )
}

// Page body placeholder: header, a detail card and a short list. Used where a
// whole page is still deciding what to show (e.g. access checks).
export function SkeletonPageContent() {
    return (
        <div className="skeleton-page-content">
            <SkeletonPageHeader />
            <SkeletonDetailCard fields={6} />
            <SkeletonList count={2} fields={3} />
        </div>
    )
}

// Full-screen app shell (sidebar + content) shown while the signed-in
// user's role and account status are being checked, before any portal
// layout has rendered.
export function SkeletonAppShell() {
    return (
        <div className="skeleton-app-shell">
            <aside className="skeleton-app-sidebar" aria-hidden="true">
                <div className="skeleton-app-brand">
                    <Skeleton width={38} height={38} radius={19} className="skeleton-on-dark" />
                    <div style={{ flex: 1 }}>
                        <Skeleton width="70%" height={14} className="skeleton-on-dark" style={{ marginBottom: 6 }} />
                        <Skeleton width="50%" height={10} className="skeleton-on-dark" />
                    </div>
                </div>
                {Array.from({ length: 8 }).map((_, i) => (
                    <div className="skeleton-app-nav-item" key={i}>
                        <Skeleton width={16} height={16} radius={4} className="skeleton-on-dark" />
                        <Skeleton width={`${50 + ((i * 17) % 35)}%`} height={12} className="skeleton-on-dark" />
                    </div>
                ))}
            </aside>
            <main className="skeleton-app-main">
                <SkeletonPageHeader />
                <SkeletonStatGrid count={4} />
                <SkeletonList count={3} fields={3} />
            </main>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Layout-matched page skeletons.
//
// Each page describes its own layout as a list of blocks, and the skeleton is
// built from that portal's real classes (admin-card, employee-info-grid,
// student-list-card, ...), so the placeholder has the same spacing, borders
// and columns as the page that replaces it -- nothing jumps when data lands.
// ---------------------------------------------------------------------------

const FIELD_VALUE_WIDTHS = ['80%', '62%', '90%', '70%', '55%', '84%']

function SkeletonFields({ portal, count }) {
    return (
        <div className={`${portal}-info-grid`}>
            {Array.from({ length: count }).map((_, i) => (
                <div className={`${portal}-info-field`} key={i}>
                    <Skeleton width="45%" height={10} style={{ marginBottom: 8 }} />
                    <Skeleton width={FIELD_VALUE_WIDTHS[i % FIELD_VALUE_WIDTHS.length]} height={14} />
                </div>
            ))}
        </div>
    )
}

function SkeletonCardBlock({ portal, block, index }) {
    const {
        title = true,
        action = false,
        pill = false,
        fields = 0,
        lines = 0,
        buttons = 0,
        rows = 0,
        media = 0,
    } = block

    return (
        <div className={`${portal}-card skeleton-card`} style={{ animationDelay: `${index * 60}ms` }}>
            {(title || action || pill) && (
                <div className="skeleton-card-head">
                    {title && <Skeleton width={block.titleWidth || 170} height={pill ? 20 : 16} radius={6} />}
                    {action && <Skeleton width={56} height={14} />}
                    {pill && <Skeleton width={96} height={24} radius={20} />}
                </div>
            )}

            {lines > 0 && (
                <div style={{ marginBottom: fields || buttons || rows || media ? 16 : 0 }}>
                    {Array.from({ length: lines }).map((_, i) => (
                        <Skeleton key={i} width={i === lines - 1 ? '58%' : '92%'} height={12} style={{ marginBottom: 8 }} />
                    ))}
                </div>
            )}

            {fields > 0 && <SkeletonFields portal={portal} count={fields} />}

            {media > 0 && <Skeleton width="100%" height={media} radius={10} style={{ marginTop: fields ? 18 : 0 }} />}

            {rows > 0 && (
                <div className="skeleton-rows" style={{ marginTop: fields ? 18 : 0 }}>
                    {Array.from({ length: rows }).map((_, i) => (
                        <div className="skeleton-row" key={i}>
                            <div style={{ flex: 1 }}>
                                <Skeleton width={i % 2 ? '38%' : '50%'} height={13} style={{ marginBottom: 7 }} />
                                <Skeleton width={i % 2 ? '26%' : '32%'} height={10} />
                            </div>
                            <Skeleton width={72} height={22} radius={20} />
                        </div>
                    ))}
                </div>
            )}

            {buttons > 0 && (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: fields || rows || lines || media ? 18 : 0 }}>
                    {Array.from({ length: buttons }).map((_, i) => (
                        <Skeleton key={i} width={i === 0 ? 150 : 120} height={40} radius={8} />
                    ))}
                </div>
            )}
        </div>
    )
}

function SkeletonHeaderBlock({ portal, block }) {
    const { avatar = false, subtitle = true, action = false, titleWidth = 260 } = block
    const row = (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {avatar && <Skeleton width={56} height={56} radius={28} />}
            <div>
                <Skeleton width={titleWidth} height={28} radius={8} />
                {subtitle && <Skeleton width={Math.round(titleWidth * 1.15)} height={13} style={{ marginTop: 10 }} />}
            </div>
        </div>
    )

    return (
        <div className={`${portal}-page-header skeleton-page-block`}>
            {action ? (
                <div className="skeleton-card-head" style={{ marginBottom: 0 }}>
                    {row}
                    <Skeleton width={120} height={38} radius={8} />
                </div>
            ) : row}
        </div>
    )
}

function SkeletonProfileBlock({ portal }) {
    return (
        <div className={`${portal}-card skeleton-card`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                <Skeleton width={72} height={72} radius={36} />
                <div style={{ flex: 1 }}>
                    <Skeleton width="40%" height={20} radius={6} style={{ marginBottom: 10 }} />
                    <Skeleton width="28%" height={12} style={{ marginBottom: 8 }} />
                    <Skeleton width="34%" height={12} />
                </div>
            </div>
        </div>
    )
}

function SkeletonListBlock({ portal, block }) {
    const { title = true, count = 3, fields = 2, action = true } = block
    return (
        <div>
            {title && (
                <div className="skeleton-card-head" style={{ margin: '24px 0 14px' }}>
                    <Skeleton width={180} height={18} radius={6} />
                    {action && <Skeleton width={64} height={14} />}
                </div>
            )}
            {Array.from({ length: count }).map((_, i) => (
                <div className={`${portal}-list-card skeleton-card`} key={i} style={{ animationDelay: `${i * 70}ms` }}>
                    <div className="skeleton-card-head">
                        <div style={{ flex: 1 }}>
                            <Skeleton width={TITLE_WIDTHS[i % TITLE_WIDTHS.length]} height={16} style={{ marginBottom: 9 }} />
                            <Skeleton width={SUBTITLE_WIDTHS[i % SUBTITLE_WIDTHS.length]} height={12} />
                        </div>
                        <Skeleton width={84} height={24} radius={20} />
                    </div>
                    {fields > 0 && <SkeletonFields portal={portal} count={fields} />}
                </div>
            ))}
        </div>
    )
}

/**
 * blocks: an array of
 *   { type: 'back' }
 *   { type: 'header', avatar?, subtitle?, action?, titleWidth? }
 *   { type: 'profile' }
 *   { type: 'card', title?, action?, pill?, fields?, lines?, buttons?, rows?, media? }
 *   { type: 'list', title?, count?, fields?, action? }
 */
export function SkeletonPage({ portal, blocks }) {
    return (
        <LoadingRegion label="Loading page…">
            {blocks.map((block, i) => {
                if (block.type === 'back') return <Skeleton key={i} width={130} height={14} style={{ marginBottom: 20 }} />
                if (block.type === 'header') return <SkeletonHeaderBlock key={i} portal={portal} block={block} />
                if (block.type === 'profile') return <SkeletonProfileBlock key={i} portal={portal} />
                if (block.type === 'list') return <SkeletonListBlock key={i} portal={portal} block={block} />
                return <SkeletonCardBlock key={i} portal={portal} block={block} index={i} />
            })}
        </LoadingRegion>
    )
}

// ---------------------------------------------------------------------------
// Dashboard skeleton, shaped like the real tiles and charts in
// components/DashboardStats.css and pages/admin/DashboardCharts.css.
// ---------------------------------------------------------------------------

const COLUMN_HEIGHTS = [35, 20, 55, 30, 70, 25, 45, 60, 40, 85, 50, 30, 65, 45]

export function SkeletonDashboard({ portal = 'admin', alerts = 0, overview = 3, status = 5, charts = true, quickLinks = 0, twoCol = false, list = 0, listsFirst = false, headerLinks = 0 }) {
    // Built as pieces so the order can follow each dashboard's real layout.
    const chartsEl = charts ? (
            <div className="dash-charts-grid">
                <div className="dash-chart-card skeleton-card">
                    <div className="skeleton-card-head" style={{ alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                            <Skeleton width="45%" height={16} style={{ marginBottom: 8 }} />
                            <Skeleton width="65%" height={12} />
                        </div>
                        <Skeleton width={96} height={30} radius={6} />
                    </div>
                    <div className="dash-donut-row">
                        <div className="dash-donut-wrap">
                            <div className="skeleton-donut" />
                        </div>
                        <div className="dash-legend">
                            {Array.from({ length: 7 }).map((_, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px' }}>
                                    <Skeleton width={10} height={10} radius={3} />
                                    <Skeleton width={`${40 + ((i * 13) % 30)}%`} height={12} />
                                    <span style={{ flex: 1 }} />
                                    <Skeleton width={34} height={12} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="dash-chart-card skeleton-card">
                    <div className="skeleton-card-head" style={{ alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                            <Skeleton width="50%" height={16} style={{ marginBottom: 8 }} />
                            <Skeleton width="40%" height={12} />
                        </div>
                        <Skeleton width={96} height={30} radius={6} />
                    </div>
                    <div className="skeleton-columns" aria-hidden="true">
                        {COLUMN_HEIGHTS.map((h, i) => (
                            <Skeleton key={i} height={`${h}%`} radius={4} style={{ width: 'auto', flex: 1 }} />
                        ))}
                    </div>
                </div>
            </div>
    ) : null

    const twoColEl = twoCol ? (
            <div className="dash-two-col" style={{ marginBottom: 28 }}>
                {[3, 5].map((rows, col) => (
                    <div key={col}>
                        <div className="skeleton-card-head" style={{ marginBottom: 14 }}>
                            <Skeleton width={190} height={17} radius={6} />
                            <Skeleton width={90} height={13} />
                        </div>
                        <div className="dash-row-list skeleton-card">
                            {Array.from({ length: rows }).map((_, i) => (
                                <div className="skeleton-row" key={i} style={{ padding: '13px 16px' }}>
                                    {col === 0 && <Skeleton width={58} height={13} />}
                                    <div style={{ flex: 1 }}>
                                        <Skeleton width="40%" height={13} style={{ marginBottom: 6 }} />
                                        <Skeleton width="28%" height={10} />
                                    </div>
                                    <Skeleton width={78} height={22} radius={20} />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
    ) : null

    return (
        <LoadingRegion label="Loading dashboard…">
            <div className="skeleton-page-block skeleton-card-head" style={{ marginBottom: 26, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div>
                    <Skeleton width={300} height={30} radius={8} />
                    <Skeleton width="min(380px, 80%)" height={14} style={{ marginTop: 10 }} />
                </div>
                {headerLinks > 0 && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {Array.from({ length: headerLinks }).map((_, i) => (
                            <Skeleton key={i} width={i % 2 ? 130 : 150} height={34} radius={999} />
                        ))}
                    </div>
                )}
            </div>

            {alerts > 0 && (
                <div className="dash-alert-grid">
                    {Array.from({ length: alerts }).map((_, i) => (
                        <div className="dash-stat-tile skeleton-card" key={i} style={{ flexDirection: 'row', alignItems: 'center', padding: '14px 16px', gap: 14 }}>
                            <Skeleton width={36} height={36} radius={10} />
                            <div style={{ flex: 1 }}>
                                <Skeleton width="45%" height={14} style={{ marginBottom: 6 }} />
                                <Skeleton width="60%" height={11} />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="dash-overview-grid">
                {Array.from({ length: overview }).map((_, i) => (
                    <div className="dash-stat-tile skeleton-card" key={i} style={{ animationDelay: `${i * 60}ms` }}>
                        <div className="dash-stat-top" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <Skeleton width="42%" height={13} />
                            <Skeleton width={38} height={38} radius={10} />
                        </div>
                        <Skeleton width={70} height={34} radius={8} style={{ marginTop: 4 }} />
                        <Skeleton width="60%" height={11} />
                    </div>
                ))}
            </div>

            <div className="dash-stats-heading">
                <Skeleton width={170} height={16} radius={6} />
                <Skeleton width={150} height={12} />
            </div>

            <div className="dash-status-grid" style={{ marginBottom: 28 }}>
                {Array.from({ length: status }).map((_, i) => (
                    <div className="dash-stat-tile skeleton-card" key={i} style={{ animationDelay: `${(overview + i) * 50}ms` }}>
                        <div className="dash-stat-top">
                            <Skeleton width={32} height={32} radius={9} />
                            <Skeleton width="55%" height={13} />
                        </div>
                        <Skeleton width={36} height={28} radius={6} style={{ marginTop: 4 }} />
                        <Skeleton width="100%" height={6} radius={999} style={{ marginTop: 6 }} />
                        <Skeleton width="50%" height={11} />
                    </div>
                ))}
            </div>

            {!listsFirst && chartsEl}

            {quickLinks > 0 && (
                <div className="dash-quick-links">
                    {Array.from({ length: quickLinks }).map((_, i) => (
                        <div className="dash-stat-tile skeleton-card" key={i} style={{ flexDirection: 'row', alignItems: 'center', padding: '12px 14px', gap: 12 }}>
                            <Skeleton width={32} height={32} radius={8} />
                            <Skeleton width="55%" height={13} />
                        </div>
                    ))}
                </div>
            )}

            {twoColEl}
            {listsFirst && chartsEl}

            {list > 0 && <SkeletonListBlock portal={portal} block={{ count: list, fields: 0 }} />}
        </LoadingRegion>
    )
}
