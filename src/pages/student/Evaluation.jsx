import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { SkeletonPageHeader, SkeletonList } from '../../components/Skeleton'
import './StudentPages.css'
import './Evaluation.css'

const YEAR_ORDER = ['First Year', 'Second Year', 'Third Year', 'Fourth Year']
const TERM_ORDER = ['1st Semester', '2nd Semester', 'Summer']

function groupByYearAndTerm(courses) {
    const groups = new Map()

    for (const course of courses) {
        const yearKey = course.year_level
        const termKey = course.term

        if (!groups.has(yearKey)) groups.set(yearKey, new Map())
        const terms = groups.get(yearKey)

        if (!terms.has(termKey)) terms.set(termKey, [])
        terms.get(termKey).push(course)
    }

    return [...groups.entries()]
        .sort(([a], [b]) => YEAR_ORDER.indexOf(a) - YEAR_ORDER.indexOf(b))
        .map(([year, terms]) => ({
            year,
            terms: [...terms.entries()]
                .sort(([a], [b]) => TERM_ORDER.indexOf(a) - TERM_ORDER.indexOf(b))
                .map(([term, rows]) => ({
                    term,
                    rows: rows.sort((a, b) => a.display_order - b.display_order),
                    totalUnits: rows.reduce((sum, r) => sum + Number(r.units || 0), 0),
                })),
        }))
}

function Evaluation() {
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [curriculum, setCurriculum] = useState(null)
    const [groupedYears, setGroupedYears] = useState([])

    useEffect(() => {
        loadEvaluation()
    }, [])

    const loadEvaluation = async () => {
        try {
            setLoading(true)
            setError('')

            const {
                data: { user },
                error: userError
            } = await supabase.auth.getUser()

            if (userError || !user) {
                throw new Error('You are not logged in.')
            }

            const { data: student, error: studentError } = await supabase
                .from('students')
                .select('student_id, program_id')
                .eq('user_id', user.id)
                .single()

            if (studentError || !student) {
                throw new Error('Student record could not be found.')
            }

            if (!student.program_id) {
                setCurriculum(null)
                setGroupedYears([])
                return
            }

            const { data: curriculumData, error: curriculumError } = await supabase
                .from('curricula')
                .select('curriculum_id, curriculum_code, description')
                .eq('program_id', student.program_id)
                .eq('is_active', true)
                .maybeSingle()

            if (curriculumError) {
                throw new Error('Failed to load curriculum: ' + curriculumError.message)
            }

            if (!curriculumData) {
                setCurriculum(null)
                setGroupedYears([])
                return
            }

            setCurriculum(curriculumData)

            const { data: courses, error: coursesError } = await supabase
                .from('curriculum_courses')
                .select('curriculum_course_id, course_code, course_name, units, year_level, term, prereq_course_code, display_order')
                .eq('curriculum_id', curriculumData.curriculum_id)

            if (coursesError) {
                throw new Error('Failed to load curriculum courses: ' + coursesError.message)
            }

            const { data: grades, error: gradesError } = await supabase
                .from('student_grades')
                .select('curriculum_course_id, grade')
                .eq('student_id', student.student_id)

            if (gradesError) {
                throw new Error('Failed to load grades: ' + gradesError.message)
            }

            const gradeByCourseId = Object.fromEntries(
                (grades || []).map((g) => [g.curriculum_course_id, g.grade])
            )

            const coursesWithGrades = (courses || []).map((c) => ({
                ...c,
                grade: gradeByCourseId[c.curriculum_course_id] || '',
            }))

            setGroupedYears(groupByYearAndTerm(coursesWithGrades))

        } catch (err) {
            console.error('EVALUATION LOAD ERROR:', err)
            setError(err.message || 'Failed to load evaluation.')
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div>
                <SkeletonPageHeader />
                <SkeletonList count={3} />
            </div>
        )
    }

    if (error) {
        return <div className="student-error-box">{error}</div>
    }

    if (!curriculum) {
        return (
            <div>
                <div className="student-page-header">
                    <h1>Evaluation</h1>
                    <p>Your curriculum checklist and grades.</p>
                </div>
                <div className="student-empty">
                    No curriculum has been set up for your program yet. Please check back later or contact the Registrar's Office.
                </div>
            </div>
        )
    }

    return (
        <div>
            <div className="student-page-header">
                <h1>Evaluation</h1>
                <p>Your curriculum checklist and grades.</p>
            </div>

            <div className="eval-header">
                <div>Curriculum Code: {curriculum.curriculum_code}</div>
                {curriculum.description && <div>{curriculum.description}</div>}
            </div>

            {groupedYears.map((yearGroup) => (
                <div className="eval-year-block" key={yearGroup.year}>
                    <div className="eval-year-title">{yearGroup.year}</div>

                    {yearGroup.terms.map((termGroup) => (
                        <div className="eval-term-block" key={termGroup.term}>
                            <table className="eval-table">
                                <thead>
                                    <tr>
                                        <th colSpan={2}>{termGroup.term}</th>
                                        <th>Units</th>
                                        <th>Prereq</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {termGroup.rows.map((row) => (
                                        <tr key={row.curriculum_course_id}>
                                            <td className="eval-grade-cell">{row.grade || '-'}</td>
                                            <td>
                                                <strong>{row.course_code}</strong>
                                                <span className="eval-course-name">{row.course_name}</span>
                                            </td>
                                            <td>{Number(row.units).toFixed(1)}</td>
                                            <td>{row.prereq_course_code || ''}</td>
                                        </tr>
                                    ))}
                                    <tr className="eval-total-row">
                                        <td colSpan={2}>Total Units</td>
                                        <td>{termGroup.totalUnits.toFixed(1)}</td>
                                        <td></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    )
}

export default Evaluation
