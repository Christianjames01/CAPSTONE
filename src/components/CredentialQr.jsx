import { useEffect, useState } from 'react'
import { generateQrDataUrl, verificationUrl } from '../lib/qrcode'
import './CredentialQr.css'

// Shows a credential's verify link as both a QR code and plain text,
// for staff to hand to a student or for a student to keep with their
// document -- anyone can scan/visit it to confirm authenticity, no
// login required.
function CredentialQr({ credentialNumber }) {
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

    return (
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
    )
}

export default CredentialQr
