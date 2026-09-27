import { createRoot } from 'react-dom/client'
import CaptchaPrompt from '../components/CaptchaPrompt'

// Opens the security-check pop-up on top of the page and resolves with the
// token, or null if the user closed it.
export function openCaptchaPrompt() {
    return new Promise((resolve) => {
        const host = document.createElement('div')
        document.body.appendChild(host)
        const root = createRoot(host)

        const done = (token) => {
            resolve(token)
            setTimeout(() => {
                root.unmount()
                host.remove()
            }, 0)
        }

        root.render(<CaptchaPrompt onDone={done} />)
    })
}
