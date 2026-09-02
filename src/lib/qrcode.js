import QRCode from 'qrcode'

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
