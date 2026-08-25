import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

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
        <div style={{ maxWidth: '400px', margin: '60px auto' }}>

            <h1>CertiChain Login</h1>

            <form onSubmit={handleLogin}>

                <div style={{ marginBottom: '15px' }}>
                    <label>Email</label>

                    <br />

                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email"
                        required
                        style={{
                            width: '100%',
                            padding: '10px'
                        }}
                    />
                </div>

                <div style={{ marginBottom: '15px' }}>
                    <label>Password</label>

                    <br />

                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        required
                        style={{
                            width: '100%',
                            padding: '10px'
                        }}
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    style={{
                        padding: '10px 20px',
                        cursor: 'pointer'
                    }}
                >
                    {loading ? 'Logging in...' : 'Login'}
                </button>

            </form>

            {message && (
                <p style={{ marginTop: '20px' }}>
                    {message}
                </p>
            )}

        </div>
    )
}

export default Login