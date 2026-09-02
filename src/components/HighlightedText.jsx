import './HighlightedText.css'

const FROM_TO_PATTERN = /from\s+"([^"]+)"\s+to\s+"([^"]+)"/gi
const SEGMENT_PATTERN = /("[^"]+"|₱[\d,]+(?:\.\d+)?)/g

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

function HighlightedText({ text }) {
    if (!text) return null

    const regex = new RegExp(FROM_TO_PATTERN)
    const parts = []
    let lastIndex = 0
    let match
    let i = 0

    while ((match = regex.exec(text)) !== null) {
        const [fullMatch, oldValue, newValue] = match

        parts.push(...highlightSegments(text.slice(lastIndex, match.index), `seg-${i}`))
        parts.push(
            <span key={`ft-${i}`} className="log-highlight-change">
                from <span className="log-highlight-old">"{oldValue}"</span> to <span className="log-highlight-new">"{newValue}"</span>
            </span>
        )

        lastIndex = match.index + fullMatch.length
        i++
    }

    parts.push(...highlightSegments(text.slice(lastIndex), 'seg-tail'))

    return <>{parts}</>
}

export default HighlightedText
