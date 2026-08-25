import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'

function Dashboard() {
    const [name, setName] = useState('')
    const [loading, setLoading] = useState(true)

    const navigate = useNavigate()

    useEffect(() => {
        loadProfile()
    }, [])

    async function loadProfile() {
        try {
            const {
                data: { user }
            } = await supabase.auth.getUser()

            if (!user) {
                setLoading(false)
                return
            }

            const { data, error } = await supabase
                .from('profiles')
                .select('first_name, last_name')
                .eq('user_id', user.id)
                .single()

            if (error) {
                console.error('Profile error:', error)
            }

            if (data) {
                setName(`${data.first_name} ${data.last_name}`)
            }
        } catch (error) {
            console.error('Dashboard error:', error)
        }

        setLoading(false)
    }

    return (
        <div
            style={{
                minHeight: '100vh',
                backgroundColor: '#f5f7fb',
                padding: '40px'
            }}
        >
            <div
                style={{
                    maxWidth: '900px',
                    margin: '0 auto'
                }}
            >

                <h1>Student Dashboard</h1>

                <p>Welcome to CertiChain.</p>

                {!loading && name && (
                    <p>
                        Welcome, <strong>{name}</strong>!
                    </p>
                )}

                <hr />

                <h2>Document Services</h2>

                <div
                    style={{
                        display: 'grid',
                        gap: '15px',
                        marginTop: '20px'
                    }}
                >

                    <button
                        onClick={() => navigate('/student/new-request')}
                        style={buttonStyle}
                    >
                        Request a Document
                    </button>

                    <button
                        onClick={() => navigate('/student/my-requests')}
                        style={buttonStyle}
                    >
                        My Requests
                    </button>

                    <button
                        onClick={() => navigate('/student/claim-schedule')}
                        style={buttonStyle}
                    >
                        Claim Schedule
                    </button>

                    <button
                        onClick={() => navigate('/student/notifications')}
                        style={buttonStyle}
                    >
                        Notifications
                    </button>

                    <button
                        onClick={() => navigate('/student/profile')}
                        style={buttonStyle}
                    >
                        Profile
                    </button>

                </div>

            </div>
        </div>
    )
}

const buttonStyle = {
    padding: '18px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    backgroundColor: '#ffffff',
    cursor: 'pointer',
    fontSize: '16px'
}

export default Dashboard