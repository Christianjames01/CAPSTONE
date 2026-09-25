// Shared rules for the head's "Team workload" views (dashboard card and the
// Request Assignments page), so both agree on who is overloaded and what a
// fair rebalance looks like.

// Requests nobody has started working on yet. Only these are suggested for
// moving: once an employee is processing a request, is waiting on missing
// requirements, or has it ready for claiming, moving it would lose context.
export const MOVABLE_STATUSES = ['pending', 'payment_pending', 'receipt_uploaded', 'receipt_verified']

export function averageLoad(counts) {
    return counts.length ? counts.reduce((sum, n) => sum + n, 0) / counts.length : 0
}

// Clearly above the team average -- not just one or two over.
export function isOverloaded(count, average, employeeCount) {
    return employeeCount > 1 && count - average >= 2 && count > average * 1.5
}

// Proposes moves that even out open requests: repeatedly takes the newest
// not-yet-started request from the busiest employee and gives it to the
// least busy one, until nobody is more than one request apart (or nothing
// movable is left).
//
// employees: [{ employee_id, name }]
// requests:  open requests, [{ request_id, assigned_employee_id, status, requested_at, ... }]
// Returns [{ request, fromId, fromName, toId, toName }]
export function suggestRebalance(employees, requests) {
    if (employees.length < 2) return []

    const load = Object.fromEntries(employees.map((e) => [e.employee_id, 0]))
    const movable = Object.fromEntries(employees.map((e) => [e.employee_id, []]))
    const nameOf = Object.fromEntries(employees.map((e) => [e.employee_id, e.name]))

    for (const r of requests) {
        if (!(r.assigned_employee_id in load)) continue
        load[r.assigned_employee_id] += 1
        if (MOVABLE_STATUSES.includes(r.status)) movable[r.assigned_employee_id].push(r)
    }

    // Newest first: the oldest requests stay with whoever has had them longest.
    for (const list of Object.values(movable)) {
        list.sort((a, b) => new Date(b.requested_at) - new Date(a.requested_at))
    }

    const moves = []
    const ids = Object.keys(load)

    for (let guard = 0; guard < 500; guard += 1) {
        const donors = ids.filter((id) => movable[id].length > 0).sort((a, b) => load[b] - load[a])
        if (donors.length === 0) break

        const from = donors[0]
        const to = ids.filter((id) => id !== from).sort((a, b) => load[a] - load[b])[0]
        if (load[from] - load[to] <= 1) break

        const request = movable[from].shift()
        load[from] -= 1
        load[to] += 1
        moves.push({ request, fromId: from, fromName: nameOf[from], toId: to, toName: nameOf[to] })
    }

    return moves
}
