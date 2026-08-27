import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import hcdcLogo from '../../assets/hcdc-logo.png'
import {
    IconHome,
    IconDocumentPlus,
    IconList,
    IconCalendar,
    IconReceipt,
    IconBell,
    IconUserCircle,
    IconHelp,
    IconLogout,
} from './icons'
import './StudentLayout.css'

const NAV_ITEMS = [
    { to: '/student/dashboard', label: 'Dashboard', icon: <IconHome />, end: true },
    { to: '/student/new-request', label: 'Request a Document', icon: <IconDocumentPlus /> },
    { to: '/student/my-requests', label: 'My Requests', icon: <IconList /> },
    { to: '/student/claim-schedule', label: 'Claim Schedule', icon: <IconCalendar /> },
    { to: '/student/upload-receipt', label: 'Upload Receipt', icon: <IconReceipt /> },
    { to: '/student/notifications', label: 'Notifications', icon: <IconBell />, badgeKey: 'notifications' },
    { to: '/student/profile', label: 'Profile', icon: <IconUserCircle /> },
    { to: '/student/help', label: 'Help / Support', icon: <IconHelp /> },
]

function StudentLayout() {
    const navigate = useNavigate()
    const [name, setName] = useState('')
    const [initials, setInitials] = useState('')
    const [unreadCount, setUnreadCount] = useState(0)

    useEffect(() => {
        loadProfile()
        loadUnreadCount()
    }, [])

    async function loadProfile() {
        const {
            data: { user }
        } = await supabase.auth.getUser()

        if (!user) return

        const { data } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('user_id', user.id)
            .single()

        if (data) {
            setName(`${data.first_name} ${data.last_name}`.trim())
            setInitials(
                `${data.first_name?.[0] || ''}${data.last_name?.[0] || ''}`.toUpperCase()
            )
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

    const handleLogout = async () => {
        await supabase.auth.signOut()
        navigate('/login')
    }

    return (
        <div className="student-layout">

            <aside className="student-sidebar">

                <div className="student-sidebar-top">
                    <Link to="/" className="student-sidebar-brand">
                        <div className="student-sidebar-seal">
                            <img src={hcdcLogo} alt="Holy Cross of Davao College" />
                        </div>
                        <div>
                            <div className="student-sidebar-name">CertiChain</div>
                            <div className="student-sidebar-subtitle">Student Portal</div>
                        </div>
                    </Link>

                    <nav className="student-nav">
                        {NAV_ITEMS.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.end}
                                className={({ isActive }) =>
                                    `student-nav-link${isActive ? ' active' : ''}`
                                }
                            >
                                {item.icon}
                                <span>{item.label}</span>
                                {item.badgeKey === 'notifications' && unreadCount > 0 && (
                                    <span className="student-nav-badge">
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </span>
                                )}
                            </NavLink>
                        ))}
                    </nav>
                </div>

                <div className="student-sidebar-bottom">
                    <div className="student-user">
                        <div className="student-user-avatar">{initials || 'ST'}</div>
                        <div>
                            <div className="student-user-name">{name || 'Student'}</div>
                            <div className="student-user-role">Student Account</div>
                        </div>
                    </div>

                    <button className="student-logout-button" onClick={handleLogout}>
                        <IconLogout />
                        <span>Log out</span>
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
