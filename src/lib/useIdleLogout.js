import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'
import { supabase } from './supabase'

const IDLE_TIMEOUT_MS = 20 * 60 * 1000
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
            await Swal.fire({
                title: 'Session Expired',
                text: "You've been logged out due to inactivity. Please log in again.",
                icon: 'info',
                confirmButtonText: 'OK',
                confirmButtonColor: '#123B78',
            })
            navigate('/login')
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
