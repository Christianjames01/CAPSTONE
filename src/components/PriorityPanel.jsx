import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activityLog'
import { notify, notifyError, confirmModal } from '../lib/notify'
import { isUrgent, setRequestPriority } from '../lib/requestPriority'
import './PriorityPanel.css'

// Priority card on the admin and employee request pages: lets staff mark
// the request urgent (or back to normal). `onChange` gets the updated request.
function PriorityPanel({ request, onChange }) {
    const [saving, setSaving] = useState(false)
    const urgent = isUrgent(request)
    const closed = ['completed', 'cancelled', 'rejected'].includes(request.status)

    const toggle = async () => {
        const next = urgent ? 'normal' : 'urgent'
        const confirmed = await confirmModal(
            next === 'urgent'
                ? `Mark ${request.request_number} as urgent? It will move to the top of request lists and the assigned employee will be notified.`
                : `Set ${request.request_number} back to normal priority?`,
            { title: next === 'urgent' ? 'Mark as urgent?' : 'Back to normal?', confirmButtonText: next === 'urgent' ? 'Mark urgent' : 'Set to normal', icon: 'question' }
        )
        if (!confirmed) return

        try {
            setSaving(true)
            await setRequestPriority(request.request_id, next)

            const { data: { user } } = await supabase.auth.getUser()

            await logActivity({
                userId: user?.id,
                action: next === 'urgent' ? 'mark_request_urgent' : 'mark_request_normal',
                tableName: 'document_requests',
                recordId: request.request_id,
                description: `Set priority of "${request.request_number}" to ${next}.`,
            })

            // Let the assigned employee know, unless they're the one who did it.
            if (next === 'urgent' && request.assigned_employee_id) {
                const { data: employeeRow } = await supabase
                    .from('employees')
                    .select('user_id')
                    .eq('employee_id', request.assigned_employee_id)
                    .maybeSingle()

                if (employeeRow?.user_id && employeeRow.user_id !== user?.id) {
                    await notify({
                        userId: employeeRow.user_id,
                        title: 'Request marked urgent',
                        message: `Request ${request.request_number} was marked urgent.`,
                        notificationType: 'request_update',
                        relatedRequestId: request.request_id,
                    })
                }
            }

            onChange({ ...request, priority: next })
        } catch (err) {
            console.error('SET PRIORITY ERROR:', err)
            notifyError(err.message || 'Failed to update priority.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <section className={`prio-panel${urgent ? ' is-urgent' : ''}`} aria-label="Priority">
            <div className="prio-main">
                <div className="prio-row">
                    <span className={`prio-pill ${urgent ? 'is-urgent' : 'is-normal'}`}>
                        {urgent ? '🔴 Urgent' : 'Normal priority'}
                    </span>
                </div>

                <p className="prio-text is-muted">
                    {urgent
                        ? 'Shown first in request lists; the assigned employee was notified.'
                        : 'Mark urgent to move this request to the top of request lists.'}
                </p>
            </div>

            {!closed && (
                <button type="button" className={`prio-toggle${urgent ? '' : ' is-primary'}`} onClick={toggle} disabled={saving}>
                    {saving ? 'Saving...' : urgent ? 'Set back to normal' : 'Mark as urgent'}
                </button>
            )}
        </section>
    )
}

export default PriorityPanel
