import { Fragment, useEffect, useRef, useState } from "react";
import { IconCheck as UiCheck } from '../../components/UiIcons'
import Swal from "sweetalert2";
import { supabase } from "../../lib/supabase";
import { REGISTRAR_CONTACT } from "../../lib/registrarContact";
import { DocumentSample } from "../../components/DocumentSample";
import { useScrollLock } from "../../lib/useScrollLock";
import HeroVisual from "./HeroVisual";
import ExplainerPlayer from "../../components/explainer/ExplainerPlayer";
import { STUDENT_SCENES } from "../../components/explainer/sceneLists";
import { useCountUp, useInView, useMagnetic, useReveal, useScrollProgress } from "./motion";
import "./Landing.css";
import "./LandingMotion.css";
import hcdcLogo from "../../assets/hcdc-logo.png";
import certichainLogo from "../../assets/certichain-logo.png";
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
    { Icon: IconReceipt, title: "Get your assessment slip", body: "Visit the Registrar's Office in person for the fee assessment on the document you need.", badge: "In person" },
    { Icon: IconCash, title: "Pay & get verified", body: "Pay the amount on your slip at the HCDC Finance Office, then bring the official receipt back to the Registrar's Office for them to verify in person.", badge: "In person" },
    { Icon: IconUpload, title: "Submit & upload your receipt", body: "Once verified, log into your account, choose the document, the number of copies and your purpose, submit your request, then upload a clear photo of the official receipt." },
    { Icon: IconGear, title: "Processing", body: "Your document is prepared and signed. Every status change shows up live, with a notification." },
    { Icon: IconCalendar, title: "Claim & verify", body: "Claim on your scheduled date with a valid ID — or send an approved representative. Its QR code proves it’s genuine." },
];

const LANDING_FAQ = [
    ["Do I need to create an account to request a document?", "Yes. A free CertiChain account lets you submit requests, upload your receipt and requirements, track status, and message the Registrar directly. The Registrar verifies your student record first."],
    ["Where and how do I pay?", "In person at the HCDC Finance Office. First get your assessment slip from the Registrar's Office, pay the amount shown on it, and keep the official receipt (OR). Bring the OR back to the Registrar's Office for them to verify in person — once verified, submit your request in your account and upload a clear photo of the OR."],
    ["Can I pay online?", "No. CertiChain doesn’t accept online payments — all fees are paid at the Finance Office, the same way as other HCDC fees."],
    ["What if my receipt is rejected?", "You’ll see the reason on your request. Upload a clearer or corrected photo of the same receipt — you don’t need to pay again."],
    ["How long does processing take?", "It depends on the document and current volume; typical processing days are shown for each document. Your account shows every status change live, and you’re notified at each step."],
    ["What do I bring when claiming my document?", "A valid ID and your original official receipt from the Finance Office. You’ll get a claiming date, time and window in your account once your document is ready."],
    ["Can I change my claiming schedule?", "Yes. Open the request and ask for a reschedule with a reason; the Registrar will set a new date."],
    ["Can someone else claim my document for me?", "Yes. Open your request and add an authorized representative: enter their name and relationship, and upload a letter you signed plus their valid ID. Once the Registrar approves it, they bring the original signed letter and their valid ID when claiming."],
    ["How do I know a document is genuine?", "Every document CertiChain issues carries a unique credential number and QR code. Anyone — an employer, another school — can scan it or enter the number on the Verify page, no account required."],
];


// The walkthrough ends with sign-up / log-in.
const LANDING_CTA = {
    primary: { label: "Create an account →", href: "/register" },
    secondary: { label: "Log in", href: "/login" },
};

// Headline words that rise in one after another.
const Words = ({ text, start = 0 }) =>
    text.split(" ").map((word, i) => (
        <span className="lpm-word" style={{ "--w": start + i }} key={`${word}-${i}`}>
            {word}{" "}
        </span>
    ));

