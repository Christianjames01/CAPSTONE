import { useEffect, useState } from 'react'
import Swal from 'sweetalert2'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activityLog'
import { notifyError, confirmModal } from '../lib/notify'
import { formatDisplayDateTime } from '../lib/formatDate'
import { useLiveRefresh } from '../lib/useLiveRefresh'
import { REPRESENTATIVE_STATUS, loadRepresentative, signedFileUrl } from '../lib/claimRepresentatives'
import DocumentPreviewModal from './DocumentPreviewModal'
import './Representative.css'

// Staff side (head and employees): review the student's authorized
// representative and see who is allowed to claim.
function RepresentativeStaffCard({ request, cardClassName }) {
    const [representative, setRepresentative] = useState(null)
    const [loaded, setLoaded] = useState(false)
    const [saving, setSaving] = useState(false)
    const [preview, setPreview] = useState({ url: null, name: '' })

    const requestId = request?.request_id

    const refresh = async () => {
        try {
            const result = await loadRepresentative(requestId)
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

    useLiveRefresh(['claim_representatives'], refresh)

    if (!loaded || !representative) return null

    const openFile = async (path, name) => {
        try {
            setPreview({ url: await signedFileUrl(path), name })
        } catch (err) {
            notifyError('Could not open the file: ' + err.message)
        }
    }

    const review = async (status) => {
        let note = null

        if (status === 'rejected') {
            const { value, isConfirmed } = await Swal.fire({
                title: 'Not approve this representative?',
                input: 'textarea',
                inputLabel: 'Reason (shown to the student)',
                inputPlaceholder: 'e.g. The letter is not signed / the ID is unreadable',
                inputAttributes: { maxlength: 500 },
                showCancelButton: true,
                confirmButtonText: 'Not approve',
                confirmButtonColor: '#C8102E',
                inputValidator: (v) => (!v || !v.trim() ? 'Please give a reason.' : undefined),
            })
            if (!isConfirmed) return
            note = value.trim()
        } else {
            const confirmed = await confirmModal(
                `Approve ${representative.full_name} to claim ${request.request_number}? Make sure the letter is signed by the student and the ID is valid.`,
                { title: 'Approve representative?', confirmButtonText: 'Approve', icon: 'question' }
            )
            if (!confirmed) return
        }

        try {
            setSaving(true)
            const { data, error } = await supabase
                .from('claim_representatives')
                .update({ status, review_note: note })
                .eq('representative_id', representative.representative_id)
                .select('representative_id')

            if (error || !data?.length) throw new Error(error?.message || 'The review was not saved.')

            const { data: { user } } = await supabase.auth.getUser()
            await logActivity({
                userId: user?.id,
                action: status === 'approved' ? 'approve_representative' : 'reject_representative',
                tableName: 'claim_representatives',
                recordId: requestId,
                description: `${status === 'approved' ? 'Approved' : 'Did not approve'} ${representative.full_name} as representative for "${request.request_number}".`,
            })

            await refresh()
        } catch (err) {
            notifyError('Could not save the review: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    const status = REPRESENTATIVE_STATUS[representative.status] || REPRESENTATIVE_STATUS.pending

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

            <div className="rep-files">
                <button type="button" className="rep-file" onClick={() => openFile(representative.authorization_letter_path, 'Authorization letter')}>
                    View authorization letter
                </button>
                <button type="button" className="rep-file" onClick={() => openFile(representative.valid_id_path, `${representative.full_name} — valid ID`)}>
                    View valid ID
                </button>
            </div>

            {representative.status === 'approved' && (
                <p className="rep-callout is-approved">
                    <strong>{representative.full_name}</strong> may claim this document. At the window, check the original signed
                    letter and that their valid ID matches.
                </p>
            )}
            {representative.status === 'rejected' && representative.review_note && (
                <p className="rep-callout is-rejected">Not approved: {representative.review_note}</p>
            )}

            <div className="rep-actions">
                {representative.status !== 'approved' && (
                    <button type="button" className="rep-approve" onClick={() => review('approved')} disabled={saving}>
                        Approve
                    </button>
                )}
                {representative.status !== 'rejected' && (
                    <button type="button" className="rep-link is-danger" onClick={() => review('rejected')} disabled={saving}>
                        {representative.status === 'approved' ? 'Revoke approval' : 'Not approve'}
                    </button>
                )}
            </div>

            <DocumentPreviewModal url={preview.url} fileName={preview.name} onClose={() => setPreview({ url: null, name: '' })} />
        </div>
    )
}

export default RepresentativeStaffCard
