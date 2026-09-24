// Shared checks for the student sign-up forms (Register and the Google
// Complete Profile step). Every field is required; these catch values that
// are filled in but unusable, which the browser's `required` can't.

// Picked from the suffix dropdown when the student has none -- saved as null.
export const SUFFIX_NONE = 'none'

export const SUFFIX_OPTIONS = ['Jr.', 'Sr.', 'II', 'III', 'IV', 'V']

const PH_MOBILE = /^09\d{9}$/

export function validateRegistrationDetails({
    phoneNumber,
    alternatePhoneNumber,
    alternateEmail,
    emergencyContactNumber,
}) {
    if (!PH_MOBILE.test(phoneNumber)) {
        return 'Phone number must be an 11-digit mobile number starting with 09.'
    }

    if (!PH_MOBILE.test(alternatePhoneNumber)) {
        return 'Alternate phone number must be an 11-digit mobile number starting with 09.'
    }

    if (alternatePhoneNumber === phoneNumber) {
        return 'Alternate phone number must be different from your main phone number.'
    }

    if (!PH_MOBILE.test(emergencyContactNumber)) {
        return 'Emergency number must be an 11-digit mobile number starting with 09.'
    }

    if (alternateEmail.trim().toLowerCase().endsWith('@hcdc.edu.ph')) {
        return 'Personal email must be a non-HCDC address (e.g. Gmail) that you will keep after graduation.'
    }

    return null
}
