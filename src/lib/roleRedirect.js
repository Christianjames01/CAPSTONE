export function dashboardPathForRole(role) {
    if (role === 'student') return '/student/dashboard'
    if (role === 'employee') return '/employee/dashboard'
    if (role === 'registrar_head' || role === 'admin') return '/admin/dashboard'
    return null
}
