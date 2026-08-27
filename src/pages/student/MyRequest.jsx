import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import './StudentPages.css'

function MyRequest() {
    const navigate = useNavigate()
    const location = useLocation()

    const [requests, setRequests] = useState([])
    const [loading, setLoading] = useState(true)
    const [errorMessage, setErrorMessage] = useState('')
    const [search, setSearch] = useState('')
    const justSubmitted = location.state?.justSubmitted || ''

    useEffect(() => {
        loadRequests()
        // Clear the "just submitted" flag from history so a refresh doesn't re-show it
        if (location.state?.justSubmitted) {
            window.history.replaceState({}, document.title)
        }
    }, [])

    const loadRequests = async () => {
        try {
            setLoading(true)
            setErrorMessage('')

            const {
                data: { user },
                error: userError
            } = await supabase.auth.getUser()

            if (userError) {
                throw new Error(userError.message)
            }

            if (!user) {
                throw new Error('You are not logged in.')
            }

            const {
                data: student,
                error: studentError
            } = await supabase
                .from('students')
                .select(`
                    student_id,
                    student_number
                `)
                .eq('user_id', user.id)
                .single()

            if (studentError) {
                throw new Error('Student lookup failed: ' + studentError.message)
            }

            if (!student) {
                throw new Error('Student record could not be found.')
            }

            const {
                data,
                error
            } = await supabase
                .from('document_requests')
                .select(`
                    request_id,
                    request_number,
                    student_id,
                    document_type_id,
                    quantity,
                    unit_fee,
                    total_amount,
                    priority,
                    purpose,
                    status,
                    student_remarks,
                    employee_remarks,
                    rejection_reason,
                    requested_at,
                    processed_at,
                    completed_at
                `)
                .eq('student_id', student.student_id)
                .order('requested_at', { ascending: false })

            if (error) {
                throw new Error('Failed to load requests: ' + error.message)
            }

            const requestRows = data || []

            const documentTypeIds = [
                ...new Set(requestRows.map((r) => r.document_type_id).filter(Boolean))
            ]

            const { data: documentTypes } = documentTypeIds.length
                ? await supabase
                    .from('document_types')
                    .select('document_type_id, document_name')
                    .in('document_type_id', documentTypeIds)
                : { data: [] }

            const documentNameById = Object.fromEntries(
                (documentTypes || []).map((d) => [d.document_type_id, d.document_name])
            )

            setRequests(
                requestRows.map((r) => ({
                    ...r,
                    documentName: documentNameById[r.document_type_id] || 'Document',
                }))
            )

        } catch (error) {
            console.error('MY REQUESTS ERROR:', error)
            setErrorMessage(error.message || 'Failed to load your requests.')
        } finally {
            setLoading(false)
        }
    }

    const visibleRequests = requests.filter((r) => {
        if (!search.trim()) return true
        const term = search.trim().toLowerCase()
        return (
            r.request_number.toLowerCase().includes(term) ||
            r.documentName.toLowerCase().includes(term)
        )
    })

    return (
        <div>
            <div className="student-page-header-row" style={{ marginBottom: 28 }}>
                <div>
                    <h1 style={{ fontSize: 26, marginBottom: 6 }}>My Requests</h1>
                    <p>View and manage your document requests.</p>
                </div>

                <button
                    className="auth-submit"
                    style={{ width: 'auto', padding: '11px 20px' }}
                    onClick={() => navigate('/student/new-request')}
                >
                    + New Request
                </button>
            </div>

            {justSubmitted && (
                <div className="student-success-box">
                    Request {justSubmitted} submitted successfully.
                </div>
            )}

            <input
                className="student-search-input"
                style={{ marginBottom: 16 }}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by request number or document"
            />

            {errorMessage && (
                <div className="student-error-box">
                    {errorMessage}
                    <button className="student-link-button" style={{ display: 'block', marginTop: 8 }} onClick={loadRequests}>
                        Try again
                    </button>
                </div>
            )}

            {loading ? (
                <p className="student-loading">Loading your requests...</p>
            ) : requests.length === 0 && !errorMessage ? (
                <div className="student-empty">
                    You have not submitted any document requests yet.
                    <div style={{ marginTop: 14 }}>
                        <button
                            className="student-link-button"
                            onClick={() => navigate('/student/new-request')}
                        >
                            Create your first request →
                        </button>
                    </div>
                </div>
            ) : visibleRequests.length === 0 && !errorMessage ? (
                <div className="student-empty">No requests match your search.</div>
            ) : (
                visibleRequests.map((request) => (
                    <div className="student-list-card" key={request.request_id}>

                        <div className="student-list-card-header">
                            <div>
                                <h3>{request.documentName}</h3>
                                <p>Request {request.request_number}</p>
                            </div>

                            <span className={`student-status-pill status-${request.status}`}>
                                {request.status}
                            </span>
                        </div>

                        <div className="student-info-grid">
                            <div className="student-info-field">
                                <span>Quantity</span>
                                <strong>{request.quantity}</strong>
                            </div>

                            <div className="student-info-field">
                                <span>Total</span>
                                <strong>₱{Number(request.total_amount || 0).toFixed(2)}</strong>
                            </div>

                            <div className="student-info-field">
                                <span>Priority</span>
                                <strong style={{ textTransform: 'capitalize' }}>{request.priority}</strong>
                            </div>

                            <div className="student-info-field">
                                <span>Requested</span>
                                <strong>
                                    {request.requested_at
                                        ? new Date(request.requested_at).toLocaleDateString()
                                        : '-'}
                                </strong>
                            </div>
                        </div>

                        {request.purpose && (
                            <div className="student-info-field">
                                <span>Purpose</span>
                                <strong>{request.purpose}</strong>
                            </div>
                        )}

                        <button
                            className="student-link-button"
                            onClick={() => navigate(`/student/request/${request.request_id}`)}
                        >
                            View request details →
                        </button>

                    </div>
                ))
            )}
        </div>
    )
}

export default MyRequest
