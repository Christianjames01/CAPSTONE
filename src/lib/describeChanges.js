// Builds a "field from X to Y, field from A to B" fragment for activity log
// descriptions, so HighlightedText can highlight what actually changed.
// `fields` is an array of [label, oldValue, newValue] tuples; entries where
// old and new are the same (after treating null/'' as "none") are skipped.
export function describeChanges(fields) {
    return fields
        .filter(([, oldValue, newValue]) => (oldValue || '').toString() !== (newValue || '').toString())
        .map(([label, oldValue, newValue]) => `${label} from "${oldValue || 'none'}" to "${newValue || 'none'}"`)
        .join(', ')
}
