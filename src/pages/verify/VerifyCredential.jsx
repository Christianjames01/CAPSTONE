import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { REGISTRAR_CONTACT } from '../../lib/registrarContact'
import hcdcLogo from '../../assets/hcdc-logo.png'
import './Verify.css'

const formatDate = (value) =>
    value
        ? new Date(value).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
        : 'N/A'

// Which banner to show for a lookup result.
function outcomeFor(result) {
    if (!result) {
        return {
            tone: 'missing',
            icon: '?',
            title: 'No credential found',
            subtitle: 'This number doesn’t match any credential issued through CertiChain.',
        }
    }
    if (result.signatureValid === false) {
        return {
            tone: 'tampered',
            icon: '!',
            title: 'Tampered — do not accept',
            subtitle: 'This record no longer matches what the Registrar originally issued.',
        }
    }
    if (result.status === 'revoked') {
        return {
            tone: 'revoked',
            icon: '✕',
            title: 'Revoked credential',
            subtitle: 'The Registrar’s Office cancelled this credential. It is no longer valid.',
        }
    }
    return {
        tone: 'verified',
        icon: '✓',
        title: 'Verified credential',
        subtitle: 'Issued by the Holy Cross of Davao College Registrar’s Office and unchanged since.',
    }
}

function VerifyCredential() {
    const { credentialNumber } = useParams()
    const navigate = useNavigate()

    const [term, setTerm] = useState(credentialNumber || '')
    const [result, setResult] = useState(null)
    const [loading, setLoading] = useState(false)
    const [searched, setSearched] = useState(false)
    const [checkedAt, setCheckedAt] = useState(null)
    const [rateLimitMessage, setRateLimitMessage] = useState('')
    const [lookupError, setLookupError] = useState('')

    useEffect(() => {
        if (credentialNumber) {
            lookup(credentialNumber)
        }
    }, [credentialNumber])

    const lookup = async (number) => {
        const query = (number || '').trim().toUpperCase()
        if (!query) return

        try {
            setLoading(true)
            setSearched(true)
            setRateLimitMessage('')
            setLookupError('')

            const { data, error } = await supabase.functions.invoke('verify-credential', {
                body: { credentialNumber: query },
            })

            if (error) {
                console.error('VERIFY LOOKUP ERROR:', error)
                setResult(null)
                setLookupError('We couldn’t reach the verification service. Please try again in a moment.')
                return
            }

            if (data?.rateLimited) {
                setRateLimitMessage(data.message || 'Too many verification attempts. Please try again in a few minutes.')
                setResult(null)
                return
            }

            setResult(data?.result || null)
            setCheckedAt(new Date())
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        const value = term.trim().toUpperCase()
        if (!value) return
        if (value === (credentialNumber || '').toUpperCase()) lookup(value)
        else navigate(`/verify/${encodeURIComponent(value)}`)
    }

    const checkAnother = () => {
        setTerm('')
        setResult(null)
        setSearched(false)
        navigate('/verify')
        requestAnimationFrame(() => document.getElementById('verify-input')?.focus())
    }

    const showResult = !loading && searched && !rateLimitMessage && !lookupError
    const outcome = outcomeFor(result)

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
                    <Link to="/" className="verify-back">← Back to CertiChain</Link>
                </div>
            </header>

            <main className="verify-content">
                <div className="verify-hero">
                    <span className="verify-eyebrow">Official verification</span>
                    <h1>Verify a Credential</h1>
                    <p className="verify-subtitle">
                        Enter the credential number printed on the document, or scan its QR code, to confirm it was
                        issued by the Holy Cross of Davao College Registrar’s Office.
                    </p>

                    <form className="verify-form" onSubmit={handleSubmit}>
                        <label htmlFor="verify-input" className="verify-visually-hidden">Credential number</label>
                        <input
                            id="verify-input"
                            type="text"
                            value={term}
                            onChange={(e) => setTerm(e.target.value)}
                            placeholder="e.g. CERT-000123"
                            className="verify-input"
                            autoComplete="off"
                            spellCheck={false}
                        />
                        <button type="submit" className="verify-submit" disabled={loading || !term.trim()}>
                            {loading ? 'Checking…' : 'Verify'}
                        </button>
                    </form>
                </div>

                {loading && (
                    <div className="verify-card verify-loading" role="status">
                        <span className="verify-spinner" aria-hidden="true" />
                        Checking the Registrar’s signed records…
                    </div>
                )}

                {!loading && rateLimitMessage && (
                    <div className="verify-card verify-notice">
                        <strong>Too many attempts</strong>
                        <p>{rateLimitMessage}</p>
                    </div>
                )}

                {!loading && lookupError && (
                    <div className="verify-card verify-notice">
                        <strong>Verification unavailable</strong>
                        <p>{lookupError}</p>
                    </div>
                )}

                {showResult && (
                    <section className={`verify-card verify-result is-${outcome.tone}`} aria-live="polite">
                        <div className="verify-banner">
                            <span className="verify-banner-icon" aria-hidden="true">{outcome.icon}</span>
                            <div>
                                <strong>{outcome.title}</strong>
                                <span>{outcome.subtitle}</span>
                            </div>
                        </div>

                        {result ? (
                            <div className="verify-body">
                                <span className="verify-doc-label">Document</span>
                                <h2>{result.document_name}</h2>

                                {result.status === 'revoked' && result.revocation_reason && (
                                    <p className="verify-reason"><strong>Reason:</strong> {result.revocation_reason}</p>
                                )}
                                {result.signatureValid === false && (
                                    <p className="verify-reason">
                                        Please contact the Registrar’s Office before relying on this document.
                                    </p>
                                )}

                                <dl className="verify-fields">
                                    <div>
                                        <dt>Credential number</dt>
                                        <dd className="is-mono">{result.credential_number}</dd>
                                    </div>
                                    <div>
                                        <dt>Issued to</dt>
                                        <dd>{result.student_name}</dd>
                                    </div>
                                    {result.program_name && (
                                        <div className="is-wide">
                                            <dt>Program</dt>
                                            <dd>{result.program_name}</dd>
                                        </div>
                                    )}
                                    {result.college_name && (
                                        <div className="is-wide">
                                            <dt>College</dt>
                                            <dd>{result.college_name}</dd>
                                        </div>
                                    )}
                                    <div>
                                        <dt>Request number</dt>
                                        <dd className="is-mono">{result.request_number}</dd>
                                    </div>
                                    <div>
                                        <dt>Issued on</dt>
                                        <dd>{formatDate(result.generated_at)}</dd>
                                    </div>
                                    {result.released_at && (
                                        <div>
                                            <dt>Released on</dt>
                                            <dd>{formatDate(result.released_at)}</dd>
                                        </div>
                                    )}
                                    {result.status === 'revoked' && (
                                        <div>
                                            <dt>Revoked on</dt>
                                            <dd>{formatDate(result.revoked_at)}</dd>
                                        </div>
                                    )}
                                </dl>

                                <div className={`verify-signature${result.signatureValid === false ? ' is-bad' : ''}`}>
                                    <span aria-hidden="true">{result.signatureValid === false ? '✕' : '✓'}</span>
                                    {result.signatureValid === false
                                        ? 'Digital signature does not match — the record was altered.'
                                        : 'Digital signature valid — the record matches what the Registrar issued.'}
                                </div>
                            </div>
                        ) : (
                            <div className="verify-body">
                                <p className="verify-missing">
                                    No credential matches <strong className="is-mono">{(credentialNumber || term).toUpperCase()}</strong>.
                                    Check the number for typos (it looks like <span className="is-mono">CERT-000123</span>). If it’s
                                    correct, the document may not be genuine — contact the Registrar’s Office to confirm.
                                </p>
                            </div>
                        )}

                        <div className="verify-footer">
                            <span>Checked {checkedAt ? formatDate(checkedAt) : 'just now'}</span>
                            <div className="verify-actions">
                                {result && (
                                    <button type="button" className="verify-secondary" onClick={() => window.print()}>
                                        Print result
                                    </button>
                                )}
                                <button type="button" className="verify-secondary" onClick={checkAnother}>
                                    Check another
                                </button>
                            </div>
                        </div>
                    </section>
                )}

                {!searched && !loading && (
                    <div className="verify-card verify-tips">
                        <strong>Where to find the number</strong>
                        <p>
                            The credential number (like <span className="is-mono">CERT-000123</span>) is printed near the QR
                            code on documents issued through CertiChain. Scanning the QR code opens this page with the
                            number already filled in.
                        </p>
                    </div>
                )}

                <ul className="verify-trust">
                    <li>
                        <strong>Signed records</strong>
                        <span>Each credential is signed by the Registrar when issued.</span>
                    </li>
                    <li>
                        <strong>Tamper detection</strong>
                        <span>Any change to the record after issuance is flagged.</span>
                    </li>
                    <li>
                        <strong>Free &amp; instant</strong>
                        <span>No account or app needed to verify.</span>
                    </li>
                </ul>

                <p className="verify-contact">
                    Questions about a credential? Contact the {REGISTRAR_CONTACT.office} at{' '}
                    <a href={`mailto:${REGISTRAR_CONTACT.email}`}>{REGISTRAR_CONTACT.email}</a> or{' '}
                    <a href={REGISTRAR_CONTACT.telephoneHref}>{REGISTRAR_CONTACT.telephone}</a>.
                </p>
            </main>
        </div>
    )
}

export default VerifyCredential
