import { IconPencil } from './UiIcons'
import './ProfileUi.css'

// Shared building blocks for the Profile page of every portal (student,
// employee, Registrar Head), in the same style as the detail pages: a header
// card with the photo, section cards with an icon, and fields as tiles.

export const IconShield = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3 5 6v5.5c0 4.2 2.9 7.8 7 9.5 4.1-1.7 7-5.3 7-9.5V6Z" />
        <path d="m9 12 2 2 4-4" />
    </svg>
)

export const IconBriefcase = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3.5" y="7" width="17" height="13" rx="2" />
        <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
        <path d="M3.5 12.5h17" />
    </svg>
)

export const IconKey = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="15" r="4" />
        <path d="m11 12 8.5-8.5M16 7l2.5 2.5M14 9l2 2" />
    </svg>
)

// The top card: photo (with a change button when onChangePhoto is given),
// name, a line under it and small tags.
export function ProfileHero({ photoUrl, name, initials, eyebrow, subtitle, tags = [], onChangePhoto, uploading = false }) {
    return (
        <section className="pf-hero">
            <div className="pf-avatar-wrap">
                <div className="pf-avatar">
                    {photoUrl ? <img src={photoUrl} alt={name} /> : initials}
                </div>
                {onChangePhoto && (
                    <button
                        type="button"
                        className="pf-avatar-edit"
                        onClick={onChangePhoto}
                        disabled={uploading}
                        title="Change photo"
                        aria-label="Change profile photo"
                    >
                        {uploading ? '…' : <IconPencil />}
                    </button>
                )}
            </div>

            <div className="pf-hero-main">
                {eyebrow && <span className="pf-eyebrow">{eyebrow}</span>}
                <h1>{name || 'Your profile'}</h1>
                {subtitle && <p>{subtitle}</p>}
                {tags.filter(Boolean).length > 0 && (
                    <div className="pf-tags">
                        {tags.filter(Boolean).map((tag) => <span key={tag}>{tag}</span>)}
                    </div>
                )}
                {onChangePhoto && (
                    <button type="button" className="pf-photo-link" onClick={onChangePhoto} disabled={uploading}>
                        {uploading ? 'Uploading photo...' : 'Change profile photo'}
                    </button>
                )}
            </div>
        </section>
    )
}

// A card with an icon, a title (and optional line under it) and an optional
// button on the right.
export function ProfileSection({ icon: Icon, title, subtitle, actionLabel, onAction, children }) {
    return (
        <section className="pf-card">
            <div className="pf-card-head">
                {Icon && <span className="pf-icon"><Icon /></span>}
                <div className="pf-card-heading">
                    <h2>{title}</h2>
                    {subtitle && <p>{subtitle}</p>}
                </div>
                {actionLabel && (
                    <button type="button" className="pf-action" onClick={onAction}>
                        {actionLabel}
                    </button>
                )}
            </div>
            {children}
        </section>
    )
}

// Label/value tiles. An empty value shows "Not set" in grey.
export function ProfileFields({ fields }) {
    return (
        <div className="pf-fields">
            {fields.map(({ label, value, wide, capitalize }) => (
                <div key={label} className={`pf-field${wide ? ' is-wide' : ''}`}>
                    <span>{label}</span>
                    <strong className={`${value ? '' : 'is-empty'}${capitalize ? ' is-capitalized' : ''}`}>
                        {value || 'Not set'}
                    </strong>
                </div>
            ))}
        </div>
    )
}

// One row in the "Sign-in & security" card.
export function SecurityRow({ icon: Icon, title, text, actionLabel, onAction, children }) {
    return (
        <div className="pf-row">
            {Icon && <span className="pf-row-icon"><Icon /></span>}
            <div className="pf-row-main">
                <strong>{title}</strong>
                {text && <p>{text}</p>}
                {children}
            </div>
            {actionLabel && (
                <button type="button" className="pf-action" onClick={onAction}>
                    {actionLabel}
                </button>
            )}
        </div>
    )
}
