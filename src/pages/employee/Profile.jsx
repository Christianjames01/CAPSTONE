import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { SkeletonPage } from '../../components/Skeleton'
import Modal from '../../components/Modal'
import MfaSetup from '../../components/MfaSetup'
import PasswordRequirements from '../../components/PasswordRequirements'
import { passwordMeetsRequirements, passwordRequirementMessage } from '../../lib/passwordStrength'
import '../auth/Auth.css'
import './EmployeePages.css'
import { getCaptchaToken } from '../../lib/captcha'
import { IconPhone, IconBook } from '../student/icons'
import { IconLock } from '../../components/UiIcons'
import { ProfileHero, ProfileSection, ProfileFields, SecurityRow, IconShield, IconBriefcase, IconKey } from '../../components/ProfileParts'
import { digitsOnly, isValidPhMobile } from '../../lib/phoneInput'

function Profile() {
    const [profile, setProfile] = useState(null)
    const [employee, setEmployee] = useState(null)
    const [collegeName, setCollegeName] = useState('')
    const [assignments, setAssignments] = useState([])

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
                .select('first_name, middle_name, last_name, suffix, email, phone_number, profile_photo_url')
                .eq('user_id', user.id)
                .single()

            if (profileError || !profileData) {
                throw new Error('Profile could not be found.')
            }

            setProfile(profileData)
            setPhoneNumber(profileData.phone_number || '')

            const { data: employeeData, error: employeeError } = await supabase
                .from('employees')
                .select('employee_id, employee_number, position_title, assigned_college_id, status')
                .eq('user_id', user.id)
                .single()

            if (employeeError || !employeeData) {
                throw new Error('Employee record could not be found.')
            }

            setEmployee(employeeData)

            if (employeeData.assigned_college_id) {
                const { data: college } = await supabase
                    .from('colleges')
                    .select('college_name')
                    .eq('college_id', employeeData.assigned_college_id)
                    .single()

                setCollegeName(college?.college_name || '')
            }

            const { data: assignmentRows, error: assignmentError } = await supabase
                .from('employee_assignments')
                .select('assignment_id, college_id, program_id, is_primary, status')
                .eq('employee_id', employeeData.employee_id)
                .eq('status', 'active')

            if (assignmentError) {
                console.error('EMPLOYEE ASSIGNMENTS ERROR:', assignmentError)
            } else {
                const collegeIds = [...new Set((assignmentRows || []).map((a) => a.college_id).filter(Boolean))]
                const programIds = [...new Set((assignmentRows || []).map((a) => a.program_id).filter(Boolean))]

                const [{ data: assignmentColleges }, { data: assignmentPrograms }] = await Promise.all([
                    collegeIds.length
                        ? supabase.from('colleges').select('college_id, college_name').in('college_id', collegeIds)
                        : Promise.resolve({ data: [] }),
                    programIds.length
                        ? supabase.from('programs').select('program_id, program_name').in('program_id', programIds)
                        : Promise.resolve({ data: [] }),
                ])

                const assignmentCollegeNameById = Object.fromEntries((assignmentColleges || []).map((c) => [c.college_id, c.college_name]))
                const programNameById = Object.fromEntries((assignmentPrograms || []).map((p) => [p.program_id, p.program_name]))

                setAssignments(
                    (assignmentRows || []).map((a) => ({
                        ...a,
                        collegeName: assignmentCollegeNameById[a.college_id] || 'N/A',
                        programName: programNameById[a.program_id] || 'N/A',
                    }))
                )
            }

        } catch (err) {
            console.error('EMPLOYEE PROFILE ERROR:', err)
            setError(err.message || 'Failed to load profile.')
        } finally {
            setLoading(false)
        }
    }

    const saveChanges = async () => {
        if (phoneNumber.trim() && !isValidPhMobile(phoneNumber.trim())) {
            setError('Phone number must be an 11-digit mobile number starting with 09.')
            return
        }

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
            console.error('SAVE EMPLOYEE PROFILE ERROR:', err)
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

    const fullName = profile
        ? [profile.first_name, profile.middle_name, profile.last_name, profile.suffix].filter(Boolean).join(' ')
        : ''

    const initials = profile
        ? `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}`.toUpperCase()
        : ''

    if (loading) {
        return (
            <SkeletonPage
                portal="employee"
                blocks={[
                    { type: 'header', titleWidth: 120 },
                    { type: 'profile' },
                    { type: 'card', fields: 6, titleWidth: 200 },
                    { type: 'card', rows: 2, titleWidth: 280 },
                    { type: 'card', action: true, fields: 3, titleWidth: 180 },
                    { type: 'card', action: true, lines: 1, titleWidth: 100 },
                    { type: 'card', lines: 2, buttons: 1, titleWidth: 220 },
                ]}
            />
        )
    }

    if (error && !profile) {
        return <div className="employee-error-box">{error}</div>
    }

    return (
        <div>
            <div className="employee-page-header">
                <h1>Profile</h1>
                <p>Your employee information, assignments and sign-in security.</p>
            </div>

            {error && <div className="employee-error-box">{error}</div>}
            {message && <div className="employee-success-box">{message}</div>}

            <div className="pf-page">
                <ProfileHero
                    photoUrl={profile?.profile_photo_url}
                    name={fullName}
                    initials={initials || 'EM'}
                    eyebrow="Registrar Staff"
                    subtitle={profile?.email}
                    tags={[employee?.position_title, employee?.employee_number, collegeName]}
                />

                <div className="pf-layout">
                    <div className="pf-column">
                        <ProfileSection icon={IconBriefcase} title="Employment Information" subtitle="Managed by the Registrar Head.">
                            <ProfileFields
                                fields={[
                                    { label: 'Employee Number', value: employee?.employee_number },
                                    { label: 'Position', value: employee?.position_title },
                                    { label: 'Assigned College', value: collegeName },
                                    { label: 'Status', value: employee?.status, capitalize: true },
                                ]}
                            />
                        </ProfileSection>

                        <ProfileSection
                            icon={IconBook}
                            title="Assigned Divisions & Programs"
                            subtitle="Requests are routed to you only for these programs."
                        >
                            {assignments.length === 0 ? (
                                <p className="pf-note" style={{ marginTop: 0 }}>
                                    You have no active college/program assignments yet.
                                </p>
                            ) : (
                                <div className="pf-list">
                                    {assignments.map((a) => (
                                        <div key={a.assignment_id} className="pf-list-item">
                                            <div>
                                                <strong>{a.programName}</strong>
                                                <span>{a.collegeName}</span>
                                            </div>
                                            {a.is_primary && <span className="pf-badge">Primary</span>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ProfileSection>

                        <ProfileSection
                            icon={IconPhone}
                            title="Contact Information"
                            subtitle="How students and the office can reach you."
                            actionLabel="Edit"
                            onAction={() => setEditing(true)}
                        >
                            <ProfileFields
                                fields={[
                                    { label: 'Email', value: profile?.email },
                                    { label: 'Phone Number', value: profile?.phone_number },
                                ]}
                            />
                        </ProfileSection>
                    </div>

                    <div className="pf-column">
                        <ProfileSection icon={IconShield} title="Sign-in & Security" subtitle="Keep your account safe.">
                            <div className="pf-rows">
                                <SecurityRow
                                    icon={IconKey}
                                    title="Password"
                                    text="Change the password the Registrar Head set for your account."
                                    actionLabel="Change"
                                    onAction={() => setChangingPassword(true)}
                                >
                                    {passwordMessage && <div className="employee-success-box pf-message">{passwordMessage}</div>}
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
                    subtitle="How students and the office can reach you."
                    icon={IconPhone}
                    onClose={() => {
                        if (saving) return
                        setPhoneNumber(profile?.phone_number || '')
                        setEditing(false)
                    }}
                >
                    <div className="app-modal-form">
                        <div className="form-group">
                            <label className="form-label">Phone Number</label>
                            <input
                                className="form-input"
                                type="tel"
                                inputMode="numeric"
                                maxLength={11}
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(digitsOnly(e.target.value))}
                                placeholder="09XXXXXXXXX"
                                disabled={saving}
                            />
                        </div>

                        {error && <div className="employee-error-box">{error}</div>}

                        <div className="app-modal-actions">
                            <button
                                className="app-modal-btn is-primary"
                                onClick={saveChanges}
                                disabled={saving}
                            >
                                {saving ? 'Saving...' : 'Save changes'}
                            </button>

                            <button
                                className="app-modal-btn"
                                onClick={() => {
                                    setPhoneNumber(profile?.phone_number || '')
                                    setEditing(false)
                                }}
                                disabled={saving}
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
                        if (passwordSaving) return
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

                        {passwordError && <div className="employee-error-box">{passwordError}</div>}

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
