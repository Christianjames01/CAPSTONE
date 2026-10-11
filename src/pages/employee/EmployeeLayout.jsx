import { Suspense, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import certichainLogo from '../../assets/certichain-logo.png'
import { IconHome, IconCalendar, IconBell, IconUserCircle, IconLogout, IconMenu, IconX, IconBook } from '../student/icons'
import { IconClipboardList, IconShieldCheck, IconGear, IconMessage, IconHistory } from './icons'
// Same icons as the Registrar Head's sidebar for the same pages.
import { IconIdCard, IconTicket, IconUsers, IconDocument } from '../admin/icons'
import ThemeToggle from '../../components/ThemeToggle'
import '../../components/DashboardStats.css'
import '../../components/PortalUi.css'
import './EmployeeLayout.css'
import { useLiveRefresh } from '../../lib/useLiveRefresh'
import PageLoading from '../../components/PageLoading'

const ChevronDown = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m6 9 6 6 6-6" />
    </svg>
)

// Deep links into Assigned Requests' own status filter (it already reads
// ?status= from the URL), so clicking one both navigates and pre-filters.
const REQUEST_STATUS_CHILDREN = [
    { to: '/employee/requests?status=pending,payment_pending', label: 'Pending' },
    { to: '/employee/requests?status=receipt_uploaded,receipt_verified', label: 'In Verification' },
    { to: '/employee/requests?status=processing,lacking_requirements', label: 'Processing' },
    { to: '/employee/requests?status=ready_for_claiming', label: 'Ready for Claiming' },
    { to: '/employee/requests?status=completed', label: 'Completed' },
    { to: '/employee/requests?status=rejected', label: 'Rejected' },
    { to: '/employee/requests?status=cancelled', label: 'Cancelled' },
]

const NAV_ITEMS = [
    { to: '/employee/dashboard', label: 'Dashboard', icon: <IconHome />, end: true },
    { to: '/employee/requests', label: 'Assigned Requests', icon: <IconClipboardList />, children: REQUEST_STATUS_CHILDREN },
    { to: '/employee/verification', label: 'Request Verification', icon: <IconShieldCheck />, fullAccessOnly: true },
    { to: '/employee/processing', label: 'Document Processing', icon: <IconGear />, fullAccessOnly: true },
    { to: '/employee/claim-schedule', label: 'Claim Schedule', icon: <IconCalendar /> },
    { to: '/employee/office-calendar', label: 'Office Calendar', icon: <IconCalendar /> },
    { to: '/employee/queue', label: 'Walk-in Queue', icon: <IconTicket />, fullAccessOnly: true },
    { to: '/employee/students', label: 'Students', icon: <IconIdCard />, fullAccessOnly: true, badgeKey: 'pendingStudents' },
    { to: '/employee/messages', label: 'Messages', icon: <IconMessage />, badgeKey: 'messages', fullAccessOnly: true },
    { to: '/employee/notifications', label: 'Notifications', icon: <IconBell />, badgeKey: 'notifications' },
    { to: '/employee/activity-logs', label: 'Activity Logs', icon: <IconHistory />, fullAccessOnly: true },
    { to: '/employee/documents', label: 'Documents', icon: <IconDocument /> },
    { to: '/employee/add-employee', label: 'Add Employee', icon: <IconUsers />, canAddEmployeesOnly: true },
    { to: '/employee/guide', label: 'User Guide', icon: <IconBook /> },
    { to: '/employee/profile', label: 'Profile', icon: <IconUserCircle /> },
]

function EmployeeLayout() {
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
    const [positionTitle, setPositionTitle] = useState('')
    const [accessScope, setAccessScope] = useState('full')
    const [canAddEmployees, setCanAddEmployees] = useState(false)
    const [unreadNotifications, setUnreadNotifications] = useState(0)
    const [unreadMessages, setUnreadMessages] = useState(0)
    const [pendingStudents, setPendingStudents] = useState(0)
    const [mobileNavOpen, setMobileNavOpen] = useState(false)
    const [loggingOut, setLoggingOut] = useState(false)

    useLiveRefresh(['notifications', 'messages', 'students', 'employee_assignments'], () => loadBadgeCounts())

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
            .select('position_title, access_scope, can_add_employees')
            .eq('user_id', user.id)
            .single()

        if (employee) {
            setPositionTitle(employee.position_title || '')
            setAccessScope(employee.access_scope || 'full')
            setCanAddEmployees(!!employee.can_add_employees)
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

        // Scoped the same way as employee/Students.jsx's own pending list:
        // only registrations in a college/program this employee is actively
        // assigned to, not every pending student system-wide.
        const { data: employee } = await supabase
            .from('employees')
            .select('employee_id')
            .eq('user_id', user.id)
            .maybeSingle()

        if (employee) {
            const { data: assignments } = await supabase
                .from('employee_assignments')
                .select('college_id, program_id')
                .eq('employee_id', employee.employee_id)
                .eq('status', 'active')

            const assignedPairs = new Set((assignments || []).map((a) => `${a.college_id}:${a.program_id}`))

            if (assignedPairs.size > 0) {
                const { data: pending } = await supabase
                    .from('students')
                    .select('college_id, program_id')
                    .eq('verification_status', 'pending')

                const mine = (pending || []).filter((s) => assignedPairs.has(`${s.college_id}:${s.program_id}`))
                setPendingStudents(mine.length)
            } else {
                setPendingStudents(0)
            }
        }
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
                    <img src={certichainLogo} alt="" />
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
                                <img src={certichainLogo} alt="Holy Cross of Davao College" />
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
                        {NAV_ITEMS.filter((item) =>
                            (!item.fullAccessOnly || accessScope === 'full') &&
                            (!item.canAddEmployeesOnly || canAddEmployees)
                        ).map((item) => {
                            const count = item.badgeKey ? badgeValue(item.badgeKey) : 0
                            const isOpen = item.children && expandedNav.has(item.to)

                            return (
                                <div key={item.to}>
                                    <NavLink
                                        to={item.to}
                                        end={item.end}
                                        onClick={() => {
                                            closeMobileNav()
                                            if (item.children) toggleNav(item.to)
                                        }}
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
                                        {item.children && (
                                            <span className={`employee-nav-chevron${isOpen ? ' is-open' : ''}`}>
                                                <ChevronDown />
                                            </span>
                                        )}
                                    </NavLink>

                                    {item.children && isOpen && (
                                        <div className="employee-nav-children">
                                            {item.children.map((child) => {
                                                const [childPath, childStatus] = child.to.split('?status=')
                                                const isChildActive = location.pathname.endsWith(childPath)
                                                    && new URLSearchParams(location.search).get('status') === childStatus

                                                return (
                                                    <NavLink
                                                        key={child.to}
                                                        to={child.to}
                                                        onClick={closeMobileNav}
                                                        className={`employee-nav-child-link${isChildActive ? ' active' : ''}`}
                                                    >
                                                        <span className="employee-nav-child-dot" aria-hidden="true" />
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
                <Suspense fallback={<PageLoading inline />}><Outlet /></Suspense>
            </main>

        </div>
    )
}

export default EmployeeLayout
