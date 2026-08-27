import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activityLog'
import '../auth/Auth.css'
import './AdminPages.css'

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
            alert('Document code and name are required.')
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
                const { error: updateError } = await supabase
                    .from('document_types')
                    .update(payload)
                    .eq('document_type_id', form.document_type_id)

                if (updateError) throw new Error(updateError.message)

                await logAdmin('edit_document_type', form.document_type_id, `Updated document type "${payload.document_name}".`)
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
            alert(err.message || 'Failed to save document type.')
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
            alert(err.message || 'Failed to update availability.')
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
            alert('Requirement name is required.')
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
            alert(err.message || 'Failed to add requirement.')
        }
    }

    const removeRequirement = async (requirement, documentTypeId) => {
        const confirmed = window.confirm(`Remove requirement "${requirement.requirement_name}"?`)
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
            alert(err.message || 'Failed to remove requirement.')
        }
    }

    return (
        <div>
            <div className="admin-page-header-row">
                <div>
                    <h1 style={{ fontSize: 26, marginBottom: 6 }}>Documents</h1>
                    <p>Manage document types, fees, processing times, and their requirements.</p>
                </div>

                <button className="admin-primary-button" onClick={openNewForm}>+ Add Document Type</button>
            </div>

            {showForm && (
                <div className="admin-card" style={{ marginTop: 20 }}>
                    <h2 style={{ fontSize: 16, marginBottom: 16 }}>
                        {form.document_type_id ? 'Edit Document Type' : 'New Document Type'}
                    </h2>

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
                </div>
            )}

            {error && <div className="admin-error-box" style={{ marginTop: 20 }}>{error}</div>}

            {loading ? (
                <p className="admin-loading">Loading document types...</p>
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
