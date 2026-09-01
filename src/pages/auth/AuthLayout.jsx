import { Link } from 'react-router-dom'
import './Auth.css'
import hcdcLogo from '../../assets/hcdc-logo.png'

function AuthLayout({ title, subtitle, footer, children }) {
    return (
        <div className="auth-page">

            <div className="auth-brand-panel">
                <Link to="/" className="auth-brand-link">
                    <div className="auth-brand-seal">
                        <img src={hcdcLogo} alt="Holy Cross of Davao College" />
                    </div>
                    <div>
                        <div className="auth-brand-name">Registrar Services</div>
                        <div className="auth-brand-subtitle">Holy Cross of Davao College</div>
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
    )
}

export default AuthLayout
