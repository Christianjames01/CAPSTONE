import { useState } from 'react'
import { supabase } from "../../lib/supabase";

function App() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [message, setMessage] = useState('')

    const register = async () => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
        })

        if (error) {
            setMessage(error.message)
            return
        }

        console.log(data)
        setMessage('Registration successful!')
    }

    return (
        <div style={{ padding: '40px' }}>
            <h1>CertiChain</h1>

            <h2>Authentication Test</h2>

            <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
            />

            <br /><br />

            <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
            />

            <br /><br />

            <button onClick={register}>
                Register Test Account
            </button>

            <p>{message}</p>
        </div>
    )
}

export default App