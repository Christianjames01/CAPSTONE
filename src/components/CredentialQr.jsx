import { useEffect, useState } from 'react'
import { generateQrDataUrl, verificationUrl } from '../lib/qrcode'
import './CredentialQr.css'

function CredentialQr({ credentialNumber, status, revocationReason }) {
    const [qrDataUrl, setQrDataUrl] = useState('')

    useEffect(() => {
        let cancelled = false

        if (credentialNumber) {
            generateQrDataUrl(verificationUrl(credentialNumber)).then((url) => {
                if (!cancelled) setQrDataUrl(url)
            })
        }

        return () => { cancelled = true }
    }, [credentialNumber])

    if (!credentialNumber) return null

    const url = verificationUrl(credentialNumber)
    const revoked = status === 'revoked'

    return (
        <div>
            {revoked && (
                <div className="credential-revoked-banner">
                    <strong>Revoked</strong>
                    {revocationReason && <p>{revocationReason}</p>}
                </div>
            )}

            <div className="credential-qr">
                {qrDataUrl && <img src={qrDataUrl} alt="Verification QR code" width={140} height={140} />}
                <div className="credential-qr-info">
                    <div className="credential-qr-label">Credential Number</div>
                    <div className="credential-qr-number">{credentialNumber}</div>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="credential-qr-link">
                        Open verification page →
                    </a>
                </div>
            </div>
        </div>
    )
}

export default CredentialQr
