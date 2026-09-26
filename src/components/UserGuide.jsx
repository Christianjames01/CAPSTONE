import { useState } from 'react'
import './UserGuide.css'

// In-app user manual: searchable, collapsible sections with numbered steps.
// Content lives in lib/userGuideContent.js; each portal passes its own.
function UserGuide({ title, intro, sections, cardClassName }) {
    const [query, setQuery] = useState('')
    const [open, setOpen] = useState(() => new Set(sections.slice(0, 1).map((s) => s.id)))

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

    return (
        <div className="ug">
            <div className="ug-header">
                <h1>{title}</h1>
                <p>{intro}</p>
            </div>

            <div className={`${cardClassName} ug-toolbar`}>
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
                        <button key={s.id} type="button" className="ug-toc-item" onClick={() => jumpTo(s.id)}>
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

            {visible.map((section) => {
                const number = sections.indexOf(section) + 1
                const isOpen = q ? true : open.has(section.id)

                return (
                    <section key={section.id} id={`guide-${section.id}`} className={`${cardClassName} ug-section`}>
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
                                    {section.steps.map((step) => <li key={step}>{step}</li>)}
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
