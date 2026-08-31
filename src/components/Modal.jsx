import './Modal.css'

// Generic centered modal -- backdrop click and the × button both close it.
function Modal({ title, onClose, children }) {
    return (
        <div className="app-modal-backdrop" onClick={onClose}>
            <div className="app-modal-card" onClick={(e) => e.stopPropagation()}>
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
