import { supabase } from './supabase'
import { logActivity } from './activityLog'
import { notifyStudentByStudentId } from './notify'

export async function revokeCredential({ credentialId, credentialNumber, requestNumber, studentId, reason, employeeId, userId }) {
    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase
        .from('credentials')
        .update({
            status: 'revoked',
            revoked_at: new Date().toISOString(),
            revoked_by: user?.id || null,
            revocation_reason: reason,
        })
        .eq('credential_id', credentialId)

    if (error) {
        throw new Error('Failed to revoke credential: ' + error.message)
    }

    await logActivity({
        employeeId,
        userId,
        action: 'revoke_credential',
        tableName: 'credentials',
        recordId: credentialId,
        description: `Revoked digital credential "${credentialNumber}" for request "${requestNumber}": "${reason}"`,
    })

    await notifyStudentByStudentId({
        studentId,
        title: 'Credential revoked',
        message: `Your digital credential for request ${requestNumber} has been revoked: ${reason}. Contact the Registrar's Office for details.`,
        notificationType: 'request_update',
    })
}
