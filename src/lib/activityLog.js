import { supabase } from './supabase'

// Best-effort activity log write. Never throws — a logging failure
// should not block the action it's recording.
export async function logActivity({ employeeId, userId, action, tableName, recordId, description }) {
    try {
        await supabase.from('activity_logs').insert({
            employee_id: employeeId || null,
            user_id: userId || null,
            action,
            table_name: tableName || null,
            record_id: recordId || null,
            description: description || null,
        })
    } catch (error) {
        console.error('ACTIVITY LOG ERROR:', error)
    }
}
