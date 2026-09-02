import { useState } from "react";
import Swal from "sweetalert2";
import "./Landing.css";
import hcdcLogo from "../../assets/hcdc-logo.png";

const DOCUMENTS = [
    { name: "Transcript of Records", code: "TOR" },
    { name: "Print-out of Evaluation", code: "POE" },
    { name: "Print-out of Class Schedule", code: "POCS" },
    { name: "Print-out of Grades (Report Card)", code: "POG" },
    { name: "Certificate of Enrollment", code: "COE" },
    { name: "Certificate of Enrollment w/ Units Earned", code: "COEUE" },
    { name: "Certificate of Enrollment w/ Subjects Enrolled", code: "COESE" },
    { name: "Certificate of Grades", code: "COG" },
    { name: "Certificate of Irregular/Regular Status", code: "CIRS" },
    { name: "Certificate of Remaining Units/Subjects", code: "CRUS" },
    { name: "Certificate of Completed Academic Requirements (CAR)", code: "CCAR" },
    { name: "Certificate of Completion", code: "CCOM" },
    { name: "Letter of Confirmation", code: "LOC" },
    { name: "Certificate of Cross-Enroll Permit", code: "CCEP" },
    { name: "Certificate of Honors", code: "CHON" },
    { name: "Certificate of General Weighted Average (GWA)", code: "CGWA" },
    { name: "Certificate of Graduation", code: "COGR" },
    { name: "Certificate of Units Earned", code: "CUE" },
    { name: "Letter of No Objection", code: "LNO" },
    { name: "Abu Dhabi Certificate", code: "ADC" },
    { name: "Qatar Certificate", code: "QAC" },
    { name: "Scanning of Documents", code: "SCAN" },
    { name: "Certified True Copy / Authentication", code: "CTC" },
    { name: "Reference", code: "REF" },
    { name: "Honorable Dismissal / Transfer Credential", code: "HD" },
    { name: "Diploma – Certified True Copy", code: "DIP" },
    { name: "Special Order (S.O.)", code: "SO" },
    { name: "Certificate of Grade for Cross-Enrollee", code: "CGCE" },
];

const IconDocument = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
        <path d="M14 3v4h4" />
        <path d="M9 12h6M9 15.5h6M9 8.5h3" />
    </svg>
);

const IconCalendar = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
        <path d="M3.5 9.5h17M8 3v4M16 3v4" />
        <path d="M8 13h2M13 13h2M8 16.5h2M13 16.5h2" />
    </svg>
);

const IconSearch = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="M19.5 19.5 15 15" />
    </svg>
);

const IconShield = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3.5 19 6.3v5.4c0 4.6-3 8.2-7 9.8-4-1.6-7-5.2-7-9.8V6.3Z" />
        <path d="m9 12.2 2.1 2.1L15.5 10" />
    </svg>
);

const IconUser = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c1.2-3.8 4-5.8 7-5.8s5.8 2 7 5.8" />
    </svg>
);

const IconUpload = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 15.5V4" />
        <path d="m7.5 8.3 4.5-4.5 4.5 4.5" />
        <path d="M5 15.5v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" />
    </svg>
);

const IconGear = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3.2" />
        <path d="M12 3.5v2.3M12 18.2v2.3M20.5 12h-2.3M5.8 12H3.5M17.8 6.2l-1.6 1.6M7.8 16.2l-1.6 1.6M17.8 17.8l-1.6-1.6M7.8 7.8 6.2 6.2" />
    </svg>
);

const IconCheck = () => (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3.5 8.3 6.5 11l6-6.5" />
    </svg>
);

const PROCESS_STEPS = [
    ["01", <IconUser />, "Create an account", "Register your CertiChain account and provide your student information."],
    ["02", <IconDocument />, "Submit a request", "Select the academic document you need and submit your request online."],
    ["03", <IconUpload />, "Upload requirements", "Provide supporting documents and an official receipt when applicable."],
    ["04", <IconSearch />, "Verification", "Registrar personnel review your request and verify your student records."],
    ["05", <IconGear />, "Processing", "Your document is prepared and its verification code is recorded."],
    ["06", <IconCalendar />, "Claim your document", "Receive your claiming schedule and present a valid ID when claiming."],
];

