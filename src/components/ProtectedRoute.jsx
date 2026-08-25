import { Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

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

        setProfile(data)
        setLoading(false)
    }

    if (loading) {
        return <div>Loading...</div>
    }

    if (!profile) {
        return <Navigate to="/login" replace />
    }

    if (profile.status !== 'active') {
        return <div>Your account is not active.</div>
    }

    if (
        allowedRoles &&
        !allowedRoles.includes(profile.role)
    ) {
        return <Navigate to="/unauthorized" replace />
    }

    return children
}

export default ProtectedRoute