import { useEffect, useRef, useState } from 'react'
import { useScrollLock } from '../lib/useScrollLock'
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
    // Pages keep this component mounted and pass url=null when it is closed,
    // so the page is only locked while a document is actually open.
    useScrollLock(Boolean(url))

    const [zoom, setZoom] = useState(1)
    // Pan is a self-tracked translate offset rather than the container's
    // native scrollLeft/scrollTop. A `transform: scale()`'d image doesn't
    // reliably grow the browser's scrollable overflow region in every
    // direction (Chrome/Firefox both under-report it for the "start" side
    // once content is centered), so relying on native scroll left parts of
    // a zoomed image -- notably the top-left -- permanently unreachable.
    // Driving the offset ourselves sidesteps that entirely.
    const [pan, setPan] = useState({ x: 0, y: 0 })
    const [isDragging, setIsDragging] = useState(false)
    const draggingRef = useRef(false)
    const lastPointRef = useRef({ x: 0, y: 0 })

    // A fresh document shouldn't open still panned/zoomed from whatever the
    // previous preview was left at.
    useEffect(() => {
        setZoom(1)
        setPan({ x: 0, y: 0 })
    }, [url])

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
    // has its own zoom controls -- all of this is only meaningful for the
    // plain <img> case.
    const zoomIn = () => setZoom((z) => Math.min(MAX_ZOOM, Math.round((z + ZOOM_STEP) * 100) / 100))
    const zoomOut = () => setZoom((z) => {
        const next = Math.max(MIN_ZOOM, Math.round((z - ZOOM_STEP) * 100) / 100)
        if (next <= 1) setPan({ x: 0, y: 0 })
        return next
    })
    const resetZoom = () => {
        setZoom(1)
        setPan({ x: 0, y: 0 })
    }

    // Scrolling over the image zooms instead of scrolling the page -- this
    // is a dedicated preview surface, not a document to read top-to-bottom.
    const handleWheel = (e) => {
        if (!isImage) return
        e.preventDefault()
        if (e.deltaY < 0) zoomIn()
        else zoomOut()
    }

    // Click-and-drag pans the image -- there's nothing to drag once back
    // at 100%, so this is a no-op below that.
    const handleMouseDown = (e) => {
        if (zoom <= 1) return
        draggingRef.current = true
        setIsDragging(true)
        lastPointRef.current = { x: e.clientX, y: e.clientY }
    }

    const handleMouseMove = (e) => {
        if (!draggingRef.current) return
        const dx = e.clientX - lastPointRef.current.x
        const dy = e.clientY - lastPointRef.current.y
        setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }))
        lastPointRef.current = { x: e.clientX, y: e.clientY }
    }

    const stopDragging = () => {
        draggingRef.current = false
        setIsDragging(false)
    }

    return (
        <div className="doc-preview-backdrop">
            <div className="doc-preview-card">
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

                <div
                    className="doc-preview-body"
                    onWheel={handleWheel}
                    onMouseMove={handleMouseMove}
                    onMouseUp={stopDragging}
                    onMouseLeave={stopDragging}
                >
                    {isImage ? (
                        <img
                            src={url}
                            alt={fileName || 'Document preview'}
                            draggable={false}
                            onMouseDown={handleMouseDown}
                            style={{
                                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                                cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
                            }}
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
