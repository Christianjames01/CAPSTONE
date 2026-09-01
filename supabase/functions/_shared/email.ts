// Shared email sender used by both notification email functions.
// Sends via Gmail SMTP (an app password on a real Gmail/Workspace
// account), since Mailgun was never activated.
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

const GMAIL_USER = Deno.env.get('GMAIL_USER')
const GMAIL_APP_PASSWORD = Deno.env.get('GMAIL_APP_PASSWORD')

export const FROM_EMAIL = Deno.env.get('NOTIFICATION_FROM_EMAIL') || `HCDC Registrar Services <${GMAIL_USER}>`

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
    if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
        throw new Error('GMAIL_USER / GMAIL_APP_PASSWORD are not configured.')
    }

    const client = new SMTPClient({
        connection: {
            hostname: 'smtp.gmail.com',
            port: 465,
            tls: true,
            auth: {
                username: GMAIL_USER,
                password: GMAIL_APP_PASSWORD,
            },
        },
    })

    try {
        await client.send({
            from: FROM_EMAIL,
            to,
            subject,
            content: 'This email requires an HTML-capable client.',
            html,
        })

        console.log('GMAIL SMTP SUCCESS:', to)
        return { sent: true }

    } catch (err) {
        console.error('GMAIL SMTP ERROR:', err)
        throw new Error(`Gmail SMTP send failed: ${err}`)

    } finally {
        await client.close()
    }
}
