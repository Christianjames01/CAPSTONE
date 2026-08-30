import QRCode from 'qrcode'

// Builds the public verify-page URL for a credential number, using
// whichever origin the app is currently running on (localhost, preview,
// or production) so QR codes work in every environment.
export function verificationUrl(credentialNumber) {
    return `${window.location.origin}/verify/${encodeURIComponent(credentialNumber)}`
}

export async function generateQrDataUrl(text) {
    return QRCode.toDataURL(text, {
        width: 220,
        margin: 1,
        color: { dark: '#101827', light: '#ffffff' },
    })
}
