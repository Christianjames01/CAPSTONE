import { notifyError } from './notify'

// Call at the top of a head-portal write handler (one line: `if
// (blockedForReadOnlyViewer(role)) return`). The real block is server-side --
// RLS has no write policy for the superadmin role, so the request would fail
// there regardless -- this just stops it before a raw database error shows,
// and tells the viewer why in a sentence that makes sense to them.
export function blockedForReadOnlyViewer(role) {
    if (role !== 'superadmin') return false
    notifyError("Superadmin accounts can't make changes here. This portal is read-only for this account.")
    return true
}
