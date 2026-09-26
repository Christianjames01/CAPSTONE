import { useState } from 'react'
import DocumentPreviewModal from './DocumentPreviewModal'
import { IconFile } from './UiIcons'
import './DocumentThumb.css'

// Thumbnail of a document type's sample image (uploaded by the head in
// Documents), shown on request lists and pages. Clicking it opens the image
// full size. Without an image it shows a document icon.
function DocumentThumb({ url, name, size = 44 }) {
    const [open, setOpen] = useState(false)
    const style = { width: size, height: size }

    if (!url) {
        return (
            <span className="doc-thumb is-empty" style={style} aria-hidden="true">
                <IconFile />
            </span>
        )
    }

    return (
        <>
            <button
                type="button"
                className="doc-thumb"
                style={style}
                onClick={(e) => { e.stopPropagation(); setOpen(true) }}
                aria-label={`View sample of ${name || 'this document'}`}
                title="View sample image"
            >
                <img src={url} alt="" loading="lazy" />
            </button>

            <DocumentPreviewModal
                url={open ? url : null}
                fileName={`${name || 'Document'} — sample`}
                onClose={() => setOpen(false)}
            />
        </>
    )
}

export default DocumentThumb
