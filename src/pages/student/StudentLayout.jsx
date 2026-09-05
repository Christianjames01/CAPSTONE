import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'
import { supabase } from '../../lib/supabase'
import { watchStudentSession } from '../../lib/singleSession'
import { useIdleLogout } from '../../lib/useIdleLogout'
import hcdcLogo from '../../assets/hcdc-logo.png'
import {
    IconHome,
    IconDocumentPlus,
    IconList,
    IconCalendar,
    IconReceipt,
    IconMessage,
    IconBell,
    IconUserCircle,
    IconHelp,
    IconLogout,
    IconMenu,
    IconX,
} from './icons'
import ThemeToggle from '../../components/ThemeToggle'
import './StudentLayout.css'

const NAV_ITEMS = [
    { to: '/student/dashboard', label: 'Dashboard', icon: <IconHome />, end: true },
    { to: '/student/new-request', label: 'Request a Document', icon: <IconDocumentPlus /> },
    { to: '/student/my-requests', label: 'My Requests', icon: <IconList /> },
    { to: '/student/claim-schedule', label: 'Claim Schedule', icon: <IconCalendar /> },
    { to: '/student/upload-receipt', label: 'Upload Receipt', icon: <IconReceipt /> },
    { to: '/student/messages', label: 'Messages', icon: <IconMessage />, badgeKey: 'messages' },
    { to: '/student/notifications', label: 'Notifications', icon: <IconBell />, badgeKey: 'notifications' },
    { to: '/student/profile', label: 'Profile', icon: <IconUserCircle /> },
    { to: '/student/help', label: 'Help / Support', icon: <IconHelp /> },
]

function StudentLayout() {
    const navigate = useNavigate()
    useIdleLogout()
    const [name, setName] = useState('')
    const [initials, setInitials] = useState('')
    const [photoUrl, setPhotoUrl] = useState('')
    const [unreadCount, setUnreadCount] = useState(0)
    const [unreadMessageCount, setUnreadMessageCount] = useState(0)
    const [mobileNavOpen, setMobileNavOpen] = useState(false)
    const [loggingOut, setLoggingOut] = useState(false)

    useEffect(() => {
        document.body.style.overflow = mobileNavOpen ? 'hidden' : ''
        return () => { document.body.style.overflow = '' }
    }, [mobileNavOpen])

    useEffect(() => {
        loadProfile()
        loadUnreadCount()
        loadUnreadMessageCount()

        window.addEventListener('profile-updated', loadProfile)
        window.addEventListener('notifications-updated', loadUnreadCount)
        return () => {
            window.removeEventListener('profile-updated', loadProfile)
            window.removeEventListener('notifications-updated', loadUnreadCount)
        }
    }, [])

    useEffect(() => {
        let unwatch = () => {}

        supabase.auth.getUser().then(({ data: { user } }) => {
            if (!user) return

            unwatch = watchStudentSession(user.id, async () => {
                await Swal.fire({
                    title: 'Signed out',
                    text: 'Your account was signed in on another device, so you\'ve been signed out here.',
                    confirmButtonText: 'OK',
                    confirmButtonColor: '#123B78',
                })
                await supabase.auth.signOut()
                navigate('/login')
            })
        })

        return () => unwatch()
    }, [])

    async function loadProfile() {
        const {
            data: { user }
        } = await supabase.auth.getUser()

        if (!user) return

        const { data } = await supabase
            .from('profiles')
            .select('first_name, last_name, profile_photo_url')
            .eq('user_id', user.id)
            .single()

        if (data) {
            setName(`${data.first_name} ${data.last_name}`.trim())
            setInitials(
                `${data.first_name?.[0] || ''}${data.last_name?.[0] || ''}`.toUpperCase()
            )
            setPhotoUrl(data.profile_photo_url || '')
        }
    }

    async function loadUnreadCount() {
        const {
            data: { user }
        } = await supabase.auth.getUser()

        if (!user) return

        const { count } = await supabase
            .from('notifications')
            .select('notification_id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('is_read', false)

        setUnreadCount(count || 0)
    }

    async function loadUnreadMessageCount() {
        const {
            data: { user }
        } = await supabase.auth.getUser()

        if (!user) return

        const { count } = await supabase
            .from('messages')
            .select('message_id', { count: 'exact', head: true })
            .eq('receiver_user_id', user.id)
            .eq('is_read', false)

        setUnreadMessageCount(count || 0)
    }

    const handleLogout = async () => {
        setLoggingOut(true)
        await supabase.auth.signOut()
        navigate('/')
    }

    const closeMobileNav = () => setMobileNavOpen(false)

    return (
        <div className="student-layout">

            <header className="student-mobile-topbar">
                <button
                    className="student-mobile-menu-button"
                    onClick={() => setMobileNavOpen(true)}
                    aria-label="Open menu"
                >
                    <IconMenu />
                </button>

                <Link to="/student/dashboard" className="student-mobile-brand">
                    <img src={hcdcLogo} alt="" />
                    <span>CertiChain</span>
                </Link>
            </header>

            {mobileNavOpen && (
                <div className="student-nav-backdrop" onClick={closeMobileNav} />
            )}

            <aside className={`student-sidebar${mobileNavOpen ? ' open' : ''}`}>

                <div className="student-sidebar-top">
                    <div className="student-sidebar-brand-row">
                        <Link to="/student/dashboard" className="student-sidebar-brand" onClick={closeMobileNav}>
                            <div className="student-sidebar-seal">
                                <img src={hcdcLogo} alt="Holy Cross of Davao College" />
                            </div>
                            <div>
                                <div className="student-sidebar-name">CertiChain</div>
                                <div className="student-sidebar-subtitle">Student Portal</div>
                            </div>
                        </Link>

                        <button
                            className="student-mobile-close-button"
                            onClick={closeMobileNav}
                            aria-label="Close menu"
                        >
                            <IconX />
                        </button>
                    </div>

                    <nav className="student-nav">
                        {NAV_ITEMS.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.end}
                                onClick={closeMobileNav}
                                className={({ isActive }) =>
                                    `student-nav-link${isActive ? ' active' : ''}`
                                }
                            >
                                {item.icon}
                                <span>{item.label}</span>
                                {(() => {
                                    const badgeValue =
                                        item.badgeKey === 'notifications' ? unreadCount :
                                        item.badgeKey === 'messages' ? unreadMessageCount :
                                        0

                                    return badgeValue > 0 && (
                                        <span className="student-nav-badge">
                                            {badgeValue > 9 ? '9+' : badgeValue}
                                        </span>
                                    )
                                })()}
                            </NavLink>
                        ))}
                    </nav>
                </div>

                <div className="student-sidebar-bottom">
                    <div className="student-user">
                        <div className="student-user-avatar">
                            {photoUrl ? (
                                <img
                                    src={photoUrl}
                                    alt={name || 'Student'}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}
                                />
                            ) : (
                                initials || 'ST'
                            )}
                        </div>
                        <div>
                            <div className="student-user-name">{name || 'Student'}</div>
                            <div className="student-user-role">Student Account</div>
                        </div>
                    </div>

                    <ThemeToggle buttonClassName="student-logout-button" />

                    <button className="student-logout-button" onClick={handleLogout} disabled={loggingOut}>
                        {loggingOut ? <span className="icon-spinner" /> : <IconLogout />}
                        <span>{loggingOut ? 'Logging out...' : 'Log out'}</span>
                    </button>
                </div>

            </aside>

            <main className="student-content">
                <Outlet />
            </main>

        </div>
    )
}

export default StudentLayout
