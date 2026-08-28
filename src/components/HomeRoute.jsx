import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { dashboardPathForRole } from '../lib/roleRedirect'
import LandingPage from '../pages/LandingPage/LandingPage'

// A logged-in user opening "/" (e.g. a fresh tab) should land on their
// dashboard, not the marketing landing page.
function HomeRoute() {
    const [checking, setChecking] = useState(true)
    const [redirectTo, setRedirectTo] = useState(null)

    useEffect(() => {
        checkSession()
    }, [])

    const checkSession = async () => {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            setChecking(false)
            return
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('role, status')
            .eq('user_id', user.id)
            .single()

        if (profile?.status === 'active') {
            setRedirectTo(dashboardPathForRole(profile.role))
        }

        setChecking(false)
    }

    if (checking) return null

    if (redirectTo) return <Navigate to={redirectTo} replace />

    return <LandingPage />
}

export default HomeRoute
