// "Claiming counter / window" on claim schedules: where the student picks
// up their document. Shared by the admin and employee Claim Schedule forms
// and the student's schedule views.

export const CLAIM_COUNTER_SUGGESTIONS = [
    'Registrar Window 1',
    'Registrar Window 2',
    'Registrar Window 3',
    'Releasing Counter',
]

// Runs an insert/update with `payload`. If the database doesn't have the
// claiming_counter column yet (migration 20260925000000 not applied), retry
// without it so scheduling itself never breaks -- the counter just isn't
// saved until the column exists.
export async function saveWithClaimCounter(payload, run) {
    const result = await run(payload)

    if (result.error && /claiming_counter/.test(result.error.message || '')) {
        console.warn('claiming_counter column missing; saving schedule without it.')
        const rest = { ...payload }
        delete rest.claiming_counter
        return run(rest)
    }

    return result
}
