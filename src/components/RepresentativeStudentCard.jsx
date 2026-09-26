import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { notifyError, notifySuccess, notifyWarning, confirmModal } from '../lib/notify'
import {
    ACCEPTED_TYPES, CLOSED_STATUSES, MAX_FILE_MB, RELATIONSHIPS, REPRESENTATIVE_BUCKET, REPRESENTATIVE_STATUS,
    loadRepresentative,
} from '../lib/claimRepresentatives'
import './Representative.css'

// Student side: authorize someone else to claim this request's document.
function RepresentativeStudentCard({ request }) {
    const [representative, setRepresentative] = useState(null)
    const [unavailable, setUnavailable] = useState(false)
    const [loaded, setLoaded] = useState(false)
    const [editing, setEditing] = useState(false)
    const [saving, setSaving] = useState(false)

    const [fullName, setFullName] = useState('')
    const [relationship, setRelationship] = useState('')
    const [contact, setContact] = useState('')
    const [letterFile, setLetterFile] = useState(null)
    const [idFile, setIdFile] = useState(null)

    const requestId = request?.request_id
    const closed = CLOSED_STATUSES.includes(request?.status)

    const refresh = async () => {
        try {
            const result = await loadRepresentative(requestId)
            setUnavailable(result.unavailable)
            setRepresentative(result.representative)
        } catch (err) {
            console.error('LOAD REPRESENTATIVE ERROR:', err)
        } finally {
            setLoaded(true)
        }
    }

    useEffect(() => {
        if (requestId) refresh()
    }, [requestId])

    if (!loaded || unavailable) return null
    if (closed && !representative) return null

    const startForm = () => {
        setFullName(representative?.full_name || '')
        setRelationship(representative?.relationship || '')
        setContact(representative?.contact_number || '')
        setLetterFile(null)
        setIdFile(null)
        setEditing(true)
    }

    const pickFile = (file, setter) => {
        if (!file) return setter(null)
        if (file.size > MAX_FILE_MB * 1024 * 1024) {
            notifyWarning(`Files must not exceed ${MAX_FILE_MB} MB.`)
            return setter(null)
        }
        setter(file)
    }

    const upload = async (file, kind) => {
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
        const path = `${request.student_id}/${requestId}/${kind}-${Date.now()}.${ext}`
        const { error } = await supabase.storage.from(REPRESENTATIVE_BUCKET).upload(path, file, { upsert: false })
        if (error) throw new Error(`Could not upload the ${kind === 'letter' ? 'authorization letter' : 'valid ID'}: ${error.message}`)
        return path
    }

    const submit = async (e) => {
        e.preventDefault()

        if (fullName.trim().length < 2) return notifyWarning("Please enter the representative's full name.")
        if (!relationship) return notifyWarning('Please choose their relationship to you.')
        if (!representative && (!letterFile || !idFile)) {
            return notifyWarning("Please upload both the signed authorization letter and the representative's valid ID.")
        }

        const uploaded = []
        try {
            setSaving(true)
            const letterPath = letterFile ? await upload(letterFile, 'letter') : representative.authorization_letter_path
            if (letterFile) uploaded.push(letterPath)
            const idPath = idFile ? await upload(idFile, 'id') : representative.valid_id_path
            if (idFile) uploaded.push(idPath)

            const row = {
                request_id: requestId,
                student_id: request.student_id,
                full_name: fullName.trim(),
                relationship,
                contact_number: contact.trim() || null,
                authorization_letter_path: letterPath,
                valid_id_path: idPath,
            }

            const { error } = representative
                ? await supabase.from('claim_representatives').update(row).eq('representative_id', representative.representative_id)
                : await supabase.from('claim_representatives').insert(row)

            if (error) throw new Error(error.message)

            // Replaced files are no longer needed.
            const stale = []
            if (representative && letterFile) stale.push(representative.authorization_letter_path)
            if (representative && idFile) stale.push(representative.valid_id_path)
            if (stale.length) await supabase.storage.from(REPRESENTATIVE_BUCKET).remove(stale)

            notifySuccess('Submitted. The Registrar will review your representative before they can claim.')
            setEditing(false)
            await refresh()
        } catch (err) {
            if (uploaded.length) await supabase.storage.from(REPRESENTATIVE_BUCKET).remove(uploaded)
            notifyError(err.message || 'Could not submit the representative.')
        } finally {
            setSaving(false)
        }
    }

    const remove = async () => {
        const confirmed = await confirmModal(
            `Remove ${representative.full_name} as your representative? You'll need to claim in person.`,
            { title: 'Remove representative?', confirmButtonText: 'Remove', icon: 'warning' }
        )
        if (!confirmed) return

        const { error } = await supabase.from('claim_representatives').delete().eq('representative_id', representative.representative_id)
        if (error) return notifyError('Could not remove the representative: ' + error.message)

        await supabase.storage.from(REPRESENTATIVE_BUCKET).remove([representative.authorization_letter_path, representative.valid_id_path])
        setRepresentative(null)
    }

    const status = representative ? REPRESENTATIVE_STATUS[representative.status] || REPRESENTATIVE_STATUS.pending : null

    return (
        <div className="student-card rep-card">
            <div className="rep-head">
                <div>
                    <h2 style={{ fontSize: 16, marginBottom: 4 }}>Claiming Representative</h2>
                    <p className="rep-sub">Can’t claim in person? Authorize someone to claim this document for you.</p>
                </div>
                {status && <span className={`rep-status is-${status.tone}`}>{status.label}</span>}
            </div>

            {!editing && !representative && (
                <>
                    <ul className="rep-steps">
                        <li>Write an <strong>authorization letter</strong> naming your representative and this document, and sign it.</li>
                        <li>Upload a photo or scan of the letter and of your representative’s <strong>valid ID</strong>.</li>
                        <li>Once approved, they bring the <strong>original signed letter</strong> and their <strong>valid ID</strong> when claiming.</li>
                    </ul>
                    <button type="button" className="auth-submit rep-button" onClick={startForm}>
                        Add a representative
                    </button>
                </>
            )}

            {!editing && representative && (
                <>
                    <div className="rep-details">
                        <div><span>Name</span><strong>{representative.full_name}</strong></div>
                        <div><span>Relationship</span><strong>{representative.relationship}</strong></div>
                        <div><span>Contact</span><strong>{representative.contact_number || '—'}</strong></div>
                    </div>

                    {representative.status === 'approved' && (
                        <p className="rep-callout is-approved">
                            {representative.full_name} may claim this document for you. They must bring the original signed
                            authorization letter and their valid ID.
                        </p>
                    )}
                    {representative.status === 'pending' && (
                        <p className="rep-callout">The Registrar is reviewing the letter and ID. You’ll be notified once it’s checked.</p>
                    )}
                    {representative.status === 'rejected' && (
                        <p className="rep-callout is-rejected">
                            Not approved{representative.review_note ? `: ${representative.review_note}` : '.'} Update the details or files and submit again.
                        </p>
                    )}

                    {!closed && (
                        <div className="rep-actions">
                            <button type="button" className="rep-link" onClick={startForm}>Change details or files</button>
                            <button type="button" className="rep-link is-danger" onClick={remove}>Remove representative</button>
                        </div>
                    )}
                </>
            )}

            {editing && (
                <form className="rep-form" onSubmit={submit}>
                    <div className="rep-grid">
                        <label className="rep-field">
                            <span>Representative’s full name *</span>
                            <input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} required disabled={saving} />
                        </label>
                        <label className="rep-field">
                            <span>Relationship to you *</span>
                            <select value={relationship} onChange={(e) => setRelationship(e.target.value)} required disabled={saving}>
                                <option value="">Select…</option>
                                {RELATIONSHIPS.map((r) => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </label>
                        <label className="rep-field">
                            <span>Contact number</span>
                            <input value={contact} onChange={(e) => setContact(e.target.value)} maxLength={30} inputMode="tel" disabled={saving} />
                        </label>
                    </div>

                    <div className="rep-grid">
                        <label className="rep-field">
                            <span>Signed authorization letter {representative ? '(leave empty to keep)' : '*'}</span>
                            <input type="file" accept={ACCEPTED_TYPES} onChange={(e) => pickFile(e.target.files?.[0], setLetterFile)} disabled={saving} />
                        </label>
                        <label className="rep-field">
                            <span>Representative’s valid ID {representative ? '(leave empty to keep)' : '*'}</span>
                            <input type="file" accept={ACCEPTED_TYPES} onChange={(e) => pickFile(e.target.files?.[0], setIdFile)} disabled={saving} />
                        </label>
                    </div>
                    <p className="rep-sub">JPG, PNG or PDF, up to {MAX_FILE_MB} MB each.</p>

                    <div className="rep-actions">
                        <button type="submit" className="auth-submit rep-button" disabled={saving}>
                            {saving ? 'Submitting…' : 'Submit for review'}
                        </button>
                        <button type="button" className="rep-link" onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
                    </div>
                </form>
            )}
        </div>
    )
}

export default RepresentativeStudentCard
