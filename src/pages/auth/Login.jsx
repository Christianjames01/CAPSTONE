import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import AuthLayout from './AuthLayout'

function Login() {
    const navigate = useNavigate()

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [message, setMessage] = useState('')
    const [loading, setLoading] = useState(false)

    const handleLogin = async (e) => {
        e.preventDefault()

        setLoading(true)
        setMessage('')

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

            setMessage('Your account is not active.')
            setLoading(false)
            return
        }

        // Redirect based on role
        if (profile.role === 'student') {
            navigate('/student/dashboard')
        }

        else if (profile.role === 'employee') {
            navigate('/employee/dashboard')
        }

        else if (profile.role === 'registrar_head') {
            navigate('/admin/dashboard')
        }

        else if (profile.role === 'admin') {
            navigate('/admin/dashboard')
        }

        else {
            setMessage('Unknown account role.')
        }

        setLoading(false)
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
                        placeholder="you@example.com"
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
                </div>

                {message && <p className="form-message error">{message}</p>}

                <button type="submit" className="auth-submit" disabled={loading}>
                    {loading ? 'Logging in...' : 'Log in'}
                </button>

            </form>
        </AuthLayout>
    )
}

export default Login
