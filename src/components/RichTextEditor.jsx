import { useEffect, useRef, useState } from 'react'
import './RichTextEditor.css'

const COLORS = [
    '#1A1A1A', '#57616F', '#C8102E', '#B45309',
    '#1E8A5F', '#123B78', '#6FA8F5', '#8A1F2B',
]

// Real pixel sizes rather than vague labels -- 14px matches the editor's own
// default body text, so it's included as the implicit "normal" size.
const SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 40]

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const MOD = IS_MAC ? '⌘' : 'Ctrl+'

const svgProps = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
}

const Icons = {
    bold: <svg {...svgProps}><path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z" /></svg>,
    italic: <svg {...svgProps}><path d="M14 5h-4M14 19h-4M14.5 5 9.5 19" /></svg>,
    underline: <svg {...svgProps}><path d="M7 4v7a5 5 0 0 0 10 0V4M5 20h14" /></svg>,
    bulletList: <svg {...svgProps}><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" fill="currentColor" /><circle cx="4.5" cy="12" r="1" fill="currentColor" /><circle cx="4.5" cy="18" r="1" fill="currentColor" /></svg>,
    numberList: <svg {...svgProps}><path d="M10 6h10M10 12h10M10 18h10M4 5l1.5-1v5M3.5 14.5a1.5 1.5 0 0 1 3 .5c0 1-3 2.5-3 3.5h3" /></svg>,
    undo: <svg {...svgProps}><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>,
    redo: <svg {...svgProps}><path d="m15 14 5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" /></svg>,
    clear: <svg {...svgProps}><path d="M4 7V5h13v2M10.5 5 8 19M6 19h5M15 14l5 5M20 14l-5 5" /></svg>,
    textSize: <svg {...svgProps}><path d="M4 7V5h10v2M9 5v14M7 19h4M14 12v-1h6v1M17 11v8M15.5 19h3" /></svg>,
    chevron: <svg {...svgProps}><path d="m6 9 6 6 6-6" /></svg>,
}

