import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import AuthLayout from './AuthLayout'
import PasswordRequirements from '../../components/PasswordRequirements'
import PasswordToggleButton from './PasswordToggleButton'
import { passwordMeetsRequirements, passwordRequirementMessage } from '../../lib/passwordStrength'

function ResetPassword() {
    const navigate = useNavigate()

    const [checkingLink, setCheckingLink] = useState(true)
    const [linkValid, setLinkValid] = useState(false)

    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [message, setMessage] = useState('')
    const [status, setStatus] = useState('idle')
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setLinkValid(!!session)
            setCheckingLink(false)
        })
    }, [])

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (password !== confirmPassword) {
            setStatus('error')
            setMessage("Passwords don't match.")
            return
        }

        if (!passwordMeetsRequirements(password)) {
            setStatus('error')
            setMessage(passwordRequirementMessage())
            return
        }

        setLoading(true)
        setMessage('')
        setStatus('idle')

        const { error } = await supabase.auth.updateUser({ password })

        if (error) {
            setLoading(false)
            setStatus('error')
            setMessage(error.message)
            return
        }

        await supabase.auth.signOut()

        navigate('/login', {
            state: { message: 'Your password has been reset. Log in with your new password.', type: 'success' },
        })
    }

    if (checkingLink) {
        return (
            <AuthLayout title="One moment" subtitle="Checking your reset link...">
                <p style={{ fontSize: 13.5, color: 'var(--slate)' }}>Please wait.</p>
            </AuthLayout>
        )
    }

    if (!linkValid) {
        return (
            <AuthLayout
                title="Link expired"
                subtitle="This password reset link is invalid or has expired."
                footer={
                    <>Request a new one from <Link to="/forgot-password">Forgot password</Link></>
                }
            >
                <p style={{ fontSize: 13.5, color: 'var(--slate)' }}>
                    Reset links only work once and expire after a while for security. Head back and request a fresh one.
                </p>
            </AuthLayout>
        )
    }

    return (
        <AuthLayout
            title="Set a new password"
            subtitle="Choose a new password for your account."
        >
            <form className="auth-form" onSubmit={handleSubmit}>

                <div className="form-group">
                    <label className="form-label" htmlFor="reset-password">New password</label>
                    <div className="password-field">
                        <input
                            id="reset-password"
                            type={showPassword ? 'text' : 'password'}
                            className="form-input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter a new password"
                            required
                        />
                        <PasswordToggleButton show={showPassword} onToggle={() => setShowPassword((v) => !v)} />
                    </div>
                    <PasswordRequirements password={password} />
                </div>

                <div className="form-group">
                    <label className="form-label" htmlFor="reset-confirm-password">Confirm new password</label>
                    <div className="password-field">
                        <input
                            id="reset-confirm-password"
                            type={showConfirmPassword ? 'text' : 'password'}
                            className="form-input"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Re-enter your new password"
                            required
                        />
                        <PasswordToggleButton show={showConfirmPassword} onToggle={() => setShowConfirmPassword((v) => !v)} />
                    </div>
                </div>

                {message && <p className="form-message error">{message}</p>}

                <button type="submit" className="auth-submit" disabled={loading}>
                    {loading ? 'Saving...' : 'Reset password'}
                </button>

            </form>
        </AuthLayout>
    )
}

export default ResetPassword
