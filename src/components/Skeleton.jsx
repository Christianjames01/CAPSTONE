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
