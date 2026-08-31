import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import hcdcLogo from '../../assets/hcdc-logo.png'
import './Verify.css'

function VerifyCredential() {
    const { credentialNumber } = useParams()
    const navigate = useNavigate()

    const [term, setTerm] = useState(credentialNumber || '')
    const [result, setResult] = useState(null)
    const [loading, setLoading] = useState(false)
    const [searched, setSearched] = useState(false)
    const [rateLimitMessage, setRateLimitMessage] = useState('')

    useEffect(() => {
        if (credentialNumber) {
            lookup(credentialNumber)
        }
    }, [credentialNumber])

    const lookup = async (number) => {
        const query = (number || '').trim()
        if (!query) return

        try {
            setLoading(true)
            setSearched(true)
            setRateLimitMessage('')

            const { data, error } = await supabase.functions.invoke('verify-credential', {
                body: { credentialNumber: query },
            })

            if (error) {
                console.error('VERIFY LOOKUP ERROR:', error)
                setResult(null)
                return
            }

            if (data?.rateLimited) {
                setRateLimitMessage(data.message || 'Too many verification attempts. Please try again in a few minutes.')
                setResult(null)
                return
            }

            setResult(data?.result || null)

        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!term.trim()) return
        navigate(`/verify/${encodeURIComponent(term.trim())}`)
    }

    const formatDate = (value) =>
        value
            ? new Date(value).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
            : 'N/A'

    return (
        <div className="verify-page">
            <header className="verify-header">
                <div className="verify-header-inner">
                    <Link to="/" className="verify-brand">
                        <img src={hcdcLogo} alt="Holy Cross of Davao College" />
                        <div>
                            <div className="verify-brand-name">CertiChain</div>
                            <div className="verify-brand-subtitle">Credential Verification</div>
                        </div>
                    </Link>
                </div>
            </header>

            <div className="verify-content">
                <h1>Verify a Credential</h1>
                <p className="verify-subtitle">
                    Enter the credential number printed on the document, or scan its QR code, to confirm it was issued by Holy Cross of Davao College's Registrar Office.
                </p>

                <form className="verify-form" onSubmit={handleSubmit}>
                    <input
                        type="text"
                        value={term}
                        onChange={(e) => setTerm(e.target.value)}
                        placeholder="e.g. CERT-000123"
                        className="verify-input"
                    />
                    <button type="submit" className="verify-submit" disabled={loading}>
                        {loading ? 'Checking...' : 'Verify'}
                    </button>
                </form>

                {!loading && rateLimitMessage && (
                    <div className="verify-result verify-result-invalid">
                        <div className="verify-result-badge">⏳ Too Many Attempts</div>
                        <p>{rateLimitMessage}</p>
                    </div>
                )}

                {!loading && !rateLimitMessage && searched && (
                    result ? (
                        <div className={`verify-result ${result.status === 'revoked' ? 'verify-result-invalid' : 'verify-result-valid'}`}>
                            <div className="verify-result-badge">
                                {result.status === 'revoked' ? '✕ Revoked' : '✓ Verified'}
                            </div>
                            <h2>{result.document_name}</h2>
                            <p className="verify-result-note">
                                {result.status === 'revoked'
                                    ? `This credential was revoked by the Registrar Office and is no longer valid.${result.revocation_reason ? ` Reason: ${result.revocation_reason}` : ''}`
                                    : "This credential was issued by the Holy Cross of Davao College Registrar Office and is authentic."}
                            </p>

                            <div className="verify-field-grid">
                                <div className="verify-field">
                                    <span>Credential Number</span>
                                    <strong>{result.credential_number}</strong>
                                </div>
                                <div className="verify-field">
                                    <span>Issued To</span>
                                    <strong>{result.student_name}</strong>
                                </div>
                                {result.college_name && (
                                    <div className="verify-field">
                                        <span>College</span>
                                        <strong>{result.college_name}</strong>
                                    </div>
                                )}
                                {result.program_name && (
                                    <div className="verify-field">
                                        <span>Program</span>
                                        <strong>{result.program_name}</strong>
                                    </div>
                                )}
                                <div className="verify-field">
                                    <span>Request Number</span>
                                    <strong>{result.request_number}</strong>
                                </div>
                                <div className="verify-field">
                                    <span>Issued On</span>
                                    <strong>{formatDate(result.generated_at)}</strong>
                                </div>
                                {result.status === 'revoked' && (
                                    <div className="verify-field">
                                        <span>Revoked On</span>
                                        <strong>{formatDate(result.revoked_at)}</strong>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="verify-result verify-result-invalid">
                            <div className="verify-result-badge">✕ Not Found</div>
                            <p>
                                No credential matches "{term}". Double-check the number, or contact the Registrar's Office at{' '}
                                <a href="mailto:registrar@hcdc.edu.ph">registrar@hcdc.edu.ph</a> if you believe this is an error.
                            </p>
                        </div>
                    )
                )}
            </div>
        </div>
    )
}

export default VerifyCredential
