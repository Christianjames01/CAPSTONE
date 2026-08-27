// Shared Mailgun sender used by both notification email functions.
const MAILGUN_API_KEY = Deno.env.get('MAILGUN_API_KEY')
const MAILGUN_DOMAIN = Deno.env.get('MAILGUN_DOMAIN')

export const FROM_EMAIL = Deno.env.get('NOTIFICATION_FROM_EMAIL') || `CertiChain <postmaster@${MAILGUN_DOMAIN}>`

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
    const form = new URLSearchParams()
    form.set('from', FROM_EMAIL)
    form.set('to', to)
    form.set('subject', subject)
    form.set('html', html)

    const res = await fetch(`https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`, {
        method: 'POST',
        headers: {
            Authorization: 'Basic ' + btoa(`api:${MAILGUN_API_KEY}`),
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
    })

    const body = await res.text()

    if (!res.ok) {
        console.error('MAILGUN ERROR:', res.status, body)
        throw new Error(`Mailgun ${res.status}: ${body}`)
    }

    console.log('MAILGUN SUCCESS:', body)
    return body
}
