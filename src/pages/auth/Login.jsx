import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { dashboardPathForRole } from '../../lib/roleRedirect'
import { establishStudentSession, notifyPreviousDeviceSignedOut } from '../../lib/singleSession'
import AuthLayout from './AuthLayout'
import GoogleIcon from './GoogleIcon'

function Login() {
    const navigate = useNavigate()
    const location = useLocation()

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [message, setMessage] = useState(location.state?.message || '')
    const [messageType, setMessageType] = useState(location.state?.type || 'error')
    const [loading, setLoading] = useState(false)
    const [googleLoading, setGoogleLoading] = useState(false)

    const handleLogin = async (e) => {
        e.preventDefault()

        setLoading(true)
        setMessage('')
        setMessageType('error')

        // Login to Supabase
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) {
            setMessage(error.message)
            setLoading(false)
            return
        }

        // Get the user's profile
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role, status')
            .eq('user_id', data.user.id)
            .single()

        if (profileError) {
            console.error(profileError)

            setMessage(
                'Login successful, but your profile could not be found.'
            )

            setLoading(false)
            return
        }

        // Check account status
        if (profile.status !== 'active') {
            await supabase.auth.signOut()

            setMessage(
                'Your account has been deactivated. Please contact the Registrar\'s Office for assistance.'
            )
            setLoading(false)
            return
        }

        // Redirect based on role
        const dashboardPath = dashboardPathForRole(profile.role)

        if (dashboardPath) {
            if (profile.role === 'student') {
                const { hadExistingSession } = await establishStudentSession(data.user.id)
                if (hadExistingSession) {
                    await notifyPreviousDeviceSignedOut()
                }
            }

            navigate(dashboardPath)
        } else {
            setMessage('Unknown account role.')
        }

        setLoading(false)
    }

    const handleGoogleLogin = async () => {
        setGoogleLoading(true)
        setMessage('')

        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
                queryParams: {
                    hd: 'hcdc.edu.ph',
                    prompt: 'select_account',
                },
            },
        })

        if (error) {
            setMessage(error.message)
            setGoogleLoading(false)
        }
        // On success, the browser is redirected to Google, so there's
        // nothing further to do here.
    }

    return (
        <AuthLayout
            title="Welcome back"
            subtitle="Log in to manage your academic document requests."
            footer={
                <>Don't have an account? <Link to="/register">Register</Link></>
            }
        >
            <form className="auth-form" onSubmit={handleLogin}>

                <div className="form-group">
                    <label className="form-label" htmlFor="login-email">Email</label>
                    <input
                        id="login-email"
                        type="email"
                        className="form-input"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="juan.delacruz@hcdc.edu.ph"
                        required
                    />
                </div>

                <div className="form-group">
                    <label className="form-label" htmlFor="login-password">Password</label>
                    <input
                        id="login-password"
                        type="password"
                        className="form-input"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        required
                    />
                    <Link to="/forgot-password" style={{ fontSize: 12.5, display: 'inline-block', marginTop: 6 }}>
                        Forgot password?
                    </Link>
                </div>

                {message && <p className={`form-message ${messageType}`}>{message}</p>}

                <button type="submit" className="auth-submit" disabled={loading}>
                    {loading ? 'Logging in...' : 'Log in'}
                </button>

            </form>

            <div className="auth-divider">or</div>

            <button
                type="button"
                className="auth-google-button"
                onClick={handleGoogleLogin}
                disabled={googleLoading}
            >
                <GoogleIcon />
                {googleLoading ? 'Redirecting...' : 'Continue with your HCDC Google account'}
            </button>
        </AuthLayout>
    )
}

export default Login
