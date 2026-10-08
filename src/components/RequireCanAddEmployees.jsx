import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { SkeletonPageContent } from './Skeleton'

// Gates /employee/add-employee to employees a registrar head/admin has
// granted can_add_employees. The real enforcement is server-side (the
// create-employee-account edge function checks the same flag) -- this is
// just so an employee without the grant doesn't land on a dead-end page.
function RequireCanAddEmployees({ children }) {
    const [loading, setLoading] = useState(true)
    const [allowed, setAllowed] = useState(false)

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
            .select('can_add_employees')
            .eq('user_id', user.id)
            .maybeSingle()

        setAllowed(!!employee?.can_add_employees)
        setLoading(false)
    }

    if (loading) {
        return <SkeletonPageContent />
    }

    if (!allowed) {
        return <Navigate to="/employee/dashboard" replace />
    }

    return children
}

export default RequireCanAddEmployees
