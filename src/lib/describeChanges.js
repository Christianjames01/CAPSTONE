export function describeChanges(fields) {
    return fields
        .filter(([, oldValue, newValue]) => (oldValue || '').toString() !== (newValue || '').toString())
        .map(([label, oldValue, newValue]) => `${label} from "${oldValue || 'none'}" to "${newValue || 'none'}"`)
        .join(', ')
}
