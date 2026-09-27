import { lazy, Suspense, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { dashboardPathForRole } from '../lib/roleRedirect'
import PageLoading from './PageLoading'

// Only visitors who aren't signed in see the landing page, so load it then.
const LandingPage = lazy(() => import('../pages/LandingPage/LandingPage'))

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

    if (checking) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#FBFCFE',
            }}>
                <span className="icon-spinner" style={{ width: 28, height: 28, borderWidth: 3, color: '#123B78' }} />
            </div>
        )
    }

    if (redirectTo) return <Navigate to={redirectTo} replace />

    return <Suspense fallback={<PageLoading />}><LandingPage /></Suspense>
}

export default HomeRoute
