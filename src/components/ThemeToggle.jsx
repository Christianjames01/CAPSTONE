import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../lib/theme'

function ThemeToggle({ buttonClassName }) {
    const [theme, toggleTheme] = useTheme()

    return (
        <button type="button" className={buttonClassName} onClick={toggleTheme}>
            {theme === 'dark' ? <Sun /> : <Moon />}
            <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
        </button>
    )
}

export default ThemeToggle
