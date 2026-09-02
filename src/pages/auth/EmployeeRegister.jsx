import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import AuthLayout from './AuthLayout'

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

    const handleRegister = async (e) => {
        e.preventDefault()

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
                'Registration submitted. Check your email to confirm your account, then contact the Registrar Head to activate your employee profile.'
            )
            setLoading(false)
            return
        }

        // Best-effort: create the employee record. This will only succeed
        // if row-level security allows a newly-registered user to insert
        // their own employees row — if it doesn't, the Registrar Head will
        // need to finish setup manually from the Employees page.
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
            <form className="auth-form" onSubmit={handleRegister}>

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
                </div>

                {message && (
                    <p className={`form-message ${status === 'error' ? 'error' : 'success'}`}>
                        {message}
                    </p>
                )}

                <button type="submit" className="auth-submit" disabled={loading}>
                    {loading && <span className="auth-spinner" />}
                    {loading ? 'Submitting...' : 'Register'}
                </button>

            </form>
        </AuthLayout>
    )
}

export default EmployeeRegister
