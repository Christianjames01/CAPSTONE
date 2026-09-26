#!/usr/bin/env node
// Load test: N students request a document at the same moment.
//
// Runs against the SELF-HOSTED test copy (the VM), never the live site:
// it creates N temporary student accounts, then all of them at once
//   1. sign in,
//   2. open their dashboard (read their own requests),
//   3. submit a document request,
//   4. reload their request list,
// and reports success rate and response times (median / 95th percentile /
// max) per step. Everything it created is deleted at the end.
//
// No dependencies -- plain Node 18+ fetch. Usage (on the VM):
//   SUPABASE_URL=http://localhost:8000 ANON_KEY=... SERVICE_ROLE_KEY=... \
//     node scripts/load-test.mjs --students 100

const args = process.argv.slice(2)
const argValue = (name, fallback) => {
    const i = args.indexOf(name)
    return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}

const URL_BASE = (process.env.SUPABASE_URL || '').replace(/\/+$/, '')
const ANON = process.env.ANON_KEY
const SERVICE = process.env.SERVICE_ROLE_KEY
const STUDENTS = Math.max(1, Math.min(500, Number(argValue('--students', 100))))
const KEEP = args.includes('--keep')

if (!URL_BASE || !ANON || !SERVICE) {
    console.error('Set SUPABASE_URL, ANON_KEY and SERVICE_ROLE_KEY.')
    process.exit(1)
}
if (/supabase\.co/i.test(URL_BASE) && !args.includes('--allow-cloud')) {
    console.error(`Refusing to load-test ${URL_BASE}: that is the live database. Use the VM copy (http://localhost:8000).`)
    process.exit(1)
}

const RUN_ID = Date.now().toString(36)
const PASSWORD = `LoadTest-${RUN_ID}-Aa1!`

// ---------------------------------------------------------------- helpers

async function call(method, path, { key = ANON, token, body, prefer } = {}) {
    const headers = { apikey: key, Authorization: `Bearer ${token || key}` }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (prefer) headers.Prefer = prefer
    const res = await fetch(URL_BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
    const text = await res.text()
    let data = null
    try { data = text ? JSON.parse(text) : null } catch { data = text }
    if (!res.ok) {
        const message = (data && (data.message || data.msg || data.error_description || data.error)) || text || res.statusText
        const err = new Error(`${res.status} ${message}`)
        err.status = res.status
        throw err
    }
    return data
}

const admin = (method, path, body, prefer) => call(method, path, { key: SERVICE, body, prefer })

async function timed(fn) {
    const start = performance.now()
    await fn()
    return performance.now() - start
}

const percentile = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] : 0)
const ms = (n) => `${Math.round(n)} ms`

async function inBatches(items, size, fn) {
    const results = []
    for (let i = 0; i < items.length; i += size) {
        results.push(...(await Promise.all(items.slice(i, i + size).map(fn))))
    }
    return results
}

// ------------------------------------------------------------------ setup

async function setup() {
    const [template] = await admin('GET', '/rest/v1/students?select=college_id,program_id,year_level&college_id=not.is.null&program_id=not.is.null&limit=1')
    if (!template) throw new Error('Need at least one existing student with a college and program to copy.')

    const [documentType] = await admin('GET', '/rest/v1/document_types?select=document_type_id,document_name,fee&is_available=eq.true&order=document_name&limit=1')
    if (!documentType) throw new Error('Need at least one available document type.')

    console.log(`Creating ${STUDENTS} temporary test students (run ${RUN_ID})…`)

    const students = await inBatches([...Array(STUDENTS).keys()], 10, async (i) => {
        const email = `loadtest-${RUN_ID}-${i}@loadtest.invalid`
        const user = await admin('POST', '/auth/v1/admin/users', {
            email,
            password: PASSWORD,
            email_confirm: true,
            user_metadata: { first_name: 'Load', last_name: `Test ${i}` },
        })
        const userId = user.id || user.user?.id

        // Profile row (usually made by a signup trigger) must be an active student.
        await admin('POST', '/rest/v1/profiles?on_conflict=user_id', {
            user_id: userId, first_name: 'Load', last_name: `Test ${i}`, email, role: 'student', status: 'active',
        }, 'resolution=merge-duplicates,return=minimal').catch(() => {})

        const studentRow = {
            user_id: userId,
            student_number: `LT-${RUN_ID}-${i}`,
            college_id: template.college_id,
            program_id: template.program_id,
            year_level: template.year_level,
            enrollment_status: 'active',
            verification_status: 'verified',
        }
        let inserted
        try {
            inserted = await admin('POST', '/rest/v1/students', studentRow, 'return=representation')
        } catch (err) {
            if (!/verification_status/.test(err.message)) throw err
            delete studentRow.verification_status
            inserted = await admin('POST', '/rest/v1/students', studentRow, 'return=representation')
        }
        return { email, userId, studentId: inserted[0].student_id }
    })

    return { students, documentType }
}

