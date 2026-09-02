// Shared password strength rule, used at every point the app accepts a new
// password (registration, reset, change) so the requirement is consistent
// everywhere instead of relying on Supabase's bare 6-character default.
export const PASSWORD_REQUIREMENTS = [
    { key: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
    { key: 'letter', label: 'At least one letter', test: (p) => /[a-zA-Z]/.test(p) },
    { key: 'number', label: 'At least one number', test: (p) => /[0-9]/.test(p) },
]

export function passwordMeetsRequirements(password) {
    return PASSWORD_REQUIREMENTS.every((r) => r.test(password || ''))
}

export function passwordRequirementMessage() {
    return 'Password must be at least 8 characters and include both a letter and a number.'
}
