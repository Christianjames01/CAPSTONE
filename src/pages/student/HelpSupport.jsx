import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { SkeletonList } from '../../components/Skeleton'
import dpoRegisteredBadge from '../../assets/dpo-registered-badge.png'
import dataPrivacyBadge from '../../assets/data-privacy-badge.png'
import './StudentPages.css'

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

const REGISTRAR_CONTACT = {
    office: "Office of Registration and Records Management (ORRM)",
    address: 'Sta. Ana Avenue corner C. De Guzman Street, Brgy. 14-B, Davao City, Philippines',
    email: 'registrar@hcdc.edu.ph',
    telephone: '(082) 221-9071 to 79 loc. 116 or 167',
    telefax: '(082) 221-3008',
    mobile: 'Smart (+63) 946 810 8617 · Globe (+63) 906 150 9582',
    website: 'www.hcdc.edu.ph',
}

const FAQS = [
    {
        question: 'How do I request a document?',
        answer: 'Go to "Request a Document" in the sidebar, choose the document type and quantity, add your purpose, and submit. You can track its status under "My Requests".',
    },
    {
        question: 'How do I pay for my request?',
        answer: 'Pay the amount shown on your request at the Finance Office, then go to "Upload Receipt" to submit your official receipt (OR) for verification.',
    },
    {
        question: 'How will I know when my document is ready to claim?',
        answer: 'Once your request is scheduled for claiming, it will appear under "Claim Schedule" with the date, time, and instructions. You will also get a notification.',
    },
    {
        question: 'What should I bring when claiming my document?',
        answer: "Bring your official receipt (OR) and a valid ID. The registrar will verify your identity before releasing the document.",
    },
    {
        question: 'Can I cancel a request after submitting it?',
        answer: 'Contact the Registrar\'s Office directly to request a cancellation for requests that have not yet been processed.',
    },
]

function HelpSupport() {
    const [documentTypes, setDocumentTypes] = useState([])
    const [loading, setLoading] = useState(true)
    const [openFaq, setOpenFaq] = useState(null)

    useEffect(() => {
        loadDocumentTypes()
    }, [])

    const loadDocumentTypes = async () => {
        const { data, error } = await supabase
            .from('document_types')
            .select('document_type_id, document_name, fee, processing_days_min, processing_days_max')
            .eq('is_available', true)
            .order('document_name')

        if (error) {
            console.error('DOCUMENT TYPES ERROR:', error)
        }

        setDocumentTypes(data || [])
        setLoading(false)
    }

    return (
        <div>
            <div className="student-page-header">
                <h1>Help / Support</h1>
                <p>Frequently asked questions, processing times, and Registrar contact information.</p>
            </div>

            <div className="student-card">
                <h2 style={{ fontSize: 16, marginBottom: 16 }}>Frequently Asked Questions</h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {FAQS.map((faq, index) => {
                        const isOpen = openFaq === index

                        return (
                            <div
                                key={faq.question}
                                style={{
                                    border: '1px solid var(--line)',
                                    borderRadius: 8,
                                    overflow: 'hidden',
                                }}
                            >
                                <button
                                    onClick={() => setOpenFaq(isOpen ? null : index)}
                                    style={{
                                        width: '100%',
                                        textAlign: 'left',
                                        padding: '14px 16px',
                                        fontWeight: 600,
                                        fontSize: 14,
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        gap: 12,
                                        background: isOpen ? 'var(--blue-tint)' : 'var(--surface)',
                                    }}
                                >
                                    {faq.question}
                                    <span style={{ color: 'var(--blue)' }}>{isOpen ? '−' : '+'}</span>
                                </button>

                                {isOpen && (
                                    <p style={{ padding: '0 16px 16px', fontSize: 13.5 }}>
                                        {faq.answer}
                                    </p>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            <div className="student-card">
                <h2 style={{ fontSize: 16, marginBottom: 16 }}>Document Processing Times &amp; Fees</h2>

                {loading ? (
                    <SkeletonList count={3} />
                ) : documentTypes.length === 0 ? (
                    <p style={{ fontSize: 13.5, color: 'var(--slate)' }}>
                        No document types are currently available.
                    </p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                            <thead>
                                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--line)' }}>
                                    <th style={{ padding: '8px 10px' }}>Document</th>
                                    <th style={{ padding: '8px 10px' }}>Fee</th>
                                    <th style={{ padding: '8px 10px' }}>Processing Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                {documentTypes.map((doc) => (
                                    <tr key={doc.document_type_id} style={{ borderBottom: '1px solid var(--line)' }}>
                                        <td style={{ padding: '10px' }}>{doc.document_name}</td>
                                        <td style={{ padding: '10px' }}>₱{Number(doc.fee || 0).toFixed(2)}</td>
                                        <td style={{ padding: '10px' }}>
                                            {doc.processing_days_min && doc.processing_days_max
                                                ? `${doc.processing_days_min}–${doc.processing_days_max} working days`
                                                : 'Varies'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="student-card">
                <h2 style={{ fontSize: 16, marginBottom: 4 }}>Registrar Contact Information</h2>
                <p style={{ fontSize: 13, marginBottom: 16 }}>{REGISTRAR_CONTACT.office}</p>

                <div className="student-info-grid">
                    <div className="student-info-field">
                        <span>Address</span>
                        <strong>{REGISTRAR_CONTACT.address}</strong>
                    </div>

                    <div className="student-info-field">
                        <span>Email</span>
                        <strong>{REGISTRAR_CONTACT.email}</strong>
                    </div>

                    <div className="student-info-field">
                        <span>Telephone</span>
                        <strong>{REGISTRAR_CONTACT.telephone}</strong>
                    </div>

                    <div className="student-info-field">
                        <span>Telefax</span>
                        <strong>{REGISTRAR_CONTACT.telefax}</strong>
                    </div>

                    <div className="student-info-field">
                        <span>Mobile</span>
                        <strong>{REGISTRAR_CONTACT.mobile}</strong>
                    </div>

                    <div className="student-info-field">
                        <span>Website</span>
                        <strong>{REGISTRAR_CONTACT.website}</strong>
                    </div>
                </div>
            </div>

            <footer className="student-help-footer">
                <div className="student-help-footer-badges">
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

                <div className="student-help-footer-social">
                    <div className="student-help-footer-icons">
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
                    <div className="student-help-footer-copyright">
                        © {new Date().getFullYear()} Holy Cross of Davao College. All Rights Reserved.
                    </div>
                </div>
            </footer>
        </div>
    )
}

export default HelpSupport
