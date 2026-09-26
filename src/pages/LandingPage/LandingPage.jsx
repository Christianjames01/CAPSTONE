import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { supabase } from "../../lib/supabase";
import { REGISTRAR_CONTACT } from "../../lib/registrarContact";
import { DocumentSample } from "../../components/DocumentSample";
import { useScrollLock } from "../../lib/useScrollLock";
import "./Landing.css";
import hcdcLogo from "../../assets/hcdc-logo.png";
import dpoRegisteredBadge from "../../assets/dpo-registered-badge.png";
import dataPrivacyBadge from "../../assets/data-privacy-badge.png";

// Fallback only: the catalog is loaded live from document_types (so the
// registrar head's edits show here). Used if that load fails or is empty.
const FALLBACK_DOCUMENTS = [
    { name: "Transcript of Records", code: "TOR" },
    { name: "Certification of Grades", code: "COG" },
    { name: "Certificate of Enrollment", code: "COE" },
    { name: "Certificate of Enrollment w/ Units Earned", code: "COEUE" },
    { name: "Certificate of Enrollment w/ Subjects Enrolled", code: "COESE" },
    { name: "Certificate of Registration", code: "COR" },
    { name: "Certificate of Irregular/Regular Status", code: "CIRS" },
    { name: "Certificate of Remaining Units/Subjects", code: "CRUS" },
    { name: "Certificate of Academic Standing", code: "CAAE" },
    { name: "Certificate of Good Standing", code: "CGS" },
    { name: "Certificate of Completed Academic Requirements (CAR)", code: "CCAR" },
    { name: "Certificate of Completion", code: "CCOM" },
    { name: "Certificate of Cross-Enroll Permit", code: "CCEP" },
    { name: "Certificate of Grade for Cross-Enrollee", code: "CGCE" },
    { name: "Certificate of Honors", code: "CHON" },
    { name: "Certificate of General Weighted Average (GWA)", code: "CGWA" },
    { name: "Certificate of Graduation", code: "COGR" },
    { name: "Certificate of Units Earned", code: "CUE" },
    { name: "Certificate of Residency", code: "COR-RES" },
    { name: "Letter of Confirmation", code: "LOC" },
    { name: "Letter of No Objection", code: "LNO" },
    { name: "Reference", code: "REF" },
    { name: "Special Order (S.O.)", code: "SO" },
    { name: "Scanning of Documents", code: "SCAN" },
    { name: "Honorable Dismissal / Transfer Credential", code: "HD" },
    { name: "Diploma – Certified True Copy", code: "DIP" },
    { name: "Abu Dhabi Certificate", code: "ADC" },
    { name: "Qatar Certificate", code: "QAC" },
    { name: "Authentication of Academic Documents", code: "AAD" },
    { name: "Certified True Copies of Registrar Documents", code: "CTC" },
    { name: "Verification of Academic Credentials", code: "VAC" },
    { name: "Course Description / Syllabus", code: "CURR" },
    { name: "Print-out of Evaluation", code: "POE" },
    { name: "Print-out of Class Schedule", code: "POCS" },
    { name: "Print-out of Grades (Report Card)", code: "POG" },
    { name: "Registrar Document Printout", code: "PRINT" },
    { name: "Maritime Academic Certification", code: "MAR-CERT" },
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

const IconReceipt = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 3h12v18l-3-2-3 2-3-2-3 2Z" />
        <path d="M9 8h6M9 11.5h6M9 15h3" />
    </svg>
);

const IconBell = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15Z" />
        <path d="M10 20.5a2 2 0 0 0 4 0" />
    </svg>
);

const IconCash = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2.5" y="6" width="19" height="12" rx="2" />
        <circle cx="12" cy="12" r="2.6" />
        <path d="M6 9.5v5M18 9.5v5" />
    </svg>
);

const IconUsers = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="8.5" r="3.5" />
        <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
        <path d="M16 5.2a3.5 3.5 0 0 1 0 6.6M17.5 14.3c2.1.7 3.5 2.9 3.5 5.7" />
    </svg>
);

