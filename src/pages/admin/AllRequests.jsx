import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { SkeletonList } from '../../components/Skeleton'
import './AdminPages.css'

const STATUS_CHIPS = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'payment_pending', label: 'Payment Pending' },
    { key: 'receipt_uploaded', label: 'Receipt Uploaded' },
    { key: 'receipt_verified', label: 'Receipt Verified' },
    { key: 'processing', label: 'Processing' },
    { key: 'lacking_requirements', label: 'Lacking Requirements' },
    { key: 'ready_for_claiming', label: 'Ready for Claiming' },
    { key: 'completed', label: 'Completed' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'cancelled', label: 'Cancelled' },
]

function AllRequests() {
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()

    const [requests, setRequests] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [activeChip, setActiveChip] = useState(searchParams.get('status') || 'all')
    const [search, setSearch] = useState('')

    const activeStatuses = activeChip === 'all' ? null : activeChip.split(',')

    const setChip = (key) => {
        setActiveChip(key)
        setSearchParams(key === 'all' ? {} : { status: key })
    }

    useEffect(() => {
        loadRequests()
    }, [])

    const loadRequests = async () => {
        try {
            setLoading(true)
            setError('')

            const { data: rows, error: requestError } = await supabase
                .from('document_requests')
                .select(`
                    request_id,
                    request_number,
                    student_id,
                    document_type_id,
                    assigned_employee_id,
                    total_amount,
                    priority,
                    status,
                    requested_at
                `)
                .order('requested_at', { ascending: false })

            if (requestError) {
                throw new Error('Failed to load requests: ' + requestError.message)
            }

            const data = rows || []

            const studentIds = [...new Set(data.map((r) => r.student_id).filter(Boolean))]
            const documentTypeIds = [...new Set(data.map((r) => r.document_type_id).filter(Boolean))]
            const employeeIds = [...new Set(data.map((r) => r.assigned_employee_id).filter(Boolean))]

            const [{ data: students }, { data: documentTypes }, { data: employees }] = await Promise.all([
                studentIds.length
                    ? supabase.from('students').select('student_id, student_number').in('student_id', studentIds)
                    : Promise.resolve({ data: [] }),
                documentTypeIds.length
                    ? supabase.from('document_types').select('document_type_id, document_name').in('document_type_id', documentTypeIds)
                    : Promise.resolve({ data: [] }),
                employeeIds.length
                    ? supabase.from('employees').select('employee_id, user_id, employee_number').in('employee_id', employeeIds)
                    : Promise.resolve({ data: [] }),
            ])

            const employeeUserIds = [...new Set((employees || []).map((e) => e.user_id))]

            const { data: profiles } = employeeUserIds.length
                ? await supabase.from('profiles').select('user_id, first_name, last_name').in('user_id', employeeUserIds)
                : { data: [] }

            const profileByUserId = Object.fromEntries((profiles || []).map((p) => [p.user_id, p]))
            const employeeById = Object.fromEntries((employees || []).map((e) => [e.employee_id, e]))
            const studentNumberById = Object.fromEntries((students || []).map((s) => [s.student_id, s.student_number]))
            const documentNameById = Object.fromEntries((documentTypes || []).map((d) => [d.document_type_id, d.document_name]))

            setRequests(
                data.map((r) => {
                    const employee = employeeById[r.assigned_employee_id]
                    const profile = employee ? profileByUserId[employee.user_id] : null

                    return {
                        ...r,
                        studentNumber: studentNumberById[r.student_id] || 'N/A',
                        documentName: documentNameById[r.document_type_id] || 'Document',
                        employeeName: profile ? `${profile.first_name} ${profile.last_name}`.trim() : 'Unassigned',
                    }
                })
            )

        } catch (err) {
            console.error('ALL REQUESTS ERROR:', err)
            setError(err.message || 'Failed to load requests.')
        } finally {
            setLoading(false)
        }
    }

    const visibleRequests = requests
        .filter((r) => !activeStatuses || activeStatuses.includes(r.status))
        .filter((r) => {
            if (!search.trim()) return true
            const term = search.trim().toLowerCase()
            return (
                r.request_number.toLowerCase().includes(term) ||
                r.studentNumber.toLowerCase().includes(term) ||
                r.documentName.toLowerCase().includes(term)
            )
        })

    return (
        <div>
            <div className="admin-page-header">
                <h1>All Requests</h1>
                <p>Every document request in the system, across all employees.</p>
            </div>

            <input
                className="admin-search-input"
                style={{ marginBottom: 16 }}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by request number, student number, or document"
            />

            <div className="admin-filter-row">
                {STATUS_CHIPS.map((chip) => (
                    <button
                        key={chip.key}
                        className={`admin-filter-chip${activeChip === chip.key ? ' active' : ''}`}
                        onClick={() => setChip(chip.key)}
                    >
                        {chip.label}
                    </button>
                ))}
            </div>

            {error && <div className="admin-error-box">{error}</div>}

            {loading ? (
                <SkeletonList count={3} />
            ) : visibleRequests.length === 0 ? (
                <div className="admin-empty">No requests match this view.</div>
            ) : (
                visibleRequests.map((request) => (
                    <div className="admin-list-card" key={request.request_id}>
                        <div className="admin-list-card-header">
                            <div>
                                <h3>{request.documentName}</h3>
                                <p>
                                    {request.request_number} · Student {request.studentNumber} · Assigned to {request.employeeName}
                                </p>
                            </div>

                            <span className={`admin-status-pill status-${request.status}`}>
                                {request.status.replace(/_/g, ' ')}
                            </span>
                        </div>

                        <div className="admin-info-grid">
                            <div className="admin-info-field">
                                <span>Total</span>
                                <strong>₱{Number(request.total_amount || 0).toFixed(2)}</strong>
                            </div>

                            <div className="admin-info-field">
                                <span>Priority</span>
                                <strong style={{ textTransform: 'capitalize' }}>{request.priority}</strong>
                            </div>

                            <div className="admin-info-field">
                                <span>Requested</span>
                                <strong>
                                    {request.requested_at ? new Date(request.requested_at).toLocaleDateString() : '-'}
                                </strong>
                            </div>
                        </div>

                        <button
                            className="admin-link-button"
                            onClick={() => navigate(`/admin/requests/${request.request_id}`)}
                        >
                            Open request →
                        </button>
                    </div>
                ))
            )}
        </div>
    )
}

export default AllRequests
