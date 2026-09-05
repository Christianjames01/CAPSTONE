import { useState } from 'react'

const STORAGE_KEY = 'certichain-theme'

export function getStoredTheme() {
    try {
        return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light'
    } catch {
        return 'light'
    }
}

export function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme)
}

export function initTheme() {
    applyTheme(getStoredTheme())
}

export function useTheme() {
    const [theme, setTheme] = useState(getStoredTheme)

    const toggleTheme = () => {
        const next = theme === 'dark' ? 'light' : 'dark'
        applyTheme(next)
        try {
            localStorage.setItem(STORAGE_KEY, next)
        } catch {
            // localStorage unavailable (private browsing, etc.) -- theme just won't persist.
        }
        setTheme(next)
    }

    return [theme, toggleTheme]
}
