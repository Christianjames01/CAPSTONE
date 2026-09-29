import { useEffect, useState } from 'react'
import Swal from 'sweetalert2'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activityLog'
import { notifyError, confirmModal } from '../lib/notify'
import { formatDisplayDateTime } from '../lib/formatDate'
import { useLiveRefresh } from '../lib/useLiveRefresh'
import {
    FILE_STATUS, REPRESENTATIVE_FILES, REPRESENTATIVE_STATUS, fileNoteOf, fileStatusOf, hasFileReview,
    loadRepresentative, loadRepresentativeRemovals, signedFileUrl,
} from '../lib/claimRepresentatives'
import DocumentPreviewModal from './DocumentPreviewModal'
import './Representative.css'

// Staff side (head and employees): review the student's authorized
// representative -- the signed letter and the valid ID each approved or
// rejected on their own -- and see who is allowed to claim.
function RepresentativeStaffCard({ request, cardClassName }) {
    const [representative, setRepresentative] = useState(null)
    // Representatives the student removed (newest first).
    const [removals, setRemovals] = useState([])
    const [loaded, setLoaded] = useState(false)
    const [saving, setSaving] = useState(false)
    const [preview, setPreview] = useState({ url: null, name: '' })

    const requestId = request?.request_id

    const refresh = async () => {
        try {
            const [result, removed] = await Promise.all([
                loadRepresentative(requestId),
                loadRepresentativeRemovals(requestId),
            ])
            setRepresentative(result.representative)
            setRemovals(removed)
        } catch (err) {
            console.error('LOAD REPRESENTATIVE ERROR:', err)
        } finally {
            setLoaded(true)
        }
    }

    useEffect(() => {
        if (requestId) refresh()
    }, [requestId])

    useLiveRefresh(['claim_representatives', 'claim_representative_removals'], refresh)

    if (!loaded) return null

    const removedLine = (removal) => (
        <>
            The student removed <strong>{removal.full_name}</strong>
            {removal.relationship ? ` (${removal.relationship})` : ''} as their representative on{' '}
            {formatDisplayDateTime(removal.removed_at)}.
        </>
    )

    // No representative now, but the student removed one: say so.
    if (!representative) {
        if (removals.length === 0) return null
        return (
            <div className={`${cardClassName} rep-card`}>
                <div className="rep-head">
                    <div>
                        <h2 style={{ fontSize: 16, marginBottom: 4 }}>Authorized Representative</h2>
                        <p className="rep-sub">The student no longer has a representative for this request.</p>
                    </div>
                    <span className="rep-status is-rejected">Removed</span>
                </div>
                <p className="rep-callout is-rejected">
                    {removedLine(removals[0])} Only the student can claim this document unless they add a new representative.
                </p>
                {removals.length > 1 && (
                    <ul className="rep-removals">
                        {removals.slice(1).map((removal) => <li key={removal.removal_id}>{removedLine(removal)}</li>)}
                    </ul>
                )}
            </div>
        )
    }

    const perFile = hasFileReview(representative)

    const openFile = async (path, name) => {
        try {
            setPreview({ url: await signedFileUrl(path), name })
        } catch (err) {
            notifyError('Could not open the file: ' + err.message)
        }
    }

    const save = async (changes, action, description) => {
        try {
            setSaving(true)
            const { data, error } = await supabase
                .from('claim_representatives')
                .update(changes)
                .eq('representative_id', representative.representative_id)
                .select('representative_id')

            if (error || !data?.length) throw new Error(error?.message || 'The review was not saved.')

            const { data: { user } } = await supabase.auth.getUser()
            await logActivity({
                userId: user?.id,
                action,
                tableName: 'claim_representatives',
                recordId: requestId,
                description,
            })

            await refresh()
        } catch (err) {
            notifyError('Could not save the review: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    const askReason = async (what) => {
        const { value, isConfirmed } = await Swal.fire({
            title: `Reject the ${what}?`,
            input: 'textarea',
            inputLabel: 'Reason (shown to the student)',
            inputPlaceholder: 'e.g. The letter is not signed / the ID photo is blurry',
            inputAttributes: { maxlength: 500 },
            showCancelButton: true,
            confirmButtonText: 'Reject',
            confirmButtonColor: '#C8102E',
            inputValidator: (v) => (!v || !v.trim() ? 'Please give a reason.' : undefined),
        })
        return isConfirmed ? value.trim() : null
    }

    // One file: approve, or reject with a reason.
    const reviewFile = async (file, status) => {
        let note = null
        if (status === 'rejected') {
            note = await askReason(file.short)
            if (!note) return
        } else {
            const confirmed = await confirmModal(
                file.key === 'letter'
                    ? 'Approve the authorization letter? Make sure it is signed by the student and names this representative and document.'
                    : `Approve ${representative.full_name}’s valid ID? Make sure it is readable and matches the name.`,
                { title: `Approve the ${file.short}?`, confirmButtonText: 'Approve', icon: 'question' }
            )
            if (!confirmed) return
        }

        await save(
            { [file.statusKey]: status, [file.noteKey]: note },
            status === 'approved' ? `approve_representative_${file.key}` : `reject_representative_${file.key}`,
            `${status === 'approved' ? 'Approved' : 'Rejected'} the ${file.short} of ${representative.full_name} (representative) for "${request.request_number}".${note ? ` Reason: ${note}` : ''}`
        )
    }

    const approveBoth = async () => {
        const confirmed = await confirmModal(
            `Approve ${representative.full_name} to claim ${request.request_number}? Make sure the letter is signed by the student and the ID is valid.`,
            { title: 'Approve both files?', confirmButtonText: 'Approve', icon: 'question' }
        )
        if (!confirmed) return
        await save(
            perFile ? { letter_status: 'approved', letter_note: null, id_status: 'approved', id_note: null } : { status: 'approved', review_note: null },
            'approve_representative',
            `Approved ${representative.full_name} as representative for "${request.request_number}".`
        )
    }

    // Before the per-file migration: the old whole-representative review.
    const rejectWhole = async () => {
        const note = await askReason('representative')
        if (!note) return
        await save({ status: 'rejected', review_note: note }, 'reject_representative',
            `Did not approve ${representative.full_name} as representative for "${request.request_number}". Reason: ${note}`)
    }

    const status = REPRESENTATIVE_STATUS[representative.status] || REPRESENTATIVE_STATUS.pending
    const allApproved = REPRESENTATIVE_FILES.every((f) => fileStatusOf(representative, f) === 'approved')

    return (
        <div className={`${cardClassName} rep-card${representative.status === 'approved' ? ' is-approved' : ''}`}>
            <div className="rep-head">
                <div>
                    <h2 style={{ fontSize: 16, marginBottom: 4 }}>Authorized Representative</h2>
                    <p className="rep-sub">
                        The student authorized someone else to claim this document.
                        {' '}Submitted {formatDisplayDateTime(representative.updated_at || representative.created_at)}.
                    </p>
                </div>
                <span className={`rep-status is-${status.tone}`}>{status.label}</span>
            </div>

            <div className="rep-details">
                <div><span>Name</span><strong>{representative.full_name}</strong></div>
                <div><span>Relationship</span><strong>{representative.relationship}</strong></div>
                <div><span>Contact</span><strong>{representative.contact_number || '—'}</strong></div>
            </div>

            <ul className="rep-file-list">
                {REPRESENTATIVE_FILES.map((file) => {
                    const fileStatus = fileStatusOf(representative, file)
                    const note = fileNoteOf(representative, file)
                    const pill = FILE_STATUS[fileStatus] || FILE_STATUS.pending
                    return (
                        <li key={file.key} className={`rep-file-row is-${pill.tone}`}>
                            <div className="rep-file-main">
                                <strong>{file.label}</strong>
                                <span className={`rep-status is-${pill.tone}`}>{pill.label}</span>
                                {fileStatus === 'rejected' && note && <p className="rep-file-note">Reason: {note}</p>}
                            </div>
                            <div className="rep-file-actions">
                                <button
                                    type="button"
                                    className="rep-file"
                                    onClick={() => openFile(representative[file.pathKey], file.key === 'id' ? `${representative.full_name} — valid ID` : 'Authorization letter')}
                                >
                                    View
                                </button>
                                {perFile && fileStatus !== 'approved' && (
                                    <button type="button" className="rep-approve" onClick={() => reviewFile(file, 'approved')} disabled={saving}>
                                        Approve
                                    </button>
                                )}
                                {perFile && fileStatus !== 'rejected' && (
                                    <button type="button" className="rep-link is-danger" onClick={() => reviewFile(file, 'rejected')} disabled={saving}>
                                        {fileStatus === 'approved' ? 'Revoke' : 'Reject'}
                                    </button>
                                )}
                            </div>
                        </li>
                    )
                })}
            </ul>

            {representative.status === 'approved' && (
                <p className="rep-callout is-approved">
                    <strong>{representative.full_name}</strong> may claim this document. At the window, check the original signed
                    letter and that their valid ID matches.
                </p>
            )}
            {representative.status === 'rejected' && (
                <p className="rep-callout is-rejected">
                    Waiting for the student to replace the rejected {REPRESENTATIVE_FILES.filter((f) => fileStatusOf(representative, f) === 'rejected').map((f) => f.short).join(' and ') || 'file'}.
                </p>
            )}

            <div className="rep-actions">
                {(perFile ? REPRESENTATIVE_FILES.every((f) => fileStatusOf(representative, f) === 'pending') : !allApproved) && (
                    <button type="button" className="rep-approve" onClick={approveBoth} disabled={saving}>
                        {perFile ? 'Approve both' : 'Approve'}
                    </button>
                )}
                {!perFile && representative.status !== 'rejected' && (
                    <button type="button" className="rep-link is-danger" onClick={rejectWhole} disabled={saving}>
                        {representative.status === 'approved' ? 'Revoke approval' : 'Not approve'}
                    </button>
                )}
            </div>

            {removals.length > 0 && (
                <div className="rep-removals-block">
                    <span>Earlier removed by the student</span>
                    <ul className="rep-removals">
                        {removals.map((removal) => <li key={removal.removal_id}>{removedLine(removal)}</li>)}
                    </ul>
                </div>
            )}

            <DocumentPreviewModal url={preview.url} fileName={preview.name} onClose={() => setPreview({ url: null, name: '' })} />
        </div>
    )
}

export default RepresentativeStaffCard
