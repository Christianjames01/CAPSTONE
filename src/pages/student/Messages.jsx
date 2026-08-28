import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { findAssignedEmployee } from '../../lib/assignEmployee'
import { notify, notifyError } from '../../lib/notify'
import '../auth/Auth.css'
import './StudentPages.css'

const DEFAULT_MESSAGE =
    "Hi, I'd like to ask about my document request. Please let me know if you need anything " +
    "from me — I'll check back here for your reply. Thank you!"

function Messages() {
    const [userId, setUserId] = useState(null)
    const [employee, setEmployee] = useState(null)
    const [messages, setMessages] = useState([])
    const [reply, setReply] = useState('')

    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        loadMessages()
    }, [])

    const loadMessages = async () => {
        try {
            setLoading(true)
            setError('')

            const {
                data: { user },
                error: userError
            } = await supabase.auth.getUser()

            if (userError || !user) {
                throw new Error('You are not logged in.')
            }

            setUserId(user.id)

            const { data: student, error: studentError } = await supabase
                .from('students')
                .select('student_id, college_id, program_id')
                .eq('user_id', user.id)
                .single()

            if (studentError || !student) {
                throw new Error('Student record could not be found.')
            }

            const assignedEmployeeId = await findAssignedEmployee(student.college_id, student.program_id)

            if (!assignedEmployeeId) {
                setEmployee(null)
                setLoading(false)
                return
            }

            const { data: employeeRow, error: employeeError } = await supabase
                .from('employees')
                .select('employee_id, user_id, employee_number, position_title')
                .eq('employee_id', assignedEmployeeId)
                .single()

            if (employeeError || !employeeRow) {
                throw new Error('Assigned employee could not be found.')
            }

            const { data: profile } = await supabase
                .from('profiles')
                .select('first_name, last_name')
                .eq('user_id', employeeRow.user_id)
                .single()

            setEmployee({
                ...employeeRow,
                name: profile ? `${profile.first_name} ${profile.last_name}`.trim() : employeeRow.employee_number,
            })

            const { data: messageRows, error: messagesError } = await supabase
                .from('messages')
                .select('message_id, sender_user_id, receiver_user_id, message, is_read, created_at')
                .or(`and(sender_user_id.eq.${user.id},receiver_user_id.eq.${employeeRow.user_id}),and(sender_user_id.eq.${employeeRow.user_id},receiver_user_id.eq.${user.id})`)
                .order('created_at', { ascending: true })

            if (messagesError) {
                throw new Error('Failed to load messages: ' + messagesError.message)
            }

            setMessages(messageRows || [])

            if (!messageRows || messageRows.length === 0) {
                setReply(DEFAULT_MESSAGE)
            }

            const unreadIds = (messageRows || [])
                .filter((m) => m.receiver_user_id === user.id && !m.is_read)
                .map((m) => m.message_id)

            if (unreadIds.length > 0) {
                await supabase
                    .from('messages')
                    .update({ is_read: true, read_at: new Date().toISOString() })
                    .in('message_id', unreadIds)
            }

        } catch (err) {
            console.error('STUDENT MESSAGES ERROR:', err)
            setError(err.message || 'Failed to load messages.')
        } finally {
            setLoading(false)
        }
    }

    const sendMessage = async () => {
        if (!reply.trim() || !employee || !userId) return

        try {
            setSending(true)

            const { data, error: sendError } = await supabase
                .from('messages')
                .insert({
                    sender_user_id: userId,
                    receiver_user_id: employee.user_id,
                    message: reply.trim(),
                    is_read: false,
                })
                .select()
                .single()

            if (sendError) {
                throw new Error('Failed to send message: ' + sendError.message)
            }

            await notify({
                userId: employee.user_id,
                title: 'New message',
                message: reply.trim(),
                notificationType: 'message',
            })

            setMessages((prev) => [...prev, data])
            setReply('')

        } catch (err) {
            console.error('SEND MESSAGE ERROR:', err)
            notifyError(err.message || 'Failed to send message.')
        } finally {
            setSending(false)
        }
    }

    const formatTime = (value) =>
        new Date(value).toLocaleString('en-PH', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        })

    return (
        <div>
            <div className="student-page-header">
                <h1>Messages</h1>
                <p>Message the registrar employee assigned to your college and program.</p>
            </div>

            {error && <div className="student-error-box">{error}</div>}

            {loading ? (
                <p className="student-loading">Loading messages...</p>
            ) : !employee ? (
                <div className="student-empty">
                    No registrar employee is assigned to your program yet. Please check back later or visit
                    the Registrar's Office directly.
                </div>
            ) : (
                <>
                    <div className="student-card" style={{ marginBottom: 16 }}>
                        <h2 style={{ fontSize: 15, marginBottom: 2 }}>{employee.name}</h2>
                        <p style={{ fontSize: 12.5, color: 'var(--slate)' }}>{employee.position_title}</p>
                    </div>

                    <div className="student-card" style={{ display: 'flex', flexDirection: 'column', gap: 14, minHeight: 200 }}>
                        {messages.length === 0 ? (
                            <p style={{ fontSize: 13.5, color: 'var(--slate)' }}>
                                No messages yet. Send a message below to start the conversation.
                            </p>
                        ) : (
                            messages.map((m) => (
                                <div
                                    key={m.message_id}
                                    style={{
                                        alignSelf: m.sender_user_id === userId ? 'flex-end' : 'flex-start',
                                        maxWidth: '70%',
                                        background: m.sender_user_id === userId ? 'var(--blue)' : 'var(--paper)',
                                        color: m.sender_user_id === userId ? 'var(--white)' : 'var(--ink)',
                                        padding: '10px 14px',
                                        borderRadius: 10,
                                    }}
                                >
                                    <p style={{ color: 'inherit', fontSize: 14 }}>{m.message}</p>
                                    <span style={{ fontSize: 10.5, opacity: 0.7, display: 'block', marginTop: 4 }}>
                                        {formatTime(m.created_at)}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                        <input
                            className="student-search-input"
                            style={{ flex: 1, maxWidth: 'none' }}
                            value={reply}
                            onChange={(e) => setReply(e.target.value)}
                            placeholder="Type a message..."
                            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                            disabled={sending}
                        />

                        <button
                            className="auth-submit"
                            style={{ width: 'auto', padding: '11px 20px' }}
                            onClick={sendMessage}
                            disabled={sending}
                        >
                            {sending ? 'Sending...' : 'Send'}
                        </button>
                    </div>
                </>
            )}
        </div>
    )
}

export default Messages
