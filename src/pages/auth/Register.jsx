import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import AuthLayout from './AuthLayout'
import GoogleIcon from './GoogleIcon'
import PasswordRequirements from '../../components/PasswordRequirements'
import { passwordMeetsRequirements, passwordRequirementMessage } from '../../lib/passwordStrength'

function Register() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')

    const [firstName, setFirstName] = useState('')
    const [middleName, setMiddleName] = useState('')
    const [lastName, setLastName] = useState('')
    const [suffix, setSuffix] = useState('')
    const [phoneNumber, setPhoneNumber] = useState('')
    const [birthDate, setBirthDate] = useState('')
    const [birthPlace, setBirthPlace] = useState('')

    const [studentNumber, setStudentNumber] = useState('')
    const [collegeId, setCollegeId] = useState('')
    const [programId, setProgramId] = useState('')
    const [yearLevel, setYearLevel] = useState('')

    const [address, setAddress] = useState('')
    const [emergencyContactName, setEmergencyContactName] = useState('')
    const [emergencyContactNumber, setEmergencyContactNumber] = useState('')

    const [colleges, setColleges] = useState([])
    const [programs, setPrograms] = useState([])

    const [message, setMessage] = useState('')
    const [status, setStatus] = useState('idle')
    const [loading, setLoading] = useState(false)
    const [googleLoading, setGoogleLoading] = useState(false)
    const [agreedToTerms, setAgreedToTerms] = useState(false)
    const [showTermsModal, setShowTermsModal] = useState(false)
    const [modalChecked, setModalChecked] = useState(false)
    const [legalTab, setLegalTab] = useState('terms')

    const handlePhoneInput = (setter) => (e) => {
        setter(e.target.value.replace(/\D/g, '').slice(0, 11))
    }

    const handleStudentNumberInput = (e) => {
        setStudentNumber(e.target.value.replace(/\D/g, '').slice(0, 8))
    }

    useEffect(() => {
        loadColleges()
    }, [])

    useEffect(() => {
        setProgramId('')

        if (collegeId) {
            loadPrograms(collegeId)
        } else {
            setPrograms([])
        }
    }, [collegeId])

    const loadColleges = async () => {
        const { data, error } = await supabase
            .from('colleges')
            .select('college_id, college_name')
            .order('college_name')

        if (error) {
            console.error('LOAD COLLEGES ERROR:', error)
            return
        }

        setColleges(data || [])
    }

    const loadPrograms = async (selectedCollegeId) => {
        const { data, error } = await supabase
            .from('programs')
            .select('program_id, program_name')
            .eq('college_id', selectedCollegeId)
            .order('program_name')

        if (error) {
            console.error('LOAD PROGRAMS ERROR:', error)
            return
        }

        setPrograms(data || [])
    }

    const handleGoogleRegister = async () => {
        setGoogleLoading(true)
        setMessage('')

        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
                queryParams: {
                    hd: 'hcdc.edu.ph',
                    prompt: 'select_account',
                },
            },
        })

        if (error) {
            setStatus('error')
            setMessage(error.message)
            setGoogleLoading(false)
        }
    }

    const handleFormSubmit = (e) => {
        e.preventDefault()

        if (!passwordMeetsRequirements(password)) {
            setStatus('error')
            setMessage(passwordRequirementMessage())
            return
        }

        if (agreedToTerms) {
            submitRegistration()
        } else {
            setModalChecked(false)
            setShowTermsModal(true)
        }
    }

    const confirmAgreementAndRegister = () => {
        if (!modalChecked) return
        setAgreedToTerms(true)
        setShowTermsModal(false)
        submitRegistration()
    }

    const submitRegistration = async () => {
        setLoading(true)
        setMessage('')
        setStatus('idle')

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: `${window.location.origin}/login`,
                data: {
                    first_name: firstName.trim(),
                    middle_name: middleName.trim() || null,
                    last_name: lastName.trim(),
                    suffix: suffix.trim() || null,
                    phone_number: phoneNumber.trim() || null,
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
            setStatus('error')
            setMessage('Registration could not be completed. Please try again.')
            setLoading(false)
            return
        }

        const { error: studentError } = await supabase
            .from('students')
            .insert({
                user_id: data.user.id,
                student_number: studentNumber.trim(),
                college_id: collegeId,
                program_id: programId,
                year_level: yearLevel,
                enrollment_status: 'active',
                birth_date: birthDate || null,
                birth_place: birthPlace.trim() || null,
                address: address.trim() || null,
                emergency_contact_name: emergencyContactName.trim() || null,
                emergency_contact_number: emergencyContactNumber.trim() || null,
            })

        if (studentError) {
            console.error('STUDENT INSERT ERROR:', studentError)
            setStatus('error')
            setMessage(
                'Your account was created, but your student details could not be saved: ' +
                studentError.message
            )
            setLoading(false)
            return
        }

        setStatus('success')
        setMessage(
            'Registration successful! Check your email to confirm your account. ' +
            "Once confirmed, the Registrar's Office will need to verify your enrollment before you can use CertiChain — check back later to see if your account has been approved."
        )
        setLoading(false)
    }

    return (
        <AuthLayout
            title="Create your account"
            subtitle="Register to request and track your academic documents online."
            footer={
                <>Already have an account? <Link to="/login">Log in</Link></>
            }
        >
            <form className="auth-form" onSubmit={handleFormSubmit}>

                <p className="auth-form-section-title">Account</p>

                <div className="auth-form-row">
                    <div className="form-group">
                        <label className="form-label" htmlFor="register-email">Email</label>
                        <input
                            id="register-email"
                            type="email"
                            className="form-input"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="juan.delacruz@hcdc.edu.ph"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="register-password">Password</label>
                        <input
                            id="register-password"
                            type="password"
                            className="form-input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Create a password"
                            required
                        />
                        <PasswordRequirements password={password} />
                    </div>
                </div>

                <p className="auth-form-section-title">Personal Information</p>

                <div className="auth-form-row">
                    <div className="form-group">
                        <label className="form-label" htmlFor="first-name">First Name</label>
                        <input
                            id="first-name"
                            type="text"
                            className="form-input"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="last-name">Last Name</label>
                        <input
                            id="last-name"
                            type="text"
                            className="form-input"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            required
                        />
                    </div>
                </div>

                <div className="auth-form-row">
                    <div className="form-group">
                        <label className="form-label" htmlFor="middle-name">Middle Name</label>
                        <input
                            id="middle-name"
                            type="text"
                            className="form-input"
                            value={middleName}
                            onChange={(e) => setMiddleName(e.target.value)}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="suffix">Suffix</label>
                        <input
                            id="suffix"
                            type="text"
                            className="form-input"
                            value={suffix}
                            onChange={(e) => setSuffix(e.target.value)}
                            placeholder="Jr., III, etc. (optional)"
                        />
                    </div>
                </div>

                <div className="auth-form-row">
                    <div className="form-group">
                        <label className="form-label" htmlFor="phone-number">Phone Number</label>
                        <input
                            id="phone-number"
                            type="tel"
                            inputMode="numeric"
                            maxLength={11}
                            className="form-input"
                            value={phoneNumber}
                            onChange={handlePhoneInput(setPhoneNumber)}
                            placeholder="09XXXXXXXXX"
                            autoComplete="off"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="birth-date">Birth Date</label>
                        <input
                            id="birth-date"
                            type="date"
                            className="form-input"
                            value={birthDate}
                            onChange={(e) => setBirthDate(e.target.value)}
                        />
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label" htmlFor="birth-place">Birth Place</label>
                    <input
                        id="birth-place"
                        type="text"
                        className="form-input"
                        value={birthPlace}
                        onChange={(e) => setBirthPlace(e.target.value)}
                        autoComplete="off"
                    />
                </div>

                <p className="auth-form-section-title">Academic Information</p>

                <div className="auth-form-row">
                    <div className="form-group">
                        <label className="form-label" htmlFor="student-number">Student Number</label>
                        <input
                            id="student-number"
                            type="text"
                            inputMode="numeric"
                            className="form-input"
                            value={studentNumber}
                            onChange={handleStudentNumberInput}
                            placeholder="XXXXXXXX"
                            autoComplete="off"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="year-level">Year Level</label>
                        <select
                            id="year-level"
                            className="form-input"
                            value={yearLevel}
                            onChange={(e) => setYearLevel(e.target.value)}
                            required
                        >
                            <option value="">Select</option>
                            <option value="1">1st Year</option>
                            <option value="2">2nd Year</option>
                            <option value="3">3rd Year</option>
                            <option value="4">4th Year</option>
                            <option value="5">5th Year</option>
                        </select>
                    </div>
                </div>

                <div className="auth-form-row">
                    <div className="form-group">
                        <label className="form-label" htmlFor="college">College</label>
                        <select
                            id="college"
                            className="form-input"
                            value={collegeId}
                            onChange={(e) => setCollegeId(e.target.value)}
                            required
                        >
                            <option value="">Select college</option>
                            {colleges.map((c) => (
                                <option key={c.college_id} value={c.college_id}>
                                    {c.college_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="program">Program</label>
                        <select
                            id="program"
                            className="form-input"
                            value={programId}
                            onChange={(e) => setProgramId(e.target.value)}
                            disabled={!collegeId}
                            required
                        >
                            <option value="">
                                {collegeId ? 'Select program' : 'Select college first'}
                            </option>
                            {programs.map((p) => (
                                <option key={p.program_id} value={p.program_id}>
                                    {p.program_name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <p className="auth-form-section-title">Contact &amp; Emergency</p>

                <div className="form-group">
                    <label className="form-label" htmlFor="address">Address</label>
                    <input
                        id="address"
                        type="text"
                        className="form-input"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        autoComplete="off"
                    />
                </div>

                <div className="auth-form-row">
                    <div className="form-group">
                        <label className="form-label" htmlFor="emergency-name">Emergency Contact Name</label>
                        <input
                            id="emergency-name"
                            type="text"
                            className="form-input"
                            value={emergencyContactName}
                            onChange={(e) => setEmergencyContactName(e.target.value)}
                            autoComplete="off"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="emergency-number">Emergency Number</label>
                        <input
                            id="emergency-number"
                            type="tel"
                            inputMode="numeric"
                            maxLength={11}
                            className="form-input"
                            value={emergencyContactNumber}
                            onChange={handlePhoneInput(setEmergencyContactNumber)}
                            placeholder="09XXXXXXXXX"
                            autoComplete="off"
                        />
                    </div>
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
                    {loading ? 'Creating account...' : 'Create account'}
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
                                src={legalTab === 'terms' ? '/terms' : '/privacy-policy'}
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
                                    Agree &amp; Create Account
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="auth-divider">or</div>

            <button
                type="button"
                className="auth-google-button"
                onClick={handleGoogleRegister}
                disabled={googleLoading}
            >
                <GoogleIcon />
                {googleLoading ? 'Redirecting...' : 'Continue with Google'}
            </button>
        </AuthLayout>
    )
}

export default Register