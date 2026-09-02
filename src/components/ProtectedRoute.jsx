import { Navigate, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { dashboardPathForRole } from '../lib/roleRedirect'

function ProtectedRoute({ children, allowedRoles }) {
    const [loading, setLoading] = useState(true)
    const [profile, setProfile] = useState(null)

    useEffect(() => {
        checkUser()
    }, [])

    const checkUser = async () => {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            setLoading(false)
            return
        }

        const { data, error } = await supabase
            .from('profiles')
            .select('role, status')
            .eq('user_id', user.id)
            .single()

        if (error) {
            console.error(error)
            setLoading(false)
            return
        }

        if (data.status !== 'active') {
            await supabase.auth.signOut()
        }

        setProfile(data)
        setLoading(false)
    }

    if (loading) {
        return <div>Loading...</div>
    }

    if (!profile) {
        return <Navigate to="/" replace />
    }

    if (profile.status !== 'active') {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                padding: 24,
                gap: 12,
            }}>
                <h1 style={{ fontSize: 20, margin: 0 }}>Account deactivated</h1>
                <p style={{ color: 'var(--slate)', maxWidth: 420, margin: 0 }}>
                    Your account has been deactivated. Please contact the Registrar's Office for assistance.
                </p>
                <Link to="/login" style={{ marginTop: 8, color: 'var(--blue)', fontWeight: 600 }}>
                    Back to log in
                </Link>
            </div>
        )
    }

    if (
        allowedRoles &&
        !allowedRoles.includes(profile.role)
    ) {
        return <Navigate to={dashboardPathForRole(profile.role) || '/'} replace />
    }

    return children
}

export default ProtectedRoute