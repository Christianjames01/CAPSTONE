import hcdcLogo from '../assets/hcdc-logo.png'

let cached = null

export async function getHcdcLogoBase64() {
    if (cached) return cached

    const res = await fetch(hcdcLogo)
    const blob = await res.blob()

    cached = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(String(reader.result).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(blob)
    })

    return cached
}
