import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import './EmployeePages.css'

const STATUS_CHIPS = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'payment_pending', label: 'Payment Pending' },
    { key: 'receipt_uploaded', label: 'Receipt Uploaded' },
    { key: 'receipt_verified', label: 'Receipt Verified' },
    { key: 'processing', label: 'Processing' },
    { key: 'digital_credential', label: 'Digital Credential' },
    { key: 'ready_for_claiming', label: 'Ready for Claiming' },
    { key: 'completed', label: 'Completed' },
    { key: 'rejected', label: 'Rejected' },
]

function EmployeeRequestList({ title, subtitle, statusFilter, showFilterChips, emptyText }) {
    const navigate = useNavigate()

    const [requests, setRequests] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [activeChip, setActiveChip] = useState('all')
    const [search, setSearch] = useState('')

    useEffect(() => {
        loadRequests()
    }, [])

    const loadRequests = async () => {
        try {
            setLoading(true)
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
                .select('employee_id')
                .eq('user_id', user.id)
                .single()

            if (employeeError || !employee) {
                throw new Error('Employee record could not be found.')
            }

            let query = supabase
                .from('document_requests')
                .select(`
                    request_id,
                    request_number,
                    student_id,
                    document_type_id,
                    total_amount,
                    priority,
                    status,
                    requested_at
                `)
                .eq('assigned_employee_id', employee.employee_id)
                .order('requested_at', { ascending: false })

            if (statusFilter && statusFilter.length > 0) {
                query = query.in('status', statusFilter)
            }

            const { data: requestRows, error: requestError } = await query

            if (requestError) {
                throw new Error('Failed to load requests: ' + requestError.message)
            }

            const rows = requestRows || []

            const studentIds = [...new Set(rows.map((r) => r.student_id).filter(Boolean))]
            const documentTypeIds = [...new Set(rows.map((r) => r.document_type_id).filter(Boolean))]

            const [{ data: students }, { data: documentTypes }] = await Promise.all([
                studentIds.length
                    ? supabase.from('students').select('student_id, student_number').in('student_id', studentIds)
                    : Promise.resolve({ data: [] }),
                documentTypeIds.length
                    ? supabase.from('document_types').select('document_type_id, document_name').in('document_type_id', documentTypeIds)
                    : Promise.resolve({ data: [] }),
            ])

            const studentNumberById = Object.fromEntries(
                (students || []).map((s) => [s.student_id, s.student_number])
            )

            const documentNameById = Object.fromEntries(
                (documentTypes || []).map((d) => [d.document_type_id, d.document_name])
            )

            setRequests(
                rows.map((r) => ({
                    ...r,
                    studentNumber: studentNumberById[r.student_id] || 'N/A',
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

    const visibleRequests = requests
        .filter((r) => !(showFilterChips && activeChip !== 'all') || r.status === activeChip)
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
            <div className="employee-page-header">
                <h1>{title}</h1>
                <p>{subtitle}</p>
            </div>

            <input
                className="employee-search-input"
                style={{ marginBottom: 16 }}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by request number, student number, or document"
            />

            {showFilterChips && (
                <div className="employee-filter-row">
                    {STATUS_CHIPS.map((chip) => (
                        <button
                            key={chip.key}
                            className={`employee-filter-chip${activeChip === chip.key ? ' active' : ''}`}
                            onClick={() => setActiveChip(chip.key)}
                        >
                            {chip.label}
                        </button>
                    ))}
                </div>
            )}

            {error && <div className="employee-error-box">{error}</div>}

            {loading ? (
                <p className="employee-loading">Loading requests...</p>
            ) : visibleRequests.length === 0 ? (
                <div className="employee-empty">
                    {emptyText || 'No requests match this view.'}
                </div>
            ) : (
                visibleRequests.map((request) => (
                    <div className="employee-list-card" key={request.request_id}>
                        <div className="employee-list-card-header">
                            <div>
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
                                <span>Priority</span>
                                <strong style={{ textTransform: 'capitalize' }}>{request.priority}</strong>
                            </div>

                            <div className="employee-info-field">
                                <span>Requested</span>
                                <strong>
                                    {request.requested_at
                                        ? new Date(request.requested_at).toLocaleDateString()
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
