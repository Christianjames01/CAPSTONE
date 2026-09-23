import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { SkeletonPage } from '../../components/Skeleton'
import Modal from '../../components/Modal'
import MfaSetup from '../../components/MfaSetup'
import PasswordRequirements from '../../components/PasswordRequirements'
import { passwordMeetsRequirements, passwordRequirementMessage } from '../../lib/passwordStrength'
import '../auth/Auth.css'
import './AdminPages.css'

function Profile() {
    const [profile, setProfile] = useState(null)
    const [employee, setEmployee] = useState(null)
    const [authEmail, setAuthEmail] = useState('')

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')

    const [editing, setEditing] = useState(false)
    const [saving, setSaving] = useState(false)
    const [phoneNumber, setPhoneNumber] = useState('')

    const [changingPassword, setChangingPassword] = useState(false)
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmNewPassword, setConfirmNewPassword] = useState('')
    const [passwordSaving, setPasswordSaving] = useState(false)
    const [passwordError, setPasswordError] = useState('')
    const [passwordMessage, setPasswordMessage] = useState('')

    const [changingEmail, setChangingEmail] = useState(false)
    const [emailCurrentPassword, setEmailCurrentPassword] = useState('')
    const [newEmail, setNewEmail] = useState('')
    const [emailSaving, setEmailSaving] = useState(false)
    const [emailError, setEmailError] = useState('')
    const [emailMessage, setEmailMessage] = useState('')

    useEffect(() => {
        loadProfile()
    }, [])

    const loadProfile = async () => {
        try {
            setLoading(true)
            setError('')

            const {
                data: { user },
                error: userError
            } = await supabase.auth.getUser()

            if (userError || !user) {
                throw new Error('You are not logged in.')
            }

            setAuthEmail(user.email || '')

            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('first_name, middle_name, last_name, suffix, email, phone_number, role, profile_photo_url')
                .eq('user_id', user.id)
                .single()

            if (profileError || !profileData) {
                throw new Error('Profile could not be found.')
            }

            setProfile(profileData)
            setPhoneNumber(profileData.phone_number || '')

            const { data: employeeData } = await supabase
                .from('employees')
                .select('employee_number, position_title, status')
                .eq('user_id', user.id)
                .maybeSingle()

            setEmployee(employeeData || null)

        } catch (err) {
            console.error('ADMIN PROFILE ERROR:', err)
            setError(err.message || 'Failed to load profile.')
        } finally {
            setLoading(false)
        }
    }

    const saveChanges = async () => {
        try {
            setSaving(true)
            setError('')
            setMessage('')

            const {
                data: { user },
                error: userError
            } = await supabase.auth.getUser()

            if (userError || !user) {
                throw new Error('You are not logged in.')
            }

            const { error: updateError } = await supabase
                .from('profiles')
                .update({ phone_number: phoneNumber.trim() || null })
                .eq('user_id', user.id)

            if (updateError) {
                throw new Error('Failed to update phone number: ' + updateError.message)
            }

            setProfile((prev) => ({ ...prev, phone_number: phoneNumber.trim() || null }))
            setMessage('Your information has been updated.')
            setEditing(false)

        } catch (err) {
            console.error('SAVE ADMIN PROFILE ERROR:', err)
            setError(err.message || 'Failed to save changes.')
        } finally {
            setSaving(false)
        }
    }

    const changePassword = async () => {
        setPasswordError('')
        setPasswordMessage('')

        if (!currentPassword || !newPassword || !confirmNewPassword) {
            setPasswordError('Please fill in all password fields.')
            return
        }

        if (newPassword !== confirmNewPassword) {
            setPasswordError("New passwords don't match.")
            return
        }

        if (!passwordMeetsRequirements(newPassword)) {
            setPasswordError(passwordRequirementMessage())
            return
        }

        try {
            setPasswordSaving(true)

            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: authEmail,
                password: currentPassword,
            })

            if (signInError) {
                throw new Error('Current password is incorrect.')
            }

            const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })

            if (updateError) {
                throw new Error(updateError.message)
            }

            setPasswordMessage('Your password has been changed.')
            setCurrentPassword('')
            setNewPassword('')
            setConfirmNewPassword('')
            setChangingPassword(false)

        } catch (err) {
            console.error('CHANGE PASSWORD ERROR:', err)
            setPasswordError(err.message || 'Failed to change password.')
        } finally {
            setPasswordSaving(false)
        }
    }

    const changeEmail = async () => {
        setEmailError('')
        setEmailMessage('')

        const trimmedEmail = newEmail.trim()

        if (!emailCurrentPassword || !trimmedEmail) {
            setEmailError('Please fill in all fields.')
            return
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
            setEmailError('Please enter a valid email address.')
            return
        }

        if (trimmedEmail.toLowerCase() === authEmail.toLowerCase()) {
            setEmailError('That is already your current login email.')
            return
        }

        try {
            setEmailSaving(true)

            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: authEmail,
                password: emailCurrentPassword,
            })

            if (signInError) {
                throw new Error('Current password is incorrect.')
            }

            const { error: updateError } = await supabase.auth.updateUser({ email: trimmedEmail })

            if (updateError) {
                throw new Error(updateError.message)
            }

            setEmailMessage(`A confirmation link has been sent to ${trimmedEmail}. Your login email won't change until you click that link — keep signing in with your current email until then.`)
            setEmailCurrentPassword('')
            setNewEmail('')
            setChangingEmail(false)

        } catch (err) {
            console.error('CHANGE EMAIL ERROR:', err)
            setEmailError(err.message || 'Failed to change email.')
        } finally {
            setEmailSaving(false)
        }
    }

    const fullName = profile
        ? [profile.first_name, profile.middle_name, profile.last_name, profile.suffix].filter(Boolean).join(' ')
        : ''

    const initials = profile
        ? `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}`.toUpperCase()
        : ''

    if (loading) {
        return (
            <SkeletonPage
                portal="admin"
                blocks={[
                    { type: 'header', titleWidth: 120 },
                    { type: 'profile' },
                    { type: 'card', fields: 6, titleWidth: 200 },
                    { type: 'card', action: true, fields: 3, titleWidth: 180 },
                    { type: 'card', action: true, lines: 1, titleWidth: 110 },
                    { type: 'card', action: true, lines: 1, titleWidth: 100 },
                    { type: 'card', lines: 2, buttons: 1, titleWidth: 220 },
                ]}
            />
        )
    }

    if (error && !profile) {
        return <div className="admin-error-box">{error}</div>
    }

    return (
        <div>
            <div className="admin-page-header">
                <h1>Profile</h1>
                <p>Your account information.</p>
            </div>

            {error && <div className="admin-error-box">{error}</div>}
            {message && <div className="admin-success-box">{message}</div>}

            <div className="admin-card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div
                    style={{
                        width: 56, height: 56, borderRadius: '50%', background: 'var(--blue-accent, var(--blue))', color: 'var(--white)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18,
                        flexShrink: 0, overflow: 'hidden',
                    }}
                >
                    {profile?.profile_photo_url ? (
                        <img src={profile.profile_photo_url} alt={fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (initials || 'RH')}
                </div>

                <div>
                    <h2 style={{ fontSize: 18, marginBottom: 4 }}>{fullName}</h2>
                    <p style={{ textTransform: 'capitalize' }}>{profile?.role === 'admin' ? 'System Admin' : 'Registrar Head'}</p>
                </div>
            </div>

            {employee && (
                <div className="admin-card">
                    <h2 style={{ fontSize: 16, marginBottom: 16 }}>Employment Information</h2>
                    <div className="admin-info-grid">
                        <div className="admin-info-field"><span>Employee Number</span><strong>{employee.employee_number}</strong></div>
                        <div className="admin-info-field"><span>Position</span><strong>{employee.position_title}</strong></div>
                        <div className="admin-info-field"><span>Status</span><strong style={{ textTransform: 'capitalize' }}>{employee.status}</strong></div>
                    </div>
                </div>
            )}

            <div className="admin-card">
                <div className="admin-page-header-row">
                    <h2 style={{ fontSize: 16 }}>Contact Information</h2>
                    <button className="admin-link-button" onClick={() => setEditing(true)}>Edit</button>
                </div>

                <div className="admin-info-grid" style={{ marginTop: 16 }}>
                    <div className="admin-info-field"><span>Email</span><strong>{authEmail || 'N/A'}</strong></div>
                    <div className="admin-info-field"><span>Phone Number</span><strong>{profile?.phone_number || 'Not set'}</strong></div>
                </div>
            </div>

            {editing && (
                <Modal
                    title="Edit Contact Information"
                    onClose={() => {
                        if (saving) return
                        setPhoneNumber(profile?.phone_number || '')
                        setEditing(false)
                    }}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div className="form-group">
                            <label className="form-label">Phone Number</label>
                            <input
                                className="form-input"
                                type="tel"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                placeholder="09XX XXX XXXX"
                                disabled={saving}
                            />
                        </div>

                        {error && <div className="admin-error-box">{error}</div>}

                        <div style={{ display: 'flex', gap: 10 }}>
                            <button className="auth-submit" style={{ width: 'auto', padding: '11px 20px' }} onClick={saveChanges} disabled={saving}>
                                {saving ? 'Saving...' : 'Save changes'}
                            </button>
                            <button
                                className="admin-danger-button"
                                onClick={() => { setPhoneNumber(profile?.phone_number || ''); setEditing(false) }}
                                disabled={saving}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            <div className="admin-card">
                <div className="admin-page-header-row">
                    <h2 style={{ fontSize: 16 }}>Login Email</h2>
                    <button className="admin-link-button" onClick={() => setChangingEmail(true)}>
                        Change email
                    </button>
                </div>

                {emailMessage && <div className="admin-success-box" style={{ marginTop: 16 }}>{emailMessage}</div>}
                <p style={{ fontSize: 13.5, color: 'var(--slate)', marginTop: emailMessage ? 0 : 16 }}>
                    Change the email address you use to log in. You'll need to confirm the new address before it takes effect.
                </p>
            </div>

            {changingEmail && (
                <Modal
                    title="Change Login Email"
                    onClose={() => {
                        if (emailSaving) return
                        setEmailCurrentPassword('')
                        setNewEmail('')
                        setEmailError('')
                        setChangingEmail(false)
                    }}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div className="form-group">
                            <label className="form-label">Current Password</label>
                            <input
                                className="form-input"
                                type="password"
                                value={emailCurrentPassword}
                                onChange={(e) => setEmailCurrentPassword(e.target.value)}
                                disabled={emailSaving}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">New Email Address</label>
                            <input
                                className="form-input"
                                type="email"
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                placeholder="you@hcdc.edu.ph"
                                disabled={emailSaving}
                            />
                        </div>

                        {emailError && <div className="admin-error-box">{emailError}</div>}

                        <div style={{ display: 'flex', gap: 10 }}>
                            <button
                                className="auth-submit"
                                style={{ width: 'auto', padding: '11px 20px' }}
                                onClick={changeEmail}
                                disabled={emailSaving}
                            >
                                {emailSaving ? 'Saving...' : 'Send confirmation link'}
                            </button>

                            <button
                                className="admin-danger-button"
                                onClick={() => {
                                    setEmailCurrentPassword('')
                                    setNewEmail('')
                                    setEmailError('')
                                    setChangingEmail(false)
                                }}
                                disabled={emailSaving}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            <div className="admin-card">
                <div className="admin-page-header-row">
                    <h2 style={{ fontSize: 16 }}>Password</h2>
                    <button className="admin-link-button" onClick={() => setChangingPassword(true)}>
                        Change password
                    </button>
                </div>

                {passwordMessage && <div className="admin-success-box" style={{ marginTop: 16 }}>{passwordMessage}</div>}
                <p style={{ fontSize: 13.5, color: 'var(--slate)', marginTop: passwordMessage ? 0 : 16 }}>
                    Change your account password.
                </p>
            </div>

            {changingPassword && (
                <Modal
                    title="Change Password"
                    onClose={() => {
                        if (passwordSaving) return
                        setCurrentPassword('')
                        setNewPassword('')
                        setConfirmNewPassword('')
                        setPasswordError('')
                        setChangingPassword(false)
                    }}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div className="form-group">
                            <label className="form-label">Current Password</label>
                            <input
                                className="form-input"
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                disabled={passwordSaving}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">New Password</label>
                            <input
                                className="form-input"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                disabled={passwordSaving}
                            />
                            <PasswordRequirements password={newPassword} />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Confirm New Password</label>
                            <input
                                className="form-input"
                                type="password"
                                value={confirmNewPassword}
                                onChange={(e) => setConfirmNewPassword(e.target.value)}
                                disabled={passwordSaving}
                            />
                        </div>

                        {passwordError && <div className="admin-error-box">{passwordError}</div>}

                        <div style={{ display: 'flex', gap: 10 }}>
                            <button
                                className="auth-submit"
                                style={{ width: 'auto', padding: '11px 20px' }}
                                onClick={changePassword}
                                disabled={passwordSaving}
                            >
                                {passwordSaving ? 'Saving...' : 'Save new password'}
                            </button>

                            <button
                                className="admin-danger-button"
                                onClick={() => {
                                    setCurrentPassword('')
                                    setNewPassword('')
                                    setConfirmNewPassword('')
                                    setPasswordError('')
                                    setChangingPassword(false)
                                }}
                                disabled={passwordSaving}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            <div className="admin-card">
                <h2 style={{ fontSize: 16, marginBottom: 6 }}>Two-Factor Authentication</h2>
                <MfaSetup linkButtonClassName="admin-link-button" dangerButtonClassName="admin-danger-button" />
            </div>
        </div>
    )
}

export default Profile
