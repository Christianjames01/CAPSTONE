import { useEffect, useRef, useState } from 'react'
import './RichTextEditor.css'

const COLORS = [
    '#1A1A1A', '#57616F', '#C8102E', '#B45309',
    '#1E8A5F', '#123B78', '#6FA8F5', '#8A1F2B',
]

// Real pixel sizes rather than vague labels -- 14px matches the editor's own
// default body text, so it's included as the implicit "normal" size.
const SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 40]

// A minimal formatting toolbar over a contentEditable div, so the registrar
// head can bold/italicize/underline/color/size announcement text without a
// heavy rich-text library. Uses the (deprecated but universally supported)
// execCommand API -- acceptable here since this is a small internal admin
// tool, not a product-facing editor. The resulting HTML is untrusted and
// must be sanitized (see lib/sanitizeHtml.js) before it's stored or shown.
function RichTextEditor({ value, onChange, disabled, placeholder, editorKey }) {
    const ref = useRef(null)
    const [activeMarks, setActiveMarks] = useState({ bold: false, italic: false, underline: false })

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

    // Reflect whatever formatting is active right where the cursor/selection
    // currently sits, the same way a real editor's toolbar highlights the
    // active buttons -- makes it clear the tool actually did something.
    useEffect(() => {
        const updateActiveMarks = () => {
            if (!ref.current || document.activeElement !== ref.current) return
            setActiveMarks({
                bold: document.queryCommandState('bold'),
                italic: document.queryCommandState('italic'),
                underline: document.queryCommandState('underline'),
            })
        }

        document.addEventListener('selectionchange', updateActiveMarks)
        return () => document.removeEventListener('selectionchange', updateActiveMarks)
    }, [])

    const exec = (command, arg) => {
        if (disabled) return
        ref.current?.focus()
        document.execCommand(command, false, arg)
        onChange(ref.current?.innerHTML || '')
    }

    // execCommand('fontSize', ...) only understands the legacy 1-7 <font>
    // scale, not real pixel numbers -- apply size 7 as a marker, then swap
    // every resulting <font size="7"> for a <span style="font-size:Npx">
    // so the dropdown's numbers are the actual rendered size, not a guess.
    const applyFontSize = (px) => {
        if (disabled) return
        ref.current?.focus()
        document.execCommand('fontSize', false, '7')

        ref.current?.querySelectorAll('font[size="7"]').forEach((el) => {
            el.removeAttribute('size')
            el.style.fontSize = `${px}px`
        })

        onChange(ref.current?.innerHTML || '')
    }

    return (
        <div className={`rich-text-editor${disabled ? ' is-disabled' : ''}`}>
            <div className="rich-text-toolbar" role="toolbar" aria-label="Text formatting">
                <div className="rich-text-group">
                    <button
                        type="button"
                        className={`rich-text-btn${activeMarks.bold ? ' active' : ''}`}
                        onClick={() => exec('bold')}
                        disabled={disabled}
                        title="Bold"
                        aria-pressed={activeMarks.bold}
                    >
                        <span style={{ fontWeight: 700 }}>B</span>
                    </button>
                    <button
                        type="button"
                        className={`rich-text-btn${activeMarks.italic ? ' active' : ''}`}
                        onClick={() => exec('italic')}
                        disabled={disabled}
                        title="Italic"
                        aria-pressed={activeMarks.italic}
                    >
                        <span style={{ fontStyle: 'italic' }}>I</span>
                    </button>
                    <button
                        type="button"
                        className={`rich-text-btn${activeMarks.underline ? ' active' : ''}`}
                        onClick={() => exec('underline')}
                        disabled={disabled}
                        title="Underline"
                        aria-pressed={activeMarks.underline}
                    >
                        <span style={{ textDecoration: 'underline' }}>U</span>
                    </button>
                </div>

                <div className="rich-text-divider" />

                <div className="rich-text-group">
                    <select
                        className="rich-text-size-select"
                        aria-label="Font size in pixels"
                        disabled={disabled}
                        defaultValue=""
                        onChange={(e) => {
                            if (e.target.value) applyFontSize(e.target.value)
                            e.target.value = ''
                        }}
                    >
                        <option value="" disabled>Size</option>
                        {SIZES.map((px) => (
                            <option key={px} value={px}>{px}px</option>
                        ))}
                    </select>
                </div>

                <div className="rich-text-divider" />

                <div className="rich-text-group">
                    {COLORS.map((hex) => (
                        <button
                            key={hex}
                            type="button"
                            onClick={() => exec('foreColor', hex)}
                            disabled={disabled}
                            title={hex}
                            aria-label={`Set text color to ${hex}`}
                            className="rich-text-color-swatch"
                            style={{ '--swatch-color': hex }}
                        />
                    ))}

                    <label className="rich-text-color-picker" title="Custom color">
                        <input
                            type="color"
                            aria-label="Custom text color"
                            disabled={disabled}
                            defaultValue="#1A1A1A"
                            onInput={(e) => exec('foreColor', e.target.value)}
                        />
                    </label>
                </div>

                <div className="rich-text-divider" />

                <button type="button" className="rich-text-btn rich-text-clear" onClick={() => exec('removeFormat')} disabled={disabled} title="Clear formatting">
                    Clear
                </button>
            </div>

            <div
                ref={ref}
                className="rich-text-body"
                contentEditable={!disabled}
                onInput={() => onChange(ref.current?.innerHTML || '')}
                data-placeholder={placeholder}
                suppressContentEditableWarning
            />
        </div>
    )
}

export default RichTextEditor
