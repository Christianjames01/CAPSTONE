function PasswordToggleButton({ show, onToggle }) {
    return (
        <button
            type="button"
            className="password-toggle"
            onClick={onToggle}
            tabIndex={-1}
            aria-label={show ? 'Hide password' : 'Show password'}
        >
            {show ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 3l18 18" />
                    <path d="M10.6 5.1A10.6 10.6 0 0 1 12 5c6 0 9.5 5.5 9.5 7a9.9 9.9 0 0 1-2.6 3.4M6.2 6.6C3.6 8.3 2.5 10.9 2.5 12c0 1.5 3.5 7 9.5 7 1.3 0 2.5-.25 3.6-.7" />
                    <path d="M9.5 9.6a3 3 0 0 0 4.2 4.2" />
                </svg>
            ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
                    <circle cx="12" cy="12" r="3" />
                </svg>
            )}
        </button>
    )
}

export default PasswordToggleButton
