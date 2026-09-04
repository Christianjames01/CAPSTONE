import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activityLog'
import { describeChanges } from '../../lib/describeChanges'
import { exportToExcel } from '../../lib/excelExport'
import { parseExcelFile } from '../../lib/excelImport'
import { notifyError, notifyWarning, confirmModal } from '../../lib/notify'
import { SkeletonList } from '../../components/Skeleton'
import Modal from '../../components/Modal'
import '../auth/Auth.css'
import './AdminPages.css'

const IMPORT_COLUMNS = [
    { header: 'document_code', key: 'document_code', width: 16 },
    { header: 'document_name', key: 'document_name', width: 34 },
    { header: 'category', key: 'category', width: 20 },
    { header: 'description', key: 'description', width: 40 },
    { header: 'fee', key: 'fee', width: 12 },
    { header: 'processing_days_min', key: 'processing_days_min', width: 18 },
    { header: 'processing_days_max', key: 'processing_days_max', width: 18 },
    { header: 'is_available', key: 'is_available', width: 14 },
]

const EMPTY_FORM = {
    document_type_id: null,
    document_code: '',
    document_name: '',
    category: '',
    description: '',
    fee: '',
    processing_days_min: '',
    processing_days_max: '',
    is_available: true,
}

function Documents() {
    const [documents, setDocuments] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)

    const [form, setForm] = useState(EMPTY_FORM)
    const [showForm, setShowForm] = useState(false)

    const [expandedId, setExpandedId] = useState(null)
    const [requirements, setRequirements] = useState([])
    const [newRequirement, setNewRequirement] = useState({ requirement_name: '', description: '', is_required: true, accepted_file_types: '', max_file_size_mb: 5 })

    const [importing, setImporting] = useState(false)
    const [importSummary, setImportSummary] = useState(null)

    useEffect(() => {
        loadDocuments()
    }, [])

    const loadDocuments = async () => {
        try {
            setLoading(true)
            setError('')

            const { data, error: loadError } = await supabase
                .from('document_types')
                .select('document_type_id, document_code, document_name, category, description, fee, processing_days_min, processing_days_max, is_available')
                .order('document_name')

            if (loadError) {
                throw new Error('Failed to load document types: ' + loadError.message)
            }

            setDocuments(data || [])

        } catch (err) {
            console.error('DOCUMENTS ERROR:', err)
            setError(err.message || 'Failed to load document types.')
        } finally {
            setLoading(false)
        }
    }

    const logAdmin = async (action, recordId, description) => {
        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) return

        await logActivity({ userId: user.id, action, tableName: 'document_types', recordId, description })
    }

    const downloadImportTemplate = async () => {
        await exportToExcel('document-types-template', [
            {
                name: 'Document Types',
                columns: IMPORT_COLUMNS,
                rows: [
                    {
                        document_code: 'TOR',
                        document_name: 'Transcript of Records',
                        category: 'Academic Records',
                        description: 'Official record of courses taken and grades earned.',
                        fee: '150',
                        processing_days_min: '5',
                        processing_days_max: '10',
                        is_available: 'yes',
                    },
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

            let added = 0
            let updated = 0
            const failed = []

            for (const row of rows) {
                const code = (row.document_code || '').trim()
                const name = (row.document_name || '').trim()

                if (!code || !name) {
                    failed.push(`Row missing document_code/document_name: ${JSON.stringify(row)}`)
                    continue
                }

                const payload = {
                    document_code: code,
                    document_name: name,
                    category: row.category?.trim() || null,
                    description: row.description?.trim() || null,
                    fee: row.fee ? Number(row.fee) : 0,
                    processing_days_min: row.processing_days_min ? Number(row.processing_days_min) : null,
                    processing_days_max: row.processing_days_max ? Number(row.processing_days_max) : null,
                    is_available: !['no', 'false', '0'].includes((row.is_available || '').toLowerCase()),
                }

                const { data: existing } = await supabase
                    .from('document_types')
                    .select('document_type_id')
                    .eq('document_code', code)
                    .maybeSingle()

                if (existing) {
                    const { error: updateError } = await supabase
                        .from('document_types')
                        .update(payload)
                        .eq('document_type_id', existing.document_type_id)

                    if (updateError) {
                        failed.push(`${code}: ${updateError.message}`)
                    } else {
                        updated++
                    }
                } else {
                    const { error: insertError } = await supabase
                        .from('document_types')
                        .insert(payload)

                    if (insertError) {
                        failed.push(`${code}: ${insertError.message}`)
                    } else {
                        added++
                    }
                }
            }

            if (user) {
                await logActivity({
                    userId: user.id,
                    action: 'import_document_types',
                    tableName: 'document_types',
                    description: `Imported document types from CSV: ${added} added, ${updated} updated, ${failed.length} failed.`,
                })
            }

            setImportSummary({ added, updated, failed })
            await loadDocuments()

        } catch (err) {
            console.error('IMPORT ERROR:', err)
            notifyError(err.message || 'Failed to import file.')
        } finally {
            setImporting(false)
        }
    }

    const openNewForm = () => {
        setForm(EMPTY_FORM)
        setShowForm(true)
    }

    const openEditForm = (doc) => {
        setForm({
            document_type_id: doc.document_type_id,
            document_code: doc.document_code,
            document_name: doc.document_name,
            category: doc.category || '',
            description: doc.description || '',
            fee: doc.fee ?? '',
            processing_days_min: doc.processing_days_min ?? '',
            processing_days_max: doc.processing_days_max ?? '',
            is_available: doc.is_available,
        })
        setShowForm(true)
    }

    const saveDocument = async () => {
        if (!form.document_code.trim() || !form.document_name.trim()) {
            notifyWarning('Document code and name are required.')
            return
        }

        try {
            setSaving(true)

            const payload = {
                document_code: form.document_code.trim(),
                document_name: form.document_name.trim(),
                category: form.category.trim() || null,
                description: form.description.trim() || null,
                fee: form.fee === '' ? 0 : Number(form.fee),
                processing_days_min: form.processing_days_min === '' ? null : Number(form.processing_days_min),
                processing_days_max: form.processing_days_max === '' ? null : Number(form.processing_days_max),
                is_available: form.is_available,
            }

            if (form.document_type_id) {
                const original = documents.find((d) => d.document_type_id === form.document_type_id)

                const { error: updateError } = await supabase
                    .from('document_types')
                    .update(payload)
                    .eq('document_type_id', form.document_type_id)

                if (updateError) throw new Error(updateError.message)

                const docChanges = describeChanges([
                    ['name', original?.document_name, payload.document_name],
                    ['fee', original ? `₱${Number(original.fee || 0).toFixed(2)}` : '', `₱${Number(payload.fee || 0).toFixed(2)}`],
                    ['category', original?.category, payload.category],
                ])

                const { data: updatedRequests, error: propagateError } = await supabase
                    .from('document_requests')
                    .update({ unit_fee: payload.fee })
                    .eq('document_type_id', form.document_type_id)
                    .in('status', ['pending', 'payment_pending'])
                    .select('request_id')

                if (propagateError) {
                    console.error('FEE PROPAGATION ERROR:', propagateError)
                }

                await logAdmin(
                    'edit_document_type',
                    form.document_type_id,
                    `Updated document type "${payload.document_name}".` +
                        (docChanges ? ` ${docChanges}.` : '') +
                        (updatedRequests?.length
                            ? ` Applied new fee to ${updatedRequests.length} unpaid request${updatedRequests.length === 1 ? '' : 's'}.`
                            : '')
                )
            } else {
                const { data, error: insertError } = await supabase
                    .from('document_types')
                    .insert(payload)
                    .select()
                    .single()

                if (insertError) throw new Error(insertError.message)

                await logAdmin('add_document_type', data.document_type_id, `Added document type "${payload.document_name}".`)
            }

            setShowForm(false)
            setForm(EMPTY_FORM)
            await loadDocuments()

        } catch (err) {
            console.error('SAVE DOCUMENT ERROR:', err)
            notifyError(err.message || 'Failed to save document type.')
        } finally {
            setSaving(false)
        }
    }

    const toggleAvailability = async (doc) => {
        try {
            const { error: updateError } = await supabase
                .from('document_types')
                .update({ is_available: !doc.is_available })
                .eq('document_type_id', doc.document_type_id)

            if (updateError) throw new Error(updateError.message)

            await logAdmin(
                doc.is_available ? 'disable_document_type' : 'enable_document_type',
                doc.document_type_id,
                `${doc.is_available ? 'Disabled' : 'Enabled'} document type "${doc.document_name}".`
            )

            await loadDocuments()

        } catch (err) {
            console.error('TOGGLE AVAILABILITY ERROR:', err)
            notifyError(err.message || 'Failed to update availability.')
        }
    }

    const loadRequirements = async (documentTypeId) => {
        if (expandedId === documentTypeId) {
            setExpandedId(null)
            return
        }

        setExpandedId(documentTypeId)

        const { data, error: reqError } = await supabase
            .from('document_requirements')
            .select('requirement_id, requirement_name, description, is_required, accepted_file_types, max_file_size_mb')
            .eq('document_type_id', documentTypeId)
            .order('requirement_name')

        if (reqError) {
            console.error('REQUIREMENTS LOAD ERROR:', reqError)
            setRequirements([])
            return
        }

        setRequirements(data || [])
    }

    const addRequirement = async (documentTypeId) => {
        if (!newRequirement.requirement_name.trim()) {
            notifyWarning('Requirement name is required.')
            return
        }

        try {
            const { error: insertError } = await supabase
                .from('document_requirements')
                .insert({
                    document_type_id: documentTypeId,
                    requirement_name: newRequirement.requirement_name.trim(),
                    description: newRequirement.description.trim() || null,
                    is_required: newRequirement.is_required,
                    accepted_file_types: newRequirement.accepted_file_types.trim() || null,
                    max_file_size_mb: Number(newRequirement.max_file_size_mb) || 5,
                })

            if (insertError) throw new Error(insertError.message)

            await logAdmin('add_document_requirement', documentTypeId, `Added requirement "${newRequirement.requirement_name.trim()}".`)

            setNewRequirement({ requirement_name: '', description: '', is_required: true, accepted_file_types: '', max_file_size_mb: 5 })

            const { data } = await supabase
                .from('document_requirements')
                .select('requirement_id, requirement_name, description, is_required, accepted_file_types, max_file_size_mb')
                .eq('document_type_id', documentTypeId)
                .order('requirement_name')
            setRequirements(data || [])

        } catch (err) {
            console.error('ADD REQUIREMENT ERROR:', err)
            notifyError(err.message || 'Failed to add requirement.')
        }
    }

    const removeRequirement = async (requirement, documentTypeId) => {
        const confirmed = await confirmModal(`Remove requirement "${requirement.requirement_name}"?`)
        if (!confirmed) return

        try {
            const { error: deleteError } = await supabase
                .from('document_requirements')
                .delete()
                .eq('requirement_id', requirement.requirement_id)

            if (deleteError) throw new Error(deleteError.message)

            await logAdmin('remove_document_requirement', documentTypeId, `Removed requirement "${requirement.requirement_name}".`)

            const { data } = await supabase
                .from('document_requirements')
                .select('requirement_id, requirement_name, description, is_required, accepted_file_types, max_file_size_mb')
                .eq('document_type_id', documentTypeId)
                .order('requirement_name')
            setRequirements(data || [])

        } catch (err) {
            console.error('REMOVE REQUIREMENT ERROR:', err)
            notifyError(err.message || 'Failed to remove requirement.')
        }
    }

    return (
        <div>
            <div className="admin-page-header-row">
                <div>
                    <h1 style={{ fontSize: 26, marginBottom: 6 }}>Documents</h1>
                    <p>Manage document types, fees, processing times, and their requirements.</p>
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button className="admin-link-button" onClick={downloadImportTemplate}>
                        Download Excel template
                    </button>

                    <input
                        id="document-import-input"
                        type="file"
                        accept=".xlsx"
                        style={{ display: 'none' }}
                        onChange={handleImportFile}
                        disabled={importing}
                    />

                    <button
                        className="admin-secondary-button"
                        onClick={() => document.getElementById('document-import-input').click()}
                        disabled={importing}
                    >
                        {importing ? 'Importing...' : '⬆ Import Excel'}
                    </button>

                    <button className="admin-primary-button" onClick={openNewForm}>+ Add Document Type</button>
                </div>
            </div>

            {importSummary && (
                <div className="admin-card" style={{ marginTop: 16 }}>
                    <h2 style={{ fontSize: 15, marginBottom: 8 }}>Import Complete</h2>
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

            {showForm && (
                <Modal
                    title={form.document_type_id ? 'Edit Document Type' : 'New Document Type'}
                    maxWidth={640}
                    onClose={() => { if (saving) return; setShowForm(false); setForm(EMPTY_FORM) }}
                >
                    <div className="admin-info-grid" style={{ marginBottom: 16 }}>
                        <div className="form-group">
                            <label className="form-label">Code</label>
                            <input className="form-input" value={form.document_code} onChange={(e) => setForm({ ...form, document_code: e.target.value })} disabled={saving} />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Name</label>
                            <input className="form-input" value={form.document_name} onChange={(e) => setForm({ ...form, document_name: e.target.value })} disabled={saving} />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Category</label>
                            <input className="form-input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} disabled={saving} />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Fee (₱)</label>
                            <input className="form-input" type="number" min="0" step="0.01" value={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.value })} disabled={saving} />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Processing Days (Min)</label>
                            <input className="form-input" type="number" min="0" value={form.processing_days_min} onChange={(e) => setForm({ ...form, processing_days_min: e.target.value })} disabled={saving} />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Processing Days (Max)</label>
                            <input className="form-input" type="number" min="0" value={form.processing_days_max} onChange={(e) => setForm({ ...form, processing_days_max: e.target.value })} disabled={saving} />
                        </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: 16 }}>
                        <label className="form-label">Description</label>
                        <textarea className="form-input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} disabled={saving} />
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, marginBottom: 16 }}>
                        <input type="checkbox" checked={form.is_available} onChange={(e) => setForm({ ...form, is_available: e.target.checked })} />
                        Available for students to request
                    </label>

                    <div style={{ display: 'flex', gap: 10 }}>
                        <button className="admin-primary-button" onClick={saveDocument} disabled={saving}>
                            {saving ? 'Saving...' : 'Save'}
                        </button>
                        <button className="admin-link-button" style={{ color: 'var(--slate)' }} onClick={() => setShowForm(false)} disabled={saving}>
                            Cancel
                        </button>
                    </div>
                </Modal>
            )}

            {error && <div className="admin-error-box" style={{ marginTop: 20 }}>{error}</div>}

            {loading ? (
                <SkeletonList count={3} />
            ) : (
                documents.map((doc) => (
                    <div className="admin-list-card" key={doc.document_type_id} style={{ marginTop: 16 }}>
                        <div className="admin-list-card-header">
                            <div>
                                <h3>{doc.document_name}</h3>
                                <p>{doc.document_code} · {doc.category || 'Uncategorized'}</p>
                            </div>

                            <span className={`admin-status-pill status-${doc.is_available ? 'active' : 'inactive'}`}>
                                {doc.is_available ? 'Available' : 'Unavailable'}
                            </span>
                        </div>

                        <div className="admin-info-grid">
                            <div className="admin-info-field">
                                <span>Fee</span>
                                <strong>₱{Number(doc.fee || 0).toFixed(2)}</strong>
                            </div>

                            <div className="admin-info-field">
                                <span>Processing Time</span>
                                <strong>
                                    {doc.processing_days_min && doc.processing_days_max
                                        ? `${doc.processing_days_min}–${doc.processing_days_max} days`
                                        : 'Not set'}
                                </strong>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 16 }}>
                            <button className="admin-link-button" onClick={() => openEditForm(doc)}>Edit</button>
                            <button className="admin-link-button" onClick={() => toggleAvailability(doc)}>
                                {doc.is_available ? 'Mark unavailable' : 'Mark available'}
                            </button>
                            <button className="admin-link-button" onClick={() => loadRequirements(doc.document_type_id)}>
                                {expandedId === doc.document_type_id ? 'Hide requirements' : 'Manage requirements'}
                            </button>
                        </div>

                        {expandedId === doc.document_type_id && (
                            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 16, marginTop: 4 }}>
                                {requirements.length === 0 ? (
                                    <p style={{ fontSize: 13, color: 'var(--slate)', marginBottom: 14 }}>No requirements set.</p>
                                ) : (
                                    <div style={{ marginBottom: 14 }}>
                                        {requirements.map((r) => (
                                            <div key={r.requirement_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                                                <div>
                                                    <strong style={{ fontSize: 13.5 }}>{r.requirement_name}</strong>
                                                    <span style={{ fontSize: 12, color: 'var(--slate)', marginLeft: 8 }}>
                                                        {r.is_required ? 'Required' : 'Optional'}
                                                    </span>
                                                </div>
                                                <button className="admin-link-button" style={{ color: 'var(--red)' }} onClick={() => removeRequirement(r, doc.document_type_id)}>
                                                    Remove
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                                    <input
                                        className="admin-search-input"
                                        style={{ maxWidth: 220 }}
                                        placeholder="Requirement name"
                                        value={newRequirement.requirement_name}
                                        onChange={(e) => setNewRequirement({ ...newRequirement, requirement_name: e.target.value })}
                                    />

                                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                                        <input
                                            type="checkbox"
                                            checked={newRequirement.is_required}
                                            onChange={(e) => setNewRequirement({ ...newRequirement, is_required: e.target.checked })}
                                        />
                                        Required
                                    </label>

                                    <button className="admin-primary-button" onClick={() => addRequirement(doc.document_type_id)}>
                                        Add requirement
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))
            )}
        </div>
    )
}

export default Documents
