import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import AuthLayout from './AuthLayout'
import { captchaEnabled, getCaptchaToken, preloadCaptcha } from '../../lib/captcha'

// Get the security check ready while the form is being filled in.
preloadCaptcha()

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

        // The security check (slide puzzle + Cloudflare) pops up now.
        const captchaToken = await getCaptchaToken()
        if (captchaEnabled && !captchaToken) {
            setStatus('error')
            setMessage('Please complete the security check to get a reset link.')
            setLoading(false)
            return
        }

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
            captchaToken: captchaToken || undefined,
        })

        setLoading(false)

        if (error) {
            setStatus('error')
            setMessage(error.message)
            return
        }

        setStatus('success')
        setMessage(
            'If an account exists for that email, a password reset link has been sent. Check your inbox. ' +
            "If you don't receive an email within a few minutes, double-check the email address you registered with, or contact the Registrar's Office for help."
        )
    }

    return (
        <AuthLayout
            title="Forgot your password?"
            subtitle="Enter your account email and we'll send you a link to reset it."
            cardClassName="is-refined"
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
