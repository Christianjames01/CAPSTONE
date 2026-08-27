import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import './StudentPages.css'

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

            {/* FAQ */}
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
                                        background: isOpen ? 'var(--blue-tint)' : 'var(--white)',
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

            {/* PROCESSING TIMES & FEES */}
            <div className="student-card">
                <h2 style={{ fontSize: 16, marginBottom: 16 }}>Document Processing Times &amp; Fees</h2>

                {loading ? (
                    <p className="student-loading">Loading document list...</p>
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

            {/* CONTACT */}
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
        </div>
    )
}

export default HelpSupport
