import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activityLog'
import { notifyStudentByStudentId, notifyError } from '../../lib/notify'
import Swal from 'sweetalert2'
import { SkeletonList } from '../../components/Skeleton'
import './EmployeePages.css'

function Students() {
    const navigate = useNavigate()

    const [term, setTerm] = useState('')
    const [results, setResults] = useState([])
    const [loading, setLoading] = useState(false)
    const [searched, setSearched] = useState(false)
    const [error, setError] = useState('')

    const [pendingVerifications, setPendingVerifications] = useState([])
    const [reviewingId, setReviewingId] = useState(null)
    const [selectedProgramKey, setSelectedProgramKey] = useState(null)

    useEffect(() => {
        loadAllStudents()
        loadPendingVerifications()
    }, [])

    // Only students in a college/program this employee is assigned to show
    // up here -- approving someone's enrollment is a bigger deal than the
    // general "any employee can edit any student" permission elsewhere.
    const loadPendingVerifications = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: employee } = await supabase
                .from('employees')
                .select('employee_id')
                .eq('user_id', user.id)
                .maybeSingle()

            if (!employee) return

            const { data: assignments } = await supabase
                .from('employee_assignments')
                .select('college_id, program_id')
                .eq('employee_id', employee.employee_id)
                .eq('status', 'active')

            const assignedPairs = new Set((assignments || []).map((a) => `${a.college_id}:${a.program_id}`))
            if (assignedPairs.size === 0) return

            const { data: pending } = await supabase
                .from('students')
                .select('student_id, user_id, student_number, college_id, program_id, year_level, created_at')
                .eq('verification_status', 'pending')
                .order('created_at', { ascending: true })

            const mine = (pending || []).filter((s) => assignedPairs.has(`${s.college_id}:${s.program_id}`))

            setPendingVerifications(await enrichStudents(mine))

        } catch (err) {
            console.error('LOAD PENDING VERIFICATIONS ERROR:', err)
        }
    }

    const approveStudent = async (student) => {
        await reviewStudent(student, 'approved')
    }

    const rejectStudent = async (student) => {
        const { value: reason } = await Swal.fire({
            title: 'Reject registration',
            input: 'text',
            inputLabel: 'Reason (shown to the student)',
            inputPlaceholder: 'e.g. Student number not found in enrollment records',
            showCancelButton: true,
            confirmButtonText: 'Reject',
            confirmButtonColor: '#dc3545',
        })

        if (!reason) return

        await reviewStudent(student, 'rejected', reason)
    }

    const reviewStudent = async (student, decision, reason) => {
        try {
            setReviewingId(student.student_id)

            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('You are not logged in.')

            const { data: employee } = await supabase
                .from('employees')
                .select('employee_id')
                .eq('user_id', user.id)
                .maybeSingle()

            const { error: updateError } = await supabase
                .from('students')
                .update({
                    verification_status: decision,
                    verification_note: reason || null,
                    verified_by: user.id,
                    verified_at: new Date().toISOString(),
                })
                .eq('student_id', student.student_id)

            if (updateError) throw new Error(updateError.message)

            await notifyStudentByStudentId({
                studentId: student.student_id,
                title: decision === 'approved' ? 'Account verified' : 'Registration not verified',
                message: decision === 'approved'
                    ? "Your enrollment has been verified. You can now log in and use CertiChain."
                    : `Your registration could not be verified: ${reason}. Contact the Registrar's Office for help.`,
            })

            await logActivity({
                employeeId: employee?.employee_id,
                userId: employee ? null : user.id,
                action: decision === 'approved' ? 'approve_student_registration' : 'reject_student_registration',
                tableName: 'students',
                recordId: student.student_id,
                description: `${decision === 'approved' ? 'Approved' : 'Rejected'} registration for "${student.fullName}" (${student.student_number}).`,
            })

            setPendingVerifications((prev) => prev.filter((s) => s.student_id !== student.student_id))

        } catch (err) {
            console.error('REVIEW STUDENT ERROR:', err)
            notifyError(err.message || 'Failed to review student.')
        } finally {
            setReviewingId(null)
        }
    }

    const enrichStudents = async (rows) => {
        const userIds = [...new Set(rows.map((s) => s.user_id))]

        const { data: profiles } = userIds.length
            ? await supabase.from('profiles').select('user_id, first_name, last_name, email').in('user_id', userIds)
            : { data: [] }

        const profileByUserId = Object.fromEntries(
            (profiles || []).map((p) => [p.user_id, p])
        )

        const collegeIds = [...new Set(rows.map((s) => s.college_id).filter(Boolean))]
        const programIds = [...new Set(rows.map((s) => s.program_id).filter(Boolean))]

        const [{ data: colleges }, { data: programs }] = await Promise.all([
            collegeIds.length
                ? supabase.from('colleges').select('college_id, college_name').in('college_id', collegeIds)
                : Promise.resolve({ data: [] }),
            programIds.length
                ? supabase.from('programs').select('program_id, program_name').in('program_id', programIds)
                : Promise.resolve({ data: [] }),
        ])

        const collegeNameById = Object.fromEntries((colleges || []).map((c) => [c.college_id, c.college_name]))
        const programNameById = Object.fromEntries((programs || []).map((p) => [p.program_id, p.program_name]))

        return rows.map((s) => {
            const profile = profileByUserId[s.user_id]

            return {
                ...s,
                fullName: profile ? `${profile.first_name} ${profile.last_name}`.trim() : 'Unknown',
                email: profile?.email || '',
                collegeName: collegeNameById[s.college_id] || '',
                programName: programNameById[s.program_id] || '',
            }
        })
    }

    const loadAllStudents = async () => {
        try {
            setLoading(true)
            setError('')

            const { data: rows, error: studentsError } = await supabase
                .from('students')
                .select('student_id, user_id, student_number, college_id, program_id, year_level, status')
                .order('student_number', { ascending: true })

            if (studentsError) {
                throw new Error('Failed to load students: ' + studentsError.message)
            }

            setResults(await enrichStudents(rows || []))
            setSearched(true)

        } catch (err) {
            console.error('LOAD STUDENTS ERROR:', err)
            setError(err.message || 'Failed to load students.')
        } finally {
            setLoading(false)
        }
    }

    const search = async (e) => {
        e.preventDefault()

        const query = term.trim()

        if (!query) {
            setSelectedProgramKey(null)
            await loadAllStudents()
            return
        }

        setSelectedProgramKey(null)

        try {
            setLoading(true)
            setError('')
            setSearched(true)

            const { data: byNumber } = await supabase
                .from('students')
                .select('student_id, user_id, student_number, college_id, program_id, year_level, status')
                .ilike('student_number', `%${query}%`)
                .limit(20)

            const { data: matchingProfiles } = await supabase
                .from('profiles')
                .select('user_id, first_name, last_name, email')
                .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
                .limit(20)

            const matchingUserIds = (matchingProfiles || []).map((p) => p.user_id)

            const { data: byName } = matchingUserIds.length
                ? await supabase
                    .from('students')
                    .select('student_id, user_id, student_number, college_id, program_id, year_level, status')
                    .in('user_id', matchingUserIds)
                : { data: [] }

            const merged = [...(byNumber || []), ...(byName || [])]
            const uniqueByStudentId = Object.values(
                Object.fromEntries(merged.map((s) => [s.student_id, s]))
            )

            setResults(await enrichStudents(uniqueByStudentId))

        } catch (err) {
            console.error('STUDENT SEARCH ERROR:', err)
            setError(err.message || 'Search failed.')
        } finally {
            setLoading(false)
        }
    }

    const groupedResults = (() => {
        const groups = {}

        for (const student of results) {
            const key = student.program_id || 'unassigned'

            if (!groups[key]) {
                groups[key] = {
                    key,
                    programName: student.programName || 'No Program Assigned',
                    collegeName: student.collegeName || 'Unassigned',
                    students: [],
                }
            }

            groups[key].students.push(student)
        }

        return Object.values(groups).sort((a, b) =>
            a.collegeName.localeCompare(b.collegeName) || a.programName.localeCompare(b.programName)
        )
    })()

    const selectedGroup = selectedProgramKey
        ? groupedResults.find((g) => g.key === selectedProgramKey)
        : null

    const renderStudentCard = (student) => (
        <div className="employee-list-card" key={student.student_id}>
            <div className="employee-list-card-header">
                <div>
                    <h3>{student.fullName}</h3>
                    <p>{student.student_number} · {student.email}</p>
                </div>

                <span className={`employee-status-pill status-${student.status}`}>{student.status}</span>
            </div>

            <div className="employee-info-grid">
                <div className="employee-info-field">
                    <span>College</span>
                    <strong>{student.collegeName || 'N/A'}</strong>
                </div>

                <div className="employee-info-field">
                    <span>Program</span>
                    <strong>{student.programName || 'N/A'}</strong>
                </div>

                <div className="employee-info-field">
                    <span>Year Level</span>
                    <strong>{student.year_level || 'N/A'}</strong>
                </div>
            </div>

            <button
                className="employee-link-button"
                onClick={() => navigate(`/employee/students/${student.student_id}`)}
            >
                View request history →
            </button>
        </div>
    )

    return (
        <div>
            <div className="employee-page-header">
                <h1>Students</h1>
                <p>All enrolled students. Search to narrow the list, or view a student's information and request history.</p>
            </div>

            {pendingVerifications.length > 0 && (
                <>
                    <h2 style={{ fontSize: 17, marginBottom: 6 }}>Pending Verification</h2>
                    <p style={{ fontSize: 13, color: 'var(--slate)', marginBottom: 14 }}>
                        New registrations in your assigned program(s), waiting for you to confirm enrollment.
                    </p>

                    {pendingVerifications.map((student) => (
                        <div className="employee-list-card" key={student.student_id}>
                            <div className="employee-list-card-header">
                                <div>
                                    <h3>{student.fullName}</h3>
                                    <p>{student.student_number} · {student.email}</p>
                                </div>
                                <span className="employee-status-pill status-pending">pending</span>
                            </div>

                            <div className="employee-info-grid">
                                <div className="employee-info-field">
                                    <span>College</span>
                                    <strong>{student.collegeName || 'N/A'}</strong>
                                </div>
                                <div className="employee-info-field">
                                    <span>Program</span>
                                    <strong>{student.programName || 'N/A'}</strong>
                                </div>
                                <div className="employee-info-field">
                                    <span>Year Level</span>
                                    <strong>{student.year_level || 'N/A'}</strong>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 16 }}>
                                <button
                                    className="employee-link-button"
                                    onClick={() => navigate(`/employee/students/${student.student_id}`)}
                                >
                                    View full details →
                                </button>

                                <button
                                    className="employee-link-button"
                                    style={{ color: '#1e8a5f' }}
                                    onClick={() => approveStudent(student)}
                                    disabled={reviewingId === student.student_id}
                                >
                                    {reviewingId === student.student_id ? 'Working...' : 'Approve'}
                                </button>

                                <button
                                    className="employee-link-button"
                                    style={{ color: 'var(--red)' }}
                                    onClick={() => rejectStudent(student)}
                                    disabled={reviewingId === student.student_id}
                                >
                                    Reject
                                </button>
                            </div>
                        </div>
                    ))}

                    <h2 style={{ fontSize: 17, margin: '28px 0 14px' }}>Students</h2>
                </>
            )}

            <form onSubmit={search} style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
                <input
                    className="employee-search-input"
                    type="text"
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    placeholder="Search by student number or name"
                />

                <button
                    type="submit"
                    className="employee-card"
                    style={{ margin: 0, padding: '11px 20px', background: 'var(--blue)', color: 'var(--white)', fontWeight: 600, fontSize: 14 }}
                    disabled={loading}
                >
                    {loading ? 'Searching...' : 'Search'}
                </button>
            </form>

            {error && <div className="employee-error-box">{error}</div>}

            {loading ? (
                <SkeletonList count={3} />
            ) : !searched ? null : results.length === 0 ? (
                <div className="employee-empty">
                    {term.trim() ? `No students matched "${term}".` : 'No students found.'}
                </div>
            ) : term.trim() ? (
                // Search results: show matches directly, grouped by program.
                groupedResults.map((group) => (
                    <div key={group.key} style={{ marginBottom: 28 }}>
                        <div className="employee-page-header-row" style={{ marginBottom: 14 }}>
                            <h2 style={{ fontSize: 16 }}>
                                {group.programName}
                                {group.collegeName && <span style={{ color: 'var(--slate)', fontWeight: 400 }}> · {group.collegeName}</span>}
                            </h2>
                            <span className="employee-status-pill status-pending">
                                {group.students.length} student{group.students.length === 1 ? '' : 's'}
                            </span>
                        </div>

                        {group.students.map(renderStudentCard)}
                    </div>
                ))
            ) : selectedGroup ? (
                // Drilled into one college/course: show just its students.
                <>
                    <button
                        className="employee-link-button"
                        style={{ marginBottom: 16 }}
                        onClick={() => setSelectedProgramKey(null)}
                    >
                        ← Back to Colleges & Courses
                    </button>

                    <div className="employee-page-header-row" style={{ marginBottom: 14 }}>
                        <h2 style={{ fontSize: 16 }}>
                            {selectedGroup.programName}
                            {selectedGroup.collegeName && <span style={{ color: 'var(--slate)', fontWeight: 400 }}> · {selectedGroup.collegeName}</span>}
                        </h2>
                        <span className="employee-status-pill status-pending">
                            {selectedGroup.students.length} student{selectedGroup.students.length === 1 ? '' : 's'}
                        </span>
                    </div>

                    {selectedGroup.students.map(renderStudentCard)}
                </>
            ) : (
                // Default browse view: a table of colleges & courses, not
                // every student's card at once -- click a row to drill in.
                <div className="employee-table-wrapper">
                    <table className="employee-table">
                        <thead>
                            <tr>
                                <th>College</th>
                                <th>Course</th>
                                <th>Students</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {groupedResults.map((group) => (
                                <tr
                                    key={group.key}
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => setSelectedProgramKey(group.key)}
                                >
                                    <td>{group.collegeName}</td>
                                    <td>{group.programName}</td>
                                    <td>{group.students.length}</td>
                                    <td>
                                        <span className="employee-link-button">View →</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

export default Students
