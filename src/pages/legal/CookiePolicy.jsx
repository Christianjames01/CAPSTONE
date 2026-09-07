import { Link } from 'react-router-dom'
import LegalLayout from './LegalLayout'

function CookiePolicy() {
    return (
        <LegalLayout title="Cookie Policy" updated="September 8, 2026">

            <p>
                This page explains, plainly, what CertiChain stores in your browser and why.
            </p>

            <h2>1. CertiChain does not use cookies</h2>
            <p>
                CertiChain does not set or read browser cookies of any kind — no essential cookies, no
                analytics cookies, and no third-party advertising or tracking cookies. There is no cookie
                consent banner on this site because there is nothing to consent to.
            </p>

            <h2>2. What we do use: local storage</h2>
            <p>
                To keep you signed in and to remember a small number of interface preferences (such as
                whether you've switched to dark mode), CertiChain uses your browser's <strong>local
                storage</strong> — a different, non-cookie mechanism that stays on your device and is never
                automatically sent to any server. This data:
            </p>
            <ul>
                <li>Is only ever read by CertiChain itself, never by a third party;</li>
                <li>Stays on your own device — it isn't transmitted with every request the way a cookie is;</li>
                <li>Is cleared automatically when you sign out, or manually if you clear your browser's site data.</li>
            </ul>

            <h2>3. No analytics or advertising trackers</h2>
            <p>
                CertiChain does not use Google Analytics, Facebook Pixel, or any other analytics or
                advertising tracking service. Your activity on the platform is not tracked for marketing
                purposes.
            </p>

            <h2>4. Third-party content</h2>
            <p>
                A small number of pages load fonts directly from Google Fonts (fonts.googleapis.com) so
                text displays correctly. Loading a font this way can expose your IP address to Google as
                part of a normal web request, the same as loading an image from any external site — this is
                separate from cookies and is not used by CertiChain for tracking.
            </p>

            <h2>5. If this changes</h2>
            <p>
                If CertiChain ever adds analytics, advertising, or any cookie that isn't strictly necessary
                for the platform to function, this policy will be updated first, and a consent mechanism
                will be added before any such cookie is set.
            </p>

            <h2>6. Contact</h2>
            <p>
                Questions about this policy can be directed to the Holy Cross of Davao College Registrar's
                Office at info@hcdc.edu.ph or (082) 221-9071 to 79.
            </p>

            <div className="legal-cross-link">
                Also see our <Link to="/privacy-policy">Privacy Policy</Link> for how your information is collected and used.
            </div>

        </LegalLayout>
    )
}

export default CookiePolicy
