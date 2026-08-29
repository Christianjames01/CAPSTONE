import './Skeleton.css'

// Generic shimmer block -- the building block every other skeleton
// composes from. Style-agnostic on purpose so it looks at home in the
// student, employee, and admin portals without needing their CSS.
export function Skeleton({ width = '100%', height = 14, radius = 6, style, className = '' }) {
    return (
        <div
            className={`skeleton-block ${className}`}
            style={{ width, height, borderRadius: radius, ...style }}
        />
    )
}

// A page's <h1>/<p> header, before real content is known.
export function SkeletonPageHeader() {
    return (
        <div className="skeleton-page-header">
            <Skeleton width={200} height={26} />
            <Skeleton width={340} height={14} style={{ marginTop: 8 }} />
        </div>
    )
}

// The stat-card grids used on every dashboard.
export function SkeletonStatGrid({ count = 5 }) {
    return (
        <div className="skeleton-stat-grid">
            {Array.from({ length: count }).map((_, i) => (
                <div className="skeleton-stat-card" key={i}>
                    <Skeleton width={40} height={40} radius={10} />
                    <div style={{ flex: 1 }}>
                        <Skeleton width={36} height={20} style={{ marginBottom: 6 }} />
                        <Skeleton width="70%" height={11} />
                    </div>
                </div>
            ))}
        </div>
    )
}

// The list-card pattern used throughout (requests, students, messages,
// employees, receipts, etc.) -- a header row (title + status pill) plus
// a small grid of labeled fields underneath.
export function SkeletonList({ count = 3, fields = 3 }) {
    return (
        <>
            {Array.from({ length: count }).map((_, i) => (
                <div className="skeleton-list-card" key={i}>
                    <div className="skeleton-list-card-header">
                        <div style={{ flex: 1 }}>
                            <Skeleton width="45%" height={16} style={{ marginBottom: 8 }} />
                            <Skeleton width="30%" height={12} />
                        </div>
                        <Skeleton width={70} height={22} radius={20} />
                    </div>
                    <div className="skeleton-list-card-fields">
                        {Array.from({ length: fields }).map((__, j) => (
                            <div key={j}>
                                <Skeleton width="60%" height={10} style={{ marginBottom: 6 }} />
                                <Skeleton width="80%" height={13} />
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </>
    )
}

// A short form (login, forgot password, small edit forms).
export function SkeletonForm({ rows = 3 }) {
    return (
        <div>
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} style={{ marginBottom: 18 }}>
                    <Skeleton width={90} height={11} style={{ marginBottom: 8 }} />
                    <Skeleton width="100%" height={40} radius={8} />
                </div>
            ))}
        </div>
    )
}

// A two-column form row (register/complete-profile style forms).
export function SkeletonFormRow({ rows = 2 }) {
    return (
        <div>
            {Array.from({ length: rows }).map((_, i) => (
                <div className="skeleton-form-row" key={i}>
                    <div>
                        <Skeleton width={90} height={11} style={{ marginBottom: 8 }} />
                        <Skeleton width="100%" height={40} radius={8} />
                    </div>
                    <div>
                        <Skeleton width={90} height={11} style={{ marginBottom: 8 }} />
                        <Skeleton width="100%" height={40} radius={8} />
                    </div>
                </div>
            ))}
        </div>
    )
}

// A single detail card (profile pages, request/employee/student details).
export function SkeletonDetailCard({ fields = 6 }) {
    return (
        <div className="skeleton-list-card">
            <Skeleton width="35%" height={18} style={{ marginBottom: 18 }} />
            <div className="skeleton-list-card-fields">
                {Array.from({ length: fields }).map((_, i) => (
                    <div key={i}>
                        <Skeleton width="60%" height={10} style={{ marginBottom: 6 }} />
                        <Skeleton width="85%" height={13} />
                    </div>
                ))}
            </div>
        </div>
    )
}
