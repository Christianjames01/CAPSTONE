import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activityLog'
import { describeChanges } from '../../lib/describeChanges'
import { notifyError, notifyWarning, confirmModal } from '../../lib/notify'
import { SkeletonList } from '../../components/Skeleton'
import Modal from '../../components/Modal'
import '../auth/Auth.css'
import './AdminPages.css'

const EMPTY_COLLEGE = { college_id: null, college_code: '', college_name: '', description: '', status: 'active' }
const EMPTY_PROGRAM = { program_id: null, college_id: '', program_code: '', program_name: '', degree_level: '', duration_years: '', status: 'active' }

function CollegesPrograms() {
    const [tab, setTab] = useState('colleges')

    const [colleges, setColleges] = useState([])
    const [programs, setPrograms] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)

    const [collegeForm, setCollegeForm] = useState(EMPTY_COLLEGE)
    const [showCollegeForm, setShowCollegeForm] = useState(false)

    const [programForm, setProgramForm] = useState(EMPTY_PROGRAM)
    const [showProgramForm, setShowProgramForm] = useState(false)

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        try {
            setLoading(true)
            setError('')

            const [{ data: collegeRows, error: collegeError }, { data: programRows, error: programError }] = await Promise.all([
                supabase.from('colleges').select('college_id, college_code, college_name, description, status').order('college_name'),
                supabase.from('programs').select('program_id, college_id, program_code, program_name, degree_level, duration_years, status').order('program_name'),
            ])

            if (collegeError) throw new Error('Failed to load colleges: ' + collegeError.message)
            if (programError) throw new Error('Failed to load programs: ' + programError.message)

            setColleges(collegeRows || [])
            setPrograms(programRows || [])

        } catch (err) {
            console.error('COLLEGES/PROGRAMS ERROR:', err)
            setError(err.message || 'Failed to load data.')
        } finally {
            setLoading(false)
        }
    }

    const logAdmin = async (action, tableName, recordId, description) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        await logActivity({ userId: user.id, action, tableName, recordId, description })
    }

    const openNewCollege = () => { setCollegeForm(EMPTY_COLLEGE); setShowCollegeForm(true) }
    const openEditCollege = (c) => { setCollegeForm(c); setShowCollegeForm(true) }

    const saveCollege = async () => {
        if (!collegeForm.college_code.trim() || !collegeForm.college_name.trim()) {
            notifyWarning('College code and name are required.')
            return
        }

        const confirmed = await confirmModal(
            collegeForm.college_id
                ? `Save changes to "${collegeForm.college_name.trim()}"?`
                : `Add "${collegeForm.college_name.trim()}" as a new college?`
        )
        if (!confirmed) return

        try {
            setSaving(true)

            const payload = {
                college_code: collegeForm.college_code.trim(),
                college_name: collegeForm.college_name.trim(),
                description: collegeForm.description?.trim() || null,
                status: collegeForm.status,
            }

            if (collegeForm.college_id) {
                const original = colleges.find((c) => c.college_id === collegeForm.college_id)

                const { error: updateError } = await supabase.from('colleges').update(payload).eq('college_id', collegeForm.college_id)
                if (updateError) throw new Error(updateError.message)

                const collegeChanges = describeChanges([
                    ['code', original?.college_code, payload.college_code],
                    ['name', original?.college_name, payload.college_name],
                    ['status', original?.status, payload.status],
                ])

                await logAdmin('edit_college', 'colleges', collegeForm.college_id, `Updated college "${payload.college_name}".${collegeChanges ? ' ' + collegeChanges + '.' : ''}`)
            } else {
                const { data, error: insertError } = await supabase.from('colleges').insert(payload).select().single()
                if (insertError) throw new Error(insertError.message)
                await logAdmin('add_college', 'colleges', data.college_id, `Added college "${payload.college_name}".`)
            }

            setShowCollegeForm(false)
            await loadData()

        } catch (err) {
            console.error('SAVE COLLEGE ERROR:', err)
            notifyError(err.message || 'Failed to save college.')
        } finally {
            setSaving(false)
        }
    }

    const toggleCollegeStatus = async (college) => {
        const nextStatus = college.status === 'active' ? 'inactive' : 'active'

        const confirmed = await confirmModal(
            nextStatus === 'inactive'
                ? `Deactivate "${college.college_name}"? Its programs will remain, but this college won't be selectable for new students or employees.`
                : `Activate "${college.college_name}"?`
        )
        if (!confirmed) return

        try {
            const { error: updateError } = await supabase.from('colleges').update({ status: nextStatus }).eq('college_id', college.college_id)
            if (updateError) throw new Error(updateError.message)
            await logAdmin('toggle_college_status', 'colleges', college.college_id, `Set college "${college.college_name}" status from "${college.status}" to "${nextStatus}".`)
            await loadData()
        } catch (err) {
            notifyError(err.message || 'Failed to update college status.')
        }
    }

    const openNewProgram = () => { setProgramForm(EMPTY_PROGRAM); setShowProgramForm(true) }
    const openEditProgram = (p) => { setProgramForm(p); setShowProgramForm(true) }

    const saveProgram = async () => {
        if (!programForm.college_id || !programForm.program_code.trim() || !programForm.program_name.trim()) {
            notifyWarning('College, program code, and program name are required.')
            return
        }

        const confirmed = await confirmModal(
            programForm.program_id
                ? `Save changes to "${programForm.program_name.trim()}"?`
                : `Add "${programForm.program_name.trim()}" as a new program?`
        )
        if (!confirmed) return

        try {
            setSaving(true)

            const payload = {
                college_id: programForm.college_id,
                program_code: programForm.program_code.trim(),
                program_name: programForm.program_name.trim(),
                degree_level: programForm.degree_level?.trim() || null,
                duration_years: programForm.duration_years === '' ? null : Number(programForm.duration_years),
                status: programForm.status,
            }

            if (programForm.program_id) {
                const original = programs.find((p) => p.program_id === programForm.program_id)

                const { error: updateError } = await supabase.from('programs').update(payload).eq('program_id', programForm.program_id)
                if (updateError) throw new Error(updateError.message)

                const programChanges = describeChanges([
                    ['code', original?.program_code, payload.program_code],
                    ['name', original?.program_name, payload.program_name],
                    ['degree level', original?.degree_level, payload.degree_level],
                    ['status', original?.status, payload.status],
                ])

                await logAdmin('edit_program', 'programs', programForm.program_id, `Updated program "${payload.program_name}".${programChanges ? ' ' + programChanges + '.' : ''}`)
            } else {
                const { data, error: insertError } = await supabase.from('programs').insert(payload).select().single()
                if (insertError) throw new Error(insertError.message)
                await logAdmin('add_program', 'programs', data.program_id, `Added program "${payload.program_name}".`)
            }

            setShowProgramForm(false)
            await loadData()

        } catch (err) {
            console.error('SAVE PROGRAM ERROR:', err)
            notifyError(err.message || 'Failed to save program.')
        } finally {
            setSaving(false)
        }
    }

    const toggleProgramStatus = async (program) => {
        const nextStatus = program.status === 'active' ? 'inactive' : 'active'

        const confirmed = await confirmModal(
            nextStatus === 'inactive'
                ? `Deactivate "${program.program_name}"? It won't be selectable for new students or employees.`
                : `Activate "${program.program_name}"?`
        )
        if (!confirmed) return

        try {
            const { error: updateError } = await supabase.from('programs').update({ status: nextStatus }).eq('program_id', program.program_id)
            if (updateError) throw new Error(updateError.message)
            await logAdmin('toggle_program_status', 'programs', program.program_id, `Set program "${program.program_name}" status from "${program.status}" to "${nextStatus}".`)
            await loadData()
        } catch (err) {
            notifyError(err.message || 'Failed to update program status.')
        }
    }

    const collegeName = (id) => colleges.find((c) => c.college_id === id)?.college_name || 'N/A'

    return (
        <div>
            <div className="admin-page-header">
                <h1>Colleges & Programs</h1>
                <p>Manage the colleges and academic programs students can belong to.</p>
            </div>

            <div className="admin-filter-row">
                <button className={`admin-filter-chip${tab === 'colleges' ? ' active' : ''}`} onClick={() => setTab('colleges')}>Colleges</button>
                <button className={`admin-filter-chip${tab === 'programs' ? ' active' : ''}`} onClick={() => setTab('programs')}>Programs</button>
            </div>

            {error && <div className="admin-error-box">{error}</div>}

            {tab === 'colleges' ? (
                <>
                    <div className="admin-page-header-row" style={{ marginBottom: 16 }}>
                        <h2 style={{ fontSize: 17 }}>Colleges</h2>
                        <button className="admin-primary-button" onClick={openNewCollege}>+ Add College</button>
                    </div>

                    {showCollegeForm && (
                        <Modal
                            title={collegeForm.college_id ? 'Edit College' : 'New College'}
                            maxWidth={560}
                            onClose={() => { if (saving) return; setShowCollegeForm(false) }}
                        >
                            <div className="admin-info-grid" style={{ marginBottom: 14 }}>
                                <div className="form-group">
                                    <label className="form-label">Code</label>
                                    <input className="form-input" value={collegeForm.college_code} onChange={(e) => setCollegeForm({ ...collegeForm, college_code: e.target.value })} disabled={saving} />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Name</label>
                                    <input className="form-input" value={collegeForm.college_name} onChange={(e) => setCollegeForm({ ...collegeForm, college_name: e.target.value })} disabled={saving} />
                                </div>
                            </div>

                            <div className="form-group" style={{ marginBottom: 14 }}>
                                <label className="form-label">Description</label>
                                <textarea className="form-input" rows={2} value={collegeForm.description || ''} onChange={(e) => setCollegeForm({ ...collegeForm, description: e.target.value })} disabled={saving} />
                            </div>

                            <div style={{ display: 'flex', gap: 10 }}>
                                <button className="admin-primary-button" onClick={saveCollege} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                                <button className="admin-link-button" style={{ color: 'var(--slate)' }} onClick={() => setShowCollegeForm(false)}>Cancel</button>
                            </div>
                        </Modal>
                    )}

                    {loading ? (
                        <SkeletonList count={3} />
                    ) : (
                        colleges.map((c) => (
                            <div className="admin-list-card" key={c.college_id}>
                                <div className="admin-list-card-header">
                                    <div>
                                        <h3>{c.college_name}</h3>
                                        <p>{c.college_code}</p>
                                    </div>
                                    <span className={`admin-status-pill status-${c.status}`}>{c.status}</span>
                                </div>

                                <div style={{ display: 'flex', gap: 16 }}>
                                    <button className="admin-link-button" onClick={() => openEditCollege(c)}>Edit</button>
                                    <button className="admin-link-button" onClick={() => toggleCollegeStatus(c)}>
                                        {c.status === 'active' ? 'Deactivate' : 'Activate'}
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </>
            ) : (
                <>
                    <div className="admin-page-header-row" style={{ marginBottom: 16 }}>
                        <h2 style={{ fontSize: 17 }}>Programs</h2>
                        <button className="admin-primary-button" onClick={openNewProgram}>+ Add Program</button>
                    </div>

                    {showProgramForm && (
                        <Modal
                            title={programForm.program_id ? 'Edit Program' : 'New Program'}
                            maxWidth={560}
                            onClose={() => { if (saving) return; setShowProgramForm(false) }}
                        >
                            <div className="admin-info-grid" style={{ marginBottom: 14 }}>
                                <div className="form-group">
                                    <label className="form-label">College</label>
                                    <select className="form-input" value={programForm.college_id} onChange={(e) => setProgramForm({ ...programForm, college_id: e.target.value })} disabled={saving}>
                                        <option value="">-- Select college --</option>
                                        {colleges.map((c) => (
                                            <option key={c.college_id} value={c.college_id}>{c.college_name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Code</label>
                                    <input className="form-input" value={programForm.program_code} onChange={(e) => setProgramForm({ ...programForm, program_code: e.target.value })} disabled={saving} />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Name</label>
                                    <input className="form-input" value={programForm.program_name} onChange={(e) => setProgramForm({ ...programForm, program_name: e.target.value })} disabled={saving} />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Degree Level</label>
                                    <input className="form-input" value={programForm.degree_level || ''} onChange={(e) => setProgramForm({ ...programForm, degree_level: e.target.value })} disabled={saving} />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Duration (Years)</label>
                                    <input className="form-input" type="number" min="0" step="0.5" value={programForm.duration_years} onChange={(e) => setProgramForm({ ...programForm, duration_years: e.target.value })} disabled={saving} />
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 10 }}>
                                <button className="admin-primary-button" onClick={saveProgram} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                                <button className="admin-link-button" style={{ color: 'var(--slate)' }} onClick={() => setShowProgramForm(false)}>Cancel</button>
                            </div>
                        </Modal>
                    )}

                    {loading ? (
                        <SkeletonList count={3} />
                    ) : (
                        programs.map((p) => (
                            <div className="admin-list-card" key={p.program_id}>
                                <div className="admin-list-card-header">
                                    <div>
                                        <h3>{p.program_name}</h3>
                                        <p>{p.program_code} · {collegeName(p.college_id)} · {p.degree_level || 'N/A'}</p>
                                    </div>
                                    <span className={`admin-status-pill status-${p.status}`}>{p.status}</span>
                                </div>

                                <div style={{ display: 'flex', gap: 16 }}>
                                    <button className="admin-link-button" onClick={() => openEditProgram(p)}>Edit</button>
                                    <button className="admin-link-button" onClick={() => toggleProgramStatus(p)}>
                                        {p.status === 'active' ? 'Deactivate' : 'Activate'}
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </>
            )}
        </div>
    )
}

export default CollegesPrograms
