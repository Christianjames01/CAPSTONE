import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { dashboardPathForRole } from '../../lib/roleRedirect'
import { establishStudentSession, notifyPreviousDeviceSignedOut } from '../../lib/singleSession'
import { checkLoginLock, recordLoginAttempt, formatLockMessage } from '../../lib/loginGuard'
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

    // Set once password auth succeeds but a second factor is still needed.
    const [mfaFactorId, setMfaFactorId] = useState(null)
    const [mfaChallengeId, setMfaChallengeId] = useState(null)
    const [mfaCode, setMfaCode] = useState('')

    // Runs after the account is fully authenticated (aal2 satisfied if the
    // account has 2FA enrolled) -- loads the profile and redirects.
    const completeLogin = async (userId) => {
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role, status')
            .eq('user_id', userId)
            .single()

        if (profileError) {
            console.error(profileError)
            setMessage('Login successful, but your profile could not be found.')
            setLoading(false)
            return
        }

        if (profile.status !== 'active') {
            await supabase.auth.signOut()
            setMessage("Your account has been deactivated. Please contact the Registrar's Office for assistance.")
            setLoading(false)
            return
        }

        const dashboardPath = dashboardPathForRole(profile.role)

        if (dashboardPath) {
            if (profile.role === 'student') {
                const { hadExistingSession } = await establishStudentSession(userId)
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

    const handleLogin = async (e) => {
        e.preventDefault()

        setLoading(true)
        setMessage('')
        setMessageType('error')

        // Refuse the attempt outright if this account is already locked
        // out from previous failures, without spending another attempt
        // against Supabase's own auth rate limit.
        const lockStatus = await checkLoginLock(email)
        if (lockStatus.locked) {
            setMessage(formatLockMessage(lockStatus.lockedUntil))
            setLoading(false)
            return
        }

        // Login to Supabase
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) {
            const attempt = await recordLoginAttempt(email, false)

            setMessage(
                attempt.locked
                    ? formatLockMessage(attempt.lockedUntil)
                    : error.message
            )
            setLoading(false)
            return
        }

        await recordLoginAttempt(email, true)

        // If this account has two-factor authentication enrolled, the
        // session is only aal1 at this point -- ask for the code before
        // treating login as complete.
        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

        if (aal && aal.nextLevel === 'aal2' && aal.currentLevel !== aal.nextLevel) {
            const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors()
            const factor = factorsData?.totp?.find((f) => f.status === 'verified')

            if (factorsError || !factor) {
                setMessage('Failed to start two-factor verification. Please try again.')
                setLoading(false)
                return
            }

            const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
                factorId: factor.id,
            })

            if (challengeError) {
                setMessage(challengeError.message)
                setLoading(false)
                return
            }

            setMfaFactorId(factor.id)
            setMfaChallengeId(challenge.id)
            setMessage('')
            setLoading(false)
            return
        }

        await completeLogin(data.user.id)
    }

    const handleMfaVerify = async (e) => {
        e.preventDefault()

        if (!mfaCode.trim()) {
            setMessage('Enter the 6-digit code from your authenticator app.')
            return
        }

        setLoading(true)
        setMessage('')

        const { data, error } = await supabase.auth.mfa.verify({
            factorId: mfaFactorId,
            challengeId: mfaChallengeId,
            code: mfaCode.trim(),
        })

        if (error) {
            setMessage(error.message || 'That code was incorrect or expired.')
            setLoading(false)
            return
        }

        await completeLogin(data.user.id)
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
            {mfaFactorId ? (
                <form className="auth-form" onSubmit={handleMfaVerify}>
                    <p style={{ fontSize: 13.5, color: 'var(--slate)', marginBottom: 16 }}>
                        Enter the 6-digit code from your authenticator app.
                    </p>

                    <div className="form-group">
                        <label className="form-label" htmlFor="mfa-code">Verification Code</label>
                        <input
                            id="mfa-code"
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            className="form-input"
                            value={mfaCode}
                            onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="123456"
                            autoFocus
                            required
                        />
                    </div>

                    {message && <p className={`form-message ${messageType}`}>{message}</p>}

                    <button type="submit" className="auth-submit" disabled={loading}>
                        {loading && <span className="auth-spinner" />}
                        {loading ? 'Verifying...' : 'Verify'}
                    </button>
                </form>
            ) : (
                <>
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
                            <Link to="/forgot-password" style={{ fontSize: 12.5, display: 'block', textAlign: 'right', marginTop: 6 }}>
                                Forgot password?
                            </Link>
                        </div>

                        {message && <p className={`form-message ${messageType}`}>{message}</p>}

                        <button type="submit" className="auth-submit" disabled={loading}>
                            {loading && <span className="auth-spinner" />}
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
                </>
            )}
        </AuthLayout>
    )
}

export default Login
