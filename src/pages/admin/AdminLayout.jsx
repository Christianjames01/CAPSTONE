import { Suspense, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import certichainLogo from '../../assets/certichain-logo.png'
import { IconHome, IconCalendar, IconReceipt, IconBell, IconUserCircle, IconLogout, IconMenu, IconX, IconBook } from '../student/icons'
import { IconClipboardList, IconUsers, IconMessage, IconHistory, IconShieldCheck } from '../employee/icons'
import { IconSwap, IconIdCard, IconDocument, IconBuilding, IconBarChart, IconMegaphone, IconTicket } from './icons'
import ThemeToggle from '../../components/ThemeToggle'
import './AdminLayout.css'
import { useLiveRefresh } from '../../lib/useLiveRefresh'
import PageLoading from '../../components/PageLoading'
import { adminPath } from '../../lib/portalPaths'

const ChevronDown = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m6 9 6 6 6-6" />
    </svg>
)

// Hidden from the superadmin's view of the head portal -- not relevant for
// account oversight (walk-in queue, announcements) or not meaningful for an
// account that isn't the one signed in as head (its own profile, the guide).
const HIDDEN_FOR_SUPERADMIN = ['/announcements', '/queue', '/guide', '/profile']

// Expandable sub-links under a nav item -- deep links into that page's own
// status filter (it already reads ?status= from the URL), so clicking one
// both navigates and pre-filters the list.
const REQUEST_STATUS_CHILDREN = [
    { to: '/requests?status=pending,payment_pending', label: 'Pending' },
    { to: '/requests?status=receipt_uploaded,receipt_verified', label: 'In Verification' },
    { to: '/requests?status=processing,lacking_requirements', label: 'Processing' },
    { to: '/requests?status=ready_for_claiming', label: 'Ready for Claiming' },
    { to: '/requests?status=completed', label: 'Completed' },
    { to: '/requests?status=rejected', label: 'Rejected' },
    { to: '/requests?status=cancelled', label: 'Cancelled' },
]

const CLAIM_SCHEDULE_CHILDREN = [
    { to: '/claim-schedules?status=upcoming', label: 'Upcoming' },
    { to: '/claim-schedules?status=today', label: 'Today' },
    { to: '/claim-schedules?status=missed', label: 'Missed' },
    { to: '/claim-schedules?status=reschedule', label: 'Reschedule Requests' },
    { to: '/claim-schedules?status=claimed', label: 'Claimed' },
    { to: '/claim-schedules?status=cancelled', label: 'Cancelled' },
]

const NAV_ITEMS = [
    { to: '/dashboard', label: 'Dashboard', icon: <IconHome />, end: true },
    { to: '/requests', label: 'All Requests', icon: <IconClipboardList />, children: REQUEST_STATUS_CHILDREN },
    { to: '/assignments', label: 'Request Assignments', icon: <IconSwap /> },
    { to: '/employees', label: 'Employees', icon: <IconUsers /> },
    { to: '/students', label: 'Students', icon: <IconIdCard />, badgeKey: 'pendingStudents' },
    { to: '/documents', label: 'Documents', icon: <IconDocument /> },
    { to: '/announcements', label: 'Announcements', icon: <IconMegaphone /> },
    { to: '/colleges-programs', label: 'Academic Divisions & Programs', icon: <IconBuilding /> },
    { to: '/claim-schedules', label: 'Claim Schedules', icon: <IconCalendar />, badgeKey: 'unclaimed', children: CLAIM_SCHEDULE_CHILDREN },
    { to: '/office-calendar', label: 'Office Calendar', icon: <IconCalendar /> },
    { to: '/queue', label: 'Walk-in Queue', icon: <IconTicket /> },
    { to: '/receipts', label: 'Official Receipts', icon: <IconReceipt />, badgeKey: 'uploadedReceipts' },
    { to: '/credentials', label: 'Credentials', icon: <IconShieldCheck /> },
    { to: '/messages', label: 'Messages', icon: <IconMessage />, badgeKey: 'messages' },
    { to: '/notifications', label: 'Notifications', icon: <IconBell />, badgeKey: 'notifications' },
    { to: '/activity-logs', label: 'Activity Logs', icon: <IconHistory /> },
    { to: '/reports', label: 'Reports', icon: <IconBarChart /> },
    { to: '/guide', label: 'User Guide', icon: <IconBook /> },
    { to: '/profile', label: 'Profile', icon: <IconUserCircle /> },
]

