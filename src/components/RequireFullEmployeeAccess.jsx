import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function RequireFullEmployeeAccess({ children }) {
    const [loading, setLoading] = useState(true)
    const [allowed, setAllowed] = useState(true)

    useEffect(() => {
        checkAccess()
    }, [])

    const checkAccess = async () => {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            setLoading(false)
            return
        }

        const { data: employee } = await supabase
            .from('employees')
            .select('access_scope')
            .eq('user_id', user.id)
            .maybeSingle()

        if (employee?.access_scope === 'releasing') {
            setAllowed(false)
        }

        setLoading(false)
    }

    if (loading) {
        return <div>Loading...</div>
    }

    if (!allowed) {
        return <Navigate to="/employee/dashboard" replace />
    }

    return children
}

export default RequireFullEmployeeAccess
