import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useLiveRefresh } from '../../lib/useLiveRefresh'
import { formatDisplayDateTime } from '../../lib/formatDate'
import { loadStudentsById } from '../../lib/studentNames'
import { SkeletonList } from '../../components/Skeleton'
import './EmployeePages.css'

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

const RELEASING_STATUSES = ['ready_for_claiming', 'scheduled', 'claimed', 'completed']

const RELEASING_STATUS_CHIPS = [
    { key: 'all', label: 'All' },
    { key: 'ready_for_claiming', label: 'Ready for Claiming' },
    { key: 'scheduled', label: 'Scheduled' },
    { key: 'claimed', label: 'Claimed' },
    { key: 'completed', label: 'Completed' },
]

function EmployeeRequestList({ title, subtitle, statusFilter, showFilterChips, emptyText }) {
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()

    const [requests, setRequests] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [activeChip, setActiveChip] = useState(searchParams.get('status') || 'all')
    const [search, setSearch] = useState('')
    const [releasingOnly, setReleasingOnly] = useState(false)

    const activeStatuses = activeChip === 'all' ? null : activeChip.split(',')

    const setChip = (key) => {
        setActiveChip(key)
        setSearchParams(key === 'all' ? {} : { status: key })
    }

    useEffect(() => {
        loadRequests()
    }, [])

    const loadRequests = async ({ silent = false } = {}) => {
        try {
            if (!silent) setLoading(true)
            setError('')

            const {
                data: { user },
                error: userError
            } = await supabase.auth.getUser()

            if (userError || !user) {
                throw new Error('You are not logged in.')
            }

            const { data: employee, error: employeeError } = await supabase
                .from('employees')
                .select('employee_id, access_scope')
                .eq('user_id', user.id)
                .single()

            if (employeeError || !employee) {
                throw new Error('Employee record could not be found.')
            }

            const isReleasingOnly = employee.access_scope === 'releasing'
            setReleasingOnly(isReleasingOnly)

            let query = supabase
                .from('document_requests')
                .select('*')
                .order('requested_at', { ascending: false })

            if (isReleasingOnly) {
                // Releasing is a front-desk job: they need to look up any
                // request's claiming status, not just ones assigned to them.
                query = query.in('status', RELEASING_STATUSES)
            } else {
                query = query.eq('assigned_employee_id', employee.employee_id)
                if (statusFilter && statusFilter.length > 0) {
                    query = query.in('status', statusFilter)
                }
            }

            const { data: requestRows, error: requestError } = await query

            if (requestError) {
                throw new Error('Failed to load requests: ' + requestError.message)
            }

            const rows = requestRows || []

            const studentIds = [...new Set(rows.map((r) => r.student_id).filter(Boolean))]
            const documentTypeIds = [...new Set(rows.map((r) => r.document_type_id).filter(Boolean))]

            const [studentsById, { data: documentTypes }] = await Promise.all([
                loadStudentsById(studentIds),
                documentTypeIds.length
                    ? supabase.from('document_types').select('document_type_id, document_name').in('document_type_id', documentTypeIds)
                    : Promise.resolve({ data: [] }),
            ])

            const documentNameById = Object.fromEntries(
                (documentTypes || []).map((d) => [d.document_type_id, d.document_name])
            )

            setRequests(
                rows.map((r) => ({
                    ...r,
                    studentNumber: studentsById[r.student_id]?.number || 'N/A',
                    studentName: studentsById[r.student_id]?.name || 'Unknown student',
                    documentName: documentNameById[r.document_type_id] || 'Document',
                }))
            )

        } catch (err) {
            console.error('EMPLOYEE REQUEST LIST ERROR:', err)
            setError(err.message || 'Failed to load requests.')
        } finally {
            setLoading(false)
        }
    }

    // Update in place when requests change -- no manual refresh needed.
    useLiveRefresh(['document_requests'], loadRequests)

    const visibleRequests = (requests
        .filter((r) => !(showFilterChips && activeStatuses) || activeStatuses.includes(r.status))
        .filter((r) => {
            if (!search.trim()) return true
            const term = search.trim().toLowerCase()
            return (
                r.request_number.toLowerCase().includes(term) ||
                r.studentNumber.toLowerCase().includes(term) ||
                r.studentName.toLowerCase().includes(term) ||
                r.documentName.toLowerCase().includes(term)
            )
        }))

    return (
        <div>
            <div className="employee-page-header">
                <h1>{releasingOnly ? 'Documents for Claiming' : title}</h1>
                <p>{releasingOnly ? 'All requests ready for claiming, scheduled, claimed, or completed — across all staff.' : subtitle}</p>
            </div>

            <input
                className="employee-search-input"
                style={{ marginBottom: 16 }}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by request number, student name or number, or document"
            />

            {showFilterChips && (
                <div className="employee-filter-row">
                    {(releasingOnly ? RELEASING_STATUS_CHIPS : STATUS_CHIPS).map((chip) => (
                        <button
                            key={chip.key}
                            className={`employee-filter-chip${activeChip === chip.key ? ' active' : ''}`}
                            onClick={() => setChip(chip.key)}
                        >
                            {chip.label}
                        </button>
                    ))}
                </div>
            )}

            {error && <div className="employee-error-box">{error}</div>}

            {loading ? (
                <SkeletonList count={3} />
            ) : visibleRequests.length === 0 ? (
                <div className="employee-empty">
                    {releasingOnly ? 'No documents are currently ready for claiming.' : (emptyText || 'No requests match this view.')}
                </div>
            ) : (
                visibleRequests.map((request) => (
                    <div
                        className="employee-list-card"
                        key={request.request_id}
                    >
                        <div className="employee-list-card-header">
                            <div>
                                <p className="request-student-name">{request.studentName}</p>
                                <h3>{request.documentName}</h3>
                                <p>
                                    {request.request_number} · Student {request.studentNumber}
                                </p>
                            </div>

                            <span className={`employee-status-pill status-${request.status}`}>
                                {request.status.replace(/_/g, ' ')}
                            </span>
                        </div>

                        <div className="employee-info-grid">
                            <div className="employee-info-field">
                                <span>Total</span>
                                <strong>₱{Number(request.total_amount || 0).toFixed(2)}</strong>
                            </div>

                            <div className="employee-info-field">
                                <span>Requested</span>
                                <strong>
                                    {request.requested_at
                                        ? formatDisplayDateTime(request.requested_at)
                                        : '-'}
                                </strong>
                            </div>
                        </div>

                        <button
                            className="employee-link-button"
                            onClick={() => navigate(`/employee/requests/${request.request_id}`)}
                        >
                            Open request →
                        </button>
                    </div>
                ))
            )}
        </div>
    )
}

export default EmployeeRequestList
