import { REPRESENTATIVE_STATUS } from '../lib/claimRepresentatives'
import './Representative.css'

// Release-window hint: who else may claim this request's document.
function RepresentativeBadge({ representative }) {
    if (!representative) return null
    const status = REPRESENTATIVE_STATUS[representative.status] || REPRESENTATIVE_STATUS.pending

    return (
        <span className={`rep-badge is-${status.tone}`}>
            Representative: {representative.full_name} ({representative.relationship}) · {status.label}
        </span>
    )
}

export default RepresentativeBadge