// Thin progress bar under the navbar: how far down the page you are. Its
// own component so scrolling doesn't re-render the whole page.
function PageProgress() {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        let frame = null;
        const measure = () => {
            frame = null;
            const max = document.documentElement.scrollHeight - window.innerHeight;
            setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);
        };
        const onScroll = () => { if (frame === null) frame = requestAnimationFrame(measure); };
        measure();
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll);
        return () => {
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onScroll);
            if (frame !== null) cancelAnimationFrame(frame);
        };
    }, []);

    return <span className="lpm-progress" style={{ transform: `scaleX(${progress})` }} aria-hidden="true" />;
}

// "How it works": a rail of numbered dots fills as the section scrolls by,
// lighting each step card as it's reached.
function ProcessSteps() {
    const ref = useRef(null);
    const progress = useScrollProgress(ref);
    // The cards re-render as the rail fills, which would wipe a class added
    // from outside React -- so their reveal ("is-in") is set here instead.
    const shown = useInView(ref, { threshold: 0.1 });
    const lit = (i) => progress >= (i + 0.35) / PROCESS_STEPS.length;

    return (
        <div className="lpm-process-wrap" ref={ref} style={{ "--p": progress }}>
            <div className="lpm-rail" aria-hidden="true">
                <b />
                {PROCESS_STEPS.map((step, i) => (
                    <span key={step.title} className={`${lit(i) ? "is-lit" : ""}${step.badge ? " is-red" : ""}`}>
                        {String(i + 1).padStart(2, "0")}
                    </span>
                ))}
            </div>

            <ol className="process-grid">
                {PROCESS_STEPS.map((step, index) => (
                    <li
                        className={`process-step${step.badge ? " is-highlight" : ""}${lit(index) ? " is-lit" : ""}${shown ? " is-in" : ""}`}
                        key={step.title}
                        data-reveal
                        style={{ "--d": `${(index % 3) * 110}ms` }}
                    >
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
        </div>
    );
}

// Results: numbers that count up, then the old way vs CertiChain.
function Benefits({ documentCount }) {
    const ref = useRef(null);
    const inView = useInView(ref, { threshold: 0.3 });
    const docs = useCountUp(documentCount, inView);
    const steps = useCountUp(6, inView, 900);
    const hours = useCountUp(24, inView, 1200);
    const scan = useCountUp(1, inView, 600);

    const before = [
        "Queue at the Registrar counter just to file a request",
        "Come back again and again to ask if it’s ready",
        "No way to know where your request is",
        "Paper documents are hard to check for forgery",
    ];
    const after = [
        "Request online from home, any time of day",
        "Live status with a notification at every step",
        "A set claiming date, time and window",
        "A signed credential and QR code anyone can verify",
    ];

    return (
        <section className="lpm-benefits" id="benefits" ref={ref}>
            <div className="section-container">
                <div className="section-heading" data-reveal>
                    <span className="section-label">Why it matters</span>
                    <h2>Less waiting, <br /><span>more certainty.</span></h2>
                    <p>
                        Most of the trips to the office are gone. You only go in person
                        to pay at the Finance Office and to claim your document.
                    </p>
                </div>

                <div className="lpm-stats">
                    <div className="lpm-stat" data-reveal style={{ "--d": "0ms" }}>
                        <strong>{docs}<sup>+</sup></strong>
                        <span>registrar documents you can request online</span>
                    </div>
                    <div className="lpm-stat" data-reveal style={{ "--d": "100ms" }}>
                        <strong>{steps}</strong>
                        <span>clear steps from request to verified credential</span>
                    </div>
                    <div className="lpm-stat" data-reveal style={{ "--d": "200ms" }}>
                        <strong>{hours}/7</strong>
                        <span>request and track from any device, day or night</span>
                    </div>
                    <div className="lpm-stat" data-reveal style={{ "--d": "300ms" }}>
                        <strong>{scan}</strong>
                        <span>QR scan to prove a document is genuine</span>
                    </div>
                </div>

                <div className="lpm-compare">
                    <div className="lpm-compare-card is-before" data-reveal="left">
                        <h3><span>Before</span> The counter line</h3>
                        <ul>
                            {before.map((item, i) => (
                                <li key={item} className="is-in-list" style={{ "--d": `${200 + i * 120}ms` }}><i>×</i>{item}</li>
                            ))}
                        </ul>
                    </div>
                    <div className="lpm-compare-card is-after" data-reveal="right">
                        <h3><span>Now</span> With CertiChain</h3>
                        <ul>
                            {after.map((item, i) => (
                                <li key={item} className="is-in-list" style={{ "--d": `${350 + i * 120}ms` }}><i>✓</i>{item}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </section>
    );
}

// Final call to action: buttons lean toward the cursor.
function FinalCta() {
    const primary = useRef(null);
    const secondary = useRef(null);
    useMagnetic(primary, 0.3);
    useMagnetic(secondary, 0.2);

    return (
        <section className="cta-section">
            <div className="cta-container" data-reveal="scale">
                <div className="cta-icon">
                    <img src={certichainLogo} alt="Holy Cross of Davao College" />
                </div>
                <span className="cta-label">HCDC Registrar Services</span>
                <h2>Ready to request <br /><span>your document?</span></h2>
                <p>
                    Create your CertiChain account and manage your academic
                    document requests through a secure, verified, and convenient
                    online platform.
                </p>

                <div className="lpm-cta-steps" aria-label="What happens next">
                    <span><b>1</b>Create account</span>
                    <span><b>2</b>Request</span>
                    <span><b>3</b>Track &amp; claim</span>
                </div>

                <div className="cta-buttons">
                    <button ref={primary} className="cta-primary" onClick={() => window.location.href = "/register"}>
                        Create an account
                        <span>→</span>
                    </button>
                    <button ref={secondary} className="cta-secondary" onClick={() => window.location.href = "/login"}>
                        Already have an account?
                        <span>Log in</span>
                    </button>
                </div>
            </div>
        </section>
    );
}

const IconShieldCheck = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3 5 6v5.5c0 4.2 2.9 7.8 7 9.5 4.1-1.7 7-5.3 7-9.5V6Z" />
        <path d="m9 12 2 2 4-4" />
    </svg>
);

// Social proof: facts about the system, not invented reviews.
const TRUST_POINTS = [
    { quote: "The official online registrar service of Holy Cross of Davao College — requests go straight to the Registrar’s staff.", who: "Office of Registration & Records Management", role: "Holy Cross of Davao College", logo: true },
    { quote: "Your personal data is handled under the Data Privacy Act, by an institution registered with the National Privacy Commission.", who: "Data privacy", role: "NPC-registered DPO", Icon: IconShieldCheck },
    { quote: "Every released document carries a signed credential number and QR code — schools and employers can check it free, no account needed.", who: "Verifiable credentials", role: "Signed and QR-verified", Icon: IconQr },
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
    const pageRef = useRef(null);
    useReveal(pageRef, [DOCUMENTS.length]);
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
            ${REGISTRAR_CONTACT.campuses.map((campus) => `
                <span class="lp-modal-contact-campus">${campus.name}</span>
                <a href="${campus.telephoneHref}">${campus.telephone}</a>
                ${campus.mobileNumbers.map((m) => `<a href="${m.href}">${m.label}: ${m.display}</a>`).join("")}
            `).join("")}
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
        <div className="landing-page" ref={pageRef}>

            <header className="landing-navbar">
                <PageProgress />
                <div className="navbar-container">

                    <a className="brand" href="#home" onClick={(e) => { e.preventDefault(); scrollToSection("home"); }}>
                        <div className="brand-seal">
                            <img src={certichainLogo} alt="Holy Cross of Davao College" />
                        </div>
                        <div className="brand-text">
                            <div className="brand-name">CertiChain</div>
                            <div className="brand-subtitle">HCDC Registrar Services</div>
                        </div>
                    </a>

                    <nav className="desktop-nav">
                        <a href="#watch" onClick={(e) => { e.preventDefault(); scrollToSection("watch"); }}>Watch</a>
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

                            <div className="hero-eyebrow lpm-fade-up" style={{ "--d": "0ms" }}>
                                <span className="eyebrow-mark" />
                                The Office of Registration &amp; Records Management
                            </div>

                            <h1 className="lpm-headline" aria-label="Your records, verified and provable.">
                                <Words text="Your records," />
                                <br />
                                <span><Words text="verified and provable." start={2} /></span>
                            </h1>

                            <p className="hero-description lpm-fade-up" style={{ "--d": "520ms" }}>
                                Request transcripts, certificates, and diplomas from
                                Holy Cross of Davao College without a single trip to the
                                counter. Submit, pay for, and track every request from
                                one account.
                            </p>

                            <div className="hero-buttons lpm-fade-up" style={{ "--d": "680ms" }}>
                                <button className="primary-button" onClick={() => window.location.href = "/register"}>
                                    Request a document
                                    <span>→</span>
                                </button>
                                <button className="secondary-button" onClick={() => scrollToSection("watch")}>
                                    ▶&nbsp; Watch how it works
                                </button>
                            </div>

                            <div className="hero-trust lpm-fade-up" style={{ "--d": "840ms" }}>
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
                            <HeroVisual />
                        </div>

                    </div>

                </section>

                <section id="watch" className="lpx-section">
                    <div className="section-container">
                        <div className="section-heading" data-reveal>
                            <span className="section-label">See it in action</span>
                            <h2>One minute, <br /><span>start to finish.</span></h2>
                            <p>
                                Watch a request go from sign-up to a verified document —
                                the same screens you’ll use. Pick any chapter to jump ahead.
                            </p>
                        </div>
                        <div data-reveal="scale" style={{ "--d": "120ms" }}>
                            <ExplainerPlayer scenes={STUDENT_SCENES} cta={LANDING_CTA} label="How CertiChain works" />
                        </div>
                    </div>
                </section>

                <section id="services" className="section services-section">
                    <div className="section-container">

                        <div className="section-heading" data-reveal>
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
                                <article className="service-card" key={service.title} data-reveal style={{ "--d": `${(index % 3) * 110}ms` }}>
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

                        <div className="services-highlights" data-reveal>
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

                            <div className="documents-content" data-reveal="left">
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

                            <div className="document-list" data-reveal="right" style={{ "--d": "120ms" }}>
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

                        <div className="section-heading" data-reveal>
                            <span className="section-label">How It Works</span>
                            <h2>From request <br /><span>to verified credential.</span></h2>
                            <p>
                                Six steps from your first request to a document anyone can
                                verify. Everything happens in your account — except paying,
                                which is done at the Finance Office.
                            </p>
                        </div>

                        <ProcessSteps />

                        <div className="payment-note" data-reveal>
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

                <Benefits documentCount={DOCUMENTS.length} />

                <section id="about" className="section about-section">
                    <div className="section-container">
                        <div className="about-card" data-reveal>

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

                        <div className="section-heading" data-reveal>
                            <span className="section-label">Verification</span>
                            <h2>Every credential, <br /><span>verified.</span></h2>
                            <p>
                                Every document CertiChain issues carries a signed credential
                                number and QR code. Employers and other schools can confirm
                                it’s genuine in seconds — free, with no account required.
                            </p>
                        </div>

                        <div className="verify-layout">
                            <div className="verify-card" data-reveal="left">
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

                            <div className="verify-sample" aria-label="Example of a verification result" data-reveal="right" style={{ "--d": "140ms" }}>
                                <span className="verify-sample-label">Sample result</span>

                                <div className="verify-sample-card">
                                    <div className="verify-sample-banner">
                                        <span className="verify-sample-check" aria-hidden="true"><UiCheck /></span>
                                        <div>
                                            <strong>Verified credential</strong>
                                            <span>Issued by the HCDC Registrar’s Office</span>
                                        </div>
                                    </div>

                                    <dl className="verify-sample-fields">
                                        <div><dt>Document</dt><dd>Transcript of Records</dd></div>
                                        <div><dt>Credential no.</dt><dd className="is-mono">CERT-000123</dd></div>
                                        <div><dt>Issued to</dt><dd>Juan Dela Cruz</dd></div>
                                        <div><dt>Program</dt><dd>BS Information Technology</dd></div>
                                        <div><dt>Date issued</dt><dd>Sep 25, 2026</dd></div>
                                        <div><dt>Signature</dt><dd className="is-ok">Valid</dd></div>
                                    </dl>
                                </div>

                                <p className="verify-sample-note">
                                    Revoked or altered documents are clearly flagged, and unknown numbers show as not found —
                                    so a forged copy can’t pass.
                                </p>
                            </div>
                        </div>

                    </div>
                </section>

                <section className="lpm-trust" aria-label="Why you can trust CertiChain">
                    <div className="section-container">
                        <div className="section-heading" data-reveal>
                            <span className="section-label">Trusted &amp; official</span>
                            <h2>Built by the Registrar, <br /><span>for the HCDC community.</span></h2>
                        </div>
                        <div className="lpm-trust-grid">
                            {TRUST_POINTS.map((point, i) => (
                                <figure className="lpm-trust-card" key={point.who} data-reveal style={{ "--d": `${i * 120}ms` }}>
                                    <blockquote>{point.quote}</blockquote>
                                    <figcaption className="lpm-trust-by">
                                        <span>{point.logo ? <img src={hcdcLogo} alt="" /> : <point.Icon />}</span>
                                        <div>
                                            <strong>{point.who}</strong>
                                            <small>{point.role}</small>
                                        </div>
                                    </figcaption>
                                </figure>
                            ))}
                        </div>
                    </div>
                </section>

                <section id="faq" className="section faq-section">
                    <div className="section-container">

                        <div className="section-heading" data-reveal>
                            <span className="section-label">FAQ</span>
                            <h2>Frequently asked <br /><span>questions.</span></h2>
                            <p>Quick answers about requesting, paying, claiming and verifying documents.</p>
                        </div>

                        <div className="faq-layout">
                            <div className="faq-list">
                                {LANDING_FAQ.map(([question, answer], i) => (
                                    <details className="faq-item" key={question} data-reveal style={{ "--d": `${Math.min(i, 5) * 60}ms` }}>
                                        <summary>{question}</summary>
                                        <p>{answer}</p>
                                    </details>
                                ))}
                            </div>

                            <aside className="faq-contact" data-reveal="right">
                                <span className="faq-contact-label">Still have questions?</span>
                                <h3>Contact the Registrar</h3>
                                <p>{REGISTRAR_CONTACT.office}</p>
                                <ul>
                                    <li><span>Email</span><a href={`mailto:${REGISTRAR_CONTACT.email}`}>{REGISTRAR_CONTACT.email}</a></li>
                                    {REGISTRAR_CONTACT.campuses.map((campus) => (
                                        <Fragment key={campus.name}>
                                            <li><span>{campus.name}</span><a href={campus.telephoneHref}>{campus.telephone}</a></li>
                                            {campus.mobileNumbers.map((m) => (
                                                <li key={m.href}><span>{m.label}</span><a href={m.href}>{m.display}</a></li>
                                            ))}
                                        </Fragment>
                                    ))}
                                </ul>
                                <p className="faq-contact-note">Payments: HCDC Finance Office, in person.</p>
                            </aside>
                        </div>

                    </div>
                </section>

                <FinalCta />

            </main>

            <footer className="landing-footer">
                <div className="footer-container">

                    <div className="footer-main">

                        <div className="footer-brand">
                            <div className="brand">
                                <div className="brand-seal">
                                    <img src={certichainLogo} alt="Holy Cross of Davao College" />
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
