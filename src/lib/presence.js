import { useEffect } from 'react'
import { supabase } from './supabase'

const HEARTBEAT_MS = 45_000

// Pings the server every ~45s while the tab is open and visible, so the
// superadmin's "online now" status reflects reality. Best effort: a failed
// ping never affects the page it's running on.
export function usePresenceHeartbeat(active) {
    useEffect(() => {
        if (!active) return undefined

        const ping = async () => {
            try {
                await supabase.rpc('heartbeat')
            } catch {
                // Not worth surfacing -- the next tick tries again.
            }
        }

        ping()
        const interval = setInterval(() => {
            if (document.visibilityState === 'visible') ping()
        }, HEARTBEAT_MS)

        const onVisible = () => {
            if (document.visibilityState === 'visible') ping()
        }
        document.addEventListener('visibilitychange', onVisible)

        return () => {
            clearInterval(interval)
            document.removeEventListener('visibilitychange', onVisible)
        }
    }, [active])
}
