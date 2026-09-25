import { useEffect, useState } from 'react'

// useState that survives a page refresh, for long forms like Register.
// Stored in sessionStorage: it's kept while the tab is open (so a refresh
// restores what was typed) and discarded when the tab closes, which is the
// safer choice on shared school computers. Never use it for passwords.
//
// Keys look like "draft:<form>:<field>"; clearDraft(form) removes them all,
// e.g. after the form is submitted successfully.

function storageKey(form, field) {
    return `draft:${form}:${field}`
}

export function useDraftState(form, field, initialValue) {
    const [value, setValue] = useState(() => {
        try {
            const saved = sessionStorage.getItem(storageKey(form, field))
            return saved !== null ? JSON.parse(saved) : initialValue
        } catch {
            return initialValue
        }
    })

    useEffect(() => {
        try {
            sessionStorage.setItem(storageKey(form, field), JSON.stringify(value))
        } catch {
            // Storage full or blocked (e.g. private mode): the form still works,
            // it just won't survive a refresh.
        }
    }, [form, field, value])

    return [value, setValue]
}

export function clearDraft(form) {
    try {
        const prefix = `draft:${form}:`
        Object.keys(sessionStorage)
            .filter((key) => key.startsWith(prefix))
            .forEach((key) => sessionStorage.removeItem(key))
    } catch {
        // Nothing to clear if storage isn't available.
    }
}
