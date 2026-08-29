import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { IconClock, IconAlertCircle, IconMail, IconPhone } from '../pages/student/icons'
import hcdcLogo from '../assets/hcdc-logo.png'
import './StudentVerificationGate.css'

const REGISTRAR_EMAIL = 'registrar@hcdc.edu.ph'
const REGISTRAR_PHONE = '0912345677'

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
        } else {
            // No student record at all -- they signed up but never
            // finished "Complete your profile". Send them to finish it
            // instead of defaulting to "approved" and letting them
            // through to a dashboard with no student data behind it.
            navigate('/complete-profile', { replace: true })
            return
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
            <div className="verify-gate-page">
                <div className="verify-gate-card">
                    <div className="verify-gate-seal">
                        <img src={hcdcLogo} alt="Holy Cross of Davao College" />
                    </div>

                    <div className={`verify-gate-icon ${rejected ? 'rejected' : 'pending'}`}>
                        {rejected ? <IconAlertCircle /> : <IconClock />}
                    </div>

                    <h1>{rejected ? 'Registration not verified' : 'Waiting for verification'}</h1>

                    <p>
                        {rejected
                            ? "The Registrar's Office could not verify your enrollment with the details you provided."
                            : "Your registration is being reviewed by the Registrar's Office to confirm you're currently enrolled. Please check back later — this usually doesn't take long."}
                    </p>

                    {rejected && note && (
                        <div className="verify-gate-reason">
                            <span>Reason</span>
                            <strong>{note}</strong>
                        </div>
                    )}

                    <div className="verify-gate-contact">
                        <div className="verify-gate-contact-label">Need help? Contact the Registrar's Office</div>
                        <div className="verify-gate-contact-links">
                            <a className="verify-gate-contact-link" href={`mailto:${REGISTRAR_EMAIL}`}>
                                <IconMail /> {REGISTRAR_EMAIL}
                            </a>
                            <a className="verify-gate-contact-link" href={`tel:${REGISTRAR_PHONE}`}>
                                <IconPhone /> {REGISTRAR_PHONE}
                            </a>
                        </div>
                    </div>

                    <button className="verify-gate-logout" onClick={handleLogout}>
                        Log out
                    </button>
                </div>
            </div>
        )
    }

    return children
}

export default StudentVerificationGate
