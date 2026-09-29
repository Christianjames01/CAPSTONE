import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useScrollLock } from '../../lib/useScrollLock'
import { useDraftState, clearDraft } from '../../lib/useDraftState'
import AuthLayout from './AuthLayout'
import GoogleIcon from './GoogleIcon'
import PasswordRequirements from '../../components/PasswordRequirements'
import PasswordToggleButton from './PasswordToggleButton'
import { passwordMeetsRequirements, passwordRequirementMessage } from '../../lib/passwordStrength'
import { SUFFIX_NONE, SUFFIX_OPTIONS, validateRegistrationDetails } from '../../lib/registrationValidation'
import { isStudentNumberTaken, studentNumberTakenMessage, isDuplicateStudentNumberError, isPhoneNumberTaken, phoneNumberTakenMessage } from '../../lib/studentNumberCheck'
import { captchaEnabled, getCaptchaToken, preloadCaptcha } from '../../lib/captcha'

// Get the security check ready while the form is being filled in.
preloadCaptcha()

// Graduation years offered to alumni, newest first.
const GRADUATION_YEARS = Array.from({ length: new Date().getFullYear() - 1959 }, (_, i) => new Date().getFullYear() - i)

const LEGAL_TABS = {
    terms: { title: 'Terms of Service', src: '/terms?embed=1' },
    privacy: { title: 'Privacy Policy', src: '/privacy-policy?embed=1' },
    cookie: { title: 'Cookie Policy', src: '/cookie-policy?embed=1' },
    refund: { title: 'Refund Policy', src: '/refund-policy?embed=1' },
}

