import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activityLog'
import { exportToExcel } from '../../lib/excelExport'
import { parseExcelFile } from '../../lib/excelImport'
import { notifyWarning } from '../../lib/notify'
import './AdminPages.css'

const IMPORT_COLUMNS = [
    { header: 'student_number', key: 'student_number', width: 18 },
    { header: 'course_code', key: 'course_code', width: 16 },
    { header: 'academic_year', key: 'academic_year', width: 16 },
    { header: 'grade', key: 'grade', width: 10 },
]

function Grades() {
    const [importing, setImporting] = useState(false)
    const [importSummary, setImportSummary] = useState(null)

    const downloadImportTemplate = async () => {
        await exportToExcel('grades-import-template', [
            {
                name: 'Grades',
                columns: IMPORT_COLUMNS,
                rows: [
                    { student_number: '59834547', course_code: 'CC 101', academic_year: '2023-2024', grade: '2.2' },
                ],
            },
        ])
    }

    const handleImportFile = async (e) => {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (!file) return

        setImportSummary(null)

        try {
            setImporting(true)

            const rows = await parseExcelFile(file)

            if (rows.length === 0) {
                notifyWarning('That file has no data rows.')
                return
            }

            const {
                data: { user },
            } = await supabase.auth.getUser()

            const { data: employee } = await supabase
                .from('employees')
                .select('employee_id')
                .eq('user_id', user.id)
                .maybeSingle()

            const studentCache = new Map()
            const curriculumCache = new Map()
            const courseCache = new Map()

            let added = 0
            let updated = 0
            const failed = []

            for (const row of rows) {
                const studentNumber = (row.student_number || '').trim()
                const courseCode = (row.course_code || '').trim()
                const academicYear = (row.academic_year || '').trim()
                const grade = (row.grade || '').trim()

                if (!studentNumber || !courseCode || !academicYear || !grade) {
                    failed.push(`Row missing a required field: ${JSON.stringify(row)}`)
                    continue
                }

                let student = studentCache.get(studentNumber)
                if (student === undefined) {
                    const { data } = await supabase
                        .from('students')
                        .select('student_id, program_id')
                        .eq('student_number', studentNumber)
                        .maybeSingle()
                    student = data || null
                    studentCache.set(studentNumber, student)
                }

                if (!student) {
                    failed.push(`${studentNumber}: no student found with this student number.`)
                    continue
                }

                if (!student.program_id) {
                    failed.push(`${studentNumber}: student has no program assigned.`)
                    continue
                }

                let curriculum = curriculumCache.get(student.program_id)
                if (curriculum === undefined) {
                    const { data } = await supabase
                        .from('curricula')
                        .select('curriculum_id')
                        .eq('program_id', student.program_id)
                        .eq('is_active', true)
                        .maybeSingle()
                    curriculum = data || null
                    curriculumCache.set(student.program_id, curriculum)
                }

                if (!curriculum) {
                    failed.push(`${studentNumber}: no active curriculum for their program.`)
                    continue
                }

                const courseKey = `${curriculum.curriculum_id}::${courseCode}`
                let course = courseCache.get(courseKey)
                if (course === undefined) {
                    const { data } = await supabase
                        .from('curriculum_courses')
                        .select('curriculum_course_id')
                        .eq('curriculum_id', curriculum.curriculum_id)
                        .eq('course_code', courseCode)
                        .maybeSingle()
                    course = data || null
                    courseCache.set(courseKey, course)
                }

                if (!course) {
                    failed.push(`${studentNumber}: course "${courseCode}" not found in their curriculum.`)
                    continue
                }

                const { data: existing } = await supabase
                    .from('student_grades')
                    .select('student_grade_id')
                    .eq('student_id', student.student_id)
                    .eq('curriculum_course_id', course.curriculum_course_id)
                    .maybeSingle()

                const { error: upsertError } = await supabase
                    .from('student_grades')
                    .upsert({
                        student_id: student.student_id,
                        curriculum_course_id: course.curriculum_course_id,
                        academic_year: academicYear,
                        grade,
                        recorded_by: employee?.employee_id || null,
                        updated_at: new Date().toISOString(),
                    }, { onConflict: 'student_id,curriculum_course_id' })

                if (upsertError) {
                    failed.push(`${studentNumber} / ${courseCode}: ${upsertError.message}`)
                    continue
                }

                if (existing) updated++
                else added++
            }

            setImportSummary({ added, updated, failed })

            await logActivity({
                employeeId: employee?.employee_id || null,
                userId: employee ? null : user.id,
                action: 'import_grades',
                tableName: 'student_grades',
                description: `Imported grades from spreadsheet: ${added} added, ${updated} updated, ${failed.length} failed.`,
            })

        } catch (err) {
            console.error('IMPORT GRADES ERROR:', err)
            notifyWarning(err.message || 'Failed to import grades.')
        } finally {
            setImporting(false)
        }
    }

    return (
        <div>
            <div className="admin-page-header-row">
                <div className="admin-page-header">
                    <h1>Grades</h1>
                    <p>Bulk-import student grades from a spreadsheet, matched against each student's active curriculum.</p>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="admin-secondary-button" onClick={downloadImportTemplate}>
                        Download Template
                    </button>

                    <input
                        id="grades-import-input"
                        type="file"
                        accept=".xlsx"
                        style={{ display: 'none' }}
                        onChange={handleImportFile}
                        disabled={importing}
                    />

                    <button
                        className="admin-primary-button"
                        onClick={() => document.getElementById('grades-import-input').click()}
                        disabled={importing}
                    >
                        {importing ? 'Importing...' : '⬆ Import Excel'}
                    </button>
                </div>
            </div>

            <div className="admin-notice tone-info" style={{ marginBottom: 20 }}>
                <strong>Expected columns</strong>
                <p>student_number, course_code, academic_year, grade — course_code must match a course already in that student's program curriculum.</p>
            </div>

            {importSummary && (
                <div className="admin-card">
                    <div className="admin-page-header-row" style={{ marginBottom: 8 }}>
                        <h2 style={{ fontSize: 15 }}>Import Complete</h2>
                        <button className="admin-link-button" style={{ color: 'var(--slate)' }} onClick={() => setImportSummary(null)}>
                            Dismiss
                        </button>
                    </div>
                    <p style={{ marginBottom: importSummary.failed.length ? 10 : 0 }}>
                        {importSummary.added} added · {importSummary.updated} updated
                        {importSummary.failed.length > 0 ? ` · ${importSummary.failed.length} failed` : ''}
                    </p>

                    {importSummary.failed.length > 0 && (
                        <ul style={{ fontSize: 12.5, color: 'var(--red-dark)', paddingLeft: 18 }}>
                            {importSummary.failed.map((msg, i) => <li key={i}>{msg}</li>)}
                        </ul>
                    )}
                </div>
            )}
        </div>
    )
}

export default Grades
