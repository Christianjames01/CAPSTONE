import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import '../auth/Auth.css'
import './AdminPages.css'

function Profile() {
    const [profile, setProfile] = useState(null)
    const [employee, setEmployee] = useState(null)

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')

    const [editing, setEditing] = useState(false)
    const [saving, setSaving] = useState(false)
    const [phoneNumber, setPhoneNumber] = useState('')

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
                .select('first_name, middle_name, last_name, suffix, email, phone_number, role, profile_photo_url')
                .eq('user_id', user.id)
                .single()

            if (profileError || !profileData) {
                throw new Error('Profile could not be found.')
            }

            setProfile(profileData)
            setPhoneNumber(profileData.phone_number || '')

            // Registrar Head may or may not also have an employees row —
            // this is best-effort and not treated as an error if missing.
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

    const fullName = profile
        ? [profile.first_name, profile.middle_name, profile.last_name, profile.suffix].filter(Boolean).join(' ')
        : ''

    const initials = profile
        ? `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}`.toUpperCase()
        : ''

    if (loading) {
        return <p className="admin-loading">Loading your profile...</p>
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
                        width: 56, height: 56, borderRadius: '50%', background: 'var(--blue)', color: 'var(--white)',
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
                    {!editing && <button className="admin-link-button" onClick={() => setEditing(true)}>Edit</button>}
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

                        <div style={{ display: 'flex', gap: 10 }}>
                            <button className="auth-submit" style={{ width: 'auto', padding: '11px 20px' }} onClick={saveChanges} disabled={saving}>
                                {saving ? 'Saving...' : 'Save changes'}
                            </button>
                            <button
                                className="admin-link-button"
                                style={{ color: 'var(--slate)' }}
                                onClick={() => { setPhoneNumber(profile?.phone_number || ''); setEditing(false) }}
                                disabled={saving}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="admin-info-grid" style={{ marginTop: 16 }}>
                        <div className="admin-info-field"><span>Email</span><strong>{profile?.email || 'N/A'}</strong></div>
                        <div className="admin-info-field"><span>Phone Number</span><strong>{profile?.phone_number || 'Not set'}</strong></div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default Profile
