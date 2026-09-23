import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activityLog'
import { describeChanges } from '../../lib/describeChanges'
import { notifyError, notifyWarning, confirmModal } from '../../lib/notify'
import { HCDC_COLLEGES, HCDC_PROGRAMS } from '../../lib/hcdcCatalog'
import { SkeletonList } from '../../components/Skeleton'
import Modal from '../../components/Modal'
import '../auth/Auth.css'
import './AdminPages.css'

// programs.duration_years is always stored in years -- these just let the
// admin type/read a short vocational course's length in whichever unit
// makes sense (e.g. "6 months" instead of mentally converting to 0.5) and
// keep the same number of real days when switching the unit mid-edit.
function convertDurationValue(value, fromUnit, toUnit) {
    if (value === '' || value === null || fromUnit === toUnit) return value

    const num = Number(value)
    if (Number.isNaN(num)) return value

    const years = fromUnit === 'months' ? num / 12 : num
    const converted = toUnit === 'months' ? years * 12 : years

    return String(Math.round(converted * 100) / 100)
}

function CollegesPrograms() {
    const [tab, setTab] = useState('colleges')
    const [search, setSearch] = useState('')

    const [colleges, setColleges] = useState([])
    const [programs, setPrograms] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)

    const [collegeForm, setCollegeForm] = useState(null)
    const [showCollegeForm, setShowCollegeForm] = useState(false)

    const [programForm, setProgramForm] = useState(null)
    const [showProgramForm, setShowProgramForm] = useState(false)
    const [programDurationUnit, setProgramDurationUnit] = useState('years')

    // Adding colleges/programs one at a time meant repeating the same modal
    // up to 56 times to seed the real catalog. One shared modal lets an
    // admin check off any number of colleges and programs from the HCDC
    // reference catalog and add all of them in a single action.
    const [showAddModal, setShowAddModal] = useState(false)
    const [selectedCollegeCodes, setSelectedCollegeCodes] = useState([])
    const [selectedProgramCodes, setSelectedProgramCodes] = useState([])
    const [addingBulk, setAddingBulk] = useState(false)

    // The catalog is a fixed reference list -- once everything in it is
    // added, there's nothing left to check. These hold a one-off entry for
    // something genuinely new (e.g. a program HCDC opens later) that isn't
    // in the catalog at all, so that case isn't a dead end.
    const [showCustomCollege, setShowCustomCollege] = useState(false)
    const [customCollege, setCustomCollege] = useState({ code: '', name: '' })
    const [showCustomProgram, setShowCustomProgram] = useState(false)
    const [customProgram, setCustomProgram] = useState({ code: '', name: '', collegeId: '', degreeLevel: '', durationYears: '' })
    const [customDurationUnit, setCustomDurationUnit] = useState('years')

    const [currentRole, setCurrentRole] = useState('')

    useEffect(() => {
        loadData()
        loadCurrentRole()
    }, [])

    const loadCurrentRole = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('user_id', user.id)
            .single()

        setCurrentRole(profile?.role || '')
    }

    // `silent` skips the loading/skeleton state for refreshes after a save,
    // toggle, or bulk-add. Swapping the list for a short skeleton mid-edit
    // shrinks the page and makes the browser clamp scroll back near the top,
    // so once the full list re-renders it looks like the page jumped up even
    // though nothing intentionally scrolled the admin away from their spot.
    const loadData = async ({ silent = false } = {}) => {
        try {
            if (!silent) setLoading(true)
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
            if (!silent) setLoading(false)
        }
    }

    const logAdmin = async (action, tableName, recordId, description) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        await logActivity({ userId: user.id, action, tableName, recordId, description })
    }

    const openEditCollege = (c) => { setCollegeForm(c); setShowCollegeForm(true) }

    const saveCollege = async () => {
        if (!collegeForm.college_code.trim() || !collegeForm.college_name.trim()) {
            notifyWarning('College code and name are required.')
            return
        }

        const confirmed = await confirmModal(`Save changes to "${collegeForm.college_name.trim()}"?`)
        if (!confirmed) return

        try {
            setSaving(true)

            const payload = {
                college_code: collegeForm.college_code.trim(),
                college_name: collegeForm.college_name.trim(),
                description: collegeForm.description?.trim() || null,
                status: collegeForm.status,
            }

            const original = colleges.find((c) => c.college_id === collegeForm.college_id)

            const { error: updateError } = await supabase.from('colleges').update(payload).eq('college_id', collegeForm.college_id)
            if (updateError) throw new Error(updateError.message)

            const collegeChanges = describeChanges([
                ['code', original?.college_code, payload.college_code],
                ['name', original?.college_name, payload.college_name],
                ['status', original?.status, payload.status],
            ])

            await logAdmin('edit_college', 'colleges', collegeForm.college_id, `Updated college "${payload.college_name}".${collegeChanges ? ' ' + collegeChanges + '.' : ''}`)

            setShowCollegeForm(false)
            await loadData({ silent: true })

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
            await loadData({ silent: true })
        } catch (err) {
            notifyError(err.message || 'Failed to update college status.')
        }
    }

    const deleteCollege = async (college) => {
        const confirmed = await confirmModal(
            `Permanently delete "${college.college_name}"? This cannot be undone, and will fail if it still has programs or enrolled students.`,
            { title: 'Delete college?', confirmButtonText: 'Delete' }
        )
        if (!confirmed) return

        try {
            const { error: deleteError } = await supabase.from('colleges').delete().eq('college_id', college.college_id)
            if (deleteError) throw new Error(deleteError.message)
            await logAdmin('delete_college', 'colleges', college.college_id, `Deleted college "${college.college_name}" (Registrar Head).`)
            await loadData({ silent: true })
        } catch (err) {
            notifyError(err.message || 'Failed to delete college.')
        }
    }

    const openEditProgram = (p) => {
        // A stored duration under a year (e.g. 0.5) is virtually always a
        // short vocational course entered in months, not a fraction of a
        // year an admin actually thinks in -- defaulting to Months here
        // means it displays correctly right away instead of showing an
        // awkward decimal until they manually switch the unit.
        const unit = p.duration_years != null && p.duration_years > 0 && p.duration_years < 1 ? 'months' : 'years'
        setProgramForm({
            ...p,
            duration_years: unit === 'months' ? convertDurationValue(p.duration_years, 'years', unit) : p.duration_years,
        })
        setProgramDurationUnit(unit)
        setShowProgramForm(true)
    }

    const saveProgram = async () => {
        if (!programForm.college_id || !programForm.program_code.trim() || !programForm.program_name.trim()) {
            notifyWarning('College, program code, and program name are required.')
            return
        }

        const confirmed = await confirmModal(`Save changes to "${programForm.program_name.trim()}"?`)
        if (!confirmed) return

        try {
            setSaving(true)

            const payload = {
                college_id: programForm.college_id,
                program_code: programForm.program_code.trim(),
                program_name: programForm.program_name.trim(),
                degree_level: programForm.degree_level?.trim() || null,
                duration_years: programForm.duration_years === ''
                    ? null
                    : programDurationUnit === 'months'
                        ? Number(programForm.duration_years) / 12
                        : Number(programForm.duration_years),
                status: programForm.status,
            }

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

            setShowProgramForm(false)
            await loadData({ silent: true })

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
            await loadData({ silent: true })
        } catch (err) {
            notifyError(err.message || 'Failed to update program status.')
        }
    }

    const deleteProgram = async (program) => {
        const confirmed = await confirmModal(
            `Permanently delete "${program.program_name}"? This cannot be undone, and will fail if students are still enrolled in it.`,
            { title: 'Delete program?', confirmButtonText: 'Delete' }
        )
        if (!confirmed) return

        try {
            const { error: deleteError } = await supabase.from('programs').delete().eq('program_id', program.program_id)
            if (deleteError) throw new Error(deleteError.message)
            await logAdmin('delete_program', 'programs', program.program_id, `Deleted program "${program.program_name}" (Registrar Head).`)
            await loadData({ silent: true })
        } catch (err) {
            notifyError(err.message || 'Failed to delete program.')
        }
    }

    const availableColleges = HCDC_COLLEGES.filter((c) => !colleges.some((existing) => existing.college_code === c.code))
    const availablePrograms = HCDC_PROGRAMS.filter((p) => !programs.some((existing) => existing.program_code === p.code))

    // Choices for the custom program's college field: existing colleges,
    // plus any catalog colleges checked in this same batch, plus the custom
    // college being defined right now (if any) -- covers "add a brand new
    // college and a program under it" in one action.
    const customProgramCollegeChoices = [
        ...colleges.map((c) => ({ id: c.college_id, name: c.college_name })),
        ...selectedCollegeCodes.map((code) => {
            const c = HCDC_COLLEGES.find((x) => x.code === code)
            return { id: `catalog:${code}`, name: c.name }
        }),
        ...(showCustomCollege && customCollege.name.trim() ? [{ id: 'custom', name: customCollege.name.trim() }] : []),
    ]

    const openAddModal = () => {
        setSelectedCollegeCodes([])
        setSelectedProgramCodes([])
        setShowCustomCollege(false)
        setCustomCollege({ code: '', name: '' })
        setShowCustomProgram(false)
        setCustomProgram({ code: '', name: '', collegeId: '', degreeLevel: '', durationYears: '' })
        setCustomDurationUnit('years')
        setShowAddModal(true)
    }

    const toggleCollegeSelection = (code) => {
        setSelectedCollegeCodes((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]))
    }

    const toggleProgramSelection = (code) => {
        setSelectedProgramCodes((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]))
    }

    const totalSelectedCount = selectedCollegeCodes.length + selectedProgramCodes.length
        + (showCustomCollege && customCollege.name.trim() ? 1 : 0)
        + (showCustomProgram && customProgram.name.trim() ? 1 : 0)

    const saveBulkAdd = async () => {
        const addingCustomCollege = showCustomCollege && customCollege.name.trim()
        const addingCustomProgram = showCustomProgram && customProgram.name.trim()

        if (totalSelectedCount === 0) {
            notifyWarning('Select or enter at least one college or program to add.')
            return
        }

        if (addingCustomCollege && !customCollege.code.trim()) {
            notifyWarning('Enter a code for the new college.')
            return
        }

        if (addingCustomProgram && (!customProgram.code.trim() || !customProgram.collegeId)) {
            notifyWarning('Enter a code and college for the new program.')
            return
        }

        const confirmed = await confirmModal(`Add ${totalSelectedCount} item(s)?`)
        if (!confirmed) return

        try {
            setAddingBulk(true)

            const collegeRows = selectedCollegeCodes.map((code) => {
                const c = HCDC_COLLEGES.find((x) => x.code === code)
                return { college_code: c.code, college_name: c.name, status: 'active' }
            })

            if (addingCustomCollege) {
                collegeRows.push({ college_code: customCollege.code.trim(), college_name: customCollege.name.trim(), status: 'active' })
            }

            let insertedColleges = []
            if (collegeRows.length > 0) {
                const { data, error: insertError } = await supabase.from('colleges').insert(collegeRows).select()
                if (insertError) throw new Error('Failed to add colleges: ' + insertError.message)
                insertedColleges = data || []
            }

            // A program's college might be one selected/entered in this same
            // batch (not yet in `colleges` state until after loadData), so
            // resolve college_id against both the existing list and what was
            // just inserted above.
            const collegeIdByCode = Object.fromEntries(
                [...colleges, ...insertedColleges].map((c) => [c.college_code, c.college_id])
            )

            const programRows = selectedProgramCodes
                .map((code) => {
                    const p = HCDC_PROGRAMS.find((x) => x.code === code)
                    const college_id = collegeIdByCode[p.collegeCode]
                    return college_id
                        ? { college_id, program_code: p.code, program_name: p.name, degree_level: p.degreeLevel, status: 'active' }
                        : null
                })
                .filter(Boolean)

            if (addingCustomProgram) {
                const college_id = customProgram.collegeId === 'custom'
                    ? insertedColleges.find((c) => c.college_code === customCollege.code.trim())?.college_id
                    : customProgram.collegeId.startsWith('catalog:')
                        ? collegeIdByCode[customProgram.collegeId.replace('catalog:', '')]
                        : customProgram.collegeId

                if (!college_id) throw new Error('Could not resolve the college for the new program.')

                programRows.push({
                    college_id,
                    program_code: customProgram.code.trim(),
                    program_name: customProgram.name.trim(),
                    degree_level: customProgram.degreeLevel.trim() || null,
                    duration_years: customProgram.durationYears === ''
                        ? null
                        : customDurationUnit === 'months'
                            ? Number(customProgram.durationYears) / 12
                            : Number(customProgram.durationYears),
                    status: 'active',
                })
            }

            let insertedPrograms = []
            if (programRows.length > 0) {
                const { data, error: insertError } = await supabase.from('programs').insert(programRows).select()
                if (insertError) throw new Error('Failed to add programs: ' + insertError.message)
                insertedPrograms = data || []
            }

            if (insertedColleges.length > 0) {
                await logAdmin('add_college', 'colleges', null, `Added ${insertedColleges.length} college(s): ${insertedColleges.map((c) => c.college_name).join(', ')}.`)
            }
            if (insertedPrograms.length > 0) {
                await logAdmin('add_program', 'programs', null, `Added ${insertedPrograms.length} program(s): ${insertedPrograms.map((p) => p.program_name).join(', ')}.`)
            }

            setShowAddModal(false)
            await loadData({ silent: true })

        } catch (err) {
            console.error('BULK ADD ERROR:', err)
            notifyError(err.message || 'Failed to add selected colleges/programs.')
        } finally {
            setAddingBulk(false)
        }
    }

    const collegeName = (id) => colleges.find((c) => c.college_id === id)?.college_name || 'N/A'

    const query = search.trim().toLowerCase()

    const visibleColleges = colleges.filter((c) =>
        !query || c.college_name.toLowerCase().includes(query) || c.college_code.toLowerCase().includes(query)
    )

    const visiblePrograms = programs.filter((p) =>
        !query ||
        p.program_name.toLowerCase().includes(query) ||
        p.program_code.toLowerCase().includes(query) ||
        collegeName(p.college_id).toLowerCase().includes(query)
    )

    return (
        <div>
            <div className="admin-page-header-row">
                <div className="admin-page-header">
                    <h1>Academic Divisions & Programs</h1>
                    <p>Manage the colleges and academic programs students can belong to.</p>
                </div>
                <button className="admin-primary-button" onClick={openAddModal}>+ Add Academic Divisions & Programs</button>
            </div>

            <div className="admin-filter-row">
                <button className={`admin-filter-chip${tab === 'colleges' ? ' active' : ''}`} onClick={() => { setTab('colleges'); setSearch('') }}>Colleges</button>
                <button className={`admin-filter-chip${tab === 'programs' ? ' active' : ''}`} onClick={() => { setTab('programs'); setSearch('') }}>Programs</button>
            </div>

            <input
                className="admin-search-input"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tab === 'colleges' ? 'Search by college name or code' : 'Search by program name, code, or college'}
                aria-label={tab === 'colleges' ? 'Search colleges' : 'Search programs'}
                style={{ margin: '16px 0' }}
            />

            {error && <div className="admin-error-box">{error}</div>}

            {tab === 'colleges' ? (
                <>
                    <h2 style={{ fontSize: 17, marginBottom: 16 }}>Colleges</h2>

                    {showCollegeForm && collegeForm && (
                        <Modal
                            title="Edit College"
                            maxWidth={640}
                            onClose={() => { if (saving) return; setShowCollegeForm(false) }}
                        >
                            <div className="form-group" style={{ marginBottom: 14 }}>
                                <label className="form-label" htmlFor="college-name">Name</label>
                                <input id="college-name" className="form-input" title={collegeForm.college_name} value={collegeForm.college_name} onChange={(e) => setCollegeForm({ ...collegeForm, college_name: e.target.value })} disabled={saving} />
                            </div>

                            <div className="form-group" style={{ marginBottom: 14, maxWidth: 200 }}>
                                <label className="form-label" htmlFor="college-code">Code</label>
                                <input id="college-code" className="form-input" value={collegeForm.college_code} onChange={(e) => setCollegeForm({ ...collegeForm, college_code: e.target.value })} disabled={saving} />
                            </div>

                            <div className="form-group" style={{ marginBottom: 14 }}>
                                <label className="form-label" htmlFor="college-description">Description</label>
                                <textarea id="college-description" className="form-input" rows={2} value={collegeForm.description || ''} onChange={(e) => setCollegeForm({ ...collegeForm, description: e.target.value })} disabled={saving} />
                            </div>

                            <div style={{ display: 'flex', gap: 10 }}>
                                <button className="admin-primary-button" onClick={saveCollege} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                                <button className="admin-secondary-button" style={{ color: 'var(--red)', borderColor: 'var(--red)' }} onClick={() => setShowCollegeForm(false)}>Cancel</button>
                            </div>
                        </Modal>
                    )}

                    {loading ? (
                        <SkeletonList count={3} />
                    ) : visibleColleges.length === 0 ? (
                        <div className="admin-empty">
                            {query ? `No colleges matched "${search.trim()}".` : 'No colleges found.'}
                        </div>
                    ) : (
                        visibleColleges.map((c) => (
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
                                    {currentRole === 'registrar_head' && (
                                        <button className="admin-link-button" style={{ color: 'var(--red)' }} onClick={() => deleteCollege(c)}>
                                            Delete
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </>
            ) : (
                <>
                    <h2 style={{ fontSize: 17, marginBottom: 16 }}>Programs</h2>

                    {showProgramForm && programForm && (
                        <Modal
                            title="Edit Program"
                            maxWidth={640}
                            onClose={() => { if (saving) return; setShowProgramForm(false) }}
                        >
                            <div className="form-group" style={{ marginBottom: 14 }}>
                                <label className="form-label" htmlFor="program-college">College</label>
                                <select id="program-college" className="form-input" title={colleges.find((c) => c.college_id === programForm.college_id)?.college_name || ''} value={programForm.college_id} onChange={(e) => setProgramForm({ ...programForm, college_id: e.target.value })} disabled={saving}>
                                    <option value="">-- Select college --</option>
                                    {colleges.map((c) => (
                                        <option key={c.college_id} value={c.college_id}>{c.college_name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group" style={{ marginBottom: 14 }}>
                                <label className="form-label" htmlFor="program-name">Name</label>
                                <input id="program-name" className="form-input" title={programForm.program_name} value={programForm.program_name} onChange={(e) => setProgramForm({ ...programForm, program_name: e.target.value })} disabled={saving} />
                            </div>

                            <div className="admin-info-grid" style={{ marginBottom: 14 }}>
                                <div className="form-group">
                                    <label className="form-label" htmlFor="program-code">Code</label>
                                    <input id="program-code" className="form-input" value={programForm.program_code} onChange={(e) => setProgramForm({ ...programForm, program_code: e.target.value })} disabled={saving} />
                                </div>

                                <div className="form-group">
                                    <label className="form-label" htmlFor="program-degree-level">Degree Level</label>
                                    <input id="program-degree-level" className="form-input" value={programForm.degree_level || ''} onChange={(e) => setProgramForm({ ...programForm, degree_level: e.target.value })} disabled={saving} />
                                </div>

                                <div className="form-group">
                                    <label className="form-label" htmlFor="program-duration">Duration</label>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <input
                                            id="program-duration"
                                            className="form-input"
                                            type="number"
                                            min="0"
                                            step={programDurationUnit === 'months' ? 1 : 0.5}
                                            value={programForm.duration_years}
                                            onChange={(e) => setProgramForm({ ...programForm, duration_years: e.target.value })}
                                            disabled={saving}
                                            style={{ flex: 1, minWidth: 0 }}
                                        />
                                        <select
                                            className="form-input"
                                            style={{ width: 108, flexShrink: 0 }}
                                            value={programDurationUnit}
                                            onChange={(e) => {
                                                const nextUnit = e.target.value
                                                setProgramForm({ ...programForm, duration_years: convertDurationValue(programForm.duration_years, programDurationUnit, nextUnit) })
                                                setProgramDurationUnit(nextUnit)
                                            }}
                                            disabled={saving}
                                        >
                                            <option value="years">Years</option>
                                            <option value="months">Months</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 10 }}>
                                <button className="admin-primary-button" onClick={saveProgram} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                                <button className="admin-secondary-button" style={{ color: 'var(--red)', borderColor: 'var(--red)' }} onClick={() => setShowProgramForm(false)}>Cancel</button>
                            </div>
                        </Modal>
                    )}

                    {loading ? (
                        <SkeletonList count={3} />
                    ) : visiblePrograms.length === 0 ? (
                        <div className="admin-empty">
                            {query ? `No programs matched "${search.trim()}".` : 'No programs found.'}
                        </div>
                    ) : (
                        visiblePrograms.map((p) => (
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
                                    {currentRole === 'registrar_head' && (
                                        <button className="admin-link-button" style={{ color: 'var(--red)' }} onClick={() => deleteProgram(p)}>
                                            Delete
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </>
            )}

            {showAddModal && (
                <Modal
                    title="Add Academic Divisions & Programs"
                    maxWidth={640}
                    onClose={() => { if (addingBulk) return; setShowAddModal(false) }}
                >
                    <p style={{ fontSize: 13, color: 'var(--slate)', marginBottom: 16 }}>
                        Check off any colleges or programs to add. Selecting a program that isn't in the list
                        below yet requires its college to already exist.
                    </p>

                    <h3 style={{ fontSize: 14, marginBottom: 8 }}>Colleges</h3>
                    {availableColleges.length === 0 ? (
                        <div className="admin-empty" style={{ padding: '16px', marginBottom: 10 }}>
                            All known colleges have already been added.
                        </div>
                    ) : (
                        <div style={{ maxHeight: 160, overflowY: 'auto', marginBottom: 10, border: '1px solid var(--line)', borderRadius: 8, padding: '4px 12px' }}>
                            {availableColleges.map((c) => (
                                <label key={c.code} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', fontSize: 13.5, cursor: 'pointer' }}>
                                    <input type="checkbox" checked={selectedCollegeCodes.includes(c.code)} onChange={() => toggleCollegeSelection(c.code)} disabled={addingBulk} />
                                    {c.name}
                                </label>
                            ))}
                        </div>
                    )}

                    {!showCustomCollege ? (
                        <button type="button" className="admin-link-button" style={{ marginBottom: 18 }} onClick={() => setShowCustomCollege(true)}>
                            + Add a college not in this list
                        </button>
                    ) : (
                        <div className="admin-info-grid" style={{ marginBottom: 18, padding: 12, border: '1px dashed var(--line)', borderRadius: 8 }}>
                            <div className="form-group">
                                <label className="form-label" htmlFor="new-college-code">New College Code</label>
                                <input id="new-college-code" className="form-input" value={customCollege.code} onChange={(e) => setCustomCollege({ ...customCollege, code: e.target.value })} disabled={addingBulk} />
                            </div>
                            <div className="form-group">
                                <label className="form-label" htmlFor="new-college-name">New College Name</label>
                                <input id="new-college-name" className="form-input" value={customCollege.name} onChange={(e) => setCustomCollege({ ...customCollege, name: e.target.value })} disabled={addingBulk} />
                            </div>
                            <button type="button" className="admin-link-button" style={{ color: 'var(--slate)', gridColumn: '1 / -1' }} onClick={() => { setShowCustomCollege(false); setCustomCollege({ code: '', name: '' }) }} disabled={addingBulk}>
                                Cancel this one
                            </button>
                        </div>
                    )}

                    <h3 style={{ fontSize: 14, marginBottom: 8 }}>Programs</h3>
                    {availablePrograms.length === 0 ? (
                        <div className="admin-empty" style={{ padding: '16px', marginBottom: 18 }}>
                            All known programs have already been added.
                        </div>
                    ) : (
                        <div style={{ maxHeight: 240, overflowY: 'auto', marginBottom: 18, border: '1px solid var(--line)', borderRadius: 8, padding: '4px 12px' }}>
                            {HCDC_COLLEGES.map((college) => {
                                const collegePrograms = availablePrograms.filter((p) => p.collegeCode === college.code)
                                if (collegePrograms.length === 0) return null

                                return (
                                    <div key={college.code} style={{ padding: '8px 0' }}>
                                        <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--slate)', textTransform: 'uppercase', marginBottom: 4 }}>
                                            {college.name}
                                        </div>
                                        {collegePrograms.map((p) => (
                                            <label key={p.code} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', fontSize: 13.5, cursor: 'pointer' }}>
                                                <input type="checkbox" checked={selectedProgramCodes.includes(p.code)} onChange={() => toggleProgramSelection(p.code)} disabled={addingBulk} />
                                                {p.name}
                                            </label>
                                        ))}
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {!showCustomProgram ? (
                        <button type="button" className="admin-link-button" style={{ marginBottom: 18 }} onClick={() => setShowCustomProgram(true)}>
                            + Add a program not in this list
                        </button>
                    ) : (
                        <div className="admin-info-grid" style={{ marginBottom: 18, padding: 12, border: '1px dashed var(--line)', borderRadius: 8 }}>
                            <div className="form-group">
                                <label className="form-label" htmlFor="new-program-college">College</label>
                                <select id="new-program-college" className="form-input" value={customProgram.collegeId} onChange={(e) => setCustomProgram({ ...customProgram, collegeId: e.target.value })} disabled={addingBulk}>
                                    <option value="">-- Select college --</option>
                                    {customProgramCollegeChoices.map((c) => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label" htmlFor="new-program-code">New Program Code</label>
                                <input id="new-program-code" className="form-input" value={customProgram.code} onChange={(e) => setCustomProgram({ ...customProgram, code: e.target.value })} disabled={addingBulk} />
                            </div>
                            <div className="form-group">
                                <label className="form-label" htmlFor="new-program-name">New Program Name</label>
                                <input id="new-program-name" className="form-input" value={customProgram.name} onChange={(e) => setCustomProgram({ ...customProgram, name: e.target.value })} disabled={addingBulk} />
                            </div>
                            <div className="form-group">
                                <label className="form-label" htmlFor="new-program-degree-level">Degree Level</label>
                                <input id="new-program-degree-level" className="form-input" value={customProgram.degreeLevel} onChange={(e) => setCustomProgram({ ...customProgram, degreeLevel: e.target.value })} disabled={addingBulk} />
                            </div>
                            <div className="form-group">
                                <label className="form-label" htmlFor="new-program-duration">Duration</label>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <input
                                        id="new-program-duration"
                                        className="form-input"
                                        type="number"
                                        min="0"
                                        step={customDurationUnit === 'months' ? 1 : 0.5}
                                        value={customProgram.durationYears}
                                        onChange={(e) => setCustomProgram({ ...customProgram, durationYears: e.target.value })}
                                        disabled={addingBulk}
                                        style={{ flex: 1, minWidth: 0 }}
                                    />
                                    <select
                                        className="form-input"
                                        style={{ width: 108, flexShrink: 0 }}
                                        value={customDurationUnit}
                                        onChange={(e) => {
                                            const nextUnit = e.target.value
                                            setCustomProgram({ ...customProgram, durationYears: convertDurationValue(customProgram.durationYears, customDurationUnit, nextUnit) })
                                            setCustomDurationUnit(nextUnit)
                                        }}
                                        disabled={addingBulk}
                                    >
                                        <option value="years">Years</option>
                                        <option value="months">Months</option>
                                    </select>
                                </div>
                            </div>
                            <button type="button" className="admin-link-button" style={{ color: 'var(--slate)', gridColumn: '1 / -1' }} onClick={() => { setShowCustomProgram(false); setCustomProgram({ code: '', name: '', collegeId: '', degreeLevel: '', durationYears: '' }); setCustomDurationUnit('years') }} disabled={addingBulk}>
                                Cancel this one
                            </button>
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <button className="admin-primary-button" onClick={saveBulkAdd} disabled={addingBulk}>
                            {addingBulk ? 'Adding...' : `Add Selected (${totalSelectedCount})`}
                        </button>
                        <button className="admin-secondary-button" style={{ color: 'var(--red)', borderColor: 'var(--red)' }} onClick={() => setShowAddModal(false)} disabled={addingBulk}>Cancel</button>
                    </div>
                </Modal>
            )}
        </div>
    )
}

export default CollegesPrograms
