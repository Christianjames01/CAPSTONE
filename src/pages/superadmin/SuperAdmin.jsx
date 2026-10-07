import { useCallback, useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { notifyError } from '../../lib/notify'
import ThemeToggle from '../../components/ThemeToggle'
import { useLiveRefresh } from '../../lib/useLiveRefresh'
import certichainLogo from '../../assets/certichain-logo.png'
import { IconHome, IconLogout, IconMenu, IconX } from '../student/icons'
import { IconUsers, IconHistory } from '../employee/icons'
import { IconBuilding } from '../admin/icons'
import SuperAdminOverview from './SuperAdminOverview'
import SuperAdminAccounts from './SuperAdminAccounts'
import SuperAdminLogins from './SuperAdminLogins'
import '../admin/AdminLayout.css'
import '../admin/AdminPages.css'
import './SuperAdmin.css'

const NAV_ITEMS = [
    { to: '/superadmin', label: 'Overview', icon: <IconHome />, end: true },
    { to: '/superadmin/accounts', label: 'Accounts', icon: <IconUsers /> },
    { to: '/superadmin/logins', label: 'Login activity', icon: <IconHistory /> },
]

const LOGIN_LIMIT = 1000

function SuperAdmin() {
    const navigate = useNavigate()
    const [data, setData] = useState({ overview: null, accounts: [], logins: [], daily: [] })
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState('')
    const [who, setWho] = useState({ name: '', initials: '' })
    const [mobileNavOpen, setMobileNavOpen] = useState(false)
    const [loggingOut, setLoggingOut] = useState(false)

    const load = useCallback(async ({ silent = false } = {}) => {
        if (!silent) setLoading(true)
        const [overviewRes, accountsRes, loginsRes, dailyRes] = await Promise.all([
            supabase.rpc('superadmin_overview'),
            supabase.rpc('superadmin_list_accounts'),
            supabase.rpc('superadmin_login_history', { p_limit: LOGIN_LIMIT }),
            supabase.rpc('superadmin_daily_logins', { p_days: 14 }),
        ])
        const failed = overviewRes.error || accountsRes.error || loginsRes.error || dailyRes.error
        setLoadError(failed ? failed.message : '')
        setData({
            overview: overviewRes.data || null,
            accounts: accountsRes.data || [],
            logins: loginsRes.data || [],
            daily: dailyRes.data || [],
        })
        setLoading(false)
    }, [])

    useEffect(() => {
        load()
    }, [load])

    // New sign-ins and account changes show up without a manual refresh --
    // see src/lib/useLiveRefresh.js.
    useLiveRefresh(['login_events', 'profiles', 'user_presence'], load)

    useEffect(() => {
        let cancelled = false
        async function loadWho() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            const { data: profile } = await supabase
                .from('profiles')
                .select('first_name, last_name')
                .eq('user_id', user.id)
                .maybeSingle()
            if (cancelled || !profile) return
            const name = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || user.email
            const initials = `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}`.toUpperCase() || 'SA'
            setWho({ name, initials })
        }
        loadWho()
        return () => { cancelled = true }
    }, [])

    useEffect(() => {
        document.body.style.overflow = mobileNavOpen ? 'hidden' : ''
        return () => { document.body.style.overflow = '' }
    }, [mobileNavOpen])

    async function handleLogout() {
        setLoggingOut(true)
        const { error } = await supabase.auth.signOut()
        if (error) {
            notifyError(error.message)
            setLoggingOut(false)
            return
        }
        navigate('/login', { replace: true })
    }

    const closeNav = () => setMobileNavOpen(false)

    return (
        <div className="admin-layout superadmin-layout">
            <ThemeToggle />

            <header className="admin-mobile-topbar">
                <button className="admin-mobile-menu-button" onClick={() => setMobileNavOpen(true)} aria-label="Open menu">
                    <IconMenu />
                </button>
                <NavLink to="/superadmin" className="admin-mobile-brand">
                    <img src={certichainLogo} alt="" />
                    <span>CertiChain</span>
                </NavLink>
            </header>

            {mobileNavOpen && <div className="admin-nav-backdrop" onClick={closeNav} />}

            <aside className={`admin-sidebar${mobileNavOpen ? ' open' : ''}`}>
                <div className="admin-sidebar-top">
                    <div className="admin-sidebar-brand-row">
                        <NavLink to="/superadmin" className="admin-sidebar-brand" onClick={closeNav}>
                            <div className="admin-sidebar-seal">
                                <img src={certichainLogo} alt="CertiChain" />
                            </div>
                            <div>
                                <div className="admin-sidebar-name">CertiChain</div>
                                <div className="admin-sidebar-subtitle">Superadmin Console</div>
                            </div>
                        </NavLink>
                        <button className="admin-mobile-close-button" onClick={closeNav} aria-label="Close menu">
                            <IconX />
                        </button>
                    </div>

                    <nav className="admin-nav">
                        {NAV_ITEMS.map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                end={item.end}
                                onClick={closeNav}
                                className={({ isActive }) => `admin-nav-link${isActive ? ' active' : ''}`}
                            >
                                {item.icon}
                                <span>{item.label}</span>
                            </NavLink>
                        ))}
                    </nav>

                    <div className="sa-sidebar-divider" />

                    <nav className="admin-nav" aria-label="Other portals">
                        <NavLink to="/head/dashboard" onClick={closeNav} className="admin-nav-link">
                            <IconBuilding />
                            <span>Head Portal (view only)</span>
                        </NavLink>
                    </nav>
                </div>

                <div className="admin-sidebar-bottom">
                    <div className="admin-user">
                        <div className="admin-user-avatar">{who.initials || 'SA'}</div>
                        <div>
                            <div className="admin-user-name">{who.name || 'Superadmin'}</div>
                            <div className="admin-user-role">Superadmin</div>
                        </div>
                    </div>
                    <button className="admin-logout-button" onClick={handleLogout} disabled={loggingOut}>
                        {loggingOut ? <span className="icon-spinner" /> : <IconLogout />}
                        <span>{loggingOut ? 'Logging out...' : 'Log out'}</span>
                    </button>
                </div>
            </aside>

            <main className="admin-content superadmin-content">
                {loadError && (
                    <div className="superadmin-alert" role="alert">
                        Could not load superadmin data: {loadError}. If this is the first time, the
                        superadmin database migrations may not be applied yet.
                        <button type="button" className="admin-link-button" onClick={load}>Try again</button>
                    </div>
                )}

                <Routes>
                    <Route
                        index
                        element={<SuperAdminOverview {...data} loading={loading} />}
                    />
                    <Route
                        path="accounts"
                        element={<SuperAdminAccounts accounts={data.accounts} onChanged={load} />}
                    />
                    <Route
                        path="logins"
                        element={<SuperAdminLogins logins={data.logins} />}
                    />
                    <Route path="*" element={<Navigate to="/superadmin" replace />} />
                </Routes>
            </main>
        </div>
    )
}

export default SuperAdmin
