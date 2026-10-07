export function dashboardPathForRole(role) {
    if (role === 'student') return '/student/dashboard'
    if (role === 'employee') return '/employee/dashboard'
    if (role === 'registrar_head') return '/head/dashboard'
    if (role === 'admin') return '/admin/dashboard'
    if (role === 'superadmin') return '/superadmin'
    return null
}
