import QRCode from 'qrcode'

// QR codes are scanned by other people's phones, so they must always point at
// the public site -- not at whatever address the page happens to be open on
// (localhost during development, or the self-hosted VM's IP), which a phone
// can't reach. Override with VITE_PUBLIC_SITE_URL if the domain changes.
const PUBLIC_SITE_URL = (import.meta.env.VITE_PUBLIC_SITE_URL || 'https://onlineregistrar.vercel.app').replace(/\/+$/, '')

export function verificationUrl(credentialNumber) {
    return `${PUBLIC_SITE_URL}/verify/${encodeURIComponent(credentialNumber)}`
}

export async function generateQrDataUrl(text) {
    return QRCode.toDataURL(text, {
        width: 220,
        margin: 1,
        color: { dark: '#101827', light: '#ffffff' },
    })
}
