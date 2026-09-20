import { useEffect, useRef } from 'react'
import './RichTextEditor.css'

const COLORS = [
    { label: 'Red', value: '#C8102E' },
    { label: 'Blue', value: '#123B78' },
    { label: 'Green', value: '#1E8A5F' },
    { label: 'Black', value: '#1A1A1A' },
]

const SIZES = [
    { label: 'Small', value: '2' },
    { label: 'Normal', value: '3' },
    { label: 'Large', value: '5' },
    { label: 'X-Large', value: '6' },
]

// A minimal formatting toolbar over a contentEditable div, so the registrar
// head can bold/italicize/underline/color/size announcement text without a
// heavy rich-text library. Uses the (deprecated but universally supported)
// execCommand API -- acceptable here since this is a small internal admin
// tool, not a product-facing editor. The resulting HTML is untrusted and
// must be sanitized (see lib/sanitizeHtml.js) before it's stored or shown.
function RichTextEditor({ value, onChange, disabled, placeholder, editorKey }) {
    const ref = useRef(null)

    // Only set innerHTML on mount (and when `editorKey` changes, e.g.
    // switching from "new" to editing a different announcement) -- doing
    // it on every value change would fight the browser's own cursor
    // position while typing.
    useEffect(() => {
        if (ref.current) {
            ref.current.innerHTML = value || ''
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editorKey])

    const exec = (command, arg) => {
        if (disabled) return
        ref.current?.focus()
        document.execCommand(command, false, arg)
        onChange(ref.current?.innerHTML || '')
    }

    return (
        <div className="rich-text-editor">
            <div className="rich-text-toolbar">
                <button type="button" onClick={() => exec('bold')} disabled={disabled} title="Bold" style={{ fontWeight: 700 }}>B</button>
                <button type="button" onClick={() => exec('italic')} disabled={disabled} title="Italic" style={{ fontStyle: 'italic' }}>I</button>
                <button type="button" onClick={() => exec('underline')} disabled={disabled} title="Underline" style={{ textDecoration: 'underline' }}>U</button>

                <select
                    aria-label="Font size"
                    disabled={disabled}
                    defaultValue=""
                    onChange={(e) => {
                        if (e.target.value) exec('fontSize', e.target.value)
                        e.target.value = ''
                    }}
                >
                    <option value="" disabled>Size</option>
                    {SIZES.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                </select>

                {COLORS.map((c) => (
                    <button
                        key={c.value}
                        type="button"
                        onClick={() => exec('foreColor', c.value)}
                        disabled={disabled}
                        title={c.label}
                        className="rich-text-color-swatch"
                        style={{ background: c.value }}
                    />
                ))}

                <button type="button" onClick={() => exec('removeFormat')} disabled={disabled} title="Clear formatting">
                    Clear
                </button>
            </div>

            <div
                ref={ref}
                className="rich-text-body form-input"
                contentEditable={!disabled}
                onInput={() => onChange(ref.current?.innerHTML || '')}
                data-placeholder={placeholder}
                suppressContentEditableWarning
            />
        </div>
    )
}

export default RichTextEditor
