import { Link } from 'react-router-dom'
import LegalLayout from './LegalLayout'

function PrivacyPolicy() {
    return (
        <LegalLayout title="Privacy Policy" updated="August 29, 2026">

            <p>
                This Privacy Policy explains how Holy Cross of Davao College (HCDC), through the Registrar Services
                platform, collects, uses, and protects your personal information, in line with the
                Philippine Data Privacy Act of 2012 (Republic Act No. 10173).
            </p>

            <h2>1. Information we collect</h2>
            <ul>
                <li><strong>Account information:</strong> name, email address, and password (or your Google account, for @hcdc.edu.ph sign-in).</li>
                <li><strong>Student information:</strong> student number, college, program, year level, phone number, address, birth date and place, and emergency contact details.</li>
                <li><strong>Document requests:</strong> the documents you request, stated purpose, quantity, fees, and status/history of each request.</li>
                <li><strong>Payment records:</strong> uploaded official receipts, used to verify payment for a request.</li>
                <li><strong>Profile photo</strong>, if you choose to upload one.</li>
                <li><strong>Messages</strong> exchanged with your assigned registrar staff, and system notifications sent to your account.</li>
                <li><strong>Activity and security data:</strong> basic records of account activity (e.g. staff actions on requests, login attempts) used for auditing and account security.</li>
            </ul>

            <h2>2. How we use it</h2>
            <p>Your information is used to:</p>
            <ul>
                <li>Verify your identity and maintain your account;</li>
                <li>Process, verify, and fulfill your document requests;</li>
                <li>Communicate with you about your requests, payments, and claim schedules;</li>
                <li>Maintain the security and integrity of the platform (e.g. detecting suspicious login activity); and</li>
                <li>Keep records the Registrar's Office is required to maintain.</li>
            </ul>

            <h2>3. Who can see your information</h2>
            <p>
                Your student and request information is visible to the registrar employee assigned to your
                request, the Registrar Head, and system administrators — the people who need it to process
                your requests. Other students cannot see your information. Access is enforced at the
                database level, not just hidden in the interface.
            </p>

            <h2>4. Where it's stored</h2>
            <p>
                Your information is treated as part of your official student records, maintained by Holy
                Cross of Davao College's Registrar's Office. It is safeguarded the same way your other
                academic records are protected, and is never sold, rented, or shared with outside parties.
            </p>

            <h2>5. How long we keep it</h2>
            <p>
                Your information is retained for as long as your account is active and for as long as
                needed to maintain accurate academic and transaction records, consistent with HCDC's
                record-keeping obligations.
            </p>

            <h2>6. Your rights</h2>
            <p>Under the Data Privacy Act, you have the right to:</p>
            <ul>
                <li>Be informed that your data is being collected and how it's used;</li>
                <li>Access the personal data we hold about you;</li>
                <li>Request correction of inaccurate information (you can update most contact details yourself in your Profile page);</li>
                <li>Object to or request the erasure/blocking of your data, subject to HCDC's legitimate record-keeping requirements; and</li>
                <li>File a complaint with the National Privacy Commission if you believe your data has been mishandled.</li>
            </ul>
            <p>
                To exercise any of these rights, contact the HCDC Registrar's Office.
            </p>

            <h2>7. Cookies and local storage</h2>
            <p>
                Registrar Services uses your browser's local storage to keep you signed in and to remember small
                preferences (like a collapsed menu state). It does not use third-party advertising or
                tracking cookies.
            </p>

            <h2>8. Changes to this policy</h2>
            <p>
                This policy may be updated from time to time to reflect changes in how Registrar Services operates.
                Continued use of the platform after an update means you accept the revised policy.
            </p>

            <h2>9. Contact</h2>
            <p>
                Questions or concerns about your privacy can be directed to the Holy Cross of Davao College
                Registrar's Office.
            </p>

            <div className="legal-cross-link">
                Also see our <Link to="/terms">Terms of Service</Link> for the rules of using Registrar Services.
            </div>

        </LegalLayout>
    )
}

export default PrivacyPolicy