function plainText(html) {
    return (html || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
}

// A minimal formatting toolbar over a contentEditable div, so the registrar
// head can bold/italicize/underline/color/size announcement text without a
// heavy rich-text library. Uses the (deprecated but universally supported)
// execCommand API -- acceptable here since this is a small internal admin
// tool, not a product-facing editor. The resulting HTML is untrusted and
// must be sanitized (see lib/sanitizeHtml.js) before it's stored or shown.
//
// `singleLine` is for short fields like a title: Enter is ignored and the
// list buttons are hidden.
function RichTextEditor({ value, onChange, disabled, placeholder, editorKey, id, ariaLabel, singleLine = false, showCount = false }) {
    const ref = useRef(null)
    const savedRange = useRef(null)
    const colorMenuRef = useRef(null)

    const [activeMarks, setActiveMarks] = useState({ bold: false, italic: false, underline: false, ul: false, ol: false })
    const [colorOpen, setColorOpen] = useState(false)
    const [lastColor, setLastColor] = useState(COLORS[2])
    const [text, setText] = useState(() => plainText(value))

    // Only set innerHTML on mount (and when `editorKey` changes, e.g.
    // switching from "new" to editing a different announcement) -- doing
    // it on every value change would fight the browser's own cursor
    // position while typing.
    useEffect(() => {
        if (ref.current) {
            ref.current.innerHTML = value || ''
            setText(plainText(value))
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editorKey])

    // Reflect whatever formatting is active right where the cursor/selection
    // currently sits, the same way a real editor's toolbar highlights the
    // active buttons. Also remember the selection, because using the size
    // dropdown or color input moves focus out of the editor and would
    // otherwise lose which text the admin had highlighted.
    useEffect(() => {
        const handleSelectionChange = () => {
            const selection = document.getSelection()
            if (!ref.current || !selection || selection.rangeCount === 0) return
            const range = selection.getRangeAt(0)
            if (!ref.current.contains(range.commonAncestorContainer)) return

            savedRange.current = range.cloneRange()
            setActiveMarks({
                bold: document.queryCommandState('bold'),
                italic: document.queryCommandState('italic'),
                underline: document.queryCommandState('underline'),
                ul: document.queryCommandState('insertUnorderedList'),
                ol: document.queryCommandState('insertOrderedList'),
            })
        }

        document.addEventListener('selectionchange', handleSelectionChange)
        return () => document.removeEventListener('selectionchange', handleSelectionChange)
    }, [])

    // Close the color menu on outside click or Escape.
    useEffect(() => {
        if (!colorOpen) return

        const onPointerDown = (e) => {
            if (colorMenuRef.current && !colorMenuRef.current.contains(e.target)) setColorOpen(false)
        }
        const onKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation()
                setColorOpen(false)
            }
        }

        document.addEventListener('pointerdown', onPointerDown)
        document.addEventListener('keydown', onKeyDown, true)
        return () => {
            document.removeEventListener('pointerdown', onPointerDown)
            document.removeEventListener('keydown', onKeyDown, true)
        }
    }, [colorOpen])

    const emitChange = () => {
        const html = ref.current?.innerHTML || ''
        setText(plainText(html))
        onChange(html)
    }

    const restoreSelection = () => {
        ref.current?.focus()
        const range = savedRange.current
        if (!range) return
        const selection = document.getSelection()
        selection.removeAllRanges()
        selection.addRange(range)
    }

    const exec = (command, arg) => {
        if (disabled) return
        restoreSelection()
        document.execCommand(command, false, arg)
        emitChange()
    }

    const applyColor = (hex) => {
        setLastColor(hex)
        exec('foreColor', hex)
    }

    // execCommand('fontSize', ...) only understands the legacy 1-7 <font>
    // scale, not real pixel numbers -- apply size 7 as a marker, then swap
    // every resulting <font size="7"> for a <span style="font-size:Npx">
    // so the dropdown's numbers are the actual rendered size, not a guess.
    const applyFontSize = (px) => {
        if (disabled) return
        restoreSelection()
        document.execCommand('fontSize', false, '7')

        ref.current?.querySelectorAll('font[size="7"]').forEach((el) => {
            el.removeAttribute('size')
            el.style.fontSize = `${px}px`
        })

        emitChange()
    }

    // Pasting from Word, Google Docs, or a web page drags in fonts, classes,
    // and layout markup the sanitizer would mostly strip anyway -- paste
    // plain text and let the admin format it with the toolbar instead.
    const handlePaste = (e) => {
        e.preventDefault()
        let pasted = e.clipboardData.getData('text/plain')
        if (singleLine) pasted = pasted.replace(/\s*\n\s*/g, ' ')
        document.execCommand('insertText', false, pasted)
    }

    const handleKeyDown = (e) => {
        if (singleLine && e.key === 'Enter') e.preventDefault()
    }

    // Keep focus (and the selection) inside the editor when a toolbar button
    // is pressed, instead of letting the button steal it.
    const keepFocus = (e) => e.preventDefault()

    const toolButton = ({ command, mark, label, shortcut, icon }) => (
        <button
            type="button"
            className={`rich-text-btn${mark && activeMarks[mark] ? ' active' : ''}`}
            onMouseDown={keepFocus}
            onClick={() => exec(command)}
            disabled={disabled}
            title={shortcut ? `${label} (${shortcut})` : label}
            aria-label={label}
            aria-pressed={mark ? activeMarks[mark] : undefined}
        >
            {icon}
        </button>
    )

    const words = text ? text.split(/\s+/).length : 0

    return (
        <div className={`rich-text-editor${disabled ? ' is-disabled' : ''}${singleLine ? ' is-single-line' : ''}${text ? '' : ' is-empty'}`}>
            <div className="rich-text-toolbar" role="toolbar" aria-label="Text formatting">
                <div className="rich-text-group">
                    {toolButton({ command: 'bold', mark: 'bold', label: 'Bold', shortcut: `${MOD}B`, icon: Icons.bold })}
                    {toolButton({ command: 'italic', mark: 'italic', label: 'Italic', shortcut: `${MOD}I`, icon: Icons.italic })}
                    {toolButton({ command: 'underline', mark: 'underline', label: 'Underline', shortcut: `${MOD}U`, icon: Icons.underline })}
                </div>

                <div className="rich-text-divider" />

                <div className="rich-text-group">
                    <label className="rich-text-select-wrap" title="Text size">
                        <span className="rich-text-select-icon">{Icons.textSize}</span>
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
                        <span className="rich-text-select-chevron">{Icons.chevron}</span>
                    </label>

                    <div className="rich-text-color" ref={colorMenuRef}>
                        <div className="rich-text-split">
                            <button
                                type="button"
                                className="rich-text-btn rich-text-color-apply"
                                onMouseDown={keepFocus}
                                onClick={() => applyColor(lastColor)}
                                disabled={disabled}
                                title="Text color"
                                aria-label={`Apply text color ${lastColor}`}
                            >
                                <span className="rich-text-color-letter">A</span>
                                <span className="rich-text-color-bar" style={{ background: lastColor }} />
                            </button>
                            <button
                                type="button"
                                className="rich-text-btn rich-text-color-toggle"
                                onMouseDown={keepFocus}
                                onClick={() => setColorOpen((open) => !open)}
                                disabled={disabled}
                                title="More colors"
                                aria-label="Choose text color"
                                aria-haspopup="true"
                                aria-expanded={colorOpen}
                            >
                                {Icons.chevron}
                            </button>
                        </div>

                        {colorOpen && (
                            <div className="rich-text-color-menu" role="menu" aria-label="Text colors">
                                <div className="rich-text-color-grid">
                                    {COLORS.map((hex) => (
                                        <button
                                            key={hex}
                                            type="button"
                                            role="menuitem"
                                            onMouseDown={keepFocus}
                                            onClick={() => { applyColor(hex); setColorOpen(false) }}
                                            title={hex}
                                            aria-label={`Set text color to ${hex}`}
                                            className={`rich-text-color-swatch${hex === lastColor ? ' is-current' : ''}`}
                                            style={{ '--swatch-color': hex }}
                                        />
                                    ))}
                                </div>

                                <label className="rich-text-color-custom">
                                    <span className="rich-text-color-picker" aria-hidden="true" />
                                    Custom color
                                    <input
                                        type="color"
                                        aria-label="Custom text color"
                                        value={lastColor}
                                        onChange={(e) => applyColor(e.target.value)}
                                    />
                                </label>
                            </div>
                        )}
                    </div>
                </div>

                {!singleLine && (
                    <>
                        <div className="rich-text-divider" />

                        <div className="rich-text-group">
                            {toolButton({ command: 'insertUnorderedList', mark: 'ul', label: 'Bulleted list', icon: Icons.bulletList })}
                            {toolButton({ command: 'insertOrderedList', mark: 'ol', label: 'Numbered list', icon: Icons.numberList })}
                        </div>
                    </>
                )}

                <div className="rich-text-group rich-text-group-end">
                    {toolButton({ command: 'undo', label: 'Undo', shortcut: `${MOD}Z`, icon: Icons.undo })}
                    {toolButton({ command: 'redo', label: 'Redo', shortcut: IS_MAC ? '⇧⌘Z' : 'Ctrl+Y', icon: Icons.redo })}
                    {toolButton({ command: 'removeFormat', label: 'Clear formatting', icon: Icons.clear })}
                </div>
            </div>

            <div
                ref={ref}
                id={id}
                className="rich-text-body"
                contentEditable={!disabled}
                role="textbox"
                aria-multiline={!singleLine}
                aria-label={ariaLabel || placeholder}
                aria-disabled={disabled || undefined}
                onInput={emitChange}
                onPaste={handlePaste}
                onKeyDown={handleKeyDown}
                data-placeholder={placeholder}
                suppressContentEditableWarning
            />

            {showCount && (
                <div className="rich-text-footer" aria-live="polite">
                    {words} {words === 1 ? 'word' : 'words'} · {text.length} {text.length === 1 ? 'character' : 'characters'}
                </div>
            )}
        </div>
    )
}

export default RichTextEditor
