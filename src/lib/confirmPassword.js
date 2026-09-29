import Swal from 'sweetalert2'
import { supabase } from './supabase'
import { getCaptchaToken } from './captcha'
import { notifyError } from './notify'

// Asks the signed-in staff member to re-enter their password before a
// sensitive manual action (e.g. manually changing a request's status), and
// checks it with the server. Returns true only when the password is correct.
//
// The check runs in the database (verify_my_password -- no sign-in, so no
// Cloudflare security check). Until that migration is applied it falls back
// to a normal sign-in, which does need the security check.

// Supabase's "function doesn't exist" answer.
const missingFunction = (error) => error?.code === 'PGRST202'
    || (/verify_my_password/i.test(error?.message || '') && /not find|does not exist/i.test(error?.message || ''))

async function checkBySignIn(email, password, userId) {
    const captchaToken = await getCaptchaToken()
    if (captchaToken === null) return { ok: false, cancelled: true }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password, options: { captchaToken } })
    if (error && !/invalid login credentials/i.test(error.message || '')) return { ok: false, message: error.message }
    return { ok: !error && data?.user?.id === userId }
}

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

    let result
    const { data, error } = await supabase.rpc('verify_my_password', { p_password: password })
    if (error && missingFunction(error)) {
        result = await checkBySignIn(user.email, password, user.id)
    } else if (error) {
        result = { ok: false, message: error.message }
    } else {
        result = { ok: data === true }
    }

    if (result.cancelled) return false
    if (!result.ok) {
        notifyError(
            result.message
                ? `Your password could not be checked: ${result.message}`
                : 'Incorrect password. The change was not made.',
            'Not confirmed'
        )
        return false
    }

    return true
}
