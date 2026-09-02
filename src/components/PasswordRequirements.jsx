import { PASSWORD_REQUIREMENTS } from '../lib/passwordStrength'

// Live checklist shown under a "new password" field -- each rule ticks
// green as soon as it's satisfied, red/grey otherwise.
function PasswordRequirements({ password }) {
    return (
        <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0 0', fontSize: 12 }}>
            {PASSWORD_REQUIREMENTS.map((req) => {
                const met = req.test(password || '')
                return (
                    <li
                        key={req.key}
                        style={{
                            color: met ? '#1e8a5f' : 'var(--slate)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            marginTop: 2,
                        }}
                    >
                        <span>{met ? '✓' : '•'}</span>
                        {req.label}
                    </li>
                )
            })}
        </ul>
    )
}

export default PasswordRequirements
