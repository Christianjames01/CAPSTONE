import { useState } from 'react'
import ExplainerPlayer from './explainer/ExplainerPlayer'
import { EMPLOYEE_SCENES, HEAD_SCENES, STUDENT_SCENES } from './explainer/sceneLists'
import './UserGuide.css'

// In-app user manual: a short motion walkthrough for the role, then
// searchable, collapsible sections with numbered steps. Content lives in
// lib/userGuideContent.js; each portal passes its own.

const WALKTHROUGHS = {
    student: { scenes: STUDENT_SCENES, label: 'How requesting a document works' },
    employee: { scenes: EMPLOYEE_SCENES, label: 'How handling a request works' },
    head: { scenes: HEAD_SCENES, label: 'How running the office works' },
}

function UserGuide({ title, intro, sections, cardClassName, walkthrough }) {
    const [query, setQuery] = useState('')
    const [open, setOpen] = useState(() => new Set(sections.slice(0, 1).map((s) => s.id)))
    const video = WALKTHROUGHS[walkthrough]

    const q = query.trim().toLowerCase()
    const visible = q
        ? sections.filter((s) =>
            [s.title, s.summary, ...(s.steps || []), ...(s.tips || [])].join(' ').toLowerCase().includes(q))
        : sections

    const toggle = (id) => {
        setOpen((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const jumpTo = (id) => {
        setOpen((prev) => new Set(prev).add(id))
        requestAnimationFrame(() => document.getElementById(`guide-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    }

    const cta = {
        title: 'Now try it on the real pages',
        caption: 'Read the guide below for step-by-step help with every task.',
        primary: {
            label: 'Read the guide',
            onClick: () => document.getElementById('guide-sections')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
        },
    }

    return (
        <div className="ug">
            <div className="ug-header">
                <div className="ug-anim" style={{ '--i': 0 }}>
                    <h1>{title}</h1>
                    <p>{intro}</p>
                </div>
            </div>

            {video && (
                <section className={`${cardClassName} ug-watch ug-anim`} style={{ '--i': 2 }} aria-label={video.label}>
                    <div className="ug-watch-head">
                        <span className="ug-watch-badge"><i /> Watch</span>
                        <div>
                            <strong>{video.label}</strong>
                            <span>About a minute. Pick any chapter to jump ahead.</span>
                        </div>
                    </div>
                    <ExplainerPlayer scenes={video.scenes} cta={cta} label={video.label} />
                </section>
            )}

            <div id="guide-sections" className={`${cardClassName} ug-toolbar ug-anim`} style={{ '--i': 3 }}>
                <input
                    type="search"
                    className="ug-search"
                    placeholder="Search the guide…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label="Search the guide"
                />
                <div className="ug-toc">
                    {sections.map((s, i) => (
                        <button key={s.id} type="button" className="ug-toc-item" style={{ '--i': i }} onClick={() => jumpTo(s.id)}>
                            <span>{i + 1}</span>{s.title}
                        </button>
                    ))}
                </div>
                <div className="ug-toolbar-actions">
                    <button type="button" className="ug-link" onClick={() => setOpen(new Set(sections.map((s) => s.id)))}>Expand all</button>
                    <button type="button" className="ug-link" onClick={() => setOpen(new Set())}>Collapse all</button>
                </div>
            </div>

            {visible.length === 0 && <p className="ug-empty">Nothing in the guide matches “{query}”.</p>}

            {visible.map((section, index) => {
                const number = sections.indexOf(section) + 1
                const isOpen = q ? true : open.has(section.id)

                return (
                    <section
                        key={section.id}
                        id={`guide-${section.id}`}
                        className={`${cardClassName} ug-section ug-anim${isOpen ? ' is-open' : ''}`}
                        style={{ '--i': Math.min(index, 8) + 4 }}
                    >
                        <button type="button" className="ug-section-head" onClick={() => toggle(section.id)} aria-expanded={isOpen}>
                            <span className="ug-number">{number}</span>
                            <span className="ug-section-title">
                                <strong>{section.title}</strong>
                                <span>{section.summary}</span>
                            </span>
                            <span className={`ug-chevron${isOpen ? ' is-open' : ''}`} aria-hidden="true">›</span>
                        </button>

                        {isOpen && (
                            <div className="ug-body">
                                <ol className="ug-steps">
                                    {section.steps.map((step, i) => <li key={step} style={{ '--i': i }}>{step}</li>)}
                                </ol>
                                {section.tips?.map((tip) => (
                                    <p key={tip} className="ug-tip"><strong>Tip:</strong> {tip}</p>
                                ))}
                            </div>
                        )}
                    </section>
                )
            })}
        </div>
    )
}

export default UserGuide
