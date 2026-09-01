import { Link } from 'react-router-dom'
import hcdcLogo from '../../assets/hcdc-logo.png'
import './Legal.css'

function LegalLayout({ title, updated, children }) {
    return (
        <div className="legal-page">
            <header className="legal-header">
                <div className="legal-header-inner">
                    <Link to="/" className="legal-brand">
                        <img src={hcdcLogo} alt="Holy Cross of Davao College" />
                        <div>
                            <div className="legal-brand-name">Registrar Services</div>
                            <div className="legal-brand-subtitle">Holy Cross of Davao College</div>
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
        </div>
    )
}

export default LegalLayout
