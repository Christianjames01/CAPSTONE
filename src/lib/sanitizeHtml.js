import DOMPurify from 'dompurify'

// Announcements are authored as simple formatted text (bold/italic/underline/
// size/color) by a trusted registrar-head/admin account, but the HTML they
// produce is still rendered to every student, so it's sanitized both before
// it's saved and again right before it's rendered -- a narrow allowlist of
// purely cosmetic tags/attributes, nothing that can load external content,
// run script, or navigate the page.
const ALLOWED_TAGS = ['b', 'strong', 'i', 'em', 'u', 'span', 'font', 'p', 'div', 'br', 'ul', 'ol', 'li']
const ALLOWED_ATTR = ['style', 'color', 'size', 'face']

export function sanitizeAnnouncementHtml(html) {
    return DOMPurify.sanitize(html || '', { ALLOWED_TAGS, ALLOWED_ATTR })
}
