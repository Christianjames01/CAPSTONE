import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useIdleLogout } from '../../lib/useIdleLogout'
import hcdcLogo from '../../assets/hcdc-logo.png'
import { IconHome, IconCalendar, IconReceipt, IconBell, IconUserCircle, IconGraduationCap, IconLogout, IconMenu, IconX } from '../student/icons'
import { IconClipboardList, IconUsers, IconMessage, IconHistory } from '../employee/icons'
import { IconSwap, IconIdCard, IconDocument, IconBuilding, IconBarChart } from './icons'
import ThemeToggle from '../../components/ThemeToggle'
import './AdminLayout.css'

const NAV_ITEMS = [
    { to: '/admin/dashboard', label: 'Dashboard', icon: <IconHome />, end: true },
    { to: '/admin/requests', label: 'All Requests', icon: <IconClipboardList /> },
    { to: '/admin/assignments', label: 'Request Assignments', icon: <IconSwap /> },
    { to: '/admin/employees', label: 'Employees', icon: <IconUsers /> },
    { to: '/admin/students', label: 'Students', icon: <IconIdCard /> },
    { to: '/admin/documents', label: 'Documents', icon: <IconDocument /> },
    { to: '/admin/grades', label: 'Grades', icon: <IconGraduationCap /> },
    { to: '/admin/colleges-programs', label: 'Colleges & Programs', icon: <IconBuilding /> },
    { to: '/admin/claim-schedules', label: 'Claim Schedules', icon: <IconCalendar /> },
    { to: '/admin/receipts', label: 'Official Receipts', icon: <IconReceipt /> },
    { to: '/admin/messages', label: 'Messages', icon: <IconMessage />, badgeKey: 'messages' },
    { to: '/admin/notifications', label: 'Notifications', icon: <IconBell />, badgeKey: 'notifications' },
    { to: '/admin/activity-logs', label: 'Activity Logs', icon: <IconHistory /> },
    { to: '/admin/reports', label: 'Reports', icon: <IconBarChart /> },
    { to: '/admin/profile', label: 'Profile', icon: <IconUserCircle /> },
]

function AdminLayout() {
    const navigate = useNavigate()
    useIdleLogout()
    const [name, setName] = useState('')
    const [initials, setInitials] = useState('')
    const [roleLabel, setRoleLabel] = useState('')
    const [unreadNotifications, setUnreadNotifications] = useState(0)
    const [unreadMessages, setUnreadMessages] = useState(0)
    const [mobileNavOpen, setMobileNavOpen] = useState(false)
    const [loggingOut, setLoggingOut] = useState(false)

    useEffect(() => {
        document.body.style.overflow = mobileNavOpen ? 'hidden' : ''
        return () => { document.body.style.overflow = '' }
    }, [mobileNavOpen])

    useEffect(() => {
        loadProfile()
        loadBadgeCounts()

        window.addEventListener('notifications-updated', loadBadgeCounts)
        return () => window.removeEventListener('notifications-updated', loadBadgeCounts)
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
            setRoleLabel(profile.role === 'admin' ? 'System Admin' : 'Registrar Head')
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
    }

    const handleLogout = async () => {
        setLoggingOut(true)
        await supabase.auth.signOut()
        navigate('/login')
    }

    const badgeValue = (key) => {
        if (key === 'notifications') return unreadNotifications
        if (key === 'messages') return unreadMessages
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

                <Link to="/admin/dashboard" className="admin-mobile-brand">
                    <img src={hcdcLogo} alt="" />
                    <span>CertiChain</span>
                </Link>
            </header>

            {mobileNavOpen && (
                <div className="admin-nav-backdrop" onClick={closeMobileNav} />
            )}

            <aside className={`admin-sidebar${mobileNavOpen ? ' open' : ''}`}>

                <div className="admin-sidebar-top">
                    <div className="admin-sidebar-brand-row">
                        <Link to="/admin/dashboard" className="admin-sidebar-brand" onClick={closeMobileNav}>
                            <div className="admin-sidebar-seal">
                                <img src={hcdcLogo} alt="Holy Cross of Davao College" />
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
                        {NAV_ITEMS.map((item) => {
                            const count = item.badgeKey ? badgeValue(item.badgeKey) : 0

                            return (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    end={item.end}
                                    onClick={closeMobileNav}
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
                                </NavLink>
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
                <Outlet />
            </main>

        </div>
    )
}

export default AdminLayout
