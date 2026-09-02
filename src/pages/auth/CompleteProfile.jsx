import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { establishStudentSession, notifyPreviousDeviceSignedOut } from '../../lib/singleSession'
import AuthLayout from './AuthLayout'

function CompleteProfile() {
    const navigate = useNavigate()

    const [checkingUser, setCheckingUser] = useState(true)

    const [firstName, setFirstName] = useState('')
    const [lastName, setLastName] = useState('')
    const [phoneNumber, setPhoneNumber] = useState('')

    const [studentNumber, setStudentNumber] = useState('')
    const [collegeId, setCollegeId] = useState('')
    const [programId, setProgramId] = useState('')
    const [yearLevel, setYearLevel] = useState('')

    const [birthDate, setBirthDate] = useState('')
    const [birthPlace, setBirthPlace] = useState('')
    const [address, setAddress] = useState('')
    const [emergencyContactName, setEmergencyContactName] = useState('')
    const [emergencyContactNumber, setEmergencyContactNumber] = useState('')

    const [colleges, setColleges] = useState([])
    const [programs, setPrograms] = useState([])

    const [message, setMessage] = useState('')
    const [status, setStatus] = useState('idle')
    const [loading, setLoading] = useState(false)

    const handlePhoneInput = (setter) => (e) => {
        setter(e.target.value.replace(/\D/g, '').slice(0, 11))
    }

    const handleStudentNumberInput = (e) => {
        setStudentNumber(e.target.value.replace(/\D/g, '').slice(0, 8))
    }

    useEffect(() => {
        loadUserAndColleges()
    }, [])

    useEffect(() => {
        setProgramId('')

        if (collegeId) {
            loadPrograms(collegeId)
        } else {
            setPrograms([])
        }
    }, [collegeId])

    const loadUserAndColleges = async () => {
        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            navigate('/login')
            return
        }

        const { data: existingStudent } = await supabase
            .from('students')
            .select('student_id')
            .eq('user_id', user.id)
            .maybeSingle()

        if (existingStudent) {
            const { hadExistingSession } = await establishStudentSession(user.id)
            if (hadExistingSession) {
                await notifyPreviousDeviceSignedOut()
            }
            navigate('/student/dashboard')
            return
        }

        const meta = user.user_metadata || {}
        setFirstName(meta.given_name || (meta.full_name || meta.name || '').split(' ')[0] || '')
        setLastName(meta.family_name || (meta.full_name || meta.name || '').split(' ').slice(1).join(' ') || '')

        const { data, error } = await supabase
            .from('colleges')
            .select('college_id, college_name')
            .order('college_name')

        if (error) {
            console.error('LOAD COLLEGES ERROR:', error)
        }

        setColleges(data || [])
        setCheckingUser(false)
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

    const handleSubmit = async (e) => {
        e.preventDefault()

        setLoading(true)
        setMessage('')
        setStatus('idle')

        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            navigate('/login')
            return
        }

        const { error: profileError } = await supabase
            .from('profiles')
            .update({
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                phone_number: phoneNumber.trim(),
            })
            .eq('user_id', user.id)

        if (profileError) {
            setStatus('error')
            setMessage('Failed to save your details: ' + profileError.message)
            setLoading(false)
            return
        }

        const { error: studentError } = await supabase
            .from('students')
            .insert({
                user_id: user.id,
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
            setStatus('error')
            setMessage('Failed to save your student details: ' + studentError.message)
            setLoading(false)
            return
        }

        await establishStudentSession(user.id)
        navigate('/student/dashboard')
    }

    if (checkingUser) {
        return (
            <AuthLayout title="One moment" subtitle="Loading your account...">
                <p style={{ fontSize: 13.5, color: 'var(--slate)' }}>Please wait.</p>
            </AuthLayout>
        )
    }

    return (
        <AuthLayout
            title="Complete your profile"
            subtitle="A few more details before you can request documents."
        >
            <form className="auth-form" onSubmit={handleSubmit}>

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

                <button type="submit" className="auth-submit" disabled={loading}>
                    {loading && <span className="auth-spinner" />}
                    {loading ? 'Saving...' : 'Finish setting up my account'}
                </button>

            </form>
        </AuthLayout>
    )
}

export default CompleteProfile
