import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useLiveRefresh } from '../../lib/useLiveRefresh'
import { SkeletonPage } from '../../components/Skeleton'
import { adminPath } from '../../lib/portalPaths'
import { blockedForReadOnlyViewer } from '../../lib/viewOnlyGuard'
import { notifyError, notifySuccess, notifyWarning } from '../../lib/notify'
import { confirmWithPassword } from '../../lib/confirmPassword'
import Modal from '../../components/Modal'
import { IconXCircle } from './icons'
import './AdminPages.css'

const LOAD_LIMIT = 500

function formatWhen(value) {
    if (!value) return '—'
    return new Date(value).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
}

function Credentials() {
    const navigate = useNavigate()
    const { role } = useOutletContext() || {}
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [query, setQuery] = useState('')
    const [docFilter, setDocFilter] = useState('all')
    const [statusFilter, setStatusFilter] = useState('all')
    const [revokeTarget, setRevokeTarget] = useState(null)
    const [revokeReason, setRevokeReason] = useState('')
    const [revoking, setRevoking] = useState(false)

    const load = async ({ silent = false } = {}) => {
        if (!silent) setLoading(true)
        setError('')

        try {
            const { data: credRows, error: credError } = await supabase
                .from('credentials')
                .select('credential_id, credential_number, status, student_id, request_id, document_type_id, generated_at, released_at, revoked_at, revocation_reason')
                .order('generated_at', { ascending: false })
                .limit(LOAD_LIMIT)

            if (credError) throw new Error(credError.message)

            const requestIds = [...new Set((credRows || []).map((c) => c.request_id).filter(Boolean))]
            const docTypeIds = [...new Set((credRows || []).map((c) => c.document_type_id).filter(Boolean))]
            const studentIds = [...new Set((credRows || []).map((c) => c.student_id).filter(Boolean))]

            const [{ data: requestRows }, { data: docTypeRows }, { data: studentRows }] = await Promise.all([
                requestIds.length
                    ? supabase.from('document_requests').select('request_id, request_number').in('request_id', requestIds)
                    : Promise.resolve({ data: [] }),
                docTypeIds.length
                    ? supabase.from('document_types').select('document_type_id, document_name').in('document_type_id', docTypeIds)
                    : Promise.resolve({ data: [] }),
                studentIds.length
                    ? supabase.from('students').select('student_id, user_id, student_number').in('student_id', studentIds)
                    : Promise.resolve({ data: [] }),
            ])

            const userIds = [...new Set((studentRows || []).map((s) => s.user_id).filter(Boolean))]
            const { data: profileRows } = userIds.length
                ? await supabase.from('profiles').select('user_id, first_name, last_name').in('user_id', userIds)
                : { data: [] }

            const requestNumberById = Object.fromEntries((requestRows || []).map((r) => [r.request_id, r.request_number]))
            const docNameById = Object.fromEntries((docTypeRows || []).map((d) => [d.document_type_id, d.document_name]))
            const profileByUserId = Object.fromEntries((profileRows || []).map((p) => [p.user_id, p]))
            const studentByStudentId = Object.fromEntries((studentRows || []).map((s) => [s.student_id, s]))

            setRows(
                (credRows || []).map((c) => {
                    const student = studentByStudentId[c.student_id]
                    const profile = student ? profileByUserId[student.user_id] : null
                    return {
                        ...c,
                        documentName: docNameById[c.document_type_id] || 'Unknown document',
                        requestNumber: requestNumberById[c.request_id] || '',
                        studentName: profile ? `${profile.first_name} ${profile.last_name}`.trim() : 'Unknown',
                        studentNumber: student?.student_number || '',
                    }
                })
            )
        } catch (err) {
            console.error('CREDENTIALS LOAD ERROR:', err)
            setError(err.message || 'Could not load credentials.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
    }, [])

    useLiveRefresh(['credentials'], load)

    const closeRevokeModal = () => {
        setRevokeTarget(null)
        setRevokeReason('')
    }

    const confirmRevoke = async () => {
        if (blockedForReadOnlyViewer(role)) return
        if (!revokeTarget) return

        if (!revokeReason.trim()) {
            notifyWarning('Please enter a reason for revoking this credential.')
            return
        }

        // Revoking is permanent and public (the verify page shows it):
        // confirm who is making it.
        const verified = await confirmWithPassword({
            title: 'Confirm with your password',
            text: `Enter your password to revoke credential ${revokeTarget.credential_number}.`,
        })
        if (!verified) return

        setRevoking(true)

        const { data: { user } } = await supabase.auth.getUser()

        const { error: revokeError } = await supabase
            .from('credentials')
            .update({
                status: 'revoked',
                revoked_at: new Date().toISOString(),
                revoked_by: user?.id,
                revocation_reason: revokeReason.trim(),
            })
            .eq('credential_id', revokeTarget.credential_id)

        setRevoking(false)

        if (revokeError) {
            notifyError('Failed to revoke credential: ' + revokeError.message)
            return
        }

        notifySuccess(`Credential "${revokeTarget.credential_number}" revoked.`)
        closeRevokeModal()
        load({ silent: true })
    }

    const documentOptions = useMemo(
        () => [...new Set(rows.map((r) => r.documentName))].sort(),
        [rows]
    )

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase()
        return rows.filter((r) => {
            if (docFilter !== 'all' && r.documentName !== docFilter) return false
            if (statusFilter !== 'all' && r.status !== statusFilter) return false
            if (!q) return true
            return `${r.credential_number} ${r.studentName} ${r.studentNumber} ${r.requestNumber} ${r.documentName}`
                .toLowerCase()
                .includes(q)
        })
    }, [rows, query, docFilter, statusFilter])

    if (loading) {
        return (
            <SkeletonPage
                portal="admin"
                blocks={[
                    { type: 'header' },
                    { type: 'list', count: 6 },
                ]}
            />
        )
    }

    return (
        <div>
            <header className="admin-page-header">
                <h1>Credentials</h1>
                <p>Every digital credential issued, searchable by document type, student, credential number or request number.</p>
            </header>

            {error && (
                <div className="admin-notice tone-danger" style={{ marginBottom: 16 }}>
                    Could not load credentials: {error}
                </div>
            )}

            <div className="admin-filter-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16, alignItems: 'center' }}>
                <button className={`admin-filter-chip${statusFilter === 'all' ? ' active' : ''}`} onClick={() => setStatusFilter('all')}>All</button>
                <button className={`admin-filter-chip${statusFilter === 'generated' ? ' active' : ''}`} onClick={() => setStatusFilter('generated')}>Generated</button>
                <button className={`admin-filter-chip${statusFilter === 'revoked' ? ' active' : ''}`} onClick={() => setStatusFilter('revoked')}>Revoked</button>

                <select
                    value={docFilter}
                    onChange={(e) => setDocFilter(e.target.value)}
                    className="admin-select"
                    style={{ maxWidth: 260 }}
                >
                    <option value="all">All document types</option>
                    {documentOptions.map((name) => (
                        <option key={name} value={name}>{name}</option>
                    ))}
                </select>

                <input
                    type="search"
                    className="admin-search-input"
                    placeholder="Search credential #, student, request #..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    style={{ minWidth: 240 }}
                />
            </div>

            <div className="admin-card">
                {visible.length === 0 ? (
                    <p className="admin-empty">{rows.length === 0 ? 'No credentials have been issued yet.' : 'No credentials match your search.'}</p>
                ) : (
                    <div className="admin-table-wrapper">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Credential #</th>
                                    <th>Document</th>
                                    <th>Student</th>
                                    <th>Request #</th>
                                    <th>Status</th>
                                    <th>Generated</th>
                                    <th>Released</th>
                                    <th aria-label="Actions" />
                                </tr>
                            </thead>
                            <tbody>
                                {visible.map((c) => (
                                    <tr key={c.credential_id}>
                                        <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{c.credential_number}</td>
                                        <td>{c.documentName}</td>
                                        <td>
                                            {c.studentName}
                                            {c.studentNumber && <span style={{ display: 'block', color: 'var(--slate)', fontSize: 12 }}>{c.studentNumber}</span>}
                                        </td>
                                        <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{c.requestNumber || '—'}</td>
                                        <td>
                                            <span className={`admin-status-pill status-${c.status === 'revoked' ? 'rejected' : 'active'}`}>
                                                {c.status === 'revoked' ? 'Revoked' : 'Generated'}
                                            </span>
                                            {c.status === 'revoked' && c.revocation_reason && (
                                                <span style={{ display: 'block', color: 'var(--slate)', fontSize: 12 }}>{c.revocation_reason}</span>
                                            )}
                                        </td>
                                        <td>{formatWhen(c.generated_at)}</td>
                                        <td>{formatWhen(c.released_at)}</td>
                                        <td style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                            {c.request_id && (
                                                <button
                                                    type="button"
                                                    className="admin-link-button"
                                                    onClick={() => navigate(adminPath(`/requests/${c.request_id}`))}
                                                >
                                                    Open request →
                                                </button>
                                            )}
                                            {c.status !== 'revoked' && (
                                                <button
                                                    type="button"
                                                    className="admin-link-button"
                                                    style={{ color: 'var(--red, #C8102E)' }}
                                                    onClick={() => setRevokeTarget(c)}
                                                >
                                                    Revoke
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {rows.length === LOAD_LIMIT && (
                            <p className="admin-empty" style={{ marginTop: 8 }}>Showing the latest {LOAD_LIMIT} credentials.</p>
                        )}
                    </div>
                )}
            </div>

            {revokeTarget && (
                <Modal
                    title="Revoke Credential"
                    subtitle="This marks the credential invalid. Anyone checking it on the public verify page will see it was revoked, with this reason."
                    icon={IconXCircle}
                    onClose={revoking ? undefined : closeRevokeModal}
                >
                    <p style={{ fontSize: 13, marginBottom: 12 }}>
                        Revoking credential <strong style={{ fontFamily: 'monospace' }}>{revokeTarget.credential_number}</strong> for {revokeTarget.studentName}.
                    </p>

                    <textarea
                        className="admin-search-input"
                        style={{ width: '100%', minHeight: 90, marginBottom: 12 }}
                        value={revokeReason}
                        onChange={(event) => setRevokeReason(event.target.value)}
                        placeholder="Example: Issued in error -- duplicate of CERT-000412."
                    />

                    <div className="app-modal-actions">
                        <button className="admin-secondary-button" onClick={closeRevokeModal} disabled={revoking}>
                            Cancel
                        </button>
                        <button className="admin-danger-button" onClick={confirmRevoke} disabled={revoking}>
                            {revoking ? 'Revoking...' : 'Confirm Revoke'}
                        </button>
                    </div>
                </Modal>
            )}
        </div>
    )
}

export default Credentials
