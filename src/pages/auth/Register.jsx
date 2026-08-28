import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import AuthLayout from './AuthLayout'
import GoogleIcon from './GoogleIcon'

function Register() {
    // Account
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')

    // Personal
    const [firstName, setFirstName] = useState('')
    const [middleName, setMiddleName] = useState('')
    const [lastName, setLastName] = useState('')
    const [suffix, setSuffix] = useState('')
    const [phoneNumber, setPhoneNumber] = useState('')
    const [birthDate, setBirthDate] = useState('')
    const [birthPlace, setBirthPlace] = useState('')

    // Academic
    const [studentNumber, setStudentNumber] = useState('')
    const [collegeId, setCollegeId] = useState('')
    const [programId, setProgramId] = useState('')
    const [yearLevel, setYearLevel] = useState('')

    // Contact
    const [address, setAddress] = useState('')
    const [emergencyContactName, setEmergencyContactName] = useState('')
    const [emergencyContactNumber, setEmergencyContactNumber] = useState('')

    const [colleges, setColleges] = useState([])
    const [programs, setPrograms] = useState([])

    const [message, setMessage] = useState('')
    const [status, setStatus] = useState('idle')
    const [loading, setLoading] = useState(false)
    const [googleLoading, setGoogleLoading] = useState(false)

    // Strips non-digits and caps PH mobile numbers at 11 digits (09XXXXXXXXX)
    const handlePhoneInput = (setter) => (e) => {
        setter(e.target.value.replace(/\D/g, '').slice(0, 11))
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
        // On success, the browser is redirected to Google, so there's
        // nothing further to do here.
    }

    const handleRegister = async (e) => {
        e.preventDefault()

        setLoading(true)
        setMessage('')
        setStatus('idle')

        // 1. Create the auth user. Name/suffix/phone are passed as signup
        // metadata so the existing "profiles" trigger can populate them.
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

        // 2. "students" has no auto-create trigger, so insert it directly.
        // NOTE: if this project requires email confirmation, there is no
        // active session yet and this insert may be blocked by RLS.
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
        setMessage('Registration successful! Check your email to confirm your account.')
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
            <form className="auth-form" onSubmit={handleRegister}>

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
                    />
                </div>

                <p className="auth-form-section-title">Academic Information</p>

                <div className="auth-form-row">
                    <div className="form-group">
                        <label className="form-label" htmlFor="student-number">Student Number</label>
                        <input
                            id="student-number"
                            type="text"
                            className="form-input"
                            value={studentNumber}
                            onChange={(e) => setStudentNumber(e.target.value)}
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
                        />
                    </div>
                </div>

                {message && (
                    <p className={`form-message ${status === 'error' ? 'error' : 'success'}`}>
                        {message}
                    </p>
                )}

                <button type="submit" className="auth-submit" disabled={loading}>
                    {loading ? 'Creating account...' : 'Create account'}
                </button>

            </form>

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