const IconQr = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1" />
        <rect x="14" y="3.5" width="6.5" height="6.5" rx="1" />
        <rect x="3.5" y="14" width="6.5" height="6.5" rx="1" />
        <path d="M14 14h2.5v2.5H14ZM18 18h2.5v2.5H18ZM14 18.5v2M18.5 14h2" />
    </svg>
);

// Landing page "Registrar Services" cards.
const SERVICES = [
    {
        Icon: IconDocument,
        tag: "Online",
        title: "Document requests",
        text: (count) => `Request any of ${count} registrar documents — transcripts, certifications, diplomas and more — without visiting the office.`,
        link: "Browse documents",
        href: "#documents",
    },
    {
        Icon: IconReceipt,
        tag: "In person",
        title: "Finance Office payment",
        text: () => "Pay the fee in person at the HCDC Finance Office, then upload a photo of your official receipt — the Registrar verifies it online.",
        link: "See how it works",
        href: "#process",
    },
    {
        Icon: IconBell,
        tag: "Real time",
        title: "Live request tracking",
        text: () => "Follow every step from verification to processing. Status changes appear instantly, with a notification each time.",
        link: "Track your requests",
        href: "/login",
    },
    {
        Icon: IconCalendar,
        tag: "Claiming",
        title: "Claim scheduling",
        text: () => "Get a set claiming date, time and window when your document is ready — and request a new schedule if you can’t make it.",
        link: "Learn more",
        href: "#process",
    },
    {
        Icon: IconUsers,
        tag: "New",
        title: "Authorized representatives",
        text: () => "Can’t claim in person? Name someone to claim for you with a signed letter and valid ID, approved online first.",
        link: "Common questions",
        href: "#faq",
    },
    {
        Icon: IconQr,
        tag: "Verified",
        title: "QR-verified credentials",
        text: () => "Every released document carries a signed credential and QR code, so schools and employers can confirm it’s genuine.",
        link: "Verify a document",
        href: "#verify",
    },
];

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

const IconFacebook = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
        <path d="M13.5 21v-8h2.7l.4-3.1h-3.1V8c0-.9.25-1.5 1.55-1.5H16.7V3.7C16.4 3.66 15.4 3.58 14.2 3.58c-2.4 0-4.05 1.47-4.05 4.17V9.9H7.4V13h2.75v8h3.35Z" />
    </svg>
);

const IconInstagram = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="18" height="18">
        <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
    </svg>
);

const IconTiktok = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
        <path d="M16.6 3c.4 2.2 1.8 3.6 4 3.9v2.8c-1.4.1-2.8-.3-4-1.1v6.4c0 3.3-2.7 5.9-6 5.7-3-.2-5.4-2.7-5.4-5.7 0-3.1 2.6-5.7 5.8-5.6v2.9c-1.5-.2-2.9.9-3 2.5-.1 1.5 1 2.8 2.5 2.9 1.6.1 2.9-1.1 2.9-2.7V3h3.2Z" />
    </svg>
);

const PROCESS_STEPS = [
    { Icon: IconUser, title: "Create an account", body: "Register with your student details. The Registrar verifies your record before you can request." },
    { Icon: IconDocument, title: "Submit a request", body: "Choose the document, number of copies and purpose. Add a “needed by” date if you have a deadline." },
    { Icon: IconCash, title: "Pay at the Finance Office", body: "Pay the amount shown on your request in person at the HCDC Finance Office and keep your official receipt.", badge: "In person" },
    { Icon: IconUpload, title: "Upload your receipt", body: "Upload a clear photo of the official receipt, plus any required documents. The Registrar verifies them online." },
    { Icon: IconGear, title: "Processing", body: "Your document is prepared and signed. Every status change shows up live, with a notification." },
    { Icon: IconCalendar, title: "Claim & verify", body: "Claim on your scheduled date with a valid ID — or send an approved representative. Its QR code proves it’s genuine." },
];

