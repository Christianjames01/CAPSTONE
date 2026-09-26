import './UiIcons.css'

// Line icons matching the portal sidebars (24px grid, 1.75 stroke,
// currentColor), used instead of emoji or text symbols. They size to the
// surrounding text (1em) unless a size is passed.

function Svg({ size, className = '', children, ...rest }) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
            className={`ui-icon ${className}`.trim()}
            style={size ? { width: size, height: size } : undefined}
            {...rest}
        >
            {children}
        </svg>
    )
}

export const IconCheck = (p) => <Svg {...p}><path d="m5 12.5 4.2 4.2L19 7" /></Svg>

export const IconX = (p) => <Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>

export const IconAlert = (p) => (
    <Svg {...p}>
        <path d="M10.3 4.2 2.9 17.1A2 2 0 0 0 4.6 20h14.8a2 2 0 0 0 1.7-2.9L13.7 4.2a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9.5v4M12 16.8v.2" />
    </Svg>
)

export const IconQuestion = (p) => (
    <Svg {...p}>
        <path d="M9.2 9a2.9 2.9 0 0 1 5.6 1c0 1.9-2.8 2.4-2.8 4" />
        <path d="M12 17.6v.2" />
    </Svg>
)

export const IconCalendar = (p) => (
    <Svg {...p}>
        <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
        <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </Svg>
)

export const IconFile = (p) => (
    <Svg {...p}>
        <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
        <path d="M14 3v4h4M9 12h6M9 15.5h6" />
    </Svg>
)

export const IconUpload = (p) => (
    <Svg {...p}>
        <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" />
        <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />
    </Svg>
)

export const IconCash = (p) => (
    <Svg {...p}>
        <rect x="2.5" y="6" width="19" height="12" rx="2" />
        <circle cx="12" cy="12" r="2.6" />
        <path d="M6 9.5v5M18 9.5v5" />
    </Svg>
)

export const IconBox = (p) => (
    <Svg {...p}>
        <path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5Z" />
        <path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" />
    </Svg>
)

export const IconSearch = (p) => (
    <Svg {...p}>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="M19.5 19.5 15 15" />
    </Svg>
)

export const IconVolume = (p) => (
    <Svg {...p}>
        <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4Z" />
        <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
    </Svg>
)

export const IconPencil = (p) => (
    <Svg {...p}>
        <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17Z" />
        <path d="m14 7 3 3" />
    </Svg>
)

export const IconStar = ({ filled = false, ...p }) => (
    <Svg {...p} className={`ui-star${filled ? ' is-filled' : ''}`}>
        <path
            d="M12 3.5l2.6 5.3 5.9.9-4.25 4.1 1 5.8L12 16.9l-5.25 2.7 1-5.8L3.5 9.7l5.9-.9Z"
            fill={filled ? 'currentColor' : 'none'}
        />
    </Svg>
)

// Read-only star rating, e.g. <StarRating value={4} />.
export function StarRating({ value, max = 5, size }) {
    return (
        <span className="ui-stars" role="img" aria-label={`${value} out of ${max} stars`}>
            {Array.from({ length: max }, (_, i) => <IconStar key={i} filled={i < value} size={size} />)}
        </span>
    )
}

export const IconLock = (p) => (
    <Svg {...p}>
        <rect x="5" y="10.5" width="14" height="10" rx="2" />
        <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </Svg>
)
