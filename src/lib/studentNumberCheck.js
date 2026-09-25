import { supabase } from './supabase'

// "Is this student ID already registered?" for the sign-up forms, checked
// before any account is created. Returns true/false, or null if the check
// isn't available (database function not deployed) -- callers then carry on
// and rely on the database's unique index.
export async function isStudentNumberTaken(studentNumber) {
    const value = (studentNumber || '').trim()
    if (!value) return false

    const { data, error } = await supabase.rpc('is_student_number_taken', { p_student_number: value })

    if (error) {
        console.warn('STUDENT NUMBER CHECK ERROR:', error)
        return null
    }

    return data === true
}

export function studentNumberTakenMessage(studentNumber) {
    return `Student ID ${studentNumber} is already registered. If this is your ID, log in or use "Forgot password". ` +
        "If you didn't register it, contact the Registrar's Office."
}

// Same idea for the phone number (digits-only match, ignores the caller's
// own profile). true/false, or null if the check isn't available.
export async function isPhoneNumberTaken(phoneNumber) {
    const value = (phoneNumber || '').trim()
    if (!value) return false

    const { data, error } = await supabase.rpc('is_phone_number_taken', { p_phone_number: value })

    if (error) {
        console.warn('PHONE NUMBER CHECK ERROR:', error)
        return null
    }

    return data === true
}

export function phoneNumberTakenMessage(phoneNumber) {
    return `The phone number ${phoneNumber} is already registered to another account. ` +
        "Please use your own number, or contact the Registrar's Office if you think this is a mistake."
}

// Friendly text for a unique-violation from the students insert.
export function isDuplicateStudentNumberError(error) {
    return error?.code === '23505' || /student_number/i.test(error?.message || '')
}
