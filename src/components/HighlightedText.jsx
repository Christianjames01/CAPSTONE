import './HighlightedText.css'

const FROM_TO_PATTERN = /from\s+"([^"]+)"\s+to\s+"([^"]+)"/i
const SEGMENT_PATTERN = /("[^"]+"|₱[\d,]+(?:\.\d+)?)/g

// Wraps quoted values and peso amounts in styled spans so they stand out
// from the surrounding sentence.
function highlightSegments(text, keyPrefix) {
    if (!text) return []

    return text.split(SEGMENT_PATTERN).filter(Boolean).map((segment, i) => {
        const key = `${keyPrefix}-${i}`

        if (segment.startsWith('"') && segment.endsWith('"')) {
            return <span key={key} className="log-highlight-quote">{segment}</span>
        }

        if (segment.startsWith('₱')) {
            return <span key={key} className="log-highlight-amount">{segment}</span>
        }

        return segment
    })
}

// Renders an activity log description with the "what changed" part
// highlighted -- old value struck through, new value bolded in green for
// a "from X to Y" style change, otherwise just quoted values/amounts.
function HighlightedText({ text }) {
    if (!text) return null

    const match = text.match(FROM_TO_PATTERN)

    if (!match) {
        return <>{highlightSegments(text, 'seg')}</>
    }

    const [fullMatch, oldValue, newValue] = match
    const before = text.slice(0, match.index)
    const after = text.slice(match.index + fullMatch.length)

    return (
        <>
            {highlightSegments(before, 'before')}
            <span className="log-highlight-change">
                from <span className="log-highlight-old">"{oldValue}"</span> to <span className="log-highlight-new">"{newValue}"</span>
            </span>
            {highlightSegments(after, 'after')}
        </>
    )
}

export default HighlightedText
