import { useEffect, useState } from 'react'
import { IconPhone, IconMail } from '../student/icons'
import { IconLock } from '../../components/UiIcons'
import { supabase } from '../../lib/supabase'
import { SkeletonPage } from '../../components/Skeleton'
import Modal from '../../components/Modal'
import MfaSetup from '../../components/MfaSetup'
import PasswordRequirements from '../../components/PasswordRequirements'
import { passwordMeetsRequirements, passwordRequirementMessage } from '../../lib/passwordStrength'
import '../auth/Auth.css'
import './AdminPages.css'
import { getCaptchaToken } from '../../lib/captcha'
import { ProfileHero, ProfileSection, ProfileFields, SecurityRow, IconShield, IconBriefcase, IconKey } from '../../components/ProfileParts'

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
                options: { captchaToken: await getCaptchaToken() },
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
                options: { captchaToken: await getCaptchaToken() },
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
                <p>Your account information and sign-in security.</p>
            </div>

            {error && <div className="admin-error-box">{error}</div>}
            {message && <div className="admin-success-box">{message}</div>}

            <div className="pf-page">
                <ProfileHero
                    photoUrl={profile?.profile_photo_url}
                    name={fullName}
                    initials={initials || 'RH'}
                    eyebrow={profile?.role === 'admin' ? 'System Admin' : 'Registrar Head'}
                    subtitle={authEmail}
                    tags={[employee?.position_title, employee?.employee_number, "Registrar's Office"]}
                />

                <div className="pf-layout">
                    <div className="pf-column">
                        {employee && (
                            <ProfileSection icon={IconBriefcase} title="Employment Information" subtitle="Your record at the Registrar's Office.">
                                <ProfileFields
                                    fields={[
                                        { label: 'Employee Number', value: employee.employee_number },
                                        { label: 'Position', value: employee.position_title },
                                        { label: 'Status', value: employee.status, capitalize: true },
                                    ]}
                                />
                            </ProfileSection>
                        )}

                        <ProfileSection
                            icon={IconPhone}
                            title="Contact Information"
                            subtitle="How students and staff can reach you."
                            actionLabel="Edit"
                            onAction={() => setEditing(true)}
                        >
                            <ProfileFields
                                fields={[
                                    { label: 'Email', value: authEmail },
                                    { label: 'Phone Number', value: profile?.phone_number },
                                ]}
                            />
                        </ProfileSection>
                    </div>

                    <div className="pf-column">
                        <ProfileSection icon={IconShield} title="Sign-in & Security" subtitle="Keep your account safe.">
                            <div className="pf-rows">
                                <SecurityRow
                                    icon={IconMail}
                                    title="Login email"
                                    text={authEmail || 'Change the email address you use to log in. You confirm the new address before it takes effect.'}
                                    actionLabel="Change"
                                    onAction={() => setChangingEmail(true)}
                                >
                                    {emailMessage && <div className="admin-success-box pf-message">{emailMessage}</div>}
                                </SecurityRow>

                                <SecurityRow
                                    icon={IconKey}
                                    title="Password"
                                    text="Change your account password."
                                    actionLabel="Change"
                                    onAction={() => setChangingPassword(true)}
                                >
                                    {passwordMessage && <div className="admin-success-box pf-message">{passwordMessage}</div>}
                                </SecurityRow>

                                <SecurityRow icon={IconLock} title="Two-factor authentication">
                                    <MfaSetup linkButtonClassName="pf-action" dangerButtonClassName="admin-danger-button" />
                                </SecurityRow>
                            </div>
                        </ProfileSection>
                    </div>
                </div>
            </div>

            {editing && (
                <Modal
                    title="Edit Contact Information"
                    subtitle="Your phone number and other contact details."
                    icon={IconPhone}
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

            {changingEmail && (
                <Modal
                    title="Change Login Email"
                    subtitle="You will confirm the new address from your inbox."
                    icon={IconMail}
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

            {changingPassword && (
                <Modal
                    title="Change Password"
                    subtitle="Use a strong password you do not use elsewhere."
                    icon={IconLock}
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
        </div>
    )
}

export default Profile
