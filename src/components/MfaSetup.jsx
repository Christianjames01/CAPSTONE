import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Modal from './Modal'

function MfaSetup({ linkButtonClassName = 'employee-link-button' }) {
    const [factors, setFactors] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')

    const [enrolling, setEnrolling] = useState(false)
    const [enrollData, setEnrollData] = useState(null)
    const [verifyCode, setVerifyCode] = useState('')
    const [verifying, setVerifying] = useState(false)
    const [unenrolling, setUnenrolling] = useState(false)

    useEffect(() => {
        loadFactors()
    }, [])

    const loadFactors = async () => {
        try {
            setLoading(true)
            setError('')

            const { data, error: listError } = await supabase.auth.mfa.listFactors()
            if (listError) throw listError

            setFactors((data?.totp || []).filter((f) => f.status === 'verified'))

        } catch (err) {
            console.error('LIST MFA FACTORS ERROR:', err)
            setError(err.message || 'Failed to load two-factor status.')
        } finally {
            setLoading(false)
        }
    }

    const startEnroll = async () => {
        setError('')
        setMessage('')
        setEnrolling(true)

        const { data: existingFactors } = await supabase.auth.mfa.listFactors()
        const stale = (existingFactors?.totp || []).filter((f) => f.status === 'unverified')
        for (const factor of stale) {
            await supabase.auth.mfa.unenroll({ factorId: factor.id })
        }

        const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp' })

        if (enrollError) {
            setError(enrollError.message)
            setEnrolling(false)
            return
        }

        setEnrollData(data)
    }

    const cancelEnroll = async () => {
        if (enrollData?.id) {
            await supabase.auth.mfa.unenroll({ factorId: enrollData.id })
        }
        setEnrollData(null)
        setVerifyCode('')
        setEnrolling(false)
    }

    const confirmEnroll = async () => {
        if (!verifyCode.trim()) {
            setError('Enter the 6-digit code from your authenticator app.')
            return
        }

        try {
            setVerifying(true)
            setError('')

            const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
                factorId: enrollData.id,
            })
            if (challengeError) throw challengeError

            const { error: verifyError } = await supabase.auth.mfa.verify({
                factorId: enrollData.id,
                challengeId: challenge.id,
                code: verifyCode.trim(),
            })
            if (verifyError) throw verifyError

            setMessage('Two-factor authentication is now enabled on your account.')
            setEnrolling(false)
            setEnrollData(null)
            setVerifyCode('')
            await loadFactors()

        } catch (err) {
            console.error('VERIFY MFA ENROLL ERROR:', err)
            setError(err.message || 'The code was incorrect or expired. Try again.')
        } finally {
            setVerifying(false)
        }
    }

    const disableFactor = async (factorId) => {
        try {
            setUnenrolling(true)
            setError('')
            setMessage('')

            const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId })
            if (unenrollError) throw unenrollError

            setMessage('Two-factor authentication has been turned off.')
            await loadFactors()

        } catch (err) {
            console.error('DISABLE MFA ERROR:', err)
            setError(err.message || 'Failed to disable two-factor authentication.')
        } finally {
            setUnenrolling(false)
        }
    }

    if (loading) return null

    const hasVerifiedFactor = factors.length > 0

    return (
        <div>
            <p style={{ fontSize: 13, color: 'var(--slate)', marginBottom: 14 }}>
                Add an authenticator app (Google Authenticator, Authy, etc.) as a second step when logging in.
            </p>

            {!enrolling && error && <p className="form-message error" style={{ marginBottom: 12 }}>{error}</p>}
            {!enrolling && message && <p className="form-message success" style={{ marginBottom: 12 }}>{message}</p>}

            {hasVerifiedFactor ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 13.5 }}>✓ Two-factor authentication is enabled.</span>
                    <button
                        type="button"
                        className={linkButtonClassName}
                        style={{ color: 'var(--red)' }}
                        onClick={() => disableFactor(factors[0].id)}
                        disabled={unenrolling}
                    >
                        {unenrolling ? 'Disabling...' : 'Disable'}
                    </button>
                </div>
            ) : (
                <button type="button" className={linkButtonClassName} onClick={startEnroll}>
                    Enable Two-Factor Authentication
                </button>
            )}

            {enrolling && (
                <Modal title="Set Up Two-Factor Authentication" onClose={cancelEnroll}>
                    {error && <p className="form-message error" style={{ marginBottom: 12 }}>{error}</p>}

                    {!enrollData ? (
                        <p style={{ fontSize: 13, color: 'var(--slate)' }}>Setting up...</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <p style={{ fontSize: 13 }}>
                                Scan this QR code with your authenticator app, then enter the 6-digit code it shows.
                            </p>

                            <img
                                src={enrollData.totp.qr_code}
                                alt="Two-factor authentication QR code"
                                style={{ width: 180, height: 180, alignSelf: 'flex-start', border: '1px solid var(--line)', borderRadius: 8 }}
                            />

                            <p style={{ fontSize: 12, color: 'var(--slate)' }}>
                                Can't scan it? Enter this code manually in your app:{' '}
                                <code style={{ wordBreak: 'break-all' }}>{enrollData.totp.secret}</code>
                            </p>

                            <div className="form-group">
                                <label className="form-label">Verification Code</label>
                                <input
                                    className="form-input"
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={6}
                                    value={verifyCode}
                                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    placeholder="123456"
                                    disabled={verifying}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: 10 }}>
                                <button
                                    type="button"
                                    className="auth-submit"
                                    style={{ width: 'auto', padding: '11px 20px' }}
                                    onClick={confirmEnroll}
                                    disabled={verifying}
                                >
                                    {verifying ? 'Verifying...' : 'Verify & Enable'}
                                </button>
                                <button
                                    type="button"
                                    className={linkButtonClassName}
                                    style={{ color: 'var(--slate)' }}
                                    onClick={cancelEnroll}
                                    disabled={verifying}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </Modal>
            )}
        </div>
    )
}

export default MfaSetup
