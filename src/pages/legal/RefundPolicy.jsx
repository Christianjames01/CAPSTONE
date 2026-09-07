import { Link } from 'react-router-dom'
import LegalLayout from './LegalLayout'

function RefundPolicy() {
    return (
        <LegalLayout title="Payment & Refund Policy" updated="September 8, 2026">

            <h2>1. CertiChain does not process payments</h2>
            <p>
                CertiChain does not collect, hold, or process any payment itself — there is no card
                processor, online payment gateway, or wallet built into the platform. Document fees are paid
                the same way tuition and other HCDC fees are: to the Cashier/Finance Office. Afterward, you
                upload a copy of your <strong>official receipt</strong> to CertiChain so registrar staff can
                verify that payment was made before processing your request.
            </p>

            <h2>2. What happens if a receipt is rejected</h2>
            <p>
                If registrar staff cannot verify your uploaded receipt (for example, it's unreadable, doesn't
                match the request, or appears altered), your request is marked accordingly and you'll see the
                reason on your Upload Receipt page. This is not a charge or a refund situation — you haven't
                paid CertiChain anything — you simply upload a corrected or clearer copy of your receipt to
                continue.
            </p>

            <h2>3. If you paid but the request can't be completed</h2>
            <p>
                Because payment is made directly to HCDC and not through CertiChain, CertiChain cannot itself
                issue a refund — there is no transaction on this platform to reverse. If a request you've
                already paid for is rejected, cancelled, or otherwise cannot be fulfilled, refund eligibility
                and process are determined by HCDC's Cashier/Finance Office policies, not by CertiChain.
                Please raise the matter directly with that office, referencing your request number.
            </p>

            <h2>4. Cancelling a request before payment</h2>
            <p>
                You can cancel a request yourself from your account while it's still pending — before you've
                paid or uploaded a receipt for it. Once a receipt has been uploaded and is being verified,
                contact your assigned registrar staff or the Registrar's Office before making further changes.
            </p>

            <h2>5. Fees themselves</h2>
            <p>
                Document fees are set by the Registrar's Office and may change over time; the fee shown at
                the time you submit a request is the one that applies to that request.
            </p>

            <h2>6. Contact</h2>
            <p>
                Questions about a specific payment or receipt should go to the HCDC Cashier/Finance Office.
                Questions about a request's status can be sent to your assigned registrar staff through the
                Messages page, or to the Registrar's Office directly at info@hcdc.edu.ph or (082) 221-9071
                to 79.
            </p>

            <div className="legal-cross-link">
                Also see our <Link to="/terms">Terms of Service</Link> for the rules of using CertiChain.
            </div>

        </LegalLayout>
    )
}

export default RefundPolicy
