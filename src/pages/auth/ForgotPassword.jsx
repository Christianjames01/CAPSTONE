import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import AuthLayout from './AuthLayout'

function ForgotPassword() {
    const [email, setEmail] = useState('')
    const [message, setMessage] = useState('')
    const [status, setStatus] = useState('idle')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()

        setLoading(true)
        setMessage('')
        setStatus('idle')

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
        })

        setLoading(false)

        if (error) {
            setStatus('error')
            setMessage(error.message)
            return
        }

        // Don't reveal whether the email is registered -- always show the
        // same success message either way.
        setStatus('success')
        setMessage('If an account exists for that email, a password reset link has been sent. Check your inbox.')
    }

    return (
        <AuthLayout
            title="Forgot your password?"
            subtitle="Enter your account email and we'll send you a link to reset it."
            footer={
                <>Remembered it? <Link to="/login">Back to log in</Link></>
            }
        >
            <form className="auth-form" onSubmit={handleSubmit}>

                <div className="form-group">
                    <label className="form-label" htmlFor="forgot-email">Email</label>
                    <input
                        id="forgot-email"
                        type="email"
                        className="form-input"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="juan.delacruz@hcdc.edu.ph"
                        required
                        disabled={status === 'success'}
                    />
                </div>

                {message && (
                    <p className={`form-message ${status === 'error' ? 'error' : 'success'}`}>{message}</p>
                )}

                <button type="submit" className="auth-submit" disabled={loading || status === 'success'}>
                    {loading ? 'Sending...' : 'Send reset link'}
                </button>

            </form>
        </AuthLayout>
    )
}

export default ForgotPassword
