import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import AuthLayout from './AuthLayout'
import PasswordRequirements from '../../components/PasswordRequirements'
import { passwordMeetsRequirements, passwordRequirementMessage } from '../../lib/passwordStrength'

function EmployeeRegister() {
    const [firstName, setFirstName] = useState('')
    const [lastName, setLastName] = useState('')
    const [employeeNumber, setEmployeeNumber] = useState('')
    const [positionTitle, setPositionTitle] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')

    const [message, setMessage] = useState('')
    const [status, setStatus] = useState('idle')
    const [loading, setLoading] = useState(false)
    const [agreedToTerms, setAgreedToTerms] = useState(false)
    const [showTermsModal, setShowTermsModal] = useState(false)
    const [modalChecked, setModalChecked] = useState(false)
    const [legalTab, setLegalTab] = useState('terms')

    const handleFormSubmit = (e) => {
        e.preventDefault()

        if (!passwordMeetsRequirements(password)) {
            setStatus('error')
            setMessage(passwordRequirementMessage())
            return
        }

        if (agreedToTerms) {
            handleRegister()
        } else {
            setModalChecked(false)
            setShowTermsModal(true)
        }
    }

    const confirmAgreementAndRegister = () => {
        if (!modalChecked) return
        setAgreedToTerms(true)
        setShowTermsModal(false)
        handleRegister()
    }

    const handleRegister = async () => {
        setLoading(true)
        setMessage('')

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: `${window.location.origin}/login`,
                data: {
                    role: 'employee',
                    first_name: firstName.trim(),
                    last_name: lastName.trim(),
                },
            },
        })

        if (error) {
            setStatus('error')
            setMessage(error.message)
            setLoading(false)
            return
        }

        if (!data.user) {
            setStatus('success')
            setMessage(
                'Registration submitted. Contact the Registrar Head to activate your employee profile.'
            )
            setLoading(false)
            return
        }

        const { error: employeeError } = await supabase
            .from('employees')
            .insert({
                user_id: data.user.id,
                employee_number: employeeNumber.trim(),
                position_title: positionTitle.trim(),
                status: 'inactive',
            })

        if (employeeError) {
            console.error('EMPLOYEE ROW ERROR:', employeeError)
            setStatus('success')
            setMessage(
                'Your account was created, but we could not automatically set up your employee profile. ' +
                'Please contact the Registrar Head with your registered email to finish setup.'
            )
            setLoading(false)
            return
        }

        setStatus('success')
        setMessage(
            'Registration successful! Your account is inactive until the Registrar Head activates it.'
        )
        setLoading(false)
    }

    return (
        <AuthLayout
            title="Employee Registration"
            subtitle="Register your Registrar employee account. A Registrar Head must activate your account before you can log in."
            footer={
                <>Not a registrar employee? <Link to="/register">Register as a student</Link></>
            }
        >
            <form className="auth-form" onSubmit={handleFormSubmit}>

                <div className="form-group">
                    <label className="form-label" htmlFor="emp-first-name">First Name</label>
                    <input
                        id="emp-first-name"
                        type="text"
                        className="form-input"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required
                    />
                </div>

                <div className="form-group">
                    <label className="form-label" htmlFor="emp-last-name">Last Name</label>
                    <input
                        id="emp-last-name"
                        type="text"
                        className="form-input"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        required
                    />
                </div>

                <div className="form-group">
                    <label className="form-label" htmlFor="emp-number">Employee Number</label>
                    <input
                        id="emp-number"
                        type="text"
                        className="form-input"
                        value={employeeNumber}
                        onChange={(e) => setEmployeeNumber(e.target.value)}
                        placeholder="e.g. EMP-0042"
                        required
                    />
                </div>

                <div className="form-group">
                    <label className="form-label" htmlFor="emp-position">Position Title</label>
                    <input
                        id="emp-position"
                        type="text"
                        className="form-input"
                        value={positionTitle}
                        onChange={(e) => setPositionTitle(e.target.value)}
                        placeholder="e.g. Registrar Staff"
                        required
                    />
                </div>

                <div className="form-group">
                    <label className="form-label" htmlFor="emp-email">Email</label>
                    <input
                        id="emp-email"
                        type="email"
                        className="form-input"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@hcdc.edu.ph"
                        required
                    />
                </div>

                <div className="form-group">
                    <label className="form-label" htmlFor="emp-password">Password</label>
                    <input
                        id="emp-password"
                        type="password"
                        className="form-input"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Create a password"
                        required
                    />
                    <PasswordRequirements password={password} />
                </div>

                {message && (
                    <p className={`form-message ${status === 'error' ? 'error' : 'success'}`}>
                        {message}
                    </p>
                )}

                <p style={{ fontSize: 12, color: 'var(--slate)', lineHeight: 1.5, marginBottom: 14 }}>
                    Before your account is created, you'll be asked to review and agree to CertiChain's{' '}
                    Terms of Service and Privacy Policy.
                </p>

                <button type="submit" className="auth-submit" disabled={loading}>
                    {loading && <span className="auth-spinner" />}
                    {loading ? 'Submitting...' : 'Register'}
                </button>

            </form>

            {showTermsModal && (
                <div
                    style={{
                        position: 'fixed', inset: 0, background: 'rgba(10, 20, 40, 0.55)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: 20, zIndex: 1000,
                    }}
                    onClick={() => setShowTermsModal(false)}
                >
                    <div
                        style={{
                            background: 'var(--white)', borderRadius: 10, width: '100%', maxWidth: 640,
                            maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
                            boxShadow: '0 20px 60px rgba(10, 20, 40, 0.35)',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--line)' }}>
                            <h2 style={{ fontSize: 18, marginBottom: 4 }}>Terms of Service &amp; Privacy Policy</h2>
                            <p style={{ fontSize: 13 }}>Please review both before creating your account.</p>
                        </div>

                        <div style={{ display: 'flex', gap: 4, padding: '10px 22px 0' }}>
                            <button
                                type="button"
                                onClick={() => setLegalTab('terms')}
                                className={legalTab === 'terms' ? 'auth-submit' : 'auth-google-button'}
                                style={{ width: 'auto', padding: '8px 16px', fontSize: 13 }}
                            >
                                Terms of Service
                            </button>
                            <button
                                type="button"
                                onClick={() => setLegalTab('privacy')}
                                className={legalTab === 'privacy' ? 'auth-submit' : 'auth-google-button'}
                                style={{ width: 'auto', padding: '8px 16px', fontSize: 13 }}
                            >
                                Privacy Policy
                            </button>
                        </div>

                        <div style={{ flex: 1, minHeight: 0, padding: '14px 22px' }}>
                            <iframe
                                title={legalTab === 'terms' ? 'Terms of Service' : 'Privacy Policy'}
                                src={legalTab === 'terms' ? '/terms?embed=1' : '/privacy-policy?embed=1'}
                                style={{ width: '100%', height: '100%', minHeight: 320, border: '1px solid var(--line)', borderRadius: 6 }}
                            />
                        </div>

                        <div style={{ padding: '16px 22px', borderTop: '1px solid var(--line)' }}>
                            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, lineHeight: 1.5, marginBottom: 14, cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={modalChecked}
                                    onChange={(e) => setModalChecked(e.target.checked)}
                                    style={{ marginTop: 2, flexShrink: 0 }}
                                />
                                <span>I have read and agree to CertiChain's Terms of Service and Privacy Policy.</span>
                            </label>

                            <div style={{ display: 'flex', gap: 10 }}>
                                <button
                                    type="button"
                                    className="auth-google-button"
                                    onClick={() => setShowTermsModal(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="auth-submit"
                                    disabled={!modalChecked}
                                    onClick={confirmAgreementAndRegister}
                                >
                                    Agree &amp; Register
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </AuthLayout>
    )
}

export default EmployeeRegister
