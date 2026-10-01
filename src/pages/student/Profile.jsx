import { useEffect, useState } from 'react'
import { InfoBox } from './StudentUi'
import { friendlyError } from '../../lib/friendlyError'
import { MAX_ORIGINAL_IMAGE_MB, shrinkImage } from '../../lib/shrinkImage'
import { IconLock } from '../../components/UiIcons'
import { IconPhone, IconMail, IconBook, IconUserCircle } from './icons'
import { supabase } from '../../lib/supabase'
import { SkeletonPage } from '../../components/Skeleton'
import Modal from '../../components/Modal'
import MfaSetup from '../../components/MfaSetup'
import PasswordRequirements from '../../components/PasswordRequirements'
import { passwordMeetsRequirements, passwordRequirementMessage } from '../../lib/passwordStrength'
import '../auth/Auth.css'
import './StudentPages.css'
import { getCaptchaToken } from '../../lib/captcha'
import { ProfileHero, ProfileSection, ProfileFields, SecurityRow, IconShield, IconKey } from '../../components/ProfileParts'

function Profile() {
    const [profile, setProfile] = useState(null)
    const [student, setStudent] = useState(null)
    const [collegeName, setCollegeName] = useState('')
    const [programName, setProgramName] = useState('')

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')

    const [editing, setEditing] = useState(false)
    const [saving, setSaving] = useState(false)
    const [uploadingAvatar, setUploadingAvatar] = useState(false)

    const [phoneNumber, setPhoneNumber] = useState('')
    const [address, setAddress] = useState('')
    const [alternatePhoneNumber, setAlternatePhoneNumber] = useState('')
    const [alternateEmail, setAlternateEmail] = useState('')
    const [emergencyContactName, setEmergencyContactName] = useState('')
    const [emergencyContactNumber, setEmergencyContactNumber] = useState('')

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

            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select(`
                    first_name,
                    middle_name,
                    last_name,
                    suffix,
                    email,
                    phone_number,
                    profile_photo_url
                `)
                .eq('user_id', user.id)
                .single()

            if (profileError || !profileData) {
                throw new Error('Profile could not be found.')
            }

            setProfile(profileData)
            setPhoneNumber(profileData.phone_number || '')

            const { data: studentData, error: studentError } = await supabase
                .from('students')
                .select(`
                    student_number,
                    college_id,
                    program_id,
                    year_level,
                    enrollment_status,
                    birth_date,
                    address,
                    alternate_phone_number,
                    alternate_email,
                    emergency_contact_name,
                    emergency_contact_number,
                    graduation_year
                `)
                .eq('user_id', user.id)
                .single()

            if (studentError || !studentData) {
                throw new Error('Student record could not be found.')
            }

            setStudent(studentData)
            setAddress(studentData.address || '')
            setAlternatePhoneNumber(studentData.alternate_phone_number || '')
            setAlternateEmail(studentData.alternate_email || '')
            setEmergencyContactName(studentData.emergency_contact_name || '')
            setEmergencyContactNumber(studentData.emergency_contact_number || '')

            if (studentData.college_id) {
                const { data: college } = await supabase
                    .from('colleges')
                    .select('college_name')
                    .eq('college_id', studentData.college_id)
                    .single()

                setCollegeName(college?.college_name || '')
            }

            if (studentData.program_id) {
                const { data: program } = await supabase
                    .from('programs')
                    .select('program_name')
                    .eq('program_id', studentData.program_id)
                    .single()

                setProgramName(program?.program_name || '')
            }

        } catch (err) {
            console.error('PROFILE ERROR:', err)
            setError(friendlyError(err, "We couldn't load your profile."))
        } finally {
            setLoading(false)
        }
    }

    const uploadAvatar = async (file) => {
        setError('')
        setMessage('')

        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']

        if (!allowedTypes.includes(file.type)) {
            setError('Only JPG, PNG, and WEBP images are allowed.')
            return
        }

        if (file.size > MAX_ORIGINAL_IMAGE_MB * 1024 * 1024) {
            setError(`Image must not exceed ${MAX_ORIGINAL_IMAGE_MB} MB.`)
            return
        }

        // Avatars are shown small: shrink to 600 px before upload.
        const photo = await shrinkImage(file, { maxSide: 600, skipBelowBytes: 150 * 1024 })
        if (photo.size > 2 * 1024 * 1024) {
            setError('Image must not exceed 2 MB.')
            return
        }

        try {
            setUploadingAvatar(true)

            const {
                data: { user },
                error: userError
            } = await supabase.auth.getUser()

            if (userError || !user) {
                throw new Error('You are not logged in.')
            }

            const fileExtension = photo.name.split('.').pop().toLowerCase()
            const filePath = `${user.id}/avatar-${Date.now()}.${fileExtension}`

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, photo, { cacheControl: '3600', upsert: false })

            if (uploadError) {
                throw new Error('Failed to upload photo: ' + uploadError.message)
            }

            const { data: publicUrlData } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath)

            const publicUrl = publicUrlData?.publicUrl

            const { error: updateError } = await supabase
                .from('profiles')
                .update({ profile_photo_url: publicUrl })
                .eq('user_id', user.id)

            if (updateError) {
                await supabase.storage.from('avatars').remove([filePath])
                throw new Error('Failed to save photo: ' + updateError.message)
            }

            setProfile((prev) => ({ ...prev, profile_photo_url: publicUrl }))
            setMessage('Profile photo updated.')
            window.dispatchEvent(new Event('profile-updated'))

        } catch (err) {
            console.error('AVATAR UPLOAD ERROR:', err)
            setError(err.message || 'Failed to upload photo.')
        } finally {
            setUploadingAvatar(false)
        }
    }

    const startEditing = () => {
        setMessage('')
        setError('')
        setEditing(true)
    }

    const cancelEditing = () => {
        setPhoneNumber(profile?.phone_number || '')
        setAddress(student?.address || '')
        setAlternatePhoneNumber(student?.alternate_phone_number || '')
        setAlternateEmail(student?.alternate_email || '')
        setEmergencyContactName(student?.emergency_contact_name || '')
        setEmergencyContactNumber(student?.emergency_contact_number || '')
        setEditing(false)
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

            const { error: profileUpdateError } = await supabase
                .from('profiles')
                .update({ phone_number: phoneNumber.trim() || null })
                .eq('user_id', user.id)

            if (profileUpdateError) {
                throw new Error('Failed to update phone number: ' + profileUpdateError.message)
            }

            const { error: studentUpdateError } = await supabase
                .from('students')
                .update({
                    address: address.trim() || null,
                    alternate_phone_number: alternatePhoneNumber.trim() || null,
                    alternate_email: alternateEmail.trim() || null,
                    emergency_contact_name: emergencyContactName.trim() || null,
                    emergency_contact_number: emergencyContactNumber.trim() || null,
                })
                .eq('user_id', user.id)

            if (studentUpdateError) {
                throw new Error('Failed to update contact information: ' + studentUpdateError.message)
            }

            setProfile((prev) => ({ ...prev, phone_number: phoneNumber.trim() || null }))
            setStudent((prev) => ({
                ...prev,
                address: address.trim() || null,
                alternate_phone_number: alternatePhoneNumber.trim() || null,
                alternate_email: alternateEmail.trim() || null,
                emergency_contact_name: emergencyContactName.trim() || null,
                emergency_contact_number: emergencyContactNumber.trim() || null,
            }))

            setMessage('Your information has been updated.')
            setEditing(false)

        } catch (err) {
            console.error('SAVE PROFILE ERROR:', err)
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
                email: profile.email,
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

        if (trimmedEmail.toLowerCase() === (profile?.email || '').toLowerCase()) {
            setEmailError('That is already your current login email.')
            return
        }

        try {
            setEmailSaving(true)

            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: profile.email,
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
        ? [profile.first_name, profile.middle_name, profile.last_name, profile.suffix]
            .filter(Boolean)
            .join(' ')
        : ''

    const initials = profile
        ? `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}`.toUpperCase()
        : ''

    const formatDate = (date) => {
        if (!date) return 'N/A'

        return new Date(`${date}T00:00:00`).toLocaleDateString('en-PH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })
    }

    if (loading) {
        return (
            <SkeletonPage
                portal="student"
                blocks={[
                    { type: 'header', titleWidth: 120 },
                    { type: 'profile' },
                    { type: 'card', fields: 6, titleWidth: 200 },
                    { type: 'card', fields: 3, titleWidth: 190 },
                    { type: 'card', action: true, fields: 5, titleWidth: 180 },
                    { type: 'card', action: true, lines: 1, titleWidth: 110 },
                    { type: 'card', action: true, lines: 1, titleWidth: 100 },
                    { type: 'card', lines: 2, buttons: 1, titleWidth: 220 },
                ]}
            />
        )
    }

    if (error && !profile) {
        return <div className="student-error-box">{error}</div>
    }

    return (
        <div>
            <div className="student-page-header">
                <h1>Profile</h1>
                <p>View your student information and update your contact details.</p>
            </div>

            <InfoBox title="What you can change here">
                You can update your phone number, email, password and photo. Your name, student number, college and
                program come from your school record — if any of them is wrong, message the Registrar to have it corrected.
            </InfoBox>

            {error && <div className="student-error-box">{error}</div>}
            {message && <div className="student-success-box">{message}</div>}

            <input
                id="avatar-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                disabled={uploadingAvatar}
                onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) uploadAvatar(file)
                    e.target.value = ''
                }}
            />

            <div className="pf-page">
                <ProfileHero
                    photoUrl={profile?.profile_photo_url}
                    name={fullName}
                    initials={initials || 'ST'}
                    eyebrow="Student"
                    subtitle={[programName, collegeName].filter(Boolean).join(' · ') || profile?.email}
                    tags={[student?.student_number, student?.year_level, student?.enrollment_status]}
                    onChangePhoto={() => document.getElementById('avatar-input').click()}
                    uploading={uploadingAvatar}
                />

                <div className="pf-layout">
                    <div className="pf-column">
                        <ProfileSection icon={IconBook} title="Academic Information" subtitle="From your school records.">
                            <ProfileFields
                                fields={[
                                    { label: 'Student Number', value: student?.student_number },
                                    { label: 'Year Level', value: student?.year_level },
                                    { label: 'College', value: collegeName, wide: true },
                                    { label: 'Program', value: programName, wide: true },
                                    { label: 'Enrollment Status', value: student?.enrollment_status },
                                    { label: 'Graduation Year', value: student?.graduation_year },
                                ]}
                            />
                        </ProfileSection>

                        <ProfileSection icon={IconUserCircle} title="Personal Information" subtitle="Managed by the Registrar's Office.">
                            <ProfileFields
                                fields={[
                                    { label: 'Full Name', value: fullName, wide: true },
                                    { label: 'Email', value: profile?.email, wide: true },
                                    { label: 'Birth Date', value: student?.birth_date ? formatDate(student.birth_date) : '' },
                                ]}
                            />
                            <p className="pf-note">
                                Name, email, and birth information are managed by the Registrar's Office.
                                Contact the Registrar to request changes.
                            </p>
                        </ProfileSection>

                        <ProfileSection
                            icon={IconPhone}
                            title="Contact Information"
                            subtitle="How the Registrar can reach you about your requests."
                            actionLabel={editing ? '' : 'Edit'}
                            onAction={startEditing}
                        >
                            <ProfileFields
                                fields={[
                                    { label: 'Phone Number', value: profile?.phone_number },
                                    { label: 'Alternate Phone', value: student?.alternate_phone_number },
                                    { label: 'Address', value: student?.address, wide: true },
                                    { label: 'Personal Email', value: student?.alternate_email, wide: true },
                                    { label: 'Emergency Contact', value: student?.emergency_contact_name },
                                    { label: 'Emergency Number', value: student?.emergency_contact_number },
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
                                    text="Your HCDC account is deactivated once you graduate. Switch your login to a personal email beforehand so you can still sign in and track requests afterward."
                                    actionLabel="Change"
                                    onAction={() => {
                                        setNewEmail(student?.alternate_email || '')
                                        setChangingEmail(true)
                                    }}
                                >
                                    {emailMessage && <div className="student-success-box pf-message">{emailMessage}</div>}
                                </SecurityRow>

                                <SecurityRow
                                    icon={IconKey}
                                    title="Password"
                                    text="Change your account password."
                                    actionLabel="Change"
                                    onAction={() => setChangingPassword(true)}
                                >
                                    {passwordMessage && <div className="student-success-box pf-message">{passwordMessage}</div>}
                                </SecurityRow>

                                <SecurityRow icon={IconLock} title="Two-factor authentication">
                                    <MfaSetup linkButtonClassName="pf-action" />
                                </SecurityRow>
                            </div>
                        </ProfileSection>
                    </div>
                </div>
            </div>

            {editing && (
                <Modal
                    title="Edit Contact Information"
                    subtitle="How the Registrar can reach you about your requests."
                    icon={IconPhone}
                    maxWidth={560}
                    onClose={cancelEditing}
                >
                    <div className="app-modal-grid">

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

                        <div className="form-group">
                            <label className="form-label">Alternate Phone Number</label>
                            <input
                                className="form-input"
                                type="tel"
                                value={alternatePhoneNumber}
                                onChange={(e) => setAlternatePhoneNumber(e.target.value)}
                                placeholder="09XX XXX XXXX"
                                disabled={saving}
                            />
                        </div>

                        <div className="form-group is-wide">
                            <label className="form-label">Address</label>
                            <input
                                className="form-input"
                                type="text"
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                placeholder="Your current address"
                                disabled={saving}
                            />
                        </div>

                        <div className="form-group is-wide">
                            <label className="form-label">Personal Email</label>
                            <input
                                className="form-input"
                                type="email"
                                value={alternateEmail}
                                onChange={(e) => setAlternateEmail(e.target.value)}
                                placeholder="you@gmail.com"
                                disabled={saving}
                            />
                            <small style={{ display: 'block', marginTop: 6, fontSize: 12, color: 'var(--slate)' }}>
                                A personal email you still control after your HCDC account is deactivated post-graduation.
                            </small>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Emergency Contact Name</label>
                            <input
                                className="form-input"
                                type="text"
                                value={emergencyContactName}
                                onChange={(e) => setEmergencyContactName(e.target.value)}
                                placeholder="Full name"
                                disabled={saving}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Emergency Contact Number</label>
                            <input
                                className="form-input"
                                type="tel"
                                value={emergencyContactNumber}
                                onChange={(e) => setEmergencyContactNumber(e.target.value)}
                                placeholder="09XX XXX XXXX"
                                disabled={saving}
                            />
                        </div>

                        {error && <div className="student-error-box">{error}</div>}

                        <div className="app-modal-actions">
                            <button className="app-modal-btn is-primary" onClick={saveChanges} disabled={saving}>
                                {saving ? 'Saving...' : 'Save changes'}
                            </button>

                            <button
                                className="app-modal-btn"
                                onClick={cancelEditing}
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
                    <div className="app-modal-form">
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
                                placeholder="you@gmail.com"
                                disabled={emailSaving}
                            />
                        </div>

                        {emailError && <div className="student-error-box">{emailError}</div>}

                        <div className="app-modal-actions">
                            <button
                                className="app-modal-btn is-primary"
                                onClick={changeEmail}
                                disabled={emailSaving}
                            >
                                {emailSaving ? 'Saving...' : 'Send confirmation link'}
                            </button>

                            <button
                                className="app-modal-btn"
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
                    icon={IconKey}
                    onClose={() => {
                        setCurrentPassword('')
                        setNewPassword('')
                        setConfirmNewPassword('')
                        setPasswordError('')
                        setChangingPassword(false)
                    }}
                >
                    <div className="app-modal-form">
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

                        {passwordError && <div className="student-error-box">{passwordError}</div>}

                        <div className="app-modal-actions">
                            <button
                                className="app-modal-btn is-primary"
                                onClick={changePassword}
                                disabled={passwordSaving}
                            >
                                {passwordSaving ? 'Saving...' : 'Save new password'}
                            </button>

                            <button
                                className="app-modal-btn"
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
