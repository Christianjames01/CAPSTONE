// Time labels for the Messenger-style Messages pages (components/ChatApp.jsx).

const sameDay = (a, b) => a.toDateString() === b.toDateString()

// List time: "3:41 PM" today, "Mon" this week, "Sep 27" before that.
export function chatListTime(value) {
    if (!value) return ''
    const d = new Date(value)
    const now = new Date()
    if (sameDay(d, now)) return d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
    if (now - d < 6 * 24 * 60 * 60 * 1000) return d.toLocaleDateString('en-PH', { weekday: 'short' })
    return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) })
}

// Divider between message groups: "Today 3:41 PM", "Yesterday 9:02 AM", "Sep 27, 3:41 PM".
export function dividerLabel(value) {
    const d = new Date(value)
    const now = new Date()
    const time = d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
    if (sameDay(d, now)) return `Today ${time}`
    const yesterday = new Date(now)
    yesterday.setDate(now.getDate() - 1)
    if (sameDay(d, yesterday)) return `Yesterday ${time}`
    return `${d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) })}, ${time}`
}

export function chatBubbleTime(value) {
    return new Date(value).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
}
