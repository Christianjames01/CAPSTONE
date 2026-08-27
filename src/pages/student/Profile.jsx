import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
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

    const [phoneNumber, setPhoneNumber] = useState('')
    const [address, setAddress] = useState('')
    const [emergencyContactName, setEmergencyContactName] = useState('')
    const [emergencyContactNumber, setEmergencyContactNumber] = useState('')

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
        return <p className="student-loading">Loading your profile...</p>
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

            {/* IDENTITY */}
            <div className="student-card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
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
                        flexShrink: 0,
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

                <div>
                    <h2 style={{ fontSize: 18, marginBottom: 4 }}>{fullName}</h2>
                    <p>{student?.student_number}</p>
                </div>
            </div>

            {/* ACADEMIC INFORMATION (read-only) */}
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

            {/* PERSONAL INFORMATION (read-only) */}
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

            {/* CONTACT INFORMATION (editable) */}
            <div className="student-card">
                <div className="student-page-header-row">
                    <h2 style={{ fontSize: 16 }}>Contact Information</h2>

                    {!editing && (
                        <button className="student-link-button" onClick={startEditing}>
                            Edit
                        </button>
                    )}
                </div>

                {editing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>

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
                ) : (
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
                )}
            </div>
        </div>
    )
}

export default Profile