const LANDING_FAQ = [
    ["Do I need to create an account to request a document?", "Yes. A free CertiChain account lets you submit requests, upload your receipt and requirements, track status, and message the Registrar directly. The Registrar verifies your student record first."],
    ["Where and how do I pay?", "In person at the HCDC Finance Office. Submit your request first, then pay the amount shown on it at the Finance Office and keep the official receipt (OR). Upload a clear photo of the OR in your account so the Registrar can verify it."],
    ["Can I pay online?", "No. CertiChain doesn’t accept online payments — all fees are paid at the Finance Office, the same way as other HCDC fees."],
    ["What if my receipt is rejected?", "You’ll see the reason on your request. Upload a clearer or corrected photo of the same receipt — you don’t need to pay again."],
    ["How long does processing take?", "It depends on the document and current volume; typical processing days are shown for each document. Your account shows every status change live, and you’re notified at each step."],
    ["What do I bring when claiming my document?", "A valid ID and your original official receipt from the Finance Office. You’ll get a claiming date, time and window in your account once your document is ready."],
    ["Can I change my claiming schedule?", "Yes. Open the request and ask for a reschedule with a reason; the Registrar will set a new date."],
    ["Can someone else claim my document for me?", "Yes. Open your request and add an authorized representative: enter their name and relationship, and upload a letter you signed plus their valid ID. Once the Registrar approves it, they bring the original signed letter and their valid ID when claiming."],
    ["How do I know a document is genuine?", "Every document CertiChain issues carries a unique credential number and QR code. Anyone — an employer, another school — can scan it or enter the number on the Verify page, no account required."],
];


// Available document types, alphabetical, straight from the database.
function useDocumentCatalog() {
    const [documents, setDocuments] = useState(FALLBACK_DOCUMENTS);

    useEffect(() => {
        let cancelled = false;

        supabase
            .from("document_types")
            .select("document_code, document_name, preview_image_url")
            .eq("is_available", true)
            .order("document_name")
            .then(({ data, error }) => {
                if (cancelled) return;
                if (error) {
                    console.warn("LOAD DOCUMENT CATALOG ERROR:", error);
                    return;
                }
                if (data && data.length > 0) {
                    setDocuments(data.map((d) => ({ name: d.document_name, code: d.document_code, preview: d.preview_image_url || null })));
                }
            });

        return () => { cancelled = true; };
    }, []);

    return documents;
}

// The head's uploaded sample image if there is one, otherwise the same
// layout mock-up students see on New Request.
const DocumentPreviewContent = ({ doc }) => (
    <>
        <div className="document-preview-media">
            {doc.preview ? (
                <img src={doc.preview} alt={`Sample of ${doc.name}`} />
            ) : (
                <DocumentSample name={doc.name} documentCode={doc.code} />
            )}
        </div>
        <div className="document-preview-caption">
            <strong>{doc.name}</strong>
            <span>
                {doc.preview
                    ? "A real sample of this document, posted by the Registrar."
                    : "Reference layout only — not an official document."}
            </span>
        </div>
    </>
);

