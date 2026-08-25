import React from "react";
import "./Landing.css";

const LandingPage = () => {
    const scrollToSection = (id) => {
        document.getElementById(id)?.scrollIntoView({
            behavior: "smooth",
        });
    };

    return (
        <div className="landing-page">

            {/* =========================
          NAVBAR
      ========================= */}
            <header className="landing-navbar">
                <div className="navbar-container">

                    <div
                        className="brand"
                        onClick={() => scrollToSection("home")}
                    >
                        <div className="brand-logo">
                            HCDC
                        </div>

                        <div className="brand-text">
                            <div className="brand-name">
                                CertiChain
                            </div>

                            <div className="brand-subtitle">
                                HCDC Registrar Services
                            </div>
                        </div>
                    </div>

                    <nav className="desktop-nav">
                        <a
                            href="#home"
                            onClick={(e) => {
                                e.preventDefault();
                                scrollToSection("home");
                            }}
                        >
                            Home
                        </a>

                        <a
                            href="#services"
                            onClick={(e) => {
                                e.preventDefault();
                                scrollToSection("services");
                            }}
                        >
                            Services
                        </a>

                        <a
                            href="#documents"
                            onClick={(e) => {
                                e.preventDefault();
                                scrollToSection("documents");
                            }}
                        >
                            Documents
                        </a>

                        <a
                            href="#process"
                            onClick={(e) => {
                                e.preventDefault();
                                scrollToSection("process");
                            }}
                        >
                            How It Works
                        </a>

                        <a
                            href="#security"
                            onClick={(e) => {
                                e.preventDefault();
                                scrollToSection("security");
                            }}
                        >
                            Security
                        </a>

                        <a
                            href="#about"
                            onClick={(e) => {
                                e.preventDefault();
                                scrollToSection("about");
                            }}
                        >
                            About
                        </a>
                    </nav>

                    <div className="navbar-actions">
                        <button
                            className="nav-login"
                            onClick={() => window.location.href = "/login"}
                        >
                            Login
                        </button>

                        <button
                            className="nav-register"
                            onClick={() => window.location.href = "/register"}
                        >
                            Register
                        </button>
                    </div>

                </div>
            </header>


            {/* =========================
          HERO
      ========================= */}
            <main>

                <section
                    id="home"
                    className="hero-section"
                >

                    <div className="hero-background-shape shape-one"></div>
                    <div className="hero-background-shape shape-two"></div>

                    <div className="hero-container">

                        <div className="hero-content">

                            <div className="hero-badge">
                                <span className="badge-dot"></span>
                                HCDC Online Registrar Services
                            </div>

                            <h1>
                                Academic Documents,
                                <br />
                                <span>Made Simple.</span>
                            </h1>

                            <p className="hero-description">
                                CertiChain provides a secure and convenient online
                                registrar service for requesting academic certificates
                                and credentials from Holy Cross of Davao College.
                            </p>

                            <div className="hero-buttons">

                                <button
                                    className="primary-button"
                                    onClick={() =>
                                        window.location.href = "/register"
                                    }
                                >
                                    Request a Document
                                    <span>→</span>
                                </button>

                                <button
                                    className="secondary-button"
                                    onClick={() =>
                                        scrollToSection("process")
                                    }
                                >
                                    Learn How It Works
                                </button>

                            </div>

                            <div className="hero-trust">

                                <div className="trust-item">
                                    <div className="trust-icon">
                                        ✓
                                    </div>

                                    <div>
                                        <strong>Secure</strong>
                                        <span>Protected requests</span>
                                    </div>
                                </div>

                                <div className="trust-divider"></div>

                                <div className="trust-item">
                                    <div className="trust-icon">
                                        ✓
                                    </div>

                                    <div>
                                        <strong>Convenient</strong>
                                        <span>Online requesting</span>
                                    </div>
                                </div>

                                <div className="trust-divider"></div>

                                <div className="trust-item">
                                    <div className="trust-icon">
                                        ✓
                                    </div>

                                    <div>
                                        <strong>Verified</strong>
                                        <span>Credential validation</span>
                                    </div>
                                </div>

                            </div>

                        </div>


                        {/* HERO CARD */}
                        <div className="hero-visual">

                            <div className="hero-card">

                                <div className="hero-card-header">

                                    <div className="mini-brand">

                                        <div className="mini-logo">
                                            HC
                                        </div>

                                        <div>
                                            <strong>CertiChain</strong>
                                            <span>Academic Credential</span>
                                        </div>

                                    </div>

                                    <div className="secure-indicator">
                                        <span></span>
                                        SECURE
                                    </div>

                                </div>


                                <div className="credential-preview">

                                    <div className="credential-top">
                                        <span>
                                            HOLY CROSS OF DAVAO COLLEGE
                                        </span>

                                        <div className="credential-seal">
                                            HC
                                        </div>
                                    </div>

                                    <h3>
                                        CERTIFICATE
                                    </h3>

                                    <p>
                                        Official Academic Credential
                                    </p>

                                    <div className="credential-lines">
                                        <span></span>
                                        <span></span>
                                        <span></span>
                                    </div>

                                    <div className="credential-footer">

                                        <div>
                                            <small>
                                                Credential Status
                                            </small>

                                            <strong>
                                                VERIFIED
                                            </strong>
                                        </div>

                                        <div className="qr-placeholder">
                                            QR
                                        </div>

                                    </div>

                                </div>


                                <div className="processing-status">

                                    <div className="status-icon">
                                        ✓
                                    </div>

                                    <div className="status-content">
                                        <strong>
                                            Credential Verified
                                        </strong>

                                        <span>
                                            Document integrity confirmed
                                        </span>
                                    </div>

                                    <div className="status-check">
                                        ✓
                                    </div>

                                </div>

                            </div>

                        </div>

                    </div>

                    <div className="hero-wave"></div>

                </section>


                {/* =========================
            STATS
        ========================= */}
                <section className="stats-section">

                    <div className="stats-container">

                        <div className="stat-item">
                            <strong>Online</strong>
                            <span>Document Requests</span>
                        </div>

                        <div className="stat-item">
                            <strong>Secure</strong>
                            <span>Credential Processing</span>
                        </div>

                        <div className="stat-item">
                            <strong>Digital</strong>
                            <span>Request Tracking</span>
                        </div>

                        <div className="stat-item">
                            <strong>Verified</strong>
                            <span>Academic Credentials</span>
                        </div>

                    </div>

                </section>


                {/* =========================
            SERVICES
        ========================= */}
                <section
                    id="services"
                    className="section services-section"
                >

                    <div className="section-container">

                        <div className="section-heading">

                            <span className="section-label">
                                REGISTRAR SERVICES
                            </span>

                            <h2>
                                Everything You Need,
                                <br />
                                <span>In One Place.</span>
                            </h2>

                            <p>
                                CertiChain makes academic document requests
                                easier by providing students and alumni with
                                a centralized online registrar service.
                            </p>

                        </div>


                        <div className="services-grid">

                            <div className="service-card">

                                <div className="service-icon">
                                    📄
                                </div>

                                <h3>
                                    Document Requests
                                </h3>

                                <p>
                                    Request official academic certificates,
                                    records, and other registrar documents
                                    without having to manually visit the office
                                    to submit your request.
                                </p>

                                <a href="#documents">
                                    View Documents →
                                </a>

                            </div>


                            <div className="service-card">

                                <div className="service-icon">
                                    📅
                                </div>

                                <h3>
                                    Claim Scheduling
                                </h3>

                                <p>
                                    Receive your estimated processing date
                                    and scheduled claiming information through
                                    your CertiChain account.
                                </p>

                                <a href="#process">
                                    Learn More →
                                </a>

                            </div>


                            <div className="service-card">

                                <div className="service-icon">
                                    🔍
                                </div>

                                <h3>
                                    Request Tracking
                                </h3>

                                <p>
                                    Monitor the status of your academic document
                                    request from submission and verification
                                    through processing and claiming.
                                </p>

                                <a href="#process">
                                    Track Requests →
                                </a>

                            </div>


                            <div className="service-card">

                                <div className="service-icon">
                                    🛡️
                                </div>

                                <h3>
                                    Credential Verification
                                </h3>

                                <p>
                                    Academic credentials can be verified using
                                    secure document identifiers and QR-based
                                    verification features.
                                </p>

                                <a href="#security">
                                    View Security →
                                </a>

                            </div>

                        </div>

                    </div>

                </section>


                {/* =========================
            DOCUMENTS
        ========================= */}
                <section
                    id="documents"
                    className="documents-section"
                >

                    <div className="section-container">

                        <div className="documents-layout">

                            <div className="documents-content">

                                <span className="section-label">
                                    DOCUMENT CATALOG
                                </span>

                                <h2>
                                    Request Your
                                    <br />
                                    <span>Academic Documents.</span>
                                </h2>

                                <p>
                                    Choose the registrar document you need,
                                    submit your request online, upload the
                                    required credentials and monitor the
                                    processing status through your account.
                                </p>

                                <button
                                    className="primary-button"
                                    onClick={() =>
                                        window.location.href = "/register"
                                    }
                                >
                                    Start a Request
                                    <span>→</span>
                                </button>

                            </div>


                            <div className="document-list">

                                {[
                                    "Transcript of Records",
                                    "Certificate of Enrollment",
                                    "Certificate of Registration",
                                    "Certificate of Graduation",
                                    "Diploma – Certified True Copy",
                                    "Certification of Grades",
                                    "Certificate of Academic Standing",
                                    "Certificate of Good Standing",
                                    "Certificate of Units Earned",
                                    "Honorable Dismissal / Transfer Credential",
                                    "Course Description / Syllabus",
                                    "Authentication of Academic Documents",
                                    "Verification of Academic Credentials",
                                    "Certified True Copies of Registrar Documents",
                                ].map((document, index) => (

                                    <div
                                        className="document-item"
                                        key={index}
                                    >

                                        <div className="document-check">
                                            ✓
                                        </div>

                                        <span>
                                            {document}
                                        </span>

                                    </div>

                                ))}

                            </div>

                        </div>

                    </div>

                </section>


                {/* =========================
            PROCESS
        ========================= */}
                <section
                    id="process"
                    className="section process-section"
                >

                    <div className="section-container">

                        <div className="section-heading">

                            <span className="section-label">
                                HOW IT WORKS
                            </span>

                            <h2>
                                Simple Process.
                                <br />
                                <span>Clear Progress.</span>
                            </h2>

                            <p>
                                Requesting an academic document through
                                CertiChain is designed to be simple,
                                transparent, and convenient.
                            </p>

                        </div>


                        <div className="process-grid">

                            <div className="process-line"></div>


                            <div className="process-step">

                                <span className="step-number">
                                    01
                                </span>

                                <div className="step-icon">
                                    👤
                                </div>

                                <h3>
                                    Create an Account
                                </h3>

                                <p>
                                    Register your CertiChain account and
                                    provide your required student information.
                                </p>

                            </div>


                            <div className="process-step">

                                <span className="step-number">
                                    02
                                </span>

                                <div className="step-icon">
                                    📄
                                </div>

                                <h3>
                                    Submit Request
                                </h3>

                                <p>
                                    Select the academic document you need
                                    and submit your request online.
                                </p>

                            </div>


                            <div className="process-step">

                                <span className="step-number">
                                    03
                                </span>

                                <div className="step-icon">
                                    📎
                                </div>

                                <h3>
                                    Upload Requirements
                                </h3>

                                <p>
                                    Provide the required supporting documents
                                    and official receipt when applicable.
                                </p>

                            </div>


                            <div className="process-step">

                                <span className="step-number">
                                    04
                                </span>

                                <div className="step-icon">
                                    🔎
                                </div>

                                <h3>
                                    Verification
                                </h3>

                                <p>
                                    Registrar personnel review your request
                                    and verify your student records.
                                </p>

                            </div>


                            <div className="process-step">

                                <span className="step-number">
                                    05
                                </span>

                                <div className="step-icon">
                                    ⚙️
                                </div>

                                <h3>
                                    Processing
                                </h3>

                                <p>
                                    Your document is processed while the
                                    system records the request status.
                                </p>

                            </div>


                            <div className="process-step">

                                <span className="step-number">
                                    06
                                </span>

                                <div className="step-icon">
                                    📅
                                </div>

                                <h3>
                                    Claim Your Document
                                </h3>

                                <p>
                                    Receive your claiming schedule and
                                    present your official receipt and valid
                                    identification when claiming.
                                </p>

                            </div>

                        </div>

                    </div>

                </section>


                {/* =========================
            SECURITY
        ========================= */}
                <section
                    id="security"
                    className="security-section"
                >

                    <div className="section-container">

                        <div className="security-layout">

                            <div className="security-visual">

                                <div className="security-ring ring-one"></div>
                                <div className="security-ring ring-two"></div>

                                <div className="security-circle">

                                    <div className="security-lock">
                                        🔒
                                    </div>

                                </div>

                            </div>


                            <div className="security-content">

                                <span className="section-label">
                                    SECURITY & VERIFICATION
                                </span>

                                <h2>
                                    Built for
                                    <br />
                                    <span>Trust & Integrity.</span>
                                </h2>

                                <p>
                                    CertiChain is designed to help protect
                                    academic document requests and support
                                    reliable credential verification throughout
                                    the registrar process.
                                </p>


                                <div className="security-features">

                                    <div className="security-feature">

                                        <div className="feature-icon">
                                            ✓
                                        </div>

                                        <div>
                                            <h3>
                                                Secure Authentication
                                            </h3>

                                            <p>
                                                User accounts are protected through
                                                secure authentication and password
                                                protection.
                                            </p>
                                        </div>

                                    </div>


                                    <div className="security-feature">

                                        <div className="feature-icon">
                                            ✓
                                        </div>

                                        <div>
                                            <h3>
                                                Document Integrity
                                            </h3>

                                            <p>
                                                Generated credential hashes can be
                                                used to help verify document integrity
                                                and detect unauthorized changes.
                                            </p>
                                        </div>

                                    </div>


                                    <div className="security-feature">

                                        <div className="feature-icon">
                                            ✓
                                        </div>

                                        <div>
                                            <h3>
                                                QR Verification
                                            </h3>

                                            <p>
                                                Credentials can contain QR-based
                                                verification information for easier
                                                validation.
                                            </p>
                                        </div>

                                    </div>


                                    <div className="security-feature">

                                        <div className="feature-icon">
                                            ✓
                                        </div>

                                        <div>
                                            <h3>
                                                Activity Logging
                                            </h3>

                                            <p>
                                                Important registrar actions are
                                                recorded with employee, date, and
                                                time information.
                                            </p>
                                        </div>

                                    </div>

                                </div>

                            </div>

                        </div>

                    </div>

                </section>


                {/* =========================
            ABOUT
        ========================= */}
                <section
                    id="about"
                    className="section about-section"
                >

                    <div className="section-container">

                        <div className="about-card">

                            <div className="about-content">

                                <span className="section-label">
                                    ABOUT CERTICHAIN
                                </span>

                                <h2>
                                    Modernizing
                                    <br />
                                    <span>Registrar Services.</span>
                                </h2>

                                <p>
                                    CertiChain is a web-based online registrar
                                    services system designed for the Holy Cross
                                    of Davao College Registrar Office. It provides
                                    students and alumni with a centralized platform
                                    for requesting academic certificates and
                                    credentials.
                                </p>

                                <p>
                                    Instead of relying entirely on manual
                                    transactions, CertiChain helps organize
                                    requests, requirements, processing status,
                                    claiming schedules, verification, and
                                    registrar activity records in one system.
                                </p>

                            </div>


                            <div className="about-highlights">

                                <div>
                                    <strong>
                                        Online
                                    </strong>

                                    <span>
                                        Requesting
                                    </span>
                                </div>

                                <div>
                                    <strong>
                                        Digital
                                    </strong>

                                    <span>
                                        Tracking
                                    </span>
                                </div>

                                <div>
                                    <strong>
                                        Secure
                                    </strong>

                                    <span>
                                        Processing
                                    </span>
                                </div>

                                <div>
                                    <strong>
                                        Verified
                                    </strong>

                                    <span>
                                        Credentials
                                    </span>
                                </div>

                            </div>

                        </div>

                    </div>

                </section>


                {/* =========================
            CTA
        ========================= */}
                <section className="cta-section">

                    <div className="cta-pattern"></div>

                    <div className="cta-container">

                        <div className="cta-icon">
                            HC
                        </div>

                        <span className="cta-label">
                            HCDC REGISTRAR SERVICES
                        </span>

                        <h2>
                            Ready to Request
                            <br />
                            <span>Your Document?</span>
                        </h2>

                        <p>
                            Create your CertiChain account and manage
                            your academic document requests through a
                            secure and convenient online platform.
                        </p>

                        <div className="cta-buttons">

                            <button
                                className="cta-primary"
                                onClick={() =>
                                    window.location.href = "/register"
                                }
                            >
                                Create an Account
                                <span>→</span>
                            </button>

                            <button
                                className="cta-secondary"
                                onClick={() =>
                                    window.location.href = "/login"
                                }
                            >
                                Already have an account?
                                <span>Login</span>
                            </button>

                        </div>

                    </div>

                </section>

            </main>


            {/* =========================
          FOOTER
      ========================= */}
            <footer className="landing-footer">

                <div className="footer-container">

                    <div className="footer-main">

                        <div className="footer-brand">

                            <div className="brand">

                                <div className="brand-logo">
                                    HCDC
                                </div>

                                <div className="brand-text">

                                    <div className="brand-name">
                                        CertiChain
                                    </div>

                                    <div className="brand-subtitle">
                                        HCDC Registrar Services
                                    </div>

                                </div>

                            </div>

                            <p>
                                A web-based online registrar services system
                                for academic certificate requesting and
                                credential verification.
                            </p>

                        </div>


                        <div className="footer-column">

                            <h4>
                                Platform
                            </h4>

                            <a href="#home">
                                Home
                            </a>

                            <a href="#services">
                                Services
                            </a>

                            <a href="#documents">
                                Documents
                            </a>

                            <a href="#process">
                                How It Works
                            </a>

                        </div>


                        <div className="footer-column">

                            <h4>
                                Account
                            </h4>

                            <a href="/login">
                                Login
                            </a>

                            <a href="/register">
                                Register
                            </a>

                            <a href="/verify">
                                Verify Credential
                            </a>

                            <a href="/help">
                                Help Center
                            </a>

                        </div>


                        <div className="footer-column">

                            <h4>
                                Registrar
                            </h4>

                            <a href="#about">
                                About CertiChain
                            </a>

                            <a href="#security">
                                Security
                            </a>

                            <a href="#documents">
                                Document Catalog
                            </a>

                            <a href="/contact">
                                Contact
                            </a>

                        </div>

                    </div>


                    <div className="footer-bottom">

                        <span>
                            © {new Date().getFullYear()} CertiChain.
                            All rights reserved.
                        </span>

                        <span>
                            Holy Cross of Davao College
                        </span>

                    </div>

                </div>

            </footer>

        </div>
    );
};

export default LandingPage;