import Swal from 'sweetalert2'
import { supabase } from './supabase'
import { getCaptchaToken } from './captcha'
import { notifyError } from './notify'

// Asks the signed-in staff member to re-enter their password before a
// sensitive manual action (e.g. manually changing a request's status), and
// checks it with the server. Sign-in is protected by the security check, so
// that runs too. Returns true only when the password is correct.
export async function confirmWithPassword({ title = 'Confirm with your password', text } = {}) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) {
        notifyError('You are not logged in.')
        return false
    }

    const { value: password, isConfirmed } = await Swal.fire({
        icon: 'warning',
        title,
        text: text || 'For security, enter your account password to continue.',
        input: 'password',
        inputPlaceholder: 'Your password',
        inputAttributes: { autocomplete: 'current-password', autocapitalize: 'off', autocorrect: 'off' },
        showCancelButton: true,
        confirmButtonText: 'Confirm',
        confirmButtonColor: '#123B78',
        inputValidator: (value) => (!value ? 'Please enter your password.' : undefined),
    })

    if (!isConfirmed || !password) return false

    const captchaToken = await getCaptchaToken()
    if (captchaToken === null) return false // closed the security check

    const { data, error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
        options: { captchaToken },
    })

    if (error || data?.user?.id !== user.id) {
        notifyError(
            /invalid login credentials/i.test(error?.message || '')
                ? 'Incorrect password. The change was not made.'
                : `Your password could not be checked: ${error?.message || 'please try again.'}`,
            'Not confirmed'
        )
        return false
    }

    return true
}
