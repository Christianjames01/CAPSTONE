// Keeps every phone/contact-number field to exactly what a PH mobile number
// looks like: digits only, capped at 11 characters (09XXXXXXXXX). Used both
// to filter keystrokes (digitsOnly, in onChange) and to validate on submit
// (isValidPhMobile) -- so a field can't end up with letters, spaces, dashes,
// or the wrong length either by typing or by pasting.

export const PH_MOBILE = /^09\d{9}$/

export function digitsOnly(value, max = 11) {
    return (value || '').replace(/\D/g, '').slice(0, max)
}

export function isValidPhMobile(value) {
    return PH_MOBILE.test(value || '')
}
