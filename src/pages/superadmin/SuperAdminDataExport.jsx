import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { notifyError, notifySuccess } from '../../lib/notify'
import { friendlyError } from '../../lib/friendlyError'
import { ROLE_NAMES, downloadCsv, formatWhen } from './superadminFormat'
import { exportAllStudents, exportAllEmployees, exportAllRequests, exportAllCredentials } from '../../lib/dataExports'
import { IconDownloadCloud } from './icons'

function ExportCard({ title, description, onExport, busy }) {
    return (
        <div className="sa-card sa-export-card">
            <h3>{title}</h3>
            <p>{description}</p>
            <button type="button" className="sa-btn sa-btn-primary" onClick={onExport} disabled={busy}>
                <IconDownloadCloud /> {busy ? 'Exporting…' : 'Export'}
            </button>
        </div>
    )
}

function SuperAdminDataExport() {
    const { accounts, logins } = useOutletContext()
    const [busyKey, setBusyKey] = useState(null)

    async function run(key, fn) {
        setBusyKey(key)
        try {
            const count = await fn()
            notifySuccess(typeof count === 'number' ? `Exported ${count} row(s).` : 'Export downloaded.')
        } catch (err) {
            notifyError(friendlyError(err, 'Export failed.'))
        } finally {
            setBusyKey(null)
        }
    }

    function exportAccountsCsv() {
        downloadCsv(
            `certichain-accounts-${new Date().toISOString().slice(0, 10)}.csv`,
            ['Name', 'Email', 'Role', 'Status', 'Created', 'Last sign-in'],
            accounts.map((a) => [a.full_name, a.email, ROLE_NAMES[a.role] || a.role, a.status, formatWhen(a.account_created_at), formatWhen(a.last_sign_in_at)])
        )
        return accounts.length
    }

    function exportLoginsCsv() {
        downloadCsv(
            `certichain-logins-${new Date().toISOString().slice(0, 10)}.csv`,
            ['When', 'Name', 'Email', 'Role'],
            logins.map((l) => [formatWhen(l.logged_in_at), l.full_name, l.email, ROLE_NAMES[l.role] || l.role])
        )
        return logins.length
    }

    return (
        <>
            <header className="sa-page-header">
                <h1>Data Export</h1>
                <p>Manual, on-demand exports of current data for your own records.</p>
            </header>

            <div className="sa-note">
                CertiChain does not run automated or scheduled backups, and there is no restore
                function. Exporting a file here does not protect the live system against data loss —
                it's a point-in-time copy for your own records.
            </div>

            <div className="sa-export-grid">
                <ExportCard
                    title="Accounts"
                    description="Every account currently loaded on this console (CSV)."
                    busy={busyKey === 'accounts'}
                    onExport={() => run('accounts', async () => exportAccountsCsv())}
                />
                <ExportCard
                    title="Login history"
                    description="Every sign-in currently loaded on this console (CSV)."
                    busy={busyKey === 'logins'}
                    onExport={() => run('logins', async () => exportLoginsCsv())}
                />
                <ExportCard
                    title="Students"
                    description="Every student record, college/program and status (Excel)."
                    busy={busyKey === 'students'}
                    onExport={() => run('students', exportAllStudents)}
                />
                <ExportCard
                    title="Employees"
                    description="Every employee and their primary assignment (Excel)."
                    busy={busyKey === 'employees'}
                    onExport={() => run('employees', exportAllEmployees)}
                />
                <ExportCard
                    title="Document requests"
                    description="Every request, status and amount (Excel)."
                    busy={busyKey === 'requests'}
                    onExport={() => run('requests', exportAllRequests)}
                />
                <ExportCard
                    title="Credentials"
                    description="Every issued credential's number, status and dates (Excel)."
                    busy={busyKey === 'credentials'}
                    onExport={() => run('credentials', exportAllCredentials)}
                />
            </div>
        </>
    )
}

export default SuperAdminDataExport
