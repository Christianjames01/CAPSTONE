import { Link } from 'react-router-dom'
import LegalLayout from './LegalLayout'

function Terms() {
    return (
        <LegalLayout title="Terms of Service" updated="August 29, 2026">

            <h2>1. About Registrar Services</h2>
            <p>
                Registrar Services is the online registrar services platform of Holy Cross of Davao College (HCDC),
                used to request, track, and process academic documents. By creating an account or using
                Registrar Services, you agree to these Terms of Service.
            </p>

            <h2>2. Who can use it</h2>
            <p>
                Registrar Services is for current HCDC students and authorized registrar staff. Student and Google
                sign-in accounts must use a valid <strong>@hcdc.edu.ph</strong> email address. Creating an
                account under a false identity, on behalf of someone else, or using a non-HCDC email is not
                allowed.
            </p>

            <h2>3. Your account</h2>
            <ul>
                <li>You're responsible for keeping your password confidential and for all activity under your account.</li>
                <li>Information you provide (name, student number, program, contact details, etc.) must be accurate. Inaccurate information can delay or block your document requests.</li>
                <li>Repeated failed login attempts will temporarily lock your account for a short period as a security measure.</li>
                <li>Student accounts can only be signed in on one device at a time — signing in elsewhere signs out the previous session.</li>
            </ul>

            <h2>4. Requesting documents</h2>
            <p>
                Document requests, fees, and processing times are set and may be changed by the Registrar's
                Office. Submitting a request does not guarantee approval — requests can be rejected if
                requirements are incomplete, a payment can't be verified, or information doesn't match your
                academic record.
            </p>
            <p>
                Receipts and other files you upload must be genuine and unaltered. Submitting a falsified
                receipt or document is grounds for rejecting the request and may lead to account
                deactivation and referral to the appropriate HCDC office.
            </p>

            <h2>5. Acceptable use</h2>
            <p>You agree not to:</p>
            <ul>
                <li>Impersonate another student, employee, or the Registrar's Office;</li>
                <li>Attempt to access another person's account or data without authorization;</li>
                <li>Upload falsified receipts, documents, or requirements;</li>
                <li>Interfere with or disrupt the platform (e.g. attempting to bypass security controls); or</li>
                <li>Use the platform for any purpose unrelated to legitimate registrar transactions.</li>
            </ul>

            <h2>6. Suspension and termination</h2>
            <p>
                The Registrar's Office may deactivate or restrict an account that violates these terms,
                submits fraudulent information, or on request of the account holder. You can reach out to
                the Registrar's Office to request that your account be deactivated.
            </p>

            <h2>7. Availability</h2>
            <p>
                Registrar Services is provided on an "as available" basis. We don't guarantee uninterrupted access,
                and features, fees, or processing times may change without prior notice.
            </p>

            <h2>8. Changes to these terms</h2>
            <p>
                These terms may be updated from time to time. Continuing to use Registrar Services after a change
                means you accept the updated terms.
            </p>

            <h2>9. Governing law</h2>
            <p>
                These terms are governed by the laws of the Republic of the Philippines.
            </p>

            <h2>10. Contact</h2>
            <p>
                Questions about these terms can be directed to the Holy Cross of Davao College Registrar's
                Office.
            </p>

            <div className="legal-cross-link">
                Also see our <Link to="/privacy-policy">Privacy Policy</Link> for how your information is collected and used.
            </div>

        </LegalLayout>
    )
}

export default Terms
