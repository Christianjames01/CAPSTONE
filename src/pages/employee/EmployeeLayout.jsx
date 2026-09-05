import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useIdleLogout } from '../../lib/useIdleLogout'
import hcdcLogo from '../../assets/hcdc-logo.png'
import { IconHome, IconCalendar, IconBell, IconUserCircle, IconLogout, IconMenu, IconX } from '../student/icons'
import { IconClipboardList, IconShieldCheck, IconGear, IconUsers, IconMessage, IconHistory } from './icons'
import ThemeToggle from '../../components/ThemeToggle'
import './EmployeeLayout.css'

const NAV_ITEMS = [
    { to: '/employee/dashboard', label: 'Dashboard', icon: <IconHome />, end: true },
    { to: '/employee/requests', label: 'Assigned Requests', icon: <IconClipboardList /> },
    { to: '/employee/verification', label: 'Request Verification', icon: <IconShieldCheck /> },
    { to: '/employee/processing', label: 'Document Processing', icon: <IconGear /> },
    { to: '/employee/claim-schedule', label: 'Claim Schedule', icon: <IconCalendar /> },
    { to: '/employee/students', label: 'Students', icon: <IconUsers /> },
    { to: '/employee/messages', label: 'Messages', icon: <IconMessage />, badgeKey: 'messages' },
    { to: '/employee/notifications', label: 'Notifications', icon: <IconBell />, badgeKey: 'notifications' },
    { to: '/employee/activity-logs', label: 'Activity Logs', icon: <IconHistory /> },
    { to: '/employee/profile', label: 'Profile', icon: <IconUserCircle /> },
]

function EmployeeLayout() {
    const navigate = useNavigate()
    useIdleLogout()
    const [name, setName] = useState('')
    const [initials, setInitials] = useState('')
    const [positionTitle, setPositionTitle] = useState('')
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
            .select('first_name, last_name')
            .eq('user_id', user.id)
            .single()

        if (profile) {
            setName(`${profile.first_name} ${profile.last_name}`.trim())
            setInitials(
                `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}`.toUpperCase()
            )
        }

        const { data: employee } = await supabase
            .from('employees')
            .select('position_title')
            .eq('user_id', user.id)
            .single()

        if (employee) {
            setPositionTitle(employee.position_title || '')
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
        <div className="employee-layout">

            <ThemeToggle />

            <header className="employee-mobile-topbar">
                <button
                    className="employee-mobile-menu-button"
                    onClick={() => setMobileNavOpen(true)}
                    aria-label="Open menu"
                >
                    <IconMenu />
                </button>

                <Link to="/employee/dashboard" className="employee-mobile-brand">
                    <img src={hcdcLogo} alt="" />
                    <span>CertiChain</span>
                </Link>
            </header>

            {mobileNavOpen && (
                <div className="employee-nav-backdrop" onClick={closeMobileNav} />
            )}

            <aside className={`employee-sidebar${mobileNavOpen ? ' open' : ''}`}>

                <div className="employee-sidebar-top">
                    <div className="employee-sidebar-brand-row">
                        <Link to="/employee/dashboard" className="employee-sidebar-brand" onClick={closeMobileNav}>
                            <div className="employee-sidebar-seal">
                                <img src={hcdcLogo} alt="Holy Cross of Davao College" />
                            </div>
                            <div>
                                <div className="employee-sidebar-name">CertiChain</div>
                                <div className="employee-sidebar-subtitle">Registrar Employee Portal</div>
                            </div>
                        </Link>

                        <button
                            className="employee-mobile-close-button"
                            onClick={closeMobileNav}
                            aria-label="Close menu"
                        >
                            <IconX />
                        </button>
                    </div>

                    <nav className="employee-nav">
                        {NAV_ITEMS.map((item) => {
                            const count = item.badgeKey ? badgeValue(item.badgeKey) : 0

                            return (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    end={item.end}
                                    onClick={closeMobileNav}
                                    className={({ isActive }) =>
                                        `employee-nav-link${isActive ? ' active' : ''}`
                                    }
                                >
                                    {item.icon}
                                    <span>{item.label}</span>
                                    {count > 0 && (
                                        <span className="employee-nav-badge">
                                            {count > 9 ? '9+' : count}
                                        </span>
                                    )}
                                </NavLink>
                            )
                        })}
                    </nav>
                </div>

                <div className="employee-sidebar-bottom">
                    <div className="employee-user">
                        <div className="employee-user-avatar">{initials || 'EM'}</div>
                        <div>
                            <div className="employee-user-name">{name || 'Employee'}</div>
                            <div className="employee-user-role">{positionTitle || 'Registrar Staff'}</div>
                        </div>
                    </div>

                    <button className="employee-logout-button" onClick={handleLogout} disabled={loggingOut}>
                        {loggingOut ? <span className="icon-spinner" /> : <IconLogout />}
                        <span>{loggingOut ? 'Logging out...' : 'Log out'}</span>
                    </button>
                </div>

            </aside>

            <main className="employee-content">
                <Outlet />
            </main>

        </div>
    )
}

export default EmployeeLayout
