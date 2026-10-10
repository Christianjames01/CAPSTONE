// Plain-language summary of CertiChain's actual access rules, grouped by
// module. There is no editable "permissions" table behind this -- access is
// enforced by Postgres RLS policies and role-check functions (is_employee(),
// is_registrar_head(), is_superadmin(), etc.). This file only describes what
// those rules already do; changing what a role can do means changing a
// policy, not a setting on a page.
export const ROLES_MATRIX = [
    {
        module: 'User management',
        student: 'Own profile only.',
        employee: 'View assigned students; no account management.',
        registrar_head: 'Create, edit, activate/deactivate student and employee accounts.',
        admin: 'Same as Registrar Head.',
        superadmin: 'View every account; promote/demote Admin ↔ Registrar Head; activate/deactivate staff accounts.',
    },
    {
        module: 'Academic configuration',
        student: 'View available document types when requesting.',
        employee: 'View the catalog; edit document types and sample images.',
        registrar_head: 'Full edit of colleges, programs and document types, including delete.',
        admin: 'Same as Registrar Head.',
        superadmin: 'View only.',
    },
    {
        module: 'Document requests',
        student: 'Create and track their own requests only.',
        employee: 'Process requests assigned to them (or all, with full access).',
        registrar_head: 'View and manage every request; reassign; delete finished requests.',
        admin: 'Same as Registrar Head.',
        superadmin: 'View only.',
    },
    {
        module: 'Employee assignments',
        student: 'No access.',
        employee: 'View their own assignment(s); an employee granted the privilege can add new employees and assignments.',
        registrar_head: 'Assign or reassign any employee to any college/program.',
        admin: 'Same as Registrar Head.',
        superadmin: 'View only.',
    },
    {
        module: 'Credential verification',
        student: 'View and download their own issued credentials.',
        employee: 'Issue and release credentials for requests assigned to them.',
        registrar_head: 'Issue, release or revoke any credential.',
        admin: 'Same as Registrar Head.',
        superadmin: 'View only.',
    },
    {
        module: 'Audit logs',
        student: 'No access.',
        employee: 'Activity for requests they personally handled (full-access employees only).',
        registrar_head: 'View every activity log entry.',
        admin: 'Same as Registrar Head.',
        superadmin: 'View every activity log entry (read-only, same as everywhere else).',
    },
    {
        module: 'System administration',
        student: 'No access.',
        employee: 'No access.',
        registrar_head: 'No access.',
        admin: 'No access.',
        superadmin: 'The only role that can change another staff account’s role or status. Cannot change its own.',
    },
]
