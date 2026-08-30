import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { notifyWarning, notifyError } from '../../lib/notify'
import { SkeletonPageHeader, SkeletonList } from '../../components/Skeleton'
import './StudentPages.css'

function UploadRequirements() {
    const { requestId } = useParams()
    const navigate = useNavigate()

    const [student, setStudent] = useState(null)
    const [request, setRequest] = useState(null)
    const [requirements, setRequirements] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [uploadingId, setUploadingId] = useState(null)
    const [files, setFiles] = useState({})

    useEffect(() => {
        loadRequirements()
    }, [requestId])

    const loadRequirements = async () => {
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

            const { data: studentData, error: studentError } = await supabase
                .from('students')
                .select('student_id, user_id')
                .eq('user_id', user.id)
                .single()

            if (studentError || !studentData) {
                throw new Error('Student record could not be found.')
            }

            setStudent(studentData)

            const { data: requestData, error: requestError } = await supabase
                .from('document_requests')
                .select('request_id, request_number, student_id, status')
                .eq('request_id', requestId)
                .eq('student_id', studentData.student_id)
                .single()

            if (requestError || !requestData) {
                throw new Error('Request could not be found.')
            }

            setRequest(requestData)

            const { data: requirementRows, error: requirementError } = await supabase
                .from('request_requirements')
                .select(`
                    request_requirement_id,
                    status,
                    file_name,
                    uploaded_at,
                    rejection_reason,
                    document_requirements (
                        requirement_id,
                        requirement_name,
                        description,
                        is_required,
                        accepted_file_types,
                        max_file_size_mb
                    )
                `)
                .eq('request_id', requestId)
                .order('created_at', { ascending: true })

            if (requirementError) {
                throw new Error('Failed to load requirements: ' + requirementError.message)
            }

            setRequirements(requirementRows || [])

        } catch (err) {
            console.error('LOAD REQUIREMENTS ERROR:', err)
            setError(err.message || 'Failed to load requirements.')
        } finally {
            setLoading(false)
        }
    }

    const uploadRequirement = async (requirement) => {
        if (request?.status === 'cancelled') {
            notifyWarning('This request has been cancelled. Requirements can no longer be uploaded.')
            return
        }

        const file = files[requirement.request_requirement_id]

        if (!file) {
            notifyWarning('Please choose a file first.')
            return
        }

        const maxSize = (requirement.document_requirements?.max_file_size_mb || 5) * 1024 * 1024

        if (file.size > maxSize) {
            notifyWarning(`File must not exceed ${requirement.document_requirements?.max_file_size_mb || 5} MB.`)
            return
        }

        try {
            setUploadingId(requirement.request_requirement_id)

            const fileExtension = file.name.split('.').pop().toLowerCase()
            const fileName = `${requirement.document_requirements.requirement_id}-${Date.now()}.${fileExtension}`
            const filePath = `${student.student_id}/${requestId}/${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('student-requirements')
                .upload(filePath, file, { cacheControl: '3600', upsert: false })

            if (uploadError) {
                throw new Error('File upload failed: ' + uploadError.message)
            }

            const { error: updateError } = await supabase
                .from('request_requirements')
                .update({
                    file_name: file.name,
                    file_path: filePath,
                    file_url: filePath,
                    status: 'uploaded',
                    uploaded_at: new Date().toISOString(),
                    reviewed_by: null,
                    reviewed_at: null,
                    rejection_reason: null,
                })
                .eq('request_requirement_id', requirement.request_requirement_id)

            if (updateError) {
                await supabase.storage.from('student-requirements').remove([filePath])
                throw new Error('Failed to save requirement: ' + updateError.message)
            }

            setFiles((prev) => ({ ...prev, [requirement.request_requirement_id]: null }))
            await loadRequirements()

        } catch (err) {
            console.error('UPLOAD REQUIREMENT ERROR:', err)
            notifyError(err.message || 'Failed to upload requirement.')
        } finally {
            setUploadingId(null)
        }
    }

    if (loading) {
        return (
            <div>
                <SkeletonPageHeader />
                <SkeletonList count={3} />
            </div>
        )
    }

    if (error) {
        return <div className="student-error-box">{error}</div>
    }

    return (
        <div>
            <button className="student-link-button" style={{ marginBottom: 16 }} onClick={() => navigate(`/student/request/${requestId}`)}>
                ← Back to Request
            </button>

            <div className="student-page-header">
                <h1>Upload Requirements</h1>
                <p>Upload the documents the Registrar needs to process your request.</p>
            </div>

            {request?.status === 'cancelled' && (
                <div className="student-notice tone-danger" style={{ marginBottom: 16 }}>
                    <strong>Request Cancelled</strong>
                    <p>This request has been cancelled, so requirements can no longer be uploaded.</p>
                </div>
            )}

            {requirements.length === 0 ? (
                <div className="student-empty">No additional requirements are needed for this request.</div>
            ) : (
                requirements.map((req) => {
                    const doc = req.document_requirements
                    const editable = (req.status === 'pending' || req.status === 'rejected') && request?.status !== 'cancelled'

                    return (
                        <div className="student-list-card" key={req.request_requirement_id}>
                            <div className="student-list-card-header">
                                <div>
                                    <h3>{doc?.requirement_name}{doc?.is_required && <span style={{ color: 'var(--red)' }}> *</span>}</h3>
                                    <p>{doc?.description}</p>
                                </div>

                                <span className={`student-status-pill status-${req.status}`}>{req.status}</span>
                            </div>

                            {req.file_name && (
                                <div className="student-info-field">
                                    <span>Uploaded File</span>
                                    <strong>{req.file_name}</strong>
                                </div>
                            )}

                            {req.rejection_reason && (
                                <div className="student-error-box" style={{ marginBottom: 0 }}>
                                    Rejected: {req.rejection_reason}
                                </div>
                            )}

                            {editable && (
                                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                                    <input
                                        type="file"
                                        accept={doc?.accepted_file_types || undefined}
                                        onChange={(e) =>
                                            setFiles((prev) => ({
                                                ...prev,
                                                [req.request_requirement_id]: e.target.files?.[0] || null,
                                            }))
                                        }
                                        disabled={uploadingId === req.request_requirement_id}
                                    />

                                    <button
                                        className="student-link-button"
                                        onClick={() => uploadRequirement(req)}
                                        disabled={uploadingId === req.request_requirement_id}
                                    >
                                        {uploadingId === req.request_requirement_id ? 'Uploading...' : 'Upload'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )
                })
            )}
        </div>
    )
}

export default UploadRequirements
