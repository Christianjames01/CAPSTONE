import { useEffect, useId } from 'react'
import { useScrollLock } from '../lib/useScrollLock'
import { IconX } from './UiIcons'
import './Modal.css'

// Shared dialog for forms and confirmations across all portals.
// title: heading; subtitle (optional): one line under it; icon (optional):
// a line-icon component shown in a tile beside the title. Esc closes it
// (calls onClose, which may ignore the request while saving).
function Modal({ title, subtitle, icon: Icon, onClose, children, maxWidth, closeOnBackdropClick = false }) {
    useScrollLock()
    const titleId = useId()

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [onClose])

    return (
        <div className="app-modal-backdrop" onClick={closeOnBackdropClick ? onClose : undefined}>
            <div
                className="app-modal-card"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                style={maxWidth ? { maxWidth } : undefined}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="app-modal-header">
                    {Icon && (
                        <span className="app-modal-icon" aria-hidden="true"><Icon /></span>
                    )}
                    <div className="app-modal-heading">
                        <span className="app-modal-title" id={titleId}>{title}</span>
                        {subtitle && <span className="app-modal-subtitle">{subtitle}</span>}
                    </div>
                    <button type="button" className="app-modal-close" onClick={onClose} aria-label="Close">
                        <IconX />
                    </button>
                </div>

                <div className="app-modal-body">
                    {children}
                </div>
            </div>
        </div>
    )
}

export default Modal
