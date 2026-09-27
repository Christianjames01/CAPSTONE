// Contents of a round avatar: the person's uploaded profile photo, or
// their initials when they haven't uploaded one (or it fails to load).
import { useState } from 'react'

const initialsOf = (name) =>
    (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || '?'

export default function AvatarFace({ photo, name }) {
    const [failed, setFailed] = useState(false)

    if (photo && !failed) {
        return <img className="avatar-face-photo" src={photo} alt="" loading="lazy" onError={() => setFailed(true)} />
    }

    return initialsOf(name)
}
