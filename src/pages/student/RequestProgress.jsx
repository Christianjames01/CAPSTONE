import { Link } from 'react-router-dom'
import { PROGRESS_STEPS, describeRequest } from '../../lib/studentProgress'

// The student's request journey: six steps with the current one highlighted,
// then plain answers to "What's happening now?", "What should I do?" (with
// the button when they must act) and "What happens next?".
function RequestProgress({ request, requirements, schedule, credential, compact = false }) {
    const info = describeRequest(request, { requirements, schedule, credential })

    return (
        <section className={`sp-progress tone-${info.tone}${compact ? ' is-compact' : ''}`} aria-label="Request progress">
            {info.stopped ? (
                <div className="sp-stopped" role="status">
                    <strong>{info.stopped === 'cancelled' ? 'This request was cancelled' : 'This request was rejected'}</strong>
                </div>
            ) : (
                <ol className="sp-steps">
                    {PROGRESS_STEPS.map((step, i) => {
                        const state = i < info.step || (i === info.step && info.step === PROGRESS_STEPS.length - 1)
                            ? 'done'
                            : i === info.step ? 'current' : 'upcoming'
                        return (
                            <li key={step.key} className={`sp-step is-${state}`} aria-current={state === 'current' ? 'step' : undefined}>
                                <span className="sp-step-dot" aria-hidden="true">
                                    {state === 'done' ? (
                                        <svg viewBox="0 0 24 24" width="14" height="14"><path d="M5 12.5 10 17.5 19 7.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                    ) : i + 1}
                                </span>
                                <span className="sp-step-label">{step.label}</span>
                                {state === 'current' && <span className="sp-step-now">Current step</span>}
                            </li>
                        )
                    })}
                </ol>
            )}

            {!compact && (
                <div className="sp-guide">
                    <div className="sp-guide-block">
                        <span className="sp-guide-q">What's happening now?</span>
                        <p>{info.now}</p>
                    </div>
                    <div className={`sp-guide-block sp-guide-todo${info.action && info.tone === 'action' ? ' is-required' : ''}`}>
                        <span className="sp-guide-q">{info.tone === 'action' ? 'Action required' : 'What should I do?'}</span>
                        <p>{info.todo}</p>
                        {info.action && (
                            <Link to={info.action.to} className={`sp-action${info.tone === 'action' ? ' is-primary' : ''}`}>
                                {info.action.label}
                                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            </Link>
                        )}
                    </div>
                    {info.next && (
                        <div className="sp-guide-block">
                            <span className="sp-guide-q">What happens next?</span>
                            <p>{info.next}</p>
                        </div>
                    )}
                </div>
            )}
        </section>
    )
}

export default RequestProgress
