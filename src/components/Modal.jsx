import { useScrollLock } from '../lib/useScrollLock'
import './Modal.css'

function Modal({ title, onClose, children, maxWidth, closeOnBackdropClick = false }) {
    useScrollLock()

    return (
        <div className="app-modal-backdrop" onClick={closeOnBackdropClick ? onClose : undefined}>
            <div className="app-modal-card" style={maxWidth ? { maxWidth } : undefined} onClick={(e) => e.stopPropagation()}>
                <div className="app-modal-header">
                    <span className="app-modal-title">{title}</span>
                    <button className="app-modal-close" onClick={onClose} aria-label="Close">
                        ✕
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
