import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import './StudentPages.css'

function ClaimSchedule() {
    const navigate = useNavigate()

    const [schedules, setSchedules] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        loadSchedules()
    }, [])

    const loadSchedules = async () => {
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

            const { data: student, error: studentError } = await supabase
                .from('students')
                .select('student_id')
                .eq('user_id', user.id)
                .single()

            if (studentError || !student) {
                throw new Error('Student record could not be found.')
            }

            const { data: scheduleRows, error: scheduleError } = await supabase
                .from('claim_schedules')
                .select(`
                    claim_schedule_id,
                    request_id,
                    scheduled_date,
                    scheduled_time,
                    status,
                    claim_date,
                    claim_time,
                    remarks,
                    created_at
                `)
                .eq('student_id', student.student_id)
                .order('created_at', { ascending: false })

            if (scheduleError) {
                throw new Error('Failed to load claim schedules: ' + scheduleError.message)
            }

            if (!scheduleRows || scheduleRows.length === 0) {
                setSchedules([])
                return
            }

            const requestIds = [...new Set(scheduleRows.map((s) => s.request_id))]

            const { data: requests } = await supabase
                .from('document_requests')
                .select('request_id, request_number, document_type_id')
                .in('request_id', requestIds)

            const documentTypeIds = [
                ...new Set((requests || []).map((r) => r.document_type_id).filter(Boolean))
            ]

            const { data: documentTypes } = documentTypeIds.length
                ? await supabase
                    .from('document_types')
                    .select('document_type_id, document_name')
                    .in('document_type_id', documentTypeIds)
                : { data: [] }

            const requestsById = Object.fromEntries(
                (requests || []).map((r) => [r.request_id, r])
            )

            const documentNameById = Object.fromEntries(
                (documentTypes || []).map((d) => [d.document_type_id, d.document_name])
            )

            const merged = scheduleRows.map((schedule) => {
                const request = requestsById[schedule.request_id]

                return {
                    ...schedule,
                    requestNumber: request?.request_number || 'N/A',
                    documentName: documentNameById[request?.document_type_id] || 'Document',
                }
            })

            setSchedules(merged)

        } catch (err) {
            console.error('CLAIM SCHEDULE ERROR:', err)
            setError(err.message || 'Failed to load claim schedules.')
        } finally {
            setLoading(false)
        }
    }

    const formatDate = (date) => {
        if (!date) return 'Not yet scheduled'

        return new Date(`${date}T00:00:00`).toLocaleDateString('en-PH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })
    }

    const formatTime = (time) => {
        if (!time) return ''

        const [hours, minutes] = time.split(':')
        const date = new Date()
        date.setHours(Number(hours), Number(minutes), 0, 0)

        return date.toLocaleTimeString('en-PH', {
            hour: 'numeric',
            minute: '2-digit'
        })
    }

    const formatArriveByTime = (time) => {
        if (!time) return ''

        const [hours, minutes] = time.split(':')
        const date = new Date()
        date.setHours(Number(hours), Number(minutes), 0, 0)
        date.setMinutes(date.getMinutes() - 30)

        return date.toLocaleTimeString('en-PH', {
            hour: 'numeric',
            minute: '2-digit'
        })
    }

    return (
        <div>
            <div className="student-page-header">
                <h1>Claim Schedule</h1>
                <p>View the date and time you're scheduled to claim your documents.</p>
            </div>

            {error && <div className="student-error-box">{error}</div>}

            {loading ? (
                <p className="student-loading">Loading your claim schedules...</p>
            ) : schedules.length === 0 ? (
                <div className="student-empty">
                    You don't have any claim schedules yet. Once the Registrar schedules
                    a document for claiming, it will appear here.
                </div>
            ) : (
                <>
                    {schedules.map((schedule) => (
                        <div className="student-list-card" key={schedule.claim_schedule_id}>

                            <div className="student-list-card-header">
                                <div>
                                    <h3>{schedule.documentName}</h3>
                                    <p>Request {schedule.requestNumber}</p>
                                </div>

                                <span className={`student-status-pill status-${schedule.status}`}>
                                    {schedule.status}
                                </span>
                            </div>

                            <div className="student-info-grid">
                                <div className="student-info-field">
                                    <span>Claiming Date</span>
                                    <strong>
                                        {formatDate(schedule.claim_date || schedule.scheduled_date)}
                                    </strong>
                                </div>

                                <div className="student-info-field">
                                    <span>Claiming Time</span>
                                    <strong>
                                        {formatTime(schedule.claim_time || schedule.scheduled_time) || 'N/A'}
                                    </strong>
                                </div>

                                <div className="student-info-field">
                                    <span>Arrive By</span>
                                    <strong>
                                        {formatArriveByTime(schedule.claim_time || schedule.scheduled_time) || 'N/A'}
                                    </strong>
                                </div>
                            </div>

                            {schedule.remarks && (
                                <div className="student-info-field">
                                    <span>Remarks</span>
                                    <strong>{schedule.remarks}</strong>
                                </div>
                            )}

                            <button
                                className="student-link-button"
                                onClick={() => navigate(`/student/request/${schedule.request_id}`)}
                            >
                                View request details →
                            </button>

                        </div>
                    ))}

                    <div className="student-reminder-box">
                        <strong>Claiming Reminder</strong>
                        Please arrive at least 30 minutes before your scheduled claiming time.
                        Bring your official receipt (OR) and a valid ID when claiming your
                        document at the Registrar's Office.
                    </div>
                </>
            )}
        </div>
    )
}

export default ClaimSchedule
