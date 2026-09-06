import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

const GMAIL_USER = Deno.env.get('GMAIL_USER')
const GMAIL_APP_PASSWORD = Deno.env.get('GMAIL_APP_PASSWORD')

export const FROM_EMAIL = Deno.env.get('NOTIFICATION_FROM_EMAIL') || `CertiChain <${GMAIL_USER}>`

const LOGO_URL = 'https://onlineregistrar.vercel.app/hcdc-logo.png'

export const EMAIL_FOOTER_HTML = `
    <table role="presentation" width="100%" style="margin-top:28px;border-top:1px solid #E2E6EB;padding-top:20px;">
        <tr>
            <td style="width:64px;vertical-align:top;">
                <img src="${LOGO_URL}" alt="Holy Cross of Davao College" width="56" height="56" style="display:block;border-radius:50%;" />
            </td>
            <td style="vertical-align:top;padding-left:14px;font-family:Arial,Helvetica,sans-serif;">
                <div style="font-weight:700;color:#8A1F2B;font-size:14px;line-height:1.3;">HOLY CROSS OF DAVAO COLLEGE</div>
                <div style="font-size:12.5px;color:#3C3C3C;margin-top:6px;">Holy Cross of Davao College Inc.</div>
                <div style="font-size:12.5px;color:#3C3C3C;">Sta. Ana Avenue Davao City</div>
                <div style="font-size:12.5px;color:#3C3C3C;">Phone: +6382-221-9071 to +6382-221-9079</div>
                <div style="font-size:12.5px;"><a href="https://www.hcdc.edu.ph" style="color:#123B78;">www.hcdc.edu.ph</a></div>
            </td>
        </tr>
    </table>
    <p style="font-size:10.5px;color:#8A8F98;margin-top:16px;border-top:1px solid #E2E6EB;padding-top:12px;">
        Holy Cross of Davao College Inc., accepts no liability for the content of this email, or for the consequences of any
        actions taken on the basis of the information provided unless that information is subsequently confirmed in writing.
        Any views or opinions presented in this email are solely those of the author and do not necessarily represent those
        of the school.
    </p>
`

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
