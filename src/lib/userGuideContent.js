// In-app user manual content, per role. Each section: { id, title, summary,
// steps: [string], tips?: [string] }. Rendered by components/UserGuide.jsx.

const STATUS_STEPS = [
    'Pending — your request was received and is waiting for review.',
    'Payment Pending — pay the fee at the Finance Office, then upload your official receipt.',
    'Receipt Uploaded — the Registrar is checking your receipt.',
    'Receipt Verified — payment confirmed; your document will be processed.',
    'Processing — your document is being prepared.',
    'Lacking Requirements — something is missing; open the request to see what to upload.',
    'Ready for Claiming — pick up your document on the scheduled date and time.',
    'Completed — the document was released.',
    'Rejected / Cancelled — the request was stopped; the reason is shown on the request.',
]

export const STUDENT_GUIDE = [
    {
        id: 'getting-started',
        title: 'Getting started',
        summary: 'Create your account and get it verified.',
        steps: [
            'Open the site and choose Register. Fill in every field — your student ID and phone number must not already be used by another account.',
            'Confirm your email address using the link sent to your inbox.',
            'Log in. Your account starts as “pending” until the Registrar verifies your student details; you will be notified once approved.',
            'Once verified, the full student portal opens: Dashboard, Request a Document, My Requests, Claim Schedule and more.',
        ],
        tips: ['Your form is kept if the page refreshes while registering, so you won’t lose what you typed.'],
    },
    {
        id: 'request',
        title: 'Requesting a document',
        summary: 'Submit a request for a TOR, certificate, diploma copy and more.',
        steps: [
            'Go to Request a Document and choose the document. A sample preview on the right shows what it looks like.',
            'Enter the number of copies and your purpose, if asked.',
            'Submit. Your request appears under My Requests with its request number (e.g. REQ-000012).',
        ],
        tips: ['If no employee is assigned to your program yet, your request still goes through — the Registrar Head assigns it.'],
    },
    {
        id: 'payment',
        title: 'Paying and uploading your receipt',
        summary: 'Pay in person at the Finance Office, then upload the official receipt.',
        steps: [
            'When the status becomes Payment Pending, go to the HCDC Finance Office and pay the amount shown on the request in person. CertiChain does not accept online payments.',
            'Keep the official receipt (OR) — you’ll bring the original when you claim your document.',
            'Go to Upload Receipt (or open the request) and upload a clear photo or scan of the official receipt.',
            'Wait for verification. If the receipt is marked invalid, the reason is shown — upload a clearer or corrected copy. You don’t pay again.',
        ],
    },
    {
        id: 'requirements',
        title: 'Uploading requirements',
        summary: 'Some documents need supporting files.',
        steps: [
            'Open the request. If it lists required documents, use Upload Requirements to attach each one.',
            'If a file is rejected or the status turns Lacking Requirements, read the reason and upload a new file.',
        ],
    },
    {
        id: 'status',
        title: 'Tracking your request',
        summary: 'What each status means.',
        steps: STATUS_STEPS,
        tips: ['You get a notification each time the status changes, and My Requests updates on its own.'],
    },
    {
        id: 'claiming',
        title: 'Claiming your document',
        summary: 'Pick up on your scheduled date, or ask to reschedule.',
        steps: [
            'When your document is Ready for Claiming, a claiming date, time and window are set — see Claim Schedule or the request page.',
            'Come on that date with a valid school or government ID.',
            'Can’t make it? Request a reschedule from the request page with a reason; the Registrar sets a new date.',
            'If you miss your appointment you’ll be notified and can get a new schedule.',
        ],
    },
    {
        id: 'representative',
        title: 'Letting someone claim for you',
        summary: 'Authorize a representative if you can’t claim in person.',
        steps: [
            'Write an authorization letter naming your representative and the document, and sign it.',
            'Open the request and, under Claiming Representative, choose Add a representative.',
            'Enter their name, relationship and contact number, and upload the signed letter and their valid ID.',
            'Wait for approval — you’ll be notified. If not approved, the reason is shown and you can submit again.',
            'Your representative brings the original signed letter and their valid ID when claiming.',
        ],
    },
    {
        id: 'verify',
        title: 'Verifying your document',
        summary: 'Anyone can check that a document is genuine.',
        steps: [
            'Each released document has a credential number and QR code.',
            'Scanning the QR (or entering the number on the site’s Verify page) shows whether it is Verified, Revoked or Tampered.',
        ],
    },
    {
        id: 'account',
        title: 'Messages, notifications and your account',
        summary: 'Stay in touch with the Registrar and manage your profile.',
        steps: [
            'Messages lets you chat with the Registrar’s Office. You can edit or unsend your own messages.',
            'Notifications lists every update about your requests.',
            'Profile lets you review your details and change your password. Forgot it? Use “Forgot password” on the login page.',
            'Your account can only be signed in on one device at a time; signing in elsewhere signs out the other device.',
        ],
    },
]