function AdminLayout() {
    const navigate = useNavigate()
    const location = useLocation()
    // Which nav items with sub-links are expanded, keyed by `to`. Starts
    // open for whichever section the user is already on.
    const [expandedNav, setExpandedNav] = useState(() =>
        new Set(NAV_ITEMS.filter((item) => item.children && location.pathname.endsWith(item.to)).map((item) => item.to))
    )
    const toggleNav = (to) => {
        setExpandedNav((prev) => {
            const next = new Set(prev)
            if (next.has(to)) next.delete(to)
            else next.add(to)
            return next
        })
    }
    const [name, setName] = useState('')
    const [initials, setInitials] = useState('')
    const [roleLabel, setRoleLabel] = useState('')
    const [role, setRole] = useState('')
    const [unreadNotifications, setUnreadNotifications] = useState(0)
    const [unreadMessages, setUnreadMessages] = useState(0)
    const [pendingStudents, setPendingStudents] = useState(0)
    const [unclaimed, setUnclaimed] = useState(0)
    const [uploadedReceipts, setUploadedReceipts] = useState(0)
    const [mobileNavOpen, setMobileNavOpen] = useState(false)
    const [loggingOut, setLoggingOut] = useState(false)

    useLiveRefresh(
        ['notifications', 'messages', 'students', 'document_requests', 'claim_schedules', 'official_receipts'],
        () => loadBadgeCounts()
    )

    useEffect(() => {
        document.body.style.overflow = mobileNavOpen ? 'hidden' : ''
        return () => { document.body.style.overflow = '' }
    }, [mobileNavOpen])

    useEffect(() => {
        loadProfile()
        loadBadgeCounts()

        window.addEventListener('notifications-updated', loadBadgeCounts)
        window.addEventListener('messages-updated', loadBadgeCounts)
        return () => {
            window.removeEventListener('notifications-updated', loadBadgeCounts)
            window.removeEventListener('messages-updated', loadBadgeCounts)
        }
    }, [])

    async function loadProfile() {
        const {
            data: { user }
        } = await supabase.auth.getUser()

        if (!user) return

        const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name, role')
            .eq('user_id', user.id)
            .single()

        if (profile) {
            setName(`${profile.first_name} ${profile.last_name}`.trim())
            setInitials(
                `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}`.toUpperCase()
            )
            setRole(profile.role)
            setRoleLabel(
                profile.role === 'admin' ? 'System Admin'
                    : profile.role === 'superadmin' ? 'Superadmin (view only)'
                        : 'Registrar Head'
            )
        }
    }

    async function loadBadgeCounts() {
        const {
            data: { user }
        } = await supabase.auth.getUser()

        if (!user) return

        const { count: notificationCount } = await supabase
            .from('notifications')
            .select('notification_id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('is_read', false)

        setUnreadNotifications(notificationCount || 0)

        const { count: messageCount } = await supabase
            .from('messages')
            .select('message_id', { count: 'exact', head: true })
            .eq('receiver_user_id', user.id)
            .eq('is_read', false)

        setUnreadMessages(messageCount || 0)

        const { count: pendingCount } = await supabase
            .from('students')
            .select('student_id', { count: 'exact', head: true })
            .eq('verification_status', 'pending')

        setPendingStudents(pendingCount || 0)

        // Same "unclaimed" definition as ClaimSchedules.jsx's own count:
        // ready-for-claiming requests that don't already have a non-
        // cancelled claim schedule.
        const { data: readyRequests } = await supabase
            .from('document_requests')
            .select('request_id')
            .eq('status', 'ready_for_claiming')

        const readyIds = (readyRequests || []).map((r) => r.request_id)

        if (readyIds.length > 0) {
            const { data: scheduled } = await supabase
                .from('claim_schedules')
                .select('request_id')
                .in('request_id', readyIds)
                .neq('status', 'cancelled')

            const scheduledIds = new Set((scheduled || []).map((s) => s.request_id))
            setUnclaimed(readyIds.filter((id) => !scheduledIds.has(id)).length)
        } else {
            setUnclaimed(0)
        }

        // Same default filter as OfficialReceipts.jsx: receipts waiting to
        // be verified.
        const { count: uploadedCount } = await supabase
            .from('official_receipts')
            .select('receipt_id', { count: 'exact', head: true })
            .eq('status', 'uploaded')

        setUploadedReceipts(uploadedCount || 0)
    }

    const handleLogout = async () => {
        setLoggingOut(true)
        await supabase.auth.signOut()
        navigate('/', { replace: true })
    }

    const badgeValue = (key) => {
        if (key === 'notifications') return unreadNotifications
        if (key === 'messages') return unreadMessages
        if (key === 'pendingStudents') return pendingStudents
        if (key === 'unclaimed') return unclaimed
        if (key === 'uploadedReceipts') return uploadedReceipts
        return 0
    }

    const closeMobileNav = () => setMobileNavOpen(false)

    return (
        <div className="admin-layout">

            <ThemeToggle />

            <header className="admin-mobile-topbar">
                <button
                    className="admin-mobile-menu-button"
                    onClick={() => setMobileNavOpen(true)}
                    aria-label="Open menu"
                >
                    <IconMenu />
                </button>

                <Link to={adminPath('/dashboard')} className="admin-mobile-brand">
                    <img src={certichainLogo} alt="" />
                    <span>CertiChain</span>
                </Link>
            </header>

            {mobileNavOpen && (
                <div className="admin-nav-backdrop" onClick={closeMobileNav} />
            )}

            <aside className={`admin-sidebar${mobileNavOpen ? ' open' : ''}`}>

                <div className="admin-sidebar-top">
                    <div className="admin-sidebar-brand-row">
                        <Link to={adminPath('/dashboard')} className="admin-sidebar-brand" onClick={closeMobileNav}>
                            <div className="admin-sidebar-seal">
                                <img src={certichainLogo} alt="Holy Cross of Davao College" />
                            </div>
                            <div>
                                <div className="admin-sidebar-name">CertiChain</div>
                                <div className="admin-sidebar-subtitle">Registrar Head Portal</div>
                            </div>
                        </Link>

                        <button
                            className="admin-mobile-close-button"
                            onClick={closeMobileNav}
                            aria-label="Close menu"
                        >
                            <IconX />
                        </button>
                    </div>

                    <nav className="admin-nav">
                        {NAV_ITEMS.filter((item) => role !== 'superadmin' || !HIDDEN_FOR_SUPERADMIN.includes(item.to)).map((item) => {
                            const count = item.badgeKey ? badgeValue(item.badgeKey) : 0
                            const isOpen = item.children && expandedNav.has(item.to)

                            return (
                                <div key={item.to}>
                                    <NavLink
                                        to={adminPath(item.to)}
                                        end={item.end}
                                        onClick={() => {
                                            closeMobileNav()
                                            if (item.children) toggleNav(item.to)
                                        }}
                                        className={({ isActive }) =>
                                            `admin-nav-link${isActive ? ' active' : ''}`
                                        }
                                    >
                                        {item.icon}
                                        <span>{item.label}</span>
                                        {count > 0 && (
                                            <span className="admin-nav-badge">
                                                {count > 9 ? '9+' : count}
                                            </span>
                                        )}
                                        {item.children && (
                                            <span className={`admin-nav-chevron${isOpen ? ' is-open' : ''}`}>
                                                <ChevronDown />
                                            </span>
                                        )}
                                    </NavLink>

                                    {item.children && isOpen && (
                                        <div className="admin-nav-children">
                                            {item.children.map((child) => {
                                                const [childPath, childStatus] = child.to.split('?status=')
                                                const isChildActive = location.pathname.endsWith(childPath)
                                                    && new URLSearchParams(location.search).get('status') === childStatus

                                                return (
                                                    <NavLink
                                                        key={child.to}
                                                        to={adminPath(child.to)}
                                                        onClick={closeMobileNav}
                                                        className={`admin-nav-child-link${isChildActive ? ' active' : ''}`}
                                                    >
                                                        <span className="admin-nav-child-dot" aria-hidden="true" />
                                                        <span>{child.label}</span>
                                                    </NavLink>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </nav>
                </div>

                <div className="admin-sidebar-bottom">
                    <div className="admin-user">
                        <div className="admin-user-avatar">{initials || 'RH'}</div>
                        <div>
                            <div className="admin-user-name">{name || 'Registrar Head'}</div>
                            <div className="admin-user-role">{roleLabel || 'Registrar Head'}</div>
                        </div>
                    </div>

                    <button className="admin-logout-button" onClick={handleLogout} disabled={loggingOut}>
                        {loggingOut ? <span className="icon-spinner" /> : <IconLogout />}
                        <span>{loggingOut ? 'Logging out...' : 'Log out'}</span>
                    </button>
                </div>

            </aside>

            <main className="admin-content">
                {role === 'superadmin' && (
                    <div className="admin-readonly-banner" role="status">
                        <span>
                            You're viewing the registrar head's portal as superadmin. Nothing here can be
                            changed from this account — edits, approvals, and deletions are blocked.
                        </span>
                        <Link to="/superadmin" className="admin-readonly-banner-link">← Back to Dashboard</Link>
                    </div>
                )}
                <Suspense fallback={<PageLoading inline />}><Outlet context={{ role }} /></Suspense>
            </main>

        </div>
    )
}

export default AdminLayout
