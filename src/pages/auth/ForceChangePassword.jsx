import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { dashboardPathForRole } from '../../lib/roleRedirect'
import AuthLayout from './AuthLayout'

function ForceChangePassword() {
    const navigate = useNavigate()

    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')

        if (newPassword.length < 6) {
            setError('Password must be at least 6 characters.')
            return
        }

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match.')
            return
        }

        try {
            setSaving(true)

            const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })

            if (updateError) {
                throw new Error(updateError.message)
            }

            const {
                data: { user },
            } = await supabase.auth.getUser()

            if (!user) {
                throw new Error('You are not logged in.')
            }

            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .update({ must_change_password: false })
                .eq('user_id', user.id)
                .select('role')
                .single()

            if (profileError) {
                throw new Error(profileError.message)
            }

            navigate(dashboardPathForRole(profile.role) || '/', { replace: true })

        } catch (err) {
            setError(err.message || 'Failed to update password.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <AuthLayout
            title="Set a new password"
            subtitle="For your account's security, you need to set your own password before continuing."
        >
            <form className="auth-form" onSubmit={handleSubmit}>

                <div className="form-group">
                    <label className="form-label" htmlFor="new-password">New Password</label>
                    <input
                        id="new-password"
                        type="password"
                        className="form-input"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        required
                        disabled={saving}
                    />
                </div>

                <div className="form-group">
                    <label className="form-label" htmlFor="confirm-password">Confirm New Password</label>
                    <input
                        id="confirm-password"
                        type="password"
                        className="form-input"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter your new password"
                        required
                        disabled={saving}
                    />
                </div>

                {error && <p className="form-message error">{error}</p>}

                <button type="submit" className="auth-submit" disabled={saving}>
                    {saving ? 'Saving...' : 'Set password & continue'}
                </button>

            </form>
        </AuthLayout>
    )
}

export default ForceChangePassword
