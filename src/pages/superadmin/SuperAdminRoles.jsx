import { useOutletContext } from 'react-router-dom'
import { ROLES_MATRIX } from './rolesMatrix'
import { ROLE_NAMES } from './superadminFormat'

const COLUMNS = ['student', 'employee', 'registrar_head', 'admin', 'superadmin']

function SuperAdminRoles() {
    const { accounts } = useOutletContext()

    const counts = COLUMNS.reduce((acc, role) => {
        acc[role] = accounts.filter((a) => a.role === role).length
        return acc
    }, {})
    // Superadmin's own account is excluded from superadmin_list_accounts(),
    // so that count would always read 0 -- show it as "1" instead of a
    // misleading zero (there is always exactly one, enforced server-side).
    counts.superadmin = 1

    return (
        <>
            <header className="sa-page-header">
                <h1>Roles & Permissions</h1>
                <p>How CertiChain's database and server-side rules already enforce access for each role.</p>
            </header>

            <div className="sa-note">
                This page is read-only and informational. There is nothing to save here — access is
                enforced by database policies, not a setting on this screen. Changing what a role can
                do requires a code change to those policies, not an edit here.
            </div>

            <section className="sa-card">
                <div className="sa-matrix-wrapper">
                    <table className="sa-matrix">
                        <thead>
                            <tr>
                                <th>Module</th>
                                {COLUMNS.map((role) => (
                                    <th key={role}>
                                        {ROLE_NAMES[role]}
                                        <br />
                                        <span className="sa-muted">{counts[role]} account{counts[role] === 1 ? '' : 's'}</span>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {ROLES_MATRIX.map((row) => (
                                <tr key={row.module}>
                                    <th scope="row">{row.module}</th>
                                    {COLUMNS.map((role) => (
                                        <td key={role}>{row[role]}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </>
    )
}

export default SuperAdminRoles
