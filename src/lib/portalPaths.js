// The registrar head and the system admin share the same portal pages, but
// each has its own URL: /head/* for the head, /admin/* for the admin. Pages
// build their links with adminPath(), so the link stays in whichever portal
// the visitor is in. Read at call time (not module load) so a shared
// session that switches roles still gets the right prefix.
export function adminPath(path = '') {
    const inHeadPortal = typeof window !== 'undefined' && window.location.pathname.startsWith('/head')
    return `${inHeadPortal ? '/head' : '/admin'}${path}`
}
