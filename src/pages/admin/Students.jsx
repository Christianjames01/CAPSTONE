import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activityLog'
import { notifyError, confirmModal } from '../../lib/notify'
import './AdminPages.css'

function Students() {
    const navigate = useNavigate()

    const [term, setTerm] = useState('')
    const [results, setResults] = useState([])
    const [loading, setLoading] = useState(false)
    const [searched, setSearched] = useState(false)
    const [error, setError] = useState('')
    const [updating, setUpdating] = useState(null)
    const [removing, setRemoving] = useState(null)

    useEffect(() => {
        loadAllStudents()
    }, [])

    const enrichStudents = async (rows) => {
        const userIds = [...new Set(rows.map((s) => s.user_id))]

        const { data: profiles } = userIds.length
            ? await supabase.from('profiles').select('user_id, first_name, last_name, email').in('user_id', userIds)
            : { data: [] }

        const profileByUserId = Object.fromEntries((profiles || []).map((p) => [p.user_id, p]))

        const collegeIds = [...new Set(rows.map((s) => s.college_id).filter(Boolean))]
        const programIds = [...new Set(rows.map((s) => s.program_id).filter(Boolean))]

        const [{ data: colleges }, { data: programs }] = await Promise.all([
            collegeIds.length ? supabase.from('colleges').select('college_id, college_name').in('college_id', collegeIds) : Promise.resolve({ data: [] }),
            programIds.length ? supabase.from('programs').select('program_id, program_name').in('program_id', programIds) : Promise.resolve({ data: [] }),
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
                .limit(200)

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
            await loadAllStudents()
            return
        }

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
            const uniqueByStudentId = Object.values(Object.fromEntries(merged.map((s) => [s.student_id, s])))

            setResults(await enrichStudents(uniqueByStudentId))

        } catch (err) {
            console.error('ADMIN STUDENT SEARCH ERROR:', err)
            setError(err.message || 'Search failed.')
        } finally {
            setLoading(false)
        }
    }

    const applyToResults = (studentId, changes) => {
        setResults((prev) => prev.map((s) => (s.student_id === studentId ? { ...s, ...changes } : s)))
    }

    const toggleStatus = async (student) => {
        const nextStatus = student.status === 'active' ? 'inactive' : 'active'

        const confirmed = await confirmModal(
            `${nextStatus === 'active' ? 'Activate' : 'Deactivate'} ${student.fullName}? ${nextStatus === 'inactive' ? 'They will no longer be able to log in or submit requests.' : ''}`
        )
        if (!confirmed) return

        try {
            setUpdating(student.student_id)

            const {
                data: { user },
                error: userError
            } = await supabase.auth.getUser()

            if (userError || !user) {
                throw new Error('You are not logged in.')
            }

            const { error: updateError } = await supabase
                .from('students')
                .update({ status: nextStatus })
                .eq('student_id', student.student_id)

            if (updateError) {
                throw new Error('Failed to update student status: ' + updateError.message)
            }

            // profiles.status is what actually gates login (see Login.jsx / ProtectedRoute.jsx),
            // so it has to be kept in sync with the student record's status.
            const { error: profileError } = await supabase
                .from('profiles')
                .update({ status: nextStatus })
                .eq('user_id', student.user_id)

            if (profileError) {
                throw new Error('Failed to update account status: ' + profileError.message)
            }

            await logActivity({
                userId: user.id,
                action: nextStatus === 'active' ? 'activate_student' : 'deactivate_student',
                tableName: 'students',
                recordId: student.student_id,
                description: `${nextStatus === 'active' ? 'Activated' : 'Deactivated'} student ${student.fullName} (${student.student_number}).`,
            })

            applyToResults(student.student_id, { status: nextStatus })

        } catch (err) {
            console.error('TOGGLE STUDENT STATUS ERROR:', err)
            notifyError(err.message || 'Failed to update student status.')
        } finally {
            setUpdating(null)
        }
    }

    const removeStudent = async (student) => {
        try {
            setRemoving(student.student_id)

            const { count: requestCount, error: countError } = await supabase
                .from('document_requests')
                .select('request_id', { count: 'exact', head: true })
                .eq('student_id', student.student_id)

            if (countError) {
                throw new Error('Failed to check request history: ' + countError.message)
            }

            if (requestCount > 0) {
                notifyError(
                    `${student.fullName} has ${requestCount} document request${requestCount === 1 ? '' : 's'} on file, so their record can't be deleted. Deactivate the account instead.`,
                    "Can't delete"
                )
                return
            }

            const confirmed = await confirmModal(
                `Delete ${student.fullName}'s student record? This does not delete their login account, only their student profile. This cannot be undone.`
            )
            if (!confirmed) return

            const {
                data: { user },
                error: userError
            } = await supabase.auth.getUser()

            if (userError || !user) {
                throw new Error('You are not logged in.')
            }

            const { error: deleteError } = await supabase
                .from('students')
                .delete()
                .eq('student_id', student.student_id)

            if (deleteError) {
                throw new Error('Failed to delete student: ' + deleteError.message)
            }

            await logActivity({
                userId: user.id,
                action: 'remove_student',
                tableName: 'students',
                recordId: student.student_id,
                description: `Deleted student record for ${student.fullName} (${student.student_number}).`,
            })

            setResults((prev) => prev.filter((s) => s.student_id !== student.student_id))

        } catch (err) {
            console.error('REMOVE STUDENT ERROR:', err)
            notifyError(err.message || 'Failed to delete student.')
        } finally {
            setRemoving(null)
        }
    }

    return (
        <div>
            <div className="admin-page-header">
                <h1>Students</h1>
                <p>All enrolled students. Search to narrow the list, or view a student's information, request history, and submitted requirements.</p>
            </div>

            <form onSubmit={search} style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
                <input
                    className="admin-search-input"
                    type="text"
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    placeholder="Search by student number or name"
                />
                <button type="submit" className="admin-primary-button" disabled={loading}>
                    {loading ? 'Searching...' : 'Search'}
                </button>
            </form>

            {error && <div className="admin-error-box">{error}</div>}

            {loading ? (
                <p className="admin-loading">Loading students...</p>
            ) : !searched ? null : results.length === 0 ? (
                <div className="admin-empty">
                    {term.trim() ? `No students matched "${term}".` : 'No students found.'}
                </div>
            ) : (
                results.map((student) => (
                    <div className="admin-list-card" key={student.student_id}>
                        <div className="admin-list-card-header">
                            <div>
                                <h3>{student.fullName}</h3>
                                <p>{student.student_number} · {student.email}</p>
                            </div>
                            <span className={`admin-status-pill status-${student.status}`}>{student.status}</span>
                        </div>

                        <div className="admin-info-grid">
                            <div className="admin-info-field">
                                <span>College</span>
                                <strong>{student.collegeName || 'N/A'}</strong>
                            </div>
                            <div className="admin-info-field">
                                <span>Program</span>
                                <strong>{student.programName || 'N/A'}</strong>
                            </div>
                            <div className="admin-info-field">
                                <span>Year Level</span>
                                <strong>{student.year_level || 'N/A'}</strong>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 16 }}>
                            <button className="admin-link-button" onClick={() => navigate(`/admin/students/${student.student_id}`)}>
                                View full record →
                            </button>

                            <button
                                className="admin-link-button"
                                style={{ color: student.status === 'active' ? 'var(--red)' : 'var(--blue)' }}
                                onClick={() => toggleStatus(student)}
                                disabled={updating === student.student_id}
                            >
                                {updating === student.student_id
                                    ? 'Updating...'
                                    : student.status === 'active' ? 'Deactivate' : 'Activate'}
                            </button>

                            <button
                                className="admin-link-button"
                                style={{ color: 'var(--red)' }}
                                onClick={() => removeStudent(student)}
                                disabled={removing === student.student_id}
                            >
                                {removing === student.student_id ? 'Checking...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                ))
            )}
        </div>
    )
}

export default Students
