export const ROLE_NAMES = {
    student: 'Student',
    employee: 'Employee',
    registrar_head: 'Registrar Head',
    admin: 'System Admin',
    superadmin: 'Superadmin',
}

export const STAFF_ROLES = ['admin', 'registrar_head']

const MANILA = 'Asia/Manila'

export function formatWhen(value) {
    if (!value) return 'Never'
    return new Date(value).toLocaleString('en-PH', {
        timeZone: MANILA,
        dateStyle: 'medium',
        timeStyle: 'short',
    })
}

export function formatDay(value) {
    return new Date(`${value}T00:00:00+08:00`).toLocaleDateString('en-PH', {
        timeZone: MANILA,
        month: 'short',
        day: 'numeric',
    })
}

// "5 minutes ago", "3 hours ago", "12 days ago". Falls back to the date after a month.
export function timeAgo(value) {
    if (!value) return 'Never'
    const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000)
    if (seconds < 60) return 'Just now'
    const minutes = Math.round(seconds / 60)
    if (minutes < 60) return `${minutes} min ago`
    const hours = Math.round(minutes / 60)
    if (hours < 24) return `${hours} hr ago`
    const days = Math.round(hours / 24)
    if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
    return formatWhen(value)
}

export function daysSince(value) {
    if (!value) return Infinity
    return (Date.now() - new Date(value).getTime()) / 86400000
}

export function displayName(row) {
    return row.full_name?.trim() || row.email || 'Unnamed account'
}

// Downloads rows as a CSV file. Values are quoted so commas and quotes survive.
export function downloadCsv(filename, headers, rows) {
    const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`
    const body = [headers, ...rows].map((row) => row.map(escape).join(',')).join('\r\n')
    const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
}