export const EMPLOYEE_GUIDE = [
    {
        id: 'dashboard',
        title: 'Your dashboard',
        summary: 'What needs your attention today.',
        steps: [
            'The Dashboard shows your open requests, what’s waiting on you, and today’s claiming appointments.',
            'Pages update on their own when requests change — no need to refresh.',
        ],
    },
    {
        id: 'assigned',
        title: 'Assigned requests',
        summary: 'Requests routed to you by program.',
        steps: [
            'Assigned Requests lists your requests with the student’s name and the date and time requested.',
            'Open a request to see its details, receipt, requirements, history and notes.',
        ],
    },
    {
        id: 'verification',
        title: 'Verifying receipts',
        summary: 'Confirm payments so processing can start.',
        steps: [
            'Open the request (or Request Verification) and view the uploaded official receipt.',
            'Verify it if it’s valid, or mark it invalid with a reason — the student sees the reason and re-uploads.',
        ],
        tips: ['Only employees with full access see Request Verification and Document Processing.'],
    },
    {
        id: 'requirements',
        title: 'Reviewing requirements',
        summary: 'Check supporting files.',
        steps: [
            'On the request page, open each uploaded requirement.',
            'Approve it, or reject it with a reason. Use Lacking Requirements when something is missing.',
        ],
    },
    {
        id: 'processing',
        title: 'Processing and releasing documents',
        summary: 'Move the request forward and generate the credential.',
        steps: [
            'Start processing once payment is verified.',
            'Generate the digital credential — it gets a credential number and QR code for verification.',
            'Set the request to Ready for Claiming and schedule the claiming date, time and window.',
            'Remarks you add to a status change are shown to the student.',
        ],
    },
    {
        id: 'claiming',
        title: 'Claiming and the release window',
        summary: 'Release documents to the right person.',
        steps: [
            'Claim Schedule lists requests that need a schedule and today’s appointments.',
            'Check the student’s ID. If a “Representative” badge shows, the named person may claim only when it says Approved — check their original signed letter and valid ID.',
            'Mark the appointment as claimed to release the document.',
            'Handle reschedule requests from the claim schedule page; the history of reschedules is kept.',
        ],
    },
    {
        id: 'representatives',
        title: 'Reviewing representatives',
        summary: 'Approve who may claim on a student’s behalf.',
        steps: [
            'You’re notified when a student on one of your requests names a representative.',
            'Open the request, view the authorization letter and valid ID under Authorized Representative.',
            'Approve, or choose Not approve with a reason (e.g. letter not signed). The student is notified either way.',
        ],
    },
    {
        id: 'notes',
        title: 'Staff notes',
        summary: 'Internal notes the student never sees.',
        steps: [
            'On any request, add a note under Staff Notes: General, Absence / coverage, Follow-up or Issue.',
            'Pin important notes to keep them on top. You can edit or delete your own notes.',
            'You’re notified when someone else adds a note to a request assigned to you.',
        ],
    },
    {
        id: 'other',
        title: 'Queue, messages and calendar',
        summary: 'Other everyday tools.',
        steps: [
            'Walk-in Queue calls the next walk-in number; the Queue Display screen shows it in the office.',
            'Messages lets you reply to students. Notifications collects everything addressed to you.',
            'Office Calendar shows holidays, office events and upcoming claiming dates.',
        ],
    },
]

export const HEAD_GUIDE = [
    {
        id: 'dashboard',
        title: 'Dashboard',
        summary: 'The office at a glance.',
        steps: [
            'See totals, requests by status, trends, team workload (with how long requests have waited) and recent activity with staff names.',
            'Everything updates live as requests come in.',
        ],
    },
    {
        id: 'employees',
        title: 'Managing employees',
        summary: 'Activate, assign and support your team.',
        steps: [
            'New employee accounts start inactive — activate them from Employees (you’re notified when one registers).',
            'Open an employee to edit details, set their program assignments, or set a temporary password; they must change it at their next login.',
            'Deactivate employees who leave; their requests can be reassigned.',
        ],
    },
    {
        id: 'students',
        title: 'Verifying students',
        summary: 'Approve new student accounts.',
        steps: [
            'Students lists registrations. Review a pending student’s details and approve or reject them.',
            'Open a student to edit a section of their details or see their request history.',
        ],
    },
    {
        id: 'documents',
        title: 'Document catalog',
        summary: 'What students can request.',
        steps: [
            'Documents lets you add or edit document types, fees, processing days and availability.',
            'Upload a real sample image per document — it appears on the landing page preview and on the student’s request page.',
            'Changes show on the public landing page right away.',
        ],
    },
    {
        id: 'assignments',
        title: 'Assignments and rebalancing',
        summary: 'Make sure every request has an owner.',
        steps: [
            'Request Assignments shows Programs Without an Employee — pick an employee to cover the program and its waiting requests.',
            'Assign individual or selected unassigned requests.',
            'Team workload shows each employee’s load; select an employee to move requests, or apply the Suggested rebalance.',
        ],
    },
    {
        id: 'requests',
        title: 'Overseeing requests',
        summary: 'Step in when needed.',
        steps: [
            'All Requests lists every request with student, document and date/time requested.',
            'On a request you can reassign the employee, override the status, add staff notes, and review a representative.',
        ],
    },
    {
        id: 'claiming',
        title: 'Claiming, calendar and receipts',
        summary: 'Scheduling and payments office-wide.',
        steps: [
            'Claim Schedules lists upcoming, missed and reschedule-requested appointments, with representative badges.',
            'Office Calendar manages holidays and events that block claiming dates.',
            'Official Receipts lists uploaded receipts to verify.',
            'Announcements publishes notices to students.',
        ],
    },
    {
        id: 'reports',
        title: 'Reports and exports',
        summary: 'Monthly figures for the office.',
        steps: [
            'Reports shows requests, fees collected, turnaround times, top documents and employee performance.',
            'Choose a period (this month, last month, this year or any month).',
            'Export Excel downloads a workbook (summary, monthly, by document, employees, full request list). Export PDF opens the print dialog — choose “Save as PDF”.',
        ],
    },
    {
        id: 'audit',
        title: 'Activity logs and security',
        summary: 'Who did what, and when.',
        steps: [
            'Activity Logs records staff actions (assignments, status changes, notes, reviews) with names and times.',
            'Issued credentials are signed; the public Verify page flags any that were altered as Tampered.',
        ],
    },
]
