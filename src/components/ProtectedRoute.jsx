import { Navigate, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { dashboardPathForRole } from '../lib/roleRedirect'
import { getEmployeeAccountIssue, employeeIssueMessage } from '../lib/accountStatusMessage'

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

        let effectiveStatus = data.status
        let employeeIssue = null

        if (effectiveStatus === 'active' && (data.role === 'employee' || data.role === 'registrar_head')) {
            employeeIssue = await getEmployeeAccountIssue(user.id)
            if (employeeIssue) {
                effectiveStatus = 'inactive'
            }
        }

        if (effectiveStatus !== 'active') {
            await supabase.auth.signOut()
        }

        setProfile({ ...data, status: effectiveStatus, employeeIssue })
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
                <h1 style={{ fontSize: 20, margin: 0 }}>
                    {profile.employeeIssue === 'deleted' ? 'Account removed' : 'Account deactivated'}
                </h1>
                <p style={{ color: 'var(--slate)', maxWidth: 420, margin: 0 }}>
                    {employeeIssueMessage(profile.employeeIssue, profile.role) ||
                        "Your account has been deactivated. Please contact the Registrar's Office for assistance."}
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