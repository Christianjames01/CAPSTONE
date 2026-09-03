import { Link } from 'react-router-dom'
import './Auth.css'
import hcdcLogo from '../../assets/hcdc-logo.png'
import dpoRegisteredBadge from '../../assets/dpo-registered-badge.png'
import dataPrivacyBadge from '../../assets/data-privacy-badge.png'

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

function AuthLayout({ title, subtitle, footer, children }) {
    return (
        <div className="auth-page">

            <div className="auth-shell">

                <div className="auth-brand-panel">
                    <Link to="/" className="auth-brand-link">
                        <div className="auth-brand-seal">
                            <img src={hcdcLogo} alt="Holy Cross of Davao College" />
                        </div>
                        <div>
                            <div className="auth-brand-name">CertiChain</div>
                            <div className="auth-brand-subtitle">HCDC Registrar Services</div>
                        </div>
                    </Link>

                    <div className="auth-brand-copy">
                        <h2>Your records, <span>verified and provable.</span></h2>
                        <p>
                            Request, track, and verify academic documents from
                            Holy Cross of Davao College in one secure account.
                        </p>
                    </div>

                    <div className="auth-brand-foot">
                        © {new Date().getFullYear()} Holy Cross of Davao College
                    </div>
                </div>

                <div className="auth-form-panel">
                    <div className="auth-card">
                        <Link to="/" className="auth-back-link">← Back to home</Link>

                        <div className="auth-card-header">
                            <h1>{title}</h1>
                            {subtitle && <p>{subtitle}</p>}
                        </div>

                        {children}

                        {footer && <div className="auth-footer">{footer}</div>}
                    </div>
                </div>

            </div>

            <footer className="auth-site-footer">
                <div className="auth-footer-container">
                    <div className="auth-footer-badges">
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

                    <div className="auth-footer-social">
                        <div className="auth-footer-icons">
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

                        <div className="auth-footer-contact">
                            <p><strong>Holy Cross of Davao College</strong></p>
                            <p>Sta. Ana Ave corner C. De Guzman St, Davao City</p>
                            <p>info@hcdc.edu.ph | (082) 221 9071</p>
                        </div>
                    </div>
                </div>

                <div className="auth-footer-bottom">
                    © {new Date().getFullYear()} Holy Cross of Davao College. All Rights Reserved.
                </div>
            </footer>

        </div>
    )
}

export default AuthLayout
