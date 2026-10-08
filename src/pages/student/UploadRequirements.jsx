import { useEffect, useState } from 'react'
import { isShrinkable, MAX_ORIGINAL_IMAGE_MB, shrinkImage } from '../../lib/shrinkImage'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { notifyWarning, notifyError } from '../../lib/notify'
import { EmptyState, FilePicker, InfoBox, TaskSteps } from './StudentUi'
import { friendlyError } from '../../lib/friendlyError'
import { SkeletonPage } from '../../components/Skeleton'
import './StudentPages.css'
import { useLiveRefresh } from '../../lib/useLiveRefresh'

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

    useLiveRefresh(['request_requirements', 'document_requests'], (options) => loadRequirements(options))

    useEffect(() => {
        loadRequirements()
    }, [requestId])

    const loadRequirements = async ({ silent = false } = {}) => {
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
            setError(friendlyError(err, "We couldn't load your requirements."))
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

        const originalLimit = isShrinkable(file) ? Math.max(maxSize, MAX_ORIGINAL_IMAGE_MB * 1024 * 1024) : maxSize
        if (file.size > originalLimit) {
            notifyWarning(`File must not exceed ${Math.round(originalLimit / 1024 / 1024)} MB.`)
            return
        }

        try {
            setUploadingId(requirement.request_requirement_id)

            // Photos are shrunk before upload; PDFs go up as they are.
            const uploadFile = await shrinkImage(file)
            if (uploadFile.size > maxSize) {
                throw new Error(`File must not exceed ${requirement.document_requirements?.max_file_size_mb || 5} MB.`)
            }

            const fileExtension = uploadFile.name.split('.').pop().toLowerCase()
            const fileName = `${requirement.document_requirements.requirement_id}-${Date.now()}.${fileExtension}`
            const filePath = `${student.student_id}/${requestId}/${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('student-requirements')
                .upload(filePath, uploadFile, { cacheControl: '3600', upsert: false })

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
            notifyError(friendlyError(err, 'Failed to upload requirement.'))
        } finally {
            setUploadingId(null)
        }
    }

    if (loading) {
        return (
            <SkeletonPage
                portal="student"
                blocks={[
                    { type: 'back' },
                    { type: 'header', titleWidth: 260 },
                    { type: 'list', title: false, count: 3, fields: 0 },
                ]}
            />
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
                <p>Upload the documents the Registrar needs for this request. Use clear photos or PDF scans.</p>
            </div>

            {requirements.length > 0 && (
                <TaskSteps
                    steps={['Upload each requirement', 'The Registrar reviews them', 'All approved']}
                    current={requirements.every((r) => r.status === 'approved') ? 3 : requirements.some((r) => r.status === 'pending' || r.status === 'rejected') ? 0 : 1}
                />
            )}

            {requirements.some((r) => r.status === 'rejected') && (
                <InfoBox title="Some files were not accepted" tone="warning">
                    Read the reason under each one marked <b>Rejected</b>, then upload a clearer or corrected file.
                </InfoBox>
            )}

            {request?.status === 'cancelled' && (
                <div className="student-notice tone-danger" style={{ marginBottom: 16 }}>
                    <strong>Request Cancelled</strong>
                    <p>This request has been cancelled, so requirements can no longer be uploaded.</p>
                </div>
            )}

            {requirements.length === 0 ? (
                <EmptyState
                    title="No requirements needed"
                    text="This document doesn't need any extra files. You can go back to your request."
                    action={{ label: 'Back to my request', to: `/student/request/${requestId}` }}
                />
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
                                <div className="ss-upload-row">
                                    <FilePicker
                                        file={files[req.request_requirement_id] || null}
                                        onChange={(picked) => setFiles((prev) => ({ ...prev, [req.request_requirement_id]: picked }))}
                                        accept={doc?.accepted_file_types || undefined}
                                        maxMb={doc?.max_file_size_mb || 5}
                                        disabled={uploadingId === req.request_requirement_id}
                                        label={req.status === 'rejected' ? 'Upload a new file' : 'Upload your document'}
                                    />

                                    <button
                                        type="button"
                                        className="ss-upload-btn"
                                        onClick={() => uploadRequirement(req)}
                                        disabled={uploadingId === req.request_requirement_id || !files[req.request_requirement_id]}
                                    >
                                        {uploadingId === req.request_requirement_id
                                            ? 'Uploading...'
                                            : req.status === 'rejected' ? 'Upload Again' : 'Upload'}
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
