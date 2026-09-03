import { Link, useSearchParams } from 'react-router-dom'
import Swal from 'sweetalert2'
import hcdcLogo from '../../assets/hcdc-logo.png'
import dpoRegisteredBadge from '../../assets/dpo-registered-badge.png'
import dataPrivacyBadge from '../../assets/data-privacy-badge.png'
import './Legal.css'

const PROCESS_STEPS = [
    ['Create an account', 'Register your CertiChain account and provide your student information.'],
    ['Submit a request', 'Select the academic document you need and submit your request online.'],
    ['Upload requirements', 'Provide supporting documents and an official receipt when applicable.'],
    ['Verification', 'Registrar personnel review your request and verify your student records.'],
    ['Processing', 'Your document is prepared and its verification code is recorded.'],
    ['Claim your document', 'Receive your claiming schedule and present a valid ID when claiming.'],
]

const openHelpModal = () => {
    const steps = PROCESS_STEPS.map(
        ([title, description]) =>
            `<li style="margin-bottom:10px;"><strong>${title}</strong><br/><span style="color:#57616F;font-size:13.5px;">${description}</span></li>`
    ).join('')

    Swal.fire({
        title: 'Help Center',
        html: `
            <p style="text-align:left;color:#57616F;margin-bottom:14px;">
                Here's how requesting a document works, start to finish:
            </p>
            <ol style="text-align:left;padding-left:20px;margin:0;">${steps}</ol>
            <p style="text-align:left;color:#57616F;margin-top:14px;">
                Already have a request in progress? Log in and use the Messages
                page to reach your assigned registrar staff directly.
            </p>
        `,
        confirmButtonText: 'Got it',
        confirmButtonColor: '#123B78',
        width: 560,
    })
}

const openContactModal = () => {
    Swal.fire({
        title: 'Contact',
        html: `
            <p style="text-align:left;color:#57616F;">
                For questions about a specific request, log in and message your
                assigned registrar staff directly from your CertiChain account.
            </p>
            <p style="text-align:left;color:#57616F;">
                For anything else, please reach out to the Office of Registration
                &amp; Records Management at Holy Cross of Davao College directly.
            </p>
        `,
        confirmButtonText: 'Got it',
        confirmButtonColor: '#123B78',
    })
}

const IconFacebook = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
        <path d="M13.5 21v-8h2.7l.4-3.1h-3.1V8c0-.9.25-1.5 1.55-1.5H16.7V3.7C16.4 3.66 15.4 3.58 14.2 3.58c-2.4 0-4.05 1.47-4.05 4.17V9.9H7.4V13h2.75v8h3.35Z" />
    </svg>
)

const IconInstagram = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="18" height="18">
        <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
    </svg>
)

const IconTiktok = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
        <path d="M16.6 3c.4 2.2 1.8 3.6 4 3.9v2.8c-1.4.1-2.8-.3-4-1.1v6.4c0 3.3-2.7 5.9-6 5.7-3-.2-5.4-2.7-5.4-5.7 0-3.1 2.6-5.7 5.8-5.6v2.9c-1.5-.2-2.9.9-3 2.5-.1 1.5 1 2.8 2.5 2.9 1.6.1 2.9-1.1 2.9-2.7V3h3.2Z" />
    </svg>
)

function LegalLayout({ title, updated, children }) {
    const [searchParams] = useSearchParams()
    const embed = searchParams.get('embed') === '1'

    if (embed) {
        return (
            <div className="legal-page legal-embed">
                <div className="legal-content">
                    <h1>{title}</h1>
                    <p className="legal-updated">Last updated {updated}</p>
                    {children}
                </div>
            </div>
        )
    }

    return (
        <div className="legal-page">
            <header className="legal-header">
                <div className="legal-header-inner">
                    <Link to="/" className="legal-brand">
                        <img src={hcdcLogo} alt="Holy Cross of Davao College" />
                        <div>
                            <div className="legal-brand-name">CertiChain</div>
                            <div className="legal-brand-subtitle">HCDC Registrar Services</div>
                        </div>
                    </Link>
                    <Link to="/" className="legal-back-link">← Back to home</Link>
                </div>
            </header>

            <div className="legal-content">
                <h1>{title}</h1>
                <p className="legal-updated">Last updated {updated}</p>
                {children}
            </div>

            <footer className="legal-footer">
                <div className="legal-footer-container">

                    <div className="legal-footer-main">
                        <div className="legal-footer-brand">
                            <div className="legal-footer-brand-row">
                                <div className="legal-footer-brand-seal">
                                    <img src={hcdcLogo} alt="Holy Cross of Davao College" />
                                </div>
                                <div>
                                    <div className="legal-footer-brand-name">CertiChain</div>
                                    <div className="legal-footer-brand-subtitle">HCDC Registrar Services</div>
                                </div>
                            </div>
                            <p>
                                A web-based registrar services system for academic
                                certificate requesting.
                            </p>
                        </div>

                        <div className="legal-footer-column">
                            <h4>Platform</h4>
                            <a href="/#services">Services</a>
                            <a href="/#documents">Documents</a>
                            <a href="/#process">How it works</a>
                        </div>

                        <div className="legal-footer-column">
                            <h4>Account</h4>
                            <a href="/login">Login</a>
                            <a href="/register">Register</a>
                            <button type="button" onClick={openHelpModal}>Help center</button>
                        </div>

                        <div className="legal-footer-column">
                            <h4>Registrar</h4>
                            <a href="/#about">About CertiChain</a>
                            <a href="/#documents">Document catalog</a>
                            <button type="button" onClick={openContactModal}>Contact</button>
                        </div>
                    </div>

                    <div className="legal-footer-compliance-row">
                        <div className="legal-footer-badges">
                            <a
                                href="https://npcregistration.privacy.gov.ph/certificate/organizationRegistration/6836da04de42154f20ba9195"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <img src={dpoRegisteredBadge} alt="DPO/DPS Registered with the National Privacy Commission" />
                            </a>
                            <a
                                href="https://www.hcdc.edu.ph/index.php/data-privacy/?brid=Q0N62DeagyDaaBVW7-qkEA"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <img src={dataPrivacyBadge} alt="HCDC Data Privacy Commitment" />
                            </a>
                        </div>

                        <div className="legal-footer-icons">
                            <a href="https://www.facebook.com/hcdcofficial" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                                <IconFacebook />
                            </a>
                            <a href="https://www.instagram.com/hcdcofficial/" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                                <IconInstagram />
                            </a>
                            <a href="https://www.tiktok.com/@hcdcofficial" target="_blank" rel="noopener noreferrer" aria-label="TikTok">
                                <IconTiktok />
                            </a>
                        </div>
                    </div>

                    <div className="legal-footer-bottom">
                        <span>© {new Date().getFullYear()} CertiChain. All rights reserved.</span>
                        <span>
                            <Link to="/terms">Terms of Service</Link>
                            {' · '}
                            <Link to="/privacy-policy">Privacy Policy</Link>
                        </span>
                        <span>Holy Cross of Davao College</span>
                    </div>

                </div>
            </footer>
        </div>
    )
}

export default LegalLayout
