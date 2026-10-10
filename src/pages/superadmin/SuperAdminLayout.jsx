import { Suspense, useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { notifyError } from '../../lib/notify'
import { friendlyError } from '../../lib/friendlyError'
import { useLiveRefresh } from '../../lib/useLiveRefresh'
import ThemeToggle from '../../components/ThemeToggle'
import PageLoading from '../../components/PageLoading'
import certichainLogo from '../../assets/certichain-logo.png'
import { IconHome, IconLogout, IconMenu, IconX } from '../student/icons'
import { IconUsers, IconHistory } from '../employee/icons'
import { IconBuilding, IconDocument } from '../admin/icons'
import { IconKey, IconShieldLock, IconPulse, IconDownloadCloud, IconChevronLeft } from './icons'
import './SuperAdminTheme.css'
import './SuperAdminLayout.css'

// Groups and items match the Super Admin redesign brief's sidebar sections.
// Deep-linked items route into the existing, unmodified /head/* pages
// (registrar-head portal) -- they already work, are already read-only for
// superadmin (RLS + blockedForReadOnlyViewer), and are explicitly out of
// scope to duplicate or reskin here.
const NAV_GROUPS = [
    {
        label: 'Overview',
        items: [
            { to: '/superadmin', label: 'Overview', icon: <IconHome />, end: true },
        ],
    },
    {
        label: 'Administration',
        items: [
            { to: '/superadmin/accounts', label: 'Accounts', icon: <IconUsers /> },
            { to: '/superadmin/roles', label: 'Roles & Permissions', icon: <IconKey /> },
        ],
    },
    {
        label: 'Academic Configuration',
        items: [
            { to: '/head/colleges-programs', label: 'Colleges & Programs', icon: <IconBuilding />, external: true },
            { to: '/head/documents', label: 'Document Types', icon: <IconDocument />, external: true },
            { to: '/head/employees', label: 'Employee Assignments', icon: <IconUsers />, external: true },
        ],
    },
    {
        label: 'Security and Monitoring',
        items: [
            { to: '/superadmin/logins', label: 'Login Activity', icon: <IconHistory /> },
            { to: '/superadmin/security', label: 'Security Center', icon: <IconShieldLock /> },
            { to: '/head/activity-logs', label: 'Audit Logs', icon: <IconHistory />, external: true },
        ],
    },
    {
        label: 'System Management',
        items: [
            { to: '/superadmin/system-health', label: 'System Health', icon: <IconPulse /> },
            { to: '/superadmin/data-export', label: 'Data Export', icon: <IconDownloadCloud /> },
        ],
    },
]

const LOGIN_LIMIT = 1000
const COLLAPSE_KEY = 'sa-sidebar-collapsed'

function SuperAdminLayout() {
    const navigate = useNavigate()
    const [data, setData] = useState({ overview: null, accounts: [], logins: [], daily: [] })
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState('')
    const [who, setWho] = useState({ name: '', initials: '' })
    const [mobileNavOpen, setMobileNavOpen] = useState(false)
    const [loggingOut, setLoggingOut] = useState(false)
    const [collapsed, setCollapsed] = useState(() => {
        try {
            return localStorage.getItem(COLLAPSE_KEY) === '1'
        } catch {
            return false
        }
    })

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

    function toggleCollapsed() {
        setCollapsed((prev) => {
            const next = !prev
            try {
                localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
            } catch {
                // localStorage unavailable (private window, etc.) -- collapse
                // just won't persist across reloads, nothing else breaks.
            }
            return next
        })
    }

    async function handleLogout() {
        setLoggingOut(true)
        const { error } = await supabase.auth.signOut()
        if (error) {
            notifyError(friendlyError(error))
            setLoggingOut(false)
            return
        }
        navigate('/login', { replace: true })
    }

    const closeNav = () => setMobileNavOpen(false)

    return (
        <div className={`sa-portal${collapsed ? ' is-collapsed' : ''}`}>
            <ThemeToggle />

            <header className="sa-mobile-topbar">
                <button className="sa-mobile-menu-button" onClick={() => setMobileNavOpen(true)} aria-label="Open menu">
                    <IconMenu />
                </button>
                <NavLink to="/superadmin" className="sa-mobile-brand">
                    <img src={certichainLogo} alt="" />
                    <span>CertiChain</span>
                </NavLink>
            </header>

            {mobileNavOpen && <div className="sa-nav-backdrop" onClick={closeNav} />}

            <aside className={`sa-sidebar${mobileNavOpen ? ' open' : ''}`}>
                <div className="sa-sidebar-top">
                    <div className="sa-sidebar-brand-row">
                        <NavLink to="/superadmin" className="sa-sidebar-brand" onClick={closeNav}>
                            <div className="sa-sidebar-seal">
                                <img src={certichainLogo} alt="Holy Cross of Davao College" />
                            </div>
                            <div className="sa-sidebar-brand-text">
                                <div className="sa-sidebar-name">CertiChain</div>
                                <div className="sa-sidebar-subtitle">Super Admin</div>
                            </div>
                        </NavLink>
                        <button className="sa-mobile-close-button" onClick={closeNav} aria-label="Close menu">
                            <IconX />
                        </button>
                    </div>

                    {NAV_GROUPS.map((group) => (
                        <nav className="sa-nav-group" aria-label={group.label} key={group.label}>
                            <span className="sa-nav-group-label">{group.label}</span>
                            {group.items.map((item) => (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    end={item.end}
                                    onClick={closeNav}
                                    title={item.label}
                                    className={({ isActive }) => `sa-nav-link${isActive ? ' active' : ''}`}
                                >
                                    {item.icon}
                                    <span>{item.label}</span>
                                    {item.external && <span className="sa-nav-external" aria-hidden="true">↗</span>}
                                    <span className="sa-nav-tooltip">{item.label}</span>
                                </NavLink>
                            ))}
                        </nav>
                    ))}

                    <button type="button" className="sa-collapse-toggle" onClick={toggleCollapsed} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
                        <span className="sa-collapse-icon"><IconChevronLeft /></span>
                        <span>{collapsed ? 'Expand' : 'Collapse'}</span>
                    </button>
                </div>

                <div className="sa-sidebar-bottom">
                    <div className="sa-user">
                        <div className="sa-user-avatar">{who.initials || 'SA'}</div>
                        <div className="sa-user-text">
                            <div className="sa-user-name">{who.name || 'Superadmin'}</div>
                            <div className="sa-user-role">Superadmin</div>
                        </div>
                    </div>
                    <button className="sa-logout-button" onClick={handleLogout} disabled={loggingOut} title="Log out">
                        {loggingOut ? <span className="icon-spinner" /> : <IconLogout />}
                        <span>{loggingOut ? 'Logging out...' : 'Log out'}</span>
                    </button>
                </div>
            </aside>

            <main className="sa-content">
                {loadError && (
                    <div className="sa-alert" role="alert">
                        Could not load superadmin data: {loadError}. If this is the first time, the
                        superadmin database migrations may not be applied yet.
                        <button type="button" className="sa-btn sa-btn-ghost" onClick={load}>Try again</button>
                    </div>
                )}

                <Suspense fallback={<PageLoading inline />}>
                    <Outlet context={{ ...data, loading, reload: load }} />
                </Suspense>
            </main>
        </div>
    )
}

export default SuperAdminLayout
