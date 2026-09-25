import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { dashboardPathForRole } from '../../lib/roleRedirect'
import AuthLayout from './AuthLayout'

function ForceChangePassword() {
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)
    const [done, setDone] = useState(false)

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

            // Full page load straight into the dashboard (not a client-side
            // navigate), so every route guard re-reads the profile and sees
            // must_change_password = false instead of any state from before.
            setDone(true)
            window.location.replace(dashboardPathForRole(profile.role) || '/')

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
                        disabled={saving || done}
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
                        disabled={saving || done}
                    />
                </div>

                {error && <p className="form-message error">{error}</p>}
                {done && <p className="form-message success">Password updated — taking you to your dashboard…</p>}

                <button type="submit" className="auth-submit" disabled={saving || done}>
                    {done ? 'Opening dashboard...' : saving ? 'Saving...' : 'Set password & continue'}
                </button>

            </form>
        </AuthLayout>
    )
}

export default ForceChangePassword
