import { useState } from 'react'
import './DocumentPreviewModal.css'

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif']
const MIN_ZOOM = 0.5
const MAX_ZOOM = 3
const ZOOM_STEP = 0.25

function getExtension(nameOrUrl) {
    if (!nameOrUrl) return ''
    const clean = nameOrUrl.split('?')[0]
    return clean.split('.').pop().toLowerCase()
}

function DocumentPreviewModal({ url, fileName, onClose }) {
    const [zoom, setZoom] = useState(1)

    if (!url) return null

    // Detect file type from the actual resource URL first -- `fileName` is
    // sometimes just a friendly display label (e.g. "Certificate — sample")
    // with no real extension on it, which would otherwise wrongly fall
    // through to "can't be previewed" even though the file itself is a
    // perfectly viewable image.
    const extension = getExtension(url) || getExtension(fileName)
    const isImage = IMAGE_EXTENSIONS.includes(extension)
    const isPdf = extension === 'pdf'

    // PDFs render through the browser's own <iframe> viewer, which already
    // has its own zoom controls -- this bar is only meaningful for the
    // plain <img> case.
    const zoomIn = () => setZoom((z) => Math.min(MAX_ZOOM, Math.round((z + ZOOM_STEP) * 100) / 100))
    const zoomOut = () => setZoom((z) => Math.max(MIN_ZOOM, Math.round((z - ZOOM_STEP) * 100) / 100))
    const resetZoom = () => setZoom(1)

    return (
        <div className="doc-preview-backdrop" onClick={onClose}>
            <div className="doc-preview-card" onClick={(e) => e.stopPropagation()}>
                <div className="doc-preview-header">
                    <span className="doc-preview-title">{fileName || 'Document'}</span>

                    {isImage && (
                        <div className="doc-preview-zoom-controls">
                            <button
                                type="button"
                                className="doc-preview-zoom-button"
                                onClick={zoomOut}
                                disabled={zoom <= MIN_ZOOM}
                                aria-label="Zoom out"
                            >
                                −
                            </button>
                            <button
                                type="button"
                                className="doc-preview-zoom-label"
                                onClick={resetZoom}
                                title="Reset zoom"
                            >
                                {Math.round(zoom * 100)}%
                            </button>
                            <button
                                type="button"
                                className="doc-preview-zoom-button"
                                onClick={zoomIn}
                                disabled={zoom >= MAX_ZOOM}
                                aria-label="Zoom in"
                            >
                                +
                            </button>
                        </div>
                    )}

                    <button className="doc-preview-close" onClick={onClose} aria-label="Close">
                        ✕
                    </button>
                </div>

                <div className="doc-preview-body">
                    {isImage ? (
                        <img
                            src={url}
                            alt={fileName || 'Document preview'}
                            style={{ transform: `scale(${zoom})`, cursor: zoom > 1 ? 'move' : 'default' }}
                        />
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
