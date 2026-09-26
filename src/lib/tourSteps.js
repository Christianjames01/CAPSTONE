// Guided demo tour steps per portal (components/ProductTour.jsx).
// target: CSS selector to highlight (usually a sidebar link); null = a
// centered card. optional: skip the step when the target isn't on the page
// (e.g. links hidden for limited-access employees). action: a button on
// the last step that goes somewhere.

// Dispatched by the User Guide's "Start demo" button.
export const START_TOUR_EVENT = 'certichain:start-tour'

const link = (nav, path) => `.${nav} a[href="${path}"]`

export const STUDENT_TOUR = [
    {
        target: null,
        title: 'Welcome to CertiChain! 👋',
        body: 'Here’s a one-minute tour of how to request, pay for, track and claim your registrar documents. You can skip it anytime.',
    },
    {
        target: link('student-nav', '/student/dashboard'),
        title: 'Your dashboard',
        body: 'See your active requests, what you need to do next, and announcements from the Registrar.',
    },
    {
        target: link('student-nav', '/student/new-request'),
        title: '1. Request a document',
        body: 'Choose the document, the number of copies and your purpose. A sample preview shows what the document looks like.',
    },
    {
        target: link('student-nav', '/student/upload-receipt'),
        title: '2. Pay, then upload your receipt',
        body: 'Pay the fee in person at the HCDC Finance Office — there’s no online payment. Then upload a clear photo of your official receipt here so the Registrar can verify it.',
    },
    {
        target: link('student-nav', '/student/my-requests'),
        title: '3. Track your requests',
        body: 'Every request and its status, updated live. You’re notified each time something changes, and any missing requirements show up here.',
    },
    {
        target: link('student-nav', '/student/claim-schedule'),
        title: '4. Claim your document',
        body: 'When it’s ready you get a claiming date, time and window. Bring a valid ID and your original receipt — or authorize a representative from the request page.',
    },
    {
        target: link('student-nav', '/student/messages'),
        title: 'Message the Registrar',
        body: 'Chat with the staff handling your requests. Each person has their own conversation.',
    },
    {
        target: link('student-nav', '/student/notifications'),
        title: 'Notifications',
        body: 'Every update about your requests lands here.',
    },
    {
        target: link('student-nav', '/student/guide'),
        title: 'Need a refresher?',
        body: 'The User Guide has step-by-step help for everything, and a “Start demo” button to replay this tour.',
    },
    {
        target: null,
        title: 'You’re all set! 🎉',
        body: 'Start by requesting your first document. Remember: pay at the Finance Office, then upload your receipt.',
        action: { label: 'Request a document', to: '/student/new-request' },
    },
]

export const EMPLOYEE_TOUR = [
    {
        target: null,
        title: 'Welcome to CertiChain! 👋',
        body: 'A quick tour of how you’ll handle document requests, from verification to release. You can skip it anytime.',
    },
    {
        target: link('employee-nav', '/employee/dashboard'),
        title: 'Your dashboard',
        body: 'What needs your attention today: open requests, waiting items and today’s claiming appointments.',
    },
    {
        target: link('employee-nav', '/employee/requests'),
        title: 'Assigned requests',
        body: 'Requests routed to you by program, with the student and the time requested. Open one to see receipts, requirements, notes and history.',
    },
    {
        target: link('employee-nav', '/employee/verification'),
        optional: true,
        title: 'Verify receipts',
        body: 'Students pay at the Finance Office and upload their official receipt. Verify it, or mark it invalid with a reason.',
    },
    {
        target: link('employee-nav', '/employee/processing'),
        optional: true,
        title: 'Process documents',
        body: 'Prepare the document, generate its signed credential and QR code, then set it ready for claiming.',
    },
    {
        target: link('employee-nav', '/employee/claim-schedule'),
        title: 'Claiming',
        body: 'Schedule claiming and release documents. Check the student’s ID — or an approved representative’s letter and ID.',
    },
    {
        target: link('employee-nav', '/employee/messages'),
        optional: true,
        title: 'Messages',
        body: 'Reply to students about their requests.',
    },
    {
        target: link('employee-nav', '/employee/notifications'),
        title: 'Notifications',
        body: 'New assignments, staff notes on your requests, representatives to review, and more.',
    },
    {
        target: link('employee-nav', '/employee/guide'),
        title: 'User Guide',
        body: 'Step-by-step help for every task, plus a “Start demo” button to replay this tour.',
    },
    {
        target: null,
        title: 'You’re all set! 🎉',
        body: 'Head to your assigned requests to get started.',
        action: { label: 'View assigned requests', to: '/employee/requests' },
    },
]

export const HEAD_TOUR = [
    {
        target: null,
        title: 'Welcome, Registrar Head! 👋',
        body: 'A quick tour of the tools for running the Registrar’s Office in CertiChain. You can skip it anytime.',
    },
    {
        target: link('admin-nav', '/admin/dashboard'),
        title: 'Dashboard',
        body: 'Office totals, trends, team workload and recent staff activity — all updating live.',
    },
    {
        target: link('admin-nav', '/admin/requests'),
        title: 'All requests',
        body: 'Every request in the office. Open one to reassign it, override its status, add staff notes or review a representative.',
    },
    {
        target: link('admin-nav', '/admin/assignments'),
        title: 'Assignments & rebalancing',
        body: 'Cover programs without an employee, assign waiting requests, and even out the team’s workload.',
    },
    {
        target: link('admin-nav', '/admin/employees'),
        title: 'Employees',
        body: 'Activate new staff accounts, set their program assignments, or give them a temporary password.',
    },
    {
        target: link('admin-nav', '/admin/students'),
        title: 'Students',
        body: 'Verify new student registrations and manage their details.',
    },
    {
        target: link('admin-nav', '/admin/documents'),
        title: 'Document catalog',
        body: 'Fees, processing days, availability and sample images — shown on the public landing page too.',
    },
    {
        target: link('admin-nav', '/admin/claim-schedules'),
        title: 'Claim schedules',
        body: 'Upcoming, missed and reschedule-requested claiming appointments across the office.',
    },
    {
        target: link('admin-nav', '/admin/reports'),
        title: 'Reports',
        body: 'Monthly requests, fees collected and processing times — export to Excel or PDF.',
    },
    {
        target: link('admin-nav', '/admin/guide'),
        title: 'User Guide',
        body: 'Step-by-step help for every task, plus a “Start demo” button to replay this tour.',
    },
    {
        target: null,
        title: 'You’re all set! 🎉',
        body: 'The dashboard is the best place to start each day.',
        action: { label: 'Go to dashboard', to: '/admin/dashboard' },
    },
]
