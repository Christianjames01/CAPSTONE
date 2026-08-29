import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabase'

const IDLE_TIMEOUT_MS = 30 * 60 * 1000
const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']

// Signs the user out after a period of no activity -- this app handles
// student PII and is often used on shared/public computers (library,
// computer lab), where a session left open indefinitely is a real risk.
export function useIdleLogout() {
    const navigate = useNavigate()

    useEffect(() => {
        let timer

        const logout = async () => {
            await supabase.auth.signOut()
            navigate('/login', { state: { message: "You've been logged out due to inactivity." } })
        }

        const resetTimer = () => {
            clearTimeout(timer)
            timer = setTimeout(logout, IDLE_TIMEOUT_MS)
        }

        ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, resetTimer))
        resetTimer()

        return () => {
            clearTimeout(timer)
            ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, resetTimer))
        }
    }, [navigate])
}
