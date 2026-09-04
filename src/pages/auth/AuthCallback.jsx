import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { dashboardPathForRole } from '../../lib/roleRedirect'
import { establishStudentSession, notifyPreviousDeviceSignedOut } from '../../lib/singleSession'
import { getInactiveAccountMessage } from '../../lib/accountStatusMessage'
import AuthLayout from './AuthLayout'

const ALLOWED_EMAIL_DOMAIN = '@hcdc.edu.ph'

function AuthCallback() {
    const navigate = useNavigate()
    const [message, setMessage] = useState('Signing you in...')

    useEffect(() => {
        finishSignIn()
    }, [])

    const finishSignIn = async () => {
        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user) {
            navigate('/login', { state: { message: 'Sign-in could not be completed. Please try again.' } })
            return
        }

        if (!user.email || !user.email.toLowerCase().endsWith(ALLOWED_EMAIL_DOMAIN)) {
            await supabase.from('profiles').update({ status: 'inactive' }).eq('user_id', user.id)
            await supabase.auth.signOut()

            navigate('/login', {
                state: { message: `Please sign in with your HCDC Google account (an ${ALLOWED_EMAIL_DOMAIN} email address).` },
            })
            return
        }

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role, status')
            .eq('user_id', user.id)
            .single()

        if (profileError || !profile) {
            navigate('/login', { state: { message: 'Sign-in successful, but your profile could not be found.' } })
            return
        }

        if (profile.status !== 'active') {
            const inactiveMessage = await getInactiveAccountMessage(user.id, profile.role)
            await supabase.auth.signOut()
            navigate('/login', { state: { message: inactiveMessage } })
            return
        }

        if (profile.role === 'student') {
            const { data: student } = await supabase
                .from('students')
                .select('student_id')
                .eq('user_id', user.id)
                .maybeSingle()

            if (!student) {
                setMessage('Almost there — let\'s finish setting up your student profile.')
                navigate('/complete-profile')
                return
            }
        }

        const dashboardPath = dashboardPathForRole(profile.role)

        if (dashboardPath) {
            if (profile.role === 'student') {
                const { hadExistingSession } = await establishStudentSession(user.id)
                if (hadExistingSession) {
                    await notifyPreviousDeviceSignedOut()
                }
            }

            navigate(dashboardPath)
        } else {
            navigate('/login', { state: { message: 'Unknown account role.' } })
        }
    }

    return (
        <AuthLayout title="One moment" subtitle={message}>
            <p style={{ fontSize: 13.5, color: 'var(--slate)' }}>
                Please wait while we finish signing you in.
            </p>
        </AuthLayout>
    )
}

export default AuthCallback