// ----------------------------------------------------------- the load run

async function studentFlow(student, documentType, timings) {
    let token
    timings.signIn.push(await timed(async () => {
        const session = await call('POST', '/auth/v1/token?grant_type=password', { body: { email: student.email, password: PASSWORD } })
        token = session.access_token
    }))

    timings.dashboard.push(await timed(() =>
        call('GET', `/rest/v1/document_requests?select=request_id,status,requested_at&student_id=eq.${student.studentId}&order=requested_at.desc`, { token })))

    const request = {
        student_id: student.studentId,
        document_type_id: documentType.document_type_id,
        quantity: 1,
        unit_fee: Number(documentType.fee || 0),
        purpose: 'Load test',
        status: 'pending',
    }
    timings.submit.push(await timed(async () => {
        try {
            await call('POST', '/rest/v1/document_requests', { token, body: { ...request, priority: 'normal' }, prefer: 'return=minimal' })
        } catch (err) {
            if (!/priority/.test(err.message)) throw err
            await call('POST', '/rest/v1/document_requests', { token, body: request, prefer: 'return=minimal' })
        }
    }))

    timings.list.push(await timed(() =>
        call('GET', `/rest/v1/document_requests?select=request_id,request_number,status,requested_at&student_id=eq.${student.studentId}`, { token })))
}

// ---------------------------------------------------------------- cleanup

async function cleanup(students) {
    if (KEEP || students.length === 0) return
    console.log('\nCleaning up test data…')
    const ids = students.map((s) => s.studentId).join(',')

    const requests = await admin('GET', `/rest/v1/document_requests?select=request_id&student_id=in.(${ids})`).catch(() => [])
    const requestIds = (requests || []).map((r) => r.request_id)
    for (let i = 0; i < requestIds.length; i += 50) {
        const chunk = requestIds.slice(i, i + 50).join(',')
        await admin('DELETE', `/rest/v1/notifications?related_request_id=in.(${chunk})`).catch(() => {})
        await admin('DELETE', `/rest/v1/document_requests?request_id=in.(${chunk})`).catch((e) => console.warn('  requests:', e.message))
    }
    await admin('DELETE', `/rest/v1/students?student_id=in.(${ids})`).catch((e) => console.warn('  students:', e.message))
    await inBatches(students, 10, (s) => admin('DELETE', `/auth/v1/admin/users/${s.userId}`).catch((e) => console.warn('  user:', e.message)))
    console.log(`Removed ${students.length} test students and ${requestIds.length} test requests.`)
}

// ------------------------------------------------------------------- main

async function main() {
    console.log(`CertiChain load test → ${URL_BASE}`)
    let students = []

    try {
        const setupResult = await setup()
        students = setupResult.students

        const timings = { signIn: [], dashboard: [], submit: [], list: [] }
        const errors = {}

        console.log(`\nGo: ${students.length} students signing in and requesting "${setupResult.documentType.document_name}" at the same time…`)
        const start = performance.now()
        const results = await Promise.allSettled(students.map((s) => studentFlow(s, setupResult.documentType, timings)))
        const totalSeconds = (performance.now() - start) / 1000

        let ok = 0
        for (const r of results) {
            if (r.status === 'fulfilled') ok += 1
            else errors[r.reason.message] = (errors[r.reason.message] || 0) + 1
        }

        console.log('\n================ RESULTS ================')
        console.log(`Students:        ${students.length} at once`)
        console.log(`Completed flow:  ${ok}/${students.length} (${((ok / students.length) * 100).toFixed(1)}%)`)
        console.log(`Total time:      ${totalSeconds.toFixed(2)} s`)
        console.log(`Throughput:      ${((ok * 4) / totalSeconds).toFixed(1)} requests/second\n`)
        console.log('Step               median     95th %      max')
        for (const [label, list] of [['Sign in', timings.signIn], ['Open dashboard', timings.dashboard], ['Submit request', timings.submit], ['Reload list', timings.list]]) {
            const sorted = [...list].sort((a, b) => a - b)
            console.log(`${label.padEnd(16)} ${ms(percentile(sorted, 50)).padStart(9)} ${ms(percentile(sorted, 95)).padStart(10)} ${ms(sorted[sorted.length - 1] || 0).padStart(9)}`)
        }
        if (Object.keys(errors).length) {
            console.log('\nErrors:')
            for (const [message, count] of Object.entries(errors)) console.log(`  ${count} × ${message}`)
            if (Object.keys(errors).some((m) => m.startsWith('429'))) {
                console.log('  (429 = the auth server’s sign-in rate limit; wait 5 minutes between runs.)')
            }
        }
        console.log('=========================================')
    } catch (err) {
        console.error('\nLoad test stopped:', err.message)
        process.exitCode = 1
    } finally {
        await cleanup(students)
    }
}

main()