const LandingPage = () => {
    const DOCUMENTS = useDocumentCatalog();
    // Large floating preview while hovering a document (mouse only), and the
    // full-size preview modal opened by clicking/tapping one.
    const [hoverPreview, setHoverPreview] = useState(null);
    const [zoomedDoc, setZoomedDoc] = useState(null);
    useScrollLock(Boolean(zoomedDoc));

    // Place the hover preview beside the hovered item -- to its left (over
    // the section's text column) when there's room, else to its right --
    // vertically centered in the viewport so it can be large.
    const showHoverPreview = (doc, item) => {
        if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

        const rect = item.getBoundingClientRect();
        const gap = 20;
        const width = Math.min(520, window.innerWidth - 32);
        let left = rect.left - width - gap;
        if (left < 16) left = rect.right + gap;
        if (left + width > window.innerWidth - 16) return; // no room: click opens it instead

        setHoverPreview({ doc, style: { left, width } });
    };

    // The hover preview is positioned for where the item was; drop it when
    // the page scrolls, and let Escape close the full-size preview.
    useEffect(() => {
        if (!hoverPreview) return undefined;
        const hide = () => setHoverPreview(null);
        window.addEventListener("scroll", hide, { passive: true });
        return () => window.removeEventListener("scroll", hide);
    }, [hoverPreview]);

    useEffect(() => {
        if (!zoomedDoc) return undefined;
        const onKey = (e) => e.key === "Escape" && setZoomedDoc(null);
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [zoomedDoc]);
    const [verifyCode, setVerifyCode] = useState("");

    const scrollToSection = (id) => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    };

    const handleVerifySubmit = (e) => {
        e.preventDefault();
        const code = verifyCode.trim().toUpperCase();
        if (!code) return;
        window.location.href = `/verify/${encodeURIComponent(code)}`;
    };

    // Contact details as HTML for the Help Center / Contact pop-ups.
    const contactHtml = () => `
        <div class="lp-modal-contact">
            <strong>${REGISTRAR_CONTACT.office}</strong>
            <span>${REGISTRAR_CONTACT.address}</span>
            <a href="mailto:${REGISTRAR_CONTACT.email}">${REGISTRAR_CONTACT.email}</a>
            <a href="${REGISTRAR_CONTACT.telephoneHref}">${REGISTRAR_CONTACT.telephone}</a>
            ${REGISTRAR_CONTACT.mobileNumbers.map((m) => `<a href="${m.href}">${m.label}: ${m.display}</a>`).join("")}
        </div>`;

    const openHelpModal = () => {
        let scrollTarget = null;

        const steps = PROCESS_STEPS.map(
            ({ title, body, badge }, index) => `
                <li class="${badge ? "is-highlight" : ""}">
                    <span class="lp-modal-num">${index + 1}</span>
                    <div><strong>${title}</strong>${badge ? ` <em>${badge}</em>` : ""}<p>${body}</p></div>
                </li>`
        ).join("");

        Swal.fire({
            title: "Help Center",
            customClass: { popup: "lp-modal" },
            html: `
                <p class="lp-modal-intro">How requesting a document works, start to finish:</p>
                <ol class="lp-modal-steps">${steps}</ol>
                <div class="lp-modal-note">
                    <strong>Payment is in person.</strong> Pay at the HCDC Finance Office, then upload a photo of your official receipt in your account.
                </div>
                <div class="lp-modal-links">
                    <a href="#faq" data-section="faq">Read the FAQ</a>
                    <a href="#verify" data-section="verify">Verify a document</a>
                    <a href="/register">Create an account</a>
                </div>
                <p class="lp-modal-intro" style="margin-top:16px;">Already have a request? Log in and use <strong>Messages</strong> to reach the Registrar, or contact the office:</p>
                ${contactHtml()}
            `,
            confirmButtonText: "Got it",
            confirmButtonColor: "#123B78",
            width: 720,
            didOpen: (popup) => {
                // In-page links close the pop-up, then scroll to their section
                // (after closing, since SweetAlert restores the scroll position).
                popup.querySelectorAll("[data-section]").forEach((link) => {
                    link.addEventListener("click", (e) => {
                        e.preventDefault();
                        scrollTarget = link.dataset.section;
                        Swal.close();
                    });
                });
            },
            didClose: () => {
                if (scrollTarget) scrollToSection(scrollTarget);
            },
        });
    };

    const openContactModal = () => {
        Swal.fire({
            title: "Contact the Registrar",
            customClass: { popup: "lp-modal" },
            html: `
                <p class="lp-modal-intro">
                    For questions about a specific request, log in and message the Registrar from your
                    CertiChain account. For anything else, reach the office directly:
                </p>
                ${contactHtml()}
                <div class="lp-modal-note">
                    <strong>Payments</strong> are made in person at the HCDC Finance Office.
                </div>
            `,
            confirmButtonText: "Got it",
            confirmButtonColor: "#123B78",
            width: 520,
        });
    };

    return (
        <div className="landing-page">

            <header className="landing-navbar">
                <div className="navbar-container">

                    <a className="brand" href="#home" onClick={(e) => { e.preventDefault(); scrollToSection("home"); }}>
                        <div className="brand-seal">
                            <img src={hcdcLogo} alt="Holy Cross of Davao College" />
                        </div>
                        <div className="brand-text">
                            <div className="brand-name">CertiChain</div>
                            <div className="brand-subtitle">HCDC Registrar Services</div>
                        </div>
                    </a>

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
                                Request, pay for, track and claim registrar documents from
                                one account — and let anyone confirm they’re genuine with a
                                quick QR scan.
                            </p>
                        </div>

                        <div className="services-grid">
                            {SERVICES.map((service, index) => (
                                <article className="service-card" key={service.title}>
                                    <div className="service-card-top">
                                        <div className="service-icon"><service.Icon /></div>
                                        <span className="service-tag">{service.tag}</span>
                                    </div>
                                    <span className="service-number">{String(index + 1).padStart(2, "0")}</span>
                                    <h3>{service.title}</h3>
                                    <p>{service.text(DOCUMENTS.length)}</p>
                                    <a
                                        href={service.href}
                                        onClick={service.href.startsWith("#") ? (e) => { e.preventDefault(); scrollToSection(service.href.slice(1)); } : undefined}
                                    >
                                        {service.link} <span aria-hidden="true">→</span>
                                    </a>
                                </article>
                            ))}
                        </div>

                        <div className="services-highlights">
                            <div>
                                <strong>{DOCUMENTS.length}+</strong>
                                <span>documents you can request online</span>
                            </div>
                            <div>
                                <strong>Live</strong>
                                <span>status updates and notifications</span>
                            </div>
                            <div>
                                <strong>QR</strong>
                                <span>verification on every credential</span>
                            </div>
                            <a className="services-highlights-cta" href="/register">
                                Create your account <span aria-hidden="true">→</span>
                            </a>
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
                                {DOCUMENTS.map((doc) => {
                                    const key = `${doc.code}-${doc.name}`;

                                    return (
                                        <div
                                            className="document-item has-preview"
                                            key={key}
                                            role="button"
                                            tabIndex={0}
                                            aria-label={`Preview ${doc.name}`}
                                            onMouseEnter={(e) => showHoverPreview(doc, e.currentTarget)}
                                            onMouseLeave={() => setHoverPreview(null)}
                                            onClick={() => { setHoverPreview(null); setZoomedDoc(doc); }}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" || e.key === " ") {
                                                    e.preventDefault();
                                                    setZoomedDoc(doc);
                                                }
                                            }}
                                        >
                                            <span className="document-code">{doc.code}</span>
                                            <span>{doc.name}</span>
                                            <span className="document-check"><IconCheck /></span>
                                        </div>
                                    );
                                })}
                            </div>

                            {hoverPreview && (
                                <div className="document-preview" style={hoverPreview.style} aria-hidden="true">
                                    <DocumentPreviewContent doc={hoverPreview.doc} />
                                    <span className="document-preview-hint">Click to view full size</span>
                                </div>
                            )}

                        </div>
                    </div>
                </section>

                <section id="process" className="section process-section">
                    <div className="section-container">

                        <div className="section-heading">
                            <span className="section-label">How It Works</span>
                            <h2>From request <br /><span>to verified credential.</span></h2>
                            <p>
                                Six steps from your first request to a document anyone can
                                verify. Everything happens in your account — except paying,
                                which is done at the Finance Office.
                            </p>
                        </div>

                        <ol className="process-grid">
                            {PROCESS_STEPS.map((step, index) => (
                                <li className={`process-step${step.badge ? " is-highlight" : ""}`} key={step.title}>
                                    <div className="process-step-top">
                                        <span className="step-number">{String(index + 1).padStart(2, "0")}</span>
                                        {step.badge && <span className="step-badge">{step.badge}</span>}
                                    </div>
                                    <div className="step-icon"><step.Icon /></div>
                                    <h3>{step.title}</h3>
                                    <p>{step.body}</p>
                                </li>
                            ))}
                        </ol>

                        <div className="payment-note">
                            <div className="payment-note-icon"><IconCash /></div>
                            <div>
                                <strong>Payments are made in person at the HCDC Finance Office.</strong>
                                <p>
                                    CertiChain doesn’t take online payments. After you submit a request, pay the amount
                                    shown on it at the Finance Office, keep the official receipt (OR), and upload a clear
                                    photo of it in your account. Bring the original OR when you claim your document.
                                </p>
                            </div>
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
                                    CertiChain is the online registrar services system of the Holy Cross of
                                    Davao College Office of Registration and Records Management. Students and
                                    alumni request academic documents, follow their progress and schedule
                                    claiming — all from one account.
                                </p>
                                <ul className="about-list">
                                    <li><IconCheck /> Requests, requirements and receipts in one place</li>
                                    <li><IconCheck /> Live status updates and claiming schedules</li>
                                    <li><IconCheck /> Signed credentials anyone can verify by QR</li>
                                    <li><IconCheck /> Payments stay in person at the Finance Office</li>
                                </ul>
                            </div>

                            <div className="about-highlights">
                                <div>
                                    <span className="about-highlight-icon"><IconDocument /></span>
                                    <strong>{DOCUMENTS.length}+</strong>
                                    <span>documents available online</span>
                                </div>
                                <div>
                                    <span className="about-highlight-icon"><IconCalendar /></span>
                                    <strong>6 steps</strong>
                                    <span>from request to claiming</span>
                                </div>
                                <div>
                                    <span className="about-highlight-icon"><IconCash /></span>
                                    <strong>Finance Office</strong>
                                    <span>in-person payment</span>
                                </div>
                                <div>
                                    <span className="about-highlight-icon"><IconQr /></span>
                                    <strong>QR verified</strong>
                                    <span>every issued credential</span>
                                </div>
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
                                Every document CertiChain issues carries a signed credential
                                number and QR code. Employers and other schools can confirm
                                it’s genuine in seconds — free, with no account required.
                            </p>
                        </div>

                        <div className="verify-layout">
                            <div className="verify-card">
                                <div className="verify-card-head">
                                    <span className="verify-card-icon"><IconQr /></span>
                                    <div>
                                        <h3>Check a document</h3>
                                        <p>Scan the QR code on the document with any phone camera, or type its credential number.</p>
                                    </div>
                                </div>

                                <form className="verify-cta-form" onSubmit={handleVerifySubmit}>
                                    <label className="verify-cta-field">
                                        <span className="visually-hidden">Credential number</span>
                                        <input
                                            type="text"
                                            value={verifyCode}
                                            onChange={(e) => setVerifyCode(e.target.value)}
                                            placeholder="e.g. CERT-000123"
                                            className="verify-cta-input"
                                            autoComplete="off"
                                            spellCheck={false}
                                        />
                                    </label>
                                    <button type="submit" className="verify-cta-button" disabled={!verifyCode.trim()}>
                                        Verify <span aria-hidden="true">→</span>
                                    </button>
                                </form>

                                <ol className="verify-steps">
                                    <li><strong>Scan or enter</strong> the credential number printed on the document.</li>
                                    <li><strong>We check</strong> it against the Registrar’s signed records.</li>
                                    <li><strong>See the result</strong> instantly — no account or app needed.</li>
                                </ol>
                            </div>

                            <div className="verify-results">
                                <span className="verify-results-label">What the result means</span>
                                <ul>
                                    <li className="is-verified">
                                        <span className="verify-result-icon" aria-hidden="true">✓</span>
                                        <div><strong>Verified</strong><span>Genuine and unchanged since the Registrar issued it.</span></div>
                                    </li>
                                    <li className="is-revoked">
                                        <span className="verify-result-icon" aria-hidden="true">✕</span>
                                        <div><strong>Revoked</strong><span>Issued, but cancelled by the Registrar — no longer valid.</span></div>
                                    </li>
                                    <li className="is-tampered">
                                        <span className="verify-result-icon" aria-hidden="true">!</span>
                                        <div><strong>Tampered</strong><span>The record was altered after issuance — do not accept it.</span></div>
                                    </li>
                                    <li className="is-missing">
                                        <span className="verify-result-icon" aria-hidden="true">?</span>
                                        <div><strong>Not found</strong><span>No credential with that number — check for typos, or treat it as fake.</span></div>
                                    </li>
                                </ul>
                            </div>
                        </div>

                    </div>
                </section>

                <section id="faq" className="section faq-section">
                    <div className="section-container">

                        <div className="section-heading">
                            <span className="section-label">FAQ</span>
                            <h2>Frequently asked <br /><span>questions.</span></h2>
                            <p>Quick answers about requesting, paying, claiming and verifying documents.</p>
                        </div>

                        <div className="faq-layout">
                            <div className="faq-list">
                                {LANDING_FAQ.map(([question, answer]) => (
                                    <details className="faq-item" key={question}>
                                        <summary>{question}</summary>
                                        <p>{answer}</p>
                                    </details>
                                ))}
                            </div>

                            <aside className="faq-contact">
                                <span className="faq-contact-label">Still have questions?</span>
                                <h3>Contact the Registrar</h3>
                                <p>{REGISTRAR_CONTACT.office}</p>
                                <ul>
                                    <li><span>Email</span><a href={`mailto:${REGISTRAR_CONTACT.email}`}>{REGISTRAR_CONTACT.email}</a></li>
                                    <li><span>Phone</span><a href={REGISTRAR_CONTACT.telephoneHref}>{REGISTRAR_CONTACT.telephone}</a></li>
                                    {REGISTRAR_CONTACT.mobileNumbers.map((m) => (
                                        <li key={m.label}><span>{m.label}</span><a href={m.href}>{m.display}</a></li>
                                    ))}
                                </ul>
                                <p className="faq-contact-note">Payments: HCDC Finance Office, in person.</p>
                            </aside>
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
                            <p className="footer-contact">
                                Sta. Ana Avenue corner C. De Guzman Street, Barangay 14-B, Davao City<br />
                                (082) 221-9071 to 79 &middot; info@hcdc.edu.ph
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

                    <div className="footer-compliance-row">
                        <div className="footer-badges">
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

                        <div className="footer-social-icons">
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

                    <div className="footer-bottom">
                        <span>© {new Date().getFullYear()} CertiChain. All rights reserved.</span>
                        <span>
                            <a href="/terms">Terms of Service</a>
                            {' · '}
                            <a href="/privacy-policy">Privacy Policy</a>
                            {' · '}
                            <a href="/cookie-policy">Cookie Policy</a>
                            {' · '}
                            <a href="/refund-policy">Refund Policy</a>
                        </span>
                        <span>Holy Cross of Davao College</span>
                    </div>

                </div>
            </footer>

            {zoomedDoc && (
                <div className="document-zoom-overlay" onClick={() => setZoomedDoc(null)}>
                    <div
                        className="document-zoom"
                        role="dialog"
                        aria-modal="true"
                        aria-label={`${zoomedDoc.name} preview`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            type="button"
                            className="document-zoom-close"
                            onClick={() => setZoomedDoc(null)}
                            aria-label="Close preview"
                            autoFocus
                        >
                            ×
                        </button>
                        <DocumentPreviewContent doc={zoomedDoc} />
                    </div>
                </div>
            )}

        </div>
    );
};

export default LandingPage;