const LANDING_FAQ = [
    ["Do I need to create an account to request a document?", "Yes. A free CertiChain account lets you submit requests, upload requirements, track status, and message the Registrar directly."],
    ["How do I pay for my request?", "Submit your request first, then upload your official receipt from your account. Registrar staff verify it before processing begins."],
    ["How long does processing take?", "It varies by document type and current volume. You'll see real-time status updates in your account at every step, with no need to keep calling to check."],
    ["How do I know a document is genuine?", "Every document CertiChain issues carries a unique verification code and QR code. Anyone — an employer, another school — can confirm it's authentic in seconds, no account required."],
    ["What do I bring when claiming my document?", "Your official receipt and a valid ID. You'll get a claiming date and time in your account once your document is ready."],
];

const LandingPage = () => {
    const [verifyCode, setVerifyCode] = useState("");

    const scrollToSection = (id) => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    };

    const handleVerifySubmit = (e) => {
        e.preventDefault();
        const code = verifyCode.trim();
        if (!code) return;
        window.location.href = `/verify/${encodeURIComponent(code)}`;
    };

    const openHelpModal = () => {
        const steps = PROCESS_STEPS.map(
            ([, , title, description]) =>
                `<li style="margin-bottom:10px;"><strong>${title}</strong><br/><span style="color:#57616F;font-size:13.5px;">${description}</span></li>`
        ).join("");

        Swal.fire({
            title: "Help Center",
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
            confirmButtonText: "Got it",
            confirmButtonColor: "#123B78",
            width: 560,
        });
    };

    const openContactModal = () => {
        Swal.fire({
            title: "Contact",
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
            confirmButtonText: "Got it",
            confirmButtonColor: "#123B78",
        });
    };

    return (
        <div className="landing-page">

            <header className="landing-navbar">
                <div className="navbar-container">

                    <div className="brand" onClick={() => scrollToSection("home")}>
                        <div className="brand-seal">
                            <img src={hcdcLogo} alt="Holy Cross of Davao College" />
                        </div>
                        <div className="brand-text">
                            <div className="brand-name">CertiChain</div>
                            <div className="brand-subtitle">HCDC Registrar Services</div>
                        </div>
                    </div>

                    <nav className="desktop-nav">
                        <a href="#services" onClick={(e) => { e.preventDefault(); scrollToSection("services"); }}>Services</a>
                        <a href="#documents" onClick={(e) => { e.preventDefault(); scrollToSection("documents"); }}>Documents</a>
                        <a href="#process" onClick={(e) => { e.preventDefault(); scrollToSection("process"); }}>How it works</a>
                        <a href="#about" onClick={(e) => { e.preventDefault(); scrollToSection("about"); }}>About</a>
                        <a href="#verify" onClick={(e) => { e.preventDefault(); scrollToSection("verify"); }}>Verify</a>
                    </nav>

                    <div className="navbar-actions">
                        <button className="nav-login" onClick={() => window.location.href = "/login"}>Log in</button>
                        <button className="nav-register" onClick={() => window.location.href = "/register"}>Register</button>
                    </div>

                </div>
            </header>

            <main>

                <section id="home" className="hero-section">

                    <div className="hero-container">

                        <div className="hero-content">

                            <div className="hero-eyebrow">
                                <span className="eyebrow-mark" />
                                The Office of Registration &amp; Records Management
                            </div>

                            <h1>
                                Your records,
                                <br />
                                <span>verified and provable.</span>
                            </h1>

                            <p className="hero-description">
                                Request transcripts, certificates, and diplomas from
                                Holy Cross of Davao College without a single trip to the
                                counter. Submit, pay for, and track every request from
                                one account.
                            </p>

                            <div className="hero-buttons">
                                <button className="primary-button" onClick={() => window.location.href = "/register"}>
                                    Request a document
                                    <span>→</span>
                                </button>
                                <button className="secondary-button" onClick={() => scrollToSection("process")}>
                                    See how it works
                                </button>
                            </div>

                            <div className="hero-trust">
                                <div className="trust-item">
                                    <strong>{DOCUMENTS.length}</strong>
                                    <span>Document types online</span>
                                </div>
                                <div className="trust-divider" />
                                <div className="trust-item">
                                    <strong>Verified</strong>
                                    <span>Registrar-checked records</span>
                                </div>
                            </div>

                        </div>

                        <div className="hero-visual">
                            <div className="hero-card">

                                <div className="hero-card-header">
                                    <div className="mini-brand">
                                        <div className="mini-logo">
                                            <img src={hcdcLogo} alt="Holy Cross of Davao College" />
                                        </div>
                                        <div>
                                            <strong>CertiChain</strong>
                                            <span>Academic Credential</span>
                                        </div>
                                    </div>
                                    <div className="secure-indicator">
                                        <span />
                                        VERIFIED
                                    </div>
                                </div>

                                <div className="credential-preview">
                                    <div className="credential-top">
                                        <span>HOLY CROSS OF DAVAO COLLEGE</span>
                                        <div className="credential-seal">
                                            <img src={hcdcLogo} alt="Holy Cross of Davao College" />
                                        </div>
                                    </div>

                                    <h3>Certificate</h3>
                                    <p>Official Academic Credential</p>

                                    <div className="credential-lines">
                                        <span /><span /><span />
                                    </div>

                                    <div className="credential-footer">
                                        <div>
                                            <small>Credential status</small>
                                            <strong>Verified by registrar</strong>
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </div>

                    </div>

                </section>

                <section id="services" className="section services-section">
                    <div className="section-container">

                        <div className="section-heading">
                            <span className="section-label">Registrar Services</span>
                            <h2>Everything you need, <br /><span>without the counter line.</span></h2>
                            <p>
                                CertiChain centralizes academic document requests so
                                students and alumni can submit, pay for, and track
                                registrar transactions from one account.
                            </p>
                        </div>

                        <div className="services-grid">

                            <div className="service-card">
                                <div className="service-icon"><IconDocument /></div>
                                <h3>Document requests</h3>
                                <p>Request transcripts, certificates, and other registrar
                                    documents online instead of visiting the office in person.</p>
                                <a href="#documents">View documents →</a>
                            </div>

                            <div className="service-card">
                                <div className="service-icon"><IconCalendar /></div>
                                <h3>Claim scheduling</h3>
                                <p>Get an estimated processing date and a scheduled
                                    claiming window through your CertiChain account.</p>
                                <a href="#process">Learn more →</a>
                            </div>

                            <div className="service-card">
                                <div className="service-icon"><IconSearch /></div>
                                <h3>Request tracking</h3>
                                <p>Follow your request from submission and verification
                                    through processing and claiming, in real time.</p>
                                <a href="#process">Track requests →</a>
                            </div>

                            <div className="service-card">
                                <div className="service-icon"><IconShield /></div>
                                <h3>Secure accounts</h3>
                                <p>Every account is protected by authenticated login and
                                    role-based access, keeping your request history private.</p>
                                <a href="/register">Create an account →</a>
                            </div>

                        </div>

                    </div>
                </section>

                <section id="documents" className="documents-section">
                    <div className="section-container">
                        <div className="documents-layout">

                            <div className="documents-content">
                                <span className="section-label">Document Catalog</span>
                                <h2>Request your <br /><span>academic documents.</span></h2>
                                <p>
                                    Choose the registrar document you need, submit your
                                    request online, upload the required credentials, and
                                    monitor the processing status through your account.
                                </p>
                                <button className="primary-button" onClick={() => window.location.href = "/register"}>
                                    Start a request
                                    <span>→</span>
                                </button>
                            </div>

                            <div className="document-list">
                                {DOCUMENTS.map((doc) => (
                                    <div className="document-item" key={doc.code}>
                                        <span className="document-code">{doc.code}</span>
                                        <span>{doc.name}</span>
                                        <span className="document-check"><IconCheck /></span>
                                    </div>
                                ))}
                            </div>

                        </div>
                    </div>
                </section>

                <section id="process" className="section process-section">
                    <div className="section-container">

                        <div className="section-heading">
                            <span className="section-label">How It Works</span>
                            <h2>From request <br /><span>to verified credential.</span></h2>
                            <p>
                                Every step of a document request is logged, so you always
                                know where it stands — and once issued, every credential
                                can be checked against its recorded verification code.
                            </p>
                        </div>

                        <div className="process-grid">
                            <div className="process-line" />

                            {PROCESS_STEPS.map(([num, icon, title, body]) => (
                                <div className="process-step" key={num}>
                                    <span className="step-number">{num}</span>
                                    <div className="step-icon">{icon}</div>
                                    <h3>{title}</h3>
                                    <p>{body}</p>
                                </div>
                            ))}
                        </div>

                    </div>
                </section>

                <section id="about" className="section about-section">
                    <div className="section-container">
                        <div className="about-card">

                            <div className="about-content">
                                <span className="section-label">About CertiChain</span>
                                <h2>Modernizing <br /><span>registrar services.</span></h2>
                                <p>
                                    CertiChain is a web-based registrar services system
                                    built for the Holy Cross of Davao College Registrar
                                    Office, giving students and alumni a single place to
                                    request academic certificates and credentials.
                                </p>
                                <p>
                                    Instead of relying entirely on manual transactions,
                                    CertiChain organizes requests, requirements, processing
                                    status, claiming schedules, verification, and registrar
                                    activity records in one system.
                                </p>
                            </div>

                            <div className="about-highlights">
                                <div><strong>Online</strong><span>Requesting</span></div>
                                <div><strong>Digital</strong><span>Tracking</span></div>
                                <div><strong>Secure</strong><span>Processing</span></div>
                                <div><strong>Verified</strong><span>Credentials</span></div>
                            </div>

                        </div>
                    </div>
                </section>

                <section id="verify" className="section verify-section">
                    <div className="section-container">

                        <div className="section-heading">
                            <span className="section-label">Verification</span>
                            <h2>Every credential, <br /><span>verified.</span></h2>
                            <p>
                                Every document CertiChain issues carries a unique verification
                                code and QR code. Anyone — an employer, another school —
                                can confirm it's genuine in seconds, no account required.
                            </p>
                        </div>

                        <form className="verify-cta-form" onSubmit={handleVerifySubmit}>
                            <input
                                type="text"
                                value={verifyCode}
                                onChange={(e) => setVerifyCode(e.target.value)}
                                placeholder="Enter a credential number, e.g. CERT-000123"
                                className="verify-cta-input"
                            />
                            <button type="submit" className="verify-cta-button">
                                Verify <span>→</span>
                            </button>
                        </form>

                    </div>
                </section>

                <section id="faq" className="section faq-section">
                    <div className="section-container">

                        <div className="section-heading">
                            <span className="section-label">FAQ</span>
                            <h2>Frequently asked <br /><span>questions.</span></h2>
                        </div>

                        <div className="faq-list">
                            {LANDING_FAQ.map(([question, answer]) => (
                                <details className="faq-item" key={question}>
                                    <summary>{question}</summary>
                                    <p>{answer}</p>
                                </details>
                            ))}
                        </div>

                    </div>
                </section>

                <section className="cta-section">
                    <div className="cta-container">
                        <div className="cta-icon">
                            <img src={hcdcLogo} alt="Holy Cross of Davao College" />
                        </div>
                        <span className="cta-label">HCDC Registrar Services</span>
                        <h2>Ready to request <br /><span>your document?</span></h2>
                        <p>
                            Create your CertiChain account and manage your academic
                            document requests through a secure, verified, and convenient
                            online platform.
                        </p>

                        <div className="cta-buttons">
                            <button className="cta-primary" onClick={() => window.location.href = "/register"}>
                                Create an account
                                <span>→</span>
                            </button>
                            <button className="cta-secondary" onClick={() => window.location.href = "/login"}>
                                Already have an account?
                                <span>Log in</span>
                            </button>
                        </div>
                    </div>
                </section>

            </main>

            <footer className="landing-footer">
                <div className="footer-container">

                    <div className="footer-main">

                        <div className="footer-brand">
                            <div className="brand">
                                <div className="brand-seal">
                                    <img src={hcdcLogo} alt="Holy Cross of Davao College" />
                                </div>
                                <div className="brand-text">
                                    <div className="brand-name">CertiChain</div>
                                    <div className="brand-subtitle">HCDC Registrar Services</div>
                                </div>
                            </div>
                            <p>
                                A web-based registrar services system for academic
                                certificate requesting.
                            </p>
                        </div>

                        <div className="footer-column">
                            <h4>Platform</h4>
                            <a href="#services">Services</a>
                            <a href="#documents">Documents</a>
                            <a href="#process">How it works</a>
                        </div>

                        <div className="footer-column">
                            <h4>Account</h4>
                            <a href="/login">Login</a>
                            <a href="/register">Register</a>
                            <button type="button" onClick={openHelpModal}>Help center</button>
                        </div>

                        <div className="footer-column">
                            <h4>Registrar</h4>
                            <a href="#about">About CertiChain</a>
                            <a href="#documents">Document catalog</a>
                            <button type="button" onClick={openContactModal}>Contact</button>
                        </div>

                    </div>

                    <div className="footer-bottom">
                        <span>© {new Date().getFullYear()} CertiChain. All rights reserved.</span>
                        <span>
                            <a href="/terms">Terms of Service</a>
                            {' · '}
                            <a href="/privacy-policy">Privacy Policy</a>
                        </span>
                        <span>Holy Cross of Davao College</span>
                    </div>

                </div>
            </footer>

        </div>
    );
};

export default LandingPage;
