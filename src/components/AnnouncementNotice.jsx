import { sanitizeAnnouncementHtml } from '../lib/sanitizeHtml'
import { announcementTone, formatAnnouncementDate } from '../lib/announcements'
import AnnouncementToneIcon from './AnnouncementToneIcon'
import './AnnouncementNotice.css'

const TONE_LABEL = {
    closed: 'Office closed',
    open: 'Office open',
    general: 'Announcement',
}

// The student-facing announcement banner. Also rendered inside the admin
// editor as a live preview, so what admins see there is exactly what
// students get on their dashboard.
function AnnouncementNotice({ announcement, titleFallback, messageFallback }) {
    const tone = announcementTone(announcement)
    const titleHtml = sanitizeAnnouncementHtml(announcement.title) || titleFallback || ''
    const messageHtml = sanitizeAnnouncementHtml(announcement.message) || messageFallback || ''

    return (
        <article className={`announcement-notice tone-${tone}`}>
            <span className="announcement-notice-icon" aria-hidden="true"><AnnouncementToneIcon tone={tone} /></span>

            <div className="announcement-notice-body">
                <div className="announcement-notice-meta">
                    <span className="announcement-notice-badge">{TONE_LABEL[tone]}</span>
                    {announcement.announcement_date && (
                        <time dateTime={announcement.announcement_date}>
                            {formatAnnouncementDate(announcement.announcement_date)}
                        </time>
                    )}
                </div>

                <h3 className="announcement-notice-title" dangerouslySetInnerHTML={{ __html: titleHtml }} />
                <div className="announcement-notice-message" dangerouslySetInnerHTML={{ __html: messageHtml }} />
            </div>
        </article>
    )
}

export default AnnouncementNotice