function Register() {
    const navigate = useNavigate()

    const [email, setEmail] = useDraftState('register', 'email', '')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)

    const [firstName, setFirstName] = useDraftState('register', 'firstName', '')
    const [middleName, setMiddleName] = useDraftState('register', 'middleName', '')
    const [noMiddleName, setNoMiddleName] = useDraftState('register', 'noMiddleName', false)
    const [lastName, setLastName] = useDraftState('register', 'lastName', '')
    const [suffix, setSuffix] = useDraftState('register', 'suffix', '')
    const [phoneNumber, setPhoneNumber] = useDraftState('register', 'phoneNumber', '')
    // Set when the typed phone number is already registered to another account.
    const [phoneTaken, setPhoneTaken] = useState(false)
    const [birthDate, setBirthDate] = useDraftState('register', 'birthDate', '')

    const [studentNumber, setStudentNumber] = useDraftState('register', 'studentNumber', '')
    // Set when the typed student ID is already registered (checked on blur and on submit).
    const [studentNumberTaken, setStudentNumberTaken] = useState(false)
    const [collegeId, setCollegeId] = useDraftState('register', 'collegeId', '')
    const [programId, setProgramId] = useDraftState('register', 'programId', '')
    const [yearLevel, setYearLevel] = useDraftState('register', 'yearLevel', '')
    // 'current' student or 'alumni' (graduate: graduation year instead of year level)
    const [studentType, setStudentType] = useDraftState('register', 'studentType', 'current')
    const [graduationYear, setGraduationYear] = useDraftState('register', 'graduationYear', '')

    const [address, setAddress] = useDraftState('register', 'address', '')
    const [alternatePhoneNumber, setAlternatePhoneNumber] = useDraftState('register', 'alternatePhoneNumber', '')
    const [alternateEmail, setAlternateEmail] = useDraftState('register', 'alternateEmail', '')
    const [emergencyContactName, setEmergencyContactName] = useDraftState('register', 'emergencyContactName', '')
    const [emergencyContactNumber, setEmergencyContactNumber] = useDraftState('register', 'emergencyContactNumber', '')

    const [colleges, setColleges] = useState([])
    const [programs, setPrograms] = useState([])

    const [message, setMessage] = useState('')
    const [status, setStatus] = useState('idle')
    const [loading, setLoading] = useState(false)
    const [googleLoading, setGoogleLoading] = useState(false)
    const [agreedToTerms, setAgreedToTerms] = useState(false)
    const [showTermsModal, setShowTermsModal] = useState(false)
    useScrollLock(showTermsModal)
    const [modalChecked, setModalChecked] = useState(false)
    const [legalTab, setLegalTab] = useState('terms')

    const handlePhoneInput = (setter) => (e) => {
        setter(e.target.value.replace(/\D/g, '').slice(0, 11))
    }

    const handleStudentNumberInput = (e) => {
        setStudentNumber(e.target.value.replace(/\D/g, '').slice(0, 8))
        setStudentNumberTaken(false)
    }

    const checkPhoneNumber = async () => {
        if (!phoneNumber.trim()) return
        const taken = await isPhoneNumberTaken(phoneNumber)
        setPhoneTaken(taken === true)
    }

    const checkStudentNumber = async () => {
        if (!studentNumber.trim()) return
        const taken = await isStudentNumberTaken(studentNumber)
        setStudentNumberTaken(taken === true)
    }

    useEffect(() => {
        loadColleges()
    }, [])

    const previousCollegeId = useRef(collegeId)

    useEffect(() => {
        if (previousCollegeId.current !== collegeId) {
            setProgramId('')
            previousCollegeId.current = collegeId
        }

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

        // Same security check as email sign-in before handing off to Google
        // (Google also runs its own bot checks).
        const captchaToken = await getCaptchaToken()
        if (captchaEnabled && !captchaToken) {
            setStatus('error')
            setMessage('Please complete the security check to continue with Google.')
            setGoogleLoading(false)
            return
        }

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

    const handleFormSubmit = async (e) => {
        e.preventDefault()

        if (!passwordMeetsRequirements(password)) {
            setStatus('error')
            setMessage(passwordRequirementMessage())
            return
        }

        const isAlumni = studentType === 'alumni'

        // HCDC accounts are deactivated after graduation, so alumni must
        // sign up with a personal email they can still open.
        if (isAlumni && email.trim().toLowerCase().endsWith('@hcdc.edu.ph')) {
            setStatus('error')
            setMessage('Alumni must use a personal email (e.g. Gmail). HCDC email accounts are deactivated after graduation, so you would not receive our emails there.')
            return
        }

        const problem = validateRegistrationDetails({
            phoneNumber,
            alternatePhoneNumber,
            alternateEmail: isAlumni ? email : alternateEmail,
            emergencyContactNumber,
        })
        if (problem) {
            setStatus('error')
            setMessage(problem)
            return
        }

        // Before anything is created: is this student ID already registered?
        if (await isPhoneNumberTaken(phoneNumber)) {
            setPhoneTaken(true)
            setStatus('error')
            setMessage(phoneNumberTakenMessage(phoneNumber))
            return
        }

        if (await isStudentNumberTaken(studentNumber)) {
            setStudentNumberTaken(true)
            setStatus('error')
            setMessage(studentNumberTakenMessage(studentNumber))
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
        // The security check (slide puzzle + Cloudflare) pops up now.
        const captchaToken = await getCaptchaToken()
        if (captchaEnabled && !captchaToken) {
            setStatus('error')
            setMessage('Please complete the security check to create your account.')
            return
        }

        setLoading(true)
        setMessage('')
        setStatus('idle')

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                captchaToken: captchaToken || undefined,
                emailRedirectTo: `${window.location.origin}/login`,
                data: {
                    first_name: firstName.trim(),
                    middle_name: noMiddleName ? null : middleName.trim() || null,
                    last_name: lastName.trim(),
                    suffix: suffix === SUFFIX_NONE ? null : suffix,
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
                year_level: studentType === 'alumni' ? null : yearLevel,
                ...(studentType === 'alumni' ? { student_type: 'alumni', graduation_year: Number(graduationYear) } : {}),
                enrollment_status: 'active',
                birth_date: birthDate || null,
                address: address.trim() || null,
                alternate_phone_number: alternatePhoneNumber.trim() || null,
                alternate_email: (studentType === 'alumni' ? email : alternateEmail).trim() || null,
                emergency_contact_name: emergencyContactName.trim() || null,
                emergency_contact_number: emergencyContactNumber.trim() || null,
            })

        if (studentError) {
            console.error('STUDENT INSERT ERROR:', studentError)
            setStatus('error')
            setMessage(
                isDuplicateStudentNumberError(studentError)
                    ? studentNumberTakenMessage(studentNumber)
                    : 'Your account was created, but your student details could not be saved: ' + studentError.message
            )
            setLoading(false)
            return
        }

        if (data.session) {
            clearDraft('register')
            navigate('/student/dashboard', { replace: true })
            return
        }

        clearDraft('register')
        setStatus('success')
        setMessage(
            'Registration successful! The Registrar\'s Office will need to verify your enrollment before you can use CertiChain — check back later to see if your account has been approved.'
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
                        <label className="form-label" htmlFor="register-email">
                            {studentType === 'alumni' ? 'Personal email (e.g. Gmail)' : 'Email'}
                        </label>
                        <input
                            id="register-email"
                            type="email"
                            className="form-input"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder={studentType === 'alumni' ? 'juan.delacruz@gmail.com' : 'juan.delacruz@hcdc.edu.ph'}
                            required
                        />
                        <small style={{ display: 'block', marginTop: 6, fontSize: 12, color: 'var(--slate)' }}>
                            {studentType === 'alumni'
                                ? 'Use an email you can still open. HCDC email accounts are deactivated after graduation.'
                                : 'Graduates: choose “Alumni” below and use a personal email instead.'}
                        </small>
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="register-password">Password</label>
                        <div className="password-field">
                            <input
                                id="register-password"
                                type={showPassword ? 'text' : 'password'}
                                className="form-input"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Create a password"
                                required
                            />
                            <PasswordToggleButton show={showPassword} onToggle={() => setShowPassword((v) => !v)} />
                        </div>
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
                            value={noMiddleName ? '' : middleName}
                            onChange={(e) => setMiddleName(e.target.value)}
                            placeholder={noMiddleName ? 'No middle name' : ''}
                            disabled={noMiddleName}
                            required={!noMiddleName}
                        />
                        <label className="auth-inline-check">
                            <input
                                type="checkbox"
                                checked={noMiddleName}
                                onChange={(e) => setNoMiddleName(e.target.checked)}
                            />
                            I don't have a middle name
                        </label>
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="suffix">Suffix</label>
                        <select
                            id="suffix"
                            className="form-input"
                            value={suffix}
                            onChange={(e) => setSuffix(e.target.value)}
                            required
                        >
                            <option value="">Select</option>
                            <option value={SUFFIX_NONE}>None</option>
                            {SUFFIX_OPTIONS.map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
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
                            onChange={(e) => { handlePhoneInput(setPhoneNumber)(e); setPhoneTaken(false) }}
                            onBlur={checkPhoneNumber}
                            placeholder="09XXXXXXXXX"
                            autoComplete="off"
                            aria-invalid={phoneTaken || undefined}
                            required
                        />
                        {phoneTaken && (
                            <p className="form-message error" style={{ marginTop: 6 }}>
                                {phoneNumberTakenMessage(phoneNumber)}
                            </p>
                        )}
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="birth-date">Birth Date</label>
                        <input
                            id="birth-date"
                            type="date"
                            className="form-input"
                            value={birthDate}
                            min="1900-01-01"
                            max={new Date().toISOString().slice(0, 10)}
                            onChange={(e) => {
                                const yearPart = e.target.value.split('-')[0]
                                if (yearPart && yearPart.length > 4) return
                                setBirthDate(e.target.value)
                            }}
                            required
                        />
                    </div>
                </div>

                <p className="auth-form-section-title">Academic Information</p>

                <div className="auth-type-toggle" role="radiogroup" aria-label="I am a">
                    <button
                        type="button"
                        role="radio"
                        aria-checked={studentType === 'current'}
                        className={studentType === 'current' ? 'is-active' : ''}
                        onClick={() => setStudentType('current')}
                    >
                        <strong>Current student</strong>
                        <span>Currently enrolled at HCDC</span>
                    </button>
                    <button
                        type="button"
                        role="radio"
                        aria-checked={studentType === 'alumni'}
                        className={studentType === 'alumni' ? 'is-active' : ''}
                        onClick={() => setStudentType('alumni')}
                    >
                        <strong>Alumni (graduate)</strong>
                        <span>Graduated and no longer enrolled</span>
                    </button>
                </div>
                {studentType === 'alumni' && (
                    <p className="auth-type-note">
                        Use the student ID number you had at HCDC. The Registrar verifies alumni accounts against school records before you can request documents.
                    </p>
                )}

                <div className="auth-form-row">
                    <div className="form-group">
                        <label className="form-label" htmlFor="student-number">Student ID Number</label>
                        <input
                            id="student-number"
                            type="text"
                            inputMode="numeric"
                            className="form-input"
                            value={studentNumber}
                            onChange={handleStudentNumberInput}
                            onBlur={checkStudentNumber}
                            placeholder="XXXXXXXX"
                            autoComplete="off"
                            aria-invalid={studentNumberTaken || undefined}
                            required
                        />
                        {studentNumberTaken && (
                            <p className="form-message error" style={{ marginTop: 6 }}>
                                {studentNumberTakenMessage(studentNumber)}
                            </p>
                        )}
                    </div>

                    {studentType === 'alumni' ? (
                        <div className="form-group">
                            <label className="form-label" htmlFor="graduation-year">Year Graduated</label>
                            <select
                                id="graduation-year"
                                className="form-input"
                                value={graduationYear}
                                onChange={(e) => setGraduationYear(e.target.value)}
                                required
                            >
                                <option value="">Select</option>
                                {GRADUATION_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                    ) : (
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
                    )}
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
                        required
                    />
                </div>

                <div className="form-group">
                    <label className="form-label" htmlFor="alternate-phone">Alternate Phone Number</label>
                    <input
                        id="alternate-phone"
                        type="tel"
                        inputMode="numeric"
                        maxLength={11}
                        className="form-input"
                        value={alternatePhoneNumber}
                        onChange={handlePhoneInput(setAlternatePhoneNumber)}
                        placeholder="09XXXXXXXXX"
                        autoComplete="off"
                        required
                    />
                    <small style={{ display: 'block', marginTop: 6, fontSize: 12, color: 'var(--slate)' }}>
                        A second number the registrar can try if your main phone number is unreachable.
                    </small>
                </div>

                {studentType !== 'alumni' && (
                <div className="form-group">
                    <label className="form-label" htmlFor="alternate-email">Personal Email</label>
                    <input
                        id="alternate-email"
                        type="email"
                        className="form-input"
                        value={alternateEmail}
                        onChange={(e) => setAlternateEmail(e.target.value)}
                        placeholder="you@gmail.com"
                        autoComplete="off"
                        required
                    />
                    <small style={{ display: 'block', marginTop: 6, fontSize: 12, color: 'var(--slate)' }}>
                        A personal, non-HCDC email you still control after graduation. Your HCDC account is deactivated once you graduate, so switch your login to this address beforehand from Profile &gt; Login Email.
                    </small>
                </div>
                )}

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
                            required
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
                            required
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
                    className="terms-overlay"
                    onClick={() => setShowTermsModal(false)}
                >
                    <div
                        className="terms-dialog"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="terms-head">
                            <h2 style={{ fontSize: 18, marginBottom: 4 }}>Terms, Privacy, Cookie &amp; Refund Policy</h2>
                            <p style={{ fontSize: 13 }}>Please review all four before creating your account.</p>
                        </div>

                        <div className="terms-tabs">
                            <button
                                type="button"
                                onClick={() => setLegalTab('terms')}
                                className={legalTab === 'terms' ? 'auth-submit' : 'auth-google-button'}
                                style={{ width: 'auto', padding: '8px 14px', fontSize: 13, whiteSpace: 'nowrap', flexShrink: 0 }}
                            >
                                Terms of Service
                            </button>
                            <button
                                type="button"
                                onClick={() => setLegalTab('privacy')}
                                className={legalTab === 'privacy' ? 'auth-submit' : 'auth-google-button'}
                                style={{ width: 'auto', padding: '8px 14px', fontSize: 13, whiteSpace: 'nowrap', flexShrink: 0 }}
                            >
                                Privacy Policy
                            </button>
                            <button
                                type="button"
                                onClick={() => setLegalTab('cookie')}
                                className={legalTab === 'cookie' ? 'auth-submit' : 'auth-google-button'}
                                style={{ width: 'auto', padding: '8px 14px', fontSize: 13, whiteSpace: 'nowrap', flexShrink: 0 }}
                            >
                                Cookie Policy
                            </button>
                            <button
                                type="button"
                                onClick={() => setLegalTab('refund')}
                                className={legalTab === 'refund' ? 'auth-submit' : 'auth-google-button'}
                                style={{ width: 'auto', padding: '8px 14px', fontSize: 13, whiteSpace: 'nowrap', flexShrink: 0 }}
                            >
                                Refund Policy
                            </button>
                        </div>

                        <div className="terms-body">
                            <iframe
                                title={LEGAL_TABS[legalTab].title}
                                src={LEGAL_TABS[legalTab].src}
                                className="terms-frame"
                            />
                        </div>

                        <div className="terms-foot">
                            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, lineHeight: 1.5, marginBottom: 14, cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={modalChecked}
                                    onChange={(e) => setModalChecked(e.target.checked)}
                                    style={{ marginTop: 2, flexShrink: 0 }}
                                />
                                <span>I have read and agree to CertiChain's Terms of Service, Privacy Policy, Cookie Policy, and Refund Policy.</span>
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
                {googleLoading ? 'Redirecting...' : 'Continue with your HCDC Google account'}
            </button>
        </AuthLayout>
    )
}

export default Register