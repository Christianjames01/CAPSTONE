import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// Sits between ProtectedRoute and StudentLayout. A newly-registered
// student's verification_status starts "pending" until registrar staff
// manually confirm their enrollment -- this blocks the dashboard (and so
// every student page, including submitting requests) until that happens.
function StudentVerificationGate({ children }) {
    const navigate = useNavigate()

    const [loading, setLoading] = useState(true)
    const [status, setStatus] = useState('approved')
    const [note, setNote] = useState('')

    useEffect(() => {
        checkVerification()
    }, [])

    const checkVerification = async () => {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            setLoading(false)
            return
        }

        const { data } = await supabase
            .from('students')
            .select('verification_status, verification_note')
            .eq('user_id', user.id)
            .maybeSingle()

        if (data) {
            setStatus(data.verification_status)
            setNote(data.verification_note || '')
        }

        setLoading(false)
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        navigate('/login')
    }

    if (loading) {
        return <div>Loading...</div>
    }

    if (status === 'pending' || status === 'rejected') {
        const rejected = status === 'rejected'

        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                padding: 24,
                gap: 12,
            }}>
                <h1 style={{ fontSize: 20, margin: 0 }}>
                    {rejected ? 'Registration not verified' : 'Waiting for verification'}
                </h1>
                <p style={{ color: 'var(--slate, #57616F)', maxWidth: 440, margin: 0 }}>
                    {rejected
                        ? "The Registrar's Office could not verify your enrollment with the details you provided."
                        : "Your registration is being reviewed by the Registrar's Office to confirm you're currently enrolled. You'll get an email once it's verified — this usually doesn't take long."}
                </p>
                {rejected && note && (
                    <p style={{ color: 'var(--ink, #101827)', maxWidth: 440, margin: 0, fontWeight: 600 }}>
                        Reason: {note}
                    </p>
                )}
                <p style={{ color: 'var(--slate, #57616F)', maxWidth: 440, margin: 0, fontSize: 13 }}>
                    Questions? Contact the HCDC Registrar's Office.
                </p>
                <button
                    onClick={handleLogout}
                    style={{ marginTop: 8, color: 'var(--blue, #123B78)', fontWeight: 600 }}
                >
                    Log out
                </button>
            </div>
        )
    }

    return children
}

export default StudentVerificationGate
