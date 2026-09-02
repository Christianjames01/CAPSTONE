import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { SkeletonPageHeader, SkeletonDetailCard } from '../../components/Skeleton'
import Modal from '../../components/Modal'
import MfaSetup from '../../components/MfaSetup'
import PasswordRequirements from '../../components/PasswordRequirements'
import { passwordMeetsRequirements, passwordRequirementMessage } from '../../lib/passwordStrength'
import '../auth/Auth.css'
import './StudentPages.css'

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
    const [emergencyContactName, setEmergencyContactName] = useState('')
    const [emergencyContactNumber, setEmergencyContactNumber] = useState('')

    const [changingPassword, setChangingPassword] = useState(false)
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmNewPassword, setConfirmNewPassword] = useState('')
    const [passwordSaving, setPasswordSaving] = useState(false)
    const [passwordError, setPasswordError] = useState('')
    const [passwordMessage, setPasswordMessage] = useState('')

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
                    birth_place,
                    address,
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
            setError(err.message || 'Failed to load profile.')
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

        const maxSize = 2 * 1024 * 1024

        if (file.size > maxSize) {
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

            const fileExtension = file.name.split('.').pop().toLowerCase()
            const filePath = `${user.id}/avatar-${Date.now()}.${fileExtension}`

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file, { cacheControl: '3600', upsert: false })

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
            <div>
                <SkeletonPageHeader />
                <SkeletonDetailCard fields={6} />
                <SkeletonDetailCard fields={4} />
            </div>
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

            {error && <div className="student-error-box">{error}</div>}
            {message && <div className="student-success-box">{message}</div>}

            <div className="student-card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div
                        style={{
                            width: 56,
                            height: 56,
                            borderRadius: '50%',
                            background: 'var(--blue)',
                            color: 'var(--white)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: 18,
                            overflow: 'hidden',
                        }}
                    >
                        {profile?.profile_photo_url ? (
                            <img
                                src={profile.profile_photo_url}
                                alt={fullName}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                        ) : (
                            initials || 'ST'
                        )}
                    </div>

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

                    <button
                        type="button"
                        onClick={() => document.getElementById('avatar-input').click()}
                        disabled={uploadingAvatar}
                        title="Change photo"
                        style={{
                            position: 'absolute',
                            bottom: -2,
                            right: -2,
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            background: 'var(--red)',
                            color: 'var(--white)',
                            border: '2px solid var(--white)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 11,
                            cursor: 'pointer',
                        }}
                    >
                        {uploadingAvatar ? '…' : '✎'}
                    </button>
                </div>

                <div style={{ minWidth: 0 }}>
                    <h2 style={{ fontSize: 18, marginBottom: 4, overflowWrap: 'break-word' }}>{fullName}</h2>
                    <p>{student?.student_number}</p>
                    <button
                        type="button"
                        className="student-link-button"
                        style={{ marginTop: 4, fontSize: 12.5 }}
                        onClick={() => document.getElementById('avatar-input').click()}
                        disabled={uploadingAvatar}
                    >
                        {uploadingAvatar ? 'Uploading...' : 'Change profile photo'}
                    </button>
                </div>
            </div>

            <div className="student-card">
                <h2 style={{ fontSize: 16, marginBottom: 16 }}>Academic Information</h2>

                <div className="student-info-grid">
                    <div className="student-info-field">
                        <span>Student Number</span>
                        <strong>{student?.student_number || 'N/A'}</strong>
                    </div>

                    <div className="student-info-field">
                        <span>College</span>
                        <strong>{collegeName || 'N/A'}</strong>
                    </div>

                    <div className="student-info-field">
                        <span>Program</span>
                        <strong>{programName || 'N/A'}</strong>
                    </div>

                    <div className="student-info-field">
                        <span>Year Level</span>
                        <strong>{student?.year_level || 'N/A'}</strong>
                    </div>

                    <div className="student-info-field">
                        <span>Enrollment Status</span>
                        <strong>{student?.enrollment_status || 'N/A'}</strong>
                    </div>

                    <div className="student-info-field">
                        <span>Graduation Year</span>
                        <strong>{student?.graduation_year || 'N/A'}</strong>
                    </div>
                </div>
            </div>

            <div className="student-card">
                <h2 style={{ fontSize: 16, marginBottom: 16 }}>Personal Information</h2>

                <div className="student-info-grid">
                    <div className="student-info-field">
                        <span>Full Name</span>
                        <strong>{fullName || 'N/A'}</strong>
                    </div>

                    <div className="student-info-field">
                        <span>Email</span>
                        <strong>{profile?.email || 'N/A'}</strong>
                    </div>

                    <div className="student-info-field">
                        <span>Birth Date</span>
                        <strong>{formatDate(student?.birth_date)}</strong>
                    </div>

                    <div className="student-info-field">
                        <span>Birth Place</span>
                        <strong>{student?.birth_place || 'N/A'}</strong>
                    </div>
                </div>

                <p style={{ fontSize: 12, color: 'var(--slate)', marginTop: 14 }}>
                    Name, email, and birth information are managed by the Registrar's Office.
                    Contact the Registrar to request changes.
                </p>
            </div>

            <div className="student-card">
                <div className="student-page-header-row">
                    <h2 style={{ fontSize: 16 }}>Contact Information</h2>

                    {!editing && (
                        <button className="student-link-button" onClick={startEditing}>
                            Edit
                        </button>
                    )}
                </div>

                <div className="student-info-grid" style={{ marginTop: 16 }}>
                    <div className="student-info-field">
                        <span>Phone Number</span>
                        <strong>{profile?.phone_number || 'Not set'}</strong>
                    </div>

                    <div className="student-info-field">
                        <span>Address</span>
                        <strong>{student?.address || 'Not set'}</strong>
                    </div>

                    <div className="student-info-field">
                        <span>Emergency Contact Name</span>
                        <strong>{student?.emergency_contact_name || 'Not set'}</strong>
                    </div>

                    <div className="student-info-field">
                        <span>Emergency Contact Number</span>
                        <strong>{student?.emergency_contact_number || 'Not set'}</strong>
                    </div>
                </div>
            </div>

            {editing && (
                <Modal title="Edit Contact Information" onClose={cancelEditing}>
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

                        <div className="form-group">
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

                        <div style={{ display: 'flex', gap: 10 }}>
                            <button className="auth-submit" style={{ width: 'auto', padding: '11px 20px' }} onClick={saveChanges} disabled={saving}>
                                {saving ? 'Saving...' : 'Save changes'}
                            </button>

                            <button
                                className="student-link-button"
                                onClick={cancelEditing}
                                disabled={saving}
                                style={{ color: 'var(--slate)' }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            <div className="student-card">
                <div className="student-page-header-row">
                    <h2 style={{ fontSize: 16 }}>Password</h2>

                    <button className="student-link-button" onClick={() => setChangingPassword(true)}>
                        Change password
                    </button>
                </div>

                {passwordMessage && <div className="student-success-box" style={{ marginTop: 16 }}>{passwordMessage}</div>}
                <p style={{ fontSize: 13.5, color: 'var(--slate)', marginTop: passwordMessage ? 0 : 16 }}>
                    Change your account password.
                </p>
            </div>

            <div className="student-card">
                <h2 style={{ fontSize: 16, marginBottom: 6 }}>Two-Factor Authentication</h2>
                <MfaSetup linkButtonClassName="student-link-button" />
            </div>

            {changingPassword && (
                <Modal
                    title="Change Password"
                    onClose={() => {
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

                        {passwordError && <div className="student-error-box">{passwordError}</div>}

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
                                className="student-link-button"
                                style={{ color: 'var(--slate)' }}
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
