import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import AuthLayout from './AuthLayout'
import CaptchaCheck from '../../components/CaptchaCheck'
import { captchaEnabled } from '../../lib/captcha'

function ForgotPassword() {
    // Turnstile token for Supabase Auth (see lib/captcha.js); single-use, so
    // the check is remounted (captchaKey) after every attempt.
    const [captchaToken, setCaptchaToken] = useState(null)
    const [captchaKey, setCaptchaKey] = useState(0)
    const resetCaptcha = () => {
        setCaptchaToken(null)
        setCaptchaKey((k) => k + 1)
    }
    const [email, setEmail] = useState('')
    const [message, setMessage] = useState('')
    const [status, setStatus] = useState('idle')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()

        setLoading(true)
        setMessage('')
        setStatus('idle')

        if (captchaEnabled && !captchaToken) {
            setStatus('error')
            setMessage('Please complete the security check ("Verify you are human") first.')
            setLoading(false)
            return
        }

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
            captchaToken: captchaToken || undefined,
        })
        resetCaptcha()

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

                <CaptchaCheck key={captchaKey} onToken={setCaptchaToken} />

                <button type="submit" className="auth-submit" disabled={loading || status === 'success'}>
                    {loading ? 'Sending...' : 'Send reset link'}
                </button>

            </form>
        </AuthLayout>
    )
}

export default ForgotPassword
