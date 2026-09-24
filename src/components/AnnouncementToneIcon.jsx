// Icon for an announcement's tone (see announcementTone in lib/announcements).
function AnnouncementToneIcon({ tone }) {
    if (tone === 'closed') {
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
                <path d="M3.5 10h17M8 3v4M16 3v4M10 13.5l4 4M14 13.5l-4 4" />
            </svg>
        )
    }

    if (tone === 'open') {
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
                <path d="M3.5 10h17M8 3v4M16 3v4M9 15l2 2 4-4" />
            </svg>
        )
    }

    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 10v4a1 1 0 0 0 1 1h2l3.5 4.5V4.5L6 9H4a1 1 0 0 0-1 1Z" />
            <path d="M14 8.5c1.5 1 1.5 6 0 7M17.5 6c2.5 2 2.5 10 0 12" />
        </svg>
    )
}

export default AnnouncementToneIcon
