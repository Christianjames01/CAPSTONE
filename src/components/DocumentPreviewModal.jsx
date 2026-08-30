import './DocumentPreviewModal.css'

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif']

function getExtension(nameOrUrl) {
    if (!nameOrUrl) return ''
    const clean = nameOrUrl.split('?')[0]
    return clean.split('.').pop().toLowerCase()
}

// Full-screen in-app viewer for a receipt/requirement file, so staff never
// have to leave the app in a new tab just to look at what a student uploaded.
function DocumentPreviewModal({ url, fileName, onClose }) {
    if (!url) return null

    const extension = getExtension(fileName || url)
    const isImage = IMAGE_EXTENSIONS.includes(extension)
    const isPdf = extension === 'pdf'

    return (
        <div className="doc-preview-backdrop" onClick={onClose}>
            <div className="doc-preview-card" onClick={(e) => e.stopPropagation()}>
                <div className="doc-preview-header">
                    <span className="doc-preview-title">{fileName || 'Document'}</span>
                    <button className="doc-preview-close" onClick={onClose} aria-label="Close">
                        ✕
                    </button>
                </div>

                <div className="doc-preview-body">
                    {isImage ? (
                        <img src={url} alt={fileName || 'Document preview'} />
                    ) : isPdf ? (
                        <iframe src={url} title={fileName || 'Document preview'} />
                    ) : (
                        <div className="doc-preview-unsupported">
                            <p>This file type can't be previewed here.</p>
                            <a href={url} target="_blank" rel="noopener noreferrer" className="doc-preview-fallback-link">
                                Open file →
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default DocumentPreviewModal
