import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../lib/theme'

function ThemeToggle() {
    const [theme, toggleTheme] = useTheme()

    return (
        <button
            type="button"
            className="theme-toggle-fab"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
            {theme === 'dark' ? <Sun /> : <Moon />}
        </button>
    )
}

export default ThemeToggle
