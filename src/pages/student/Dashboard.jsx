import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { IconDocumentPlus, IconList } from './icons'
import './Dashboard.css'

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
                setName(data.first_name)
            }
        } catch (error) {
            console.error('Dashboard error:', error)
        }

        setLoading(false)
    }

    return (
        <div>
            <div className="student-dashboard-header">
                <h1>{!loading && name ? `Welcome back, ${name}` : 'Welcome back'}</h1>
                <p>Here's what you can do with your CertiChain account today.</p>
            </div>

            <div className="student-dashboard-grid">

                <button
                    className="student-dashboard-card"
                    onClick={() => navigate('/student/new-request')}
                >
                    <div className="student-dashboard-card-icon"><IconDocumentPlus /></div>
                    <h3>Request a Document</h3>
                    <p>Submit a new request for a transcript, certificate, or diploma.</p>
                    <span className="student-dashboard-card-link">Get started →</span>
                </button>

                <button
                    className="student-dashboard-card"
                    onClick={() => navigate('/student/my-requests')}
                >
                    <div className="student-dashboard-card-icon"><IconList /></div>
                    <h3>My Requests</h3>
                    <p>Track the status of documents you've already requested.</p>
                    <span className="student-dashboard-card-link">View requests →</span>
                </button>

            </div>
        </div>
    )
}

export default Dashboard
