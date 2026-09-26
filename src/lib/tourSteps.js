// Guided demo tour steps per portal (components/ProductTour.jsx). Every
// sidebar item has a step, in sidebar order (the student tour follows the
// request process instead).
//
// target: CSS selector to highlight (a sidebar link); null = no highlight.
// optional: skip when the target isn't on the page (links hidden for
// limited-access employees). preview: mock-up shown in the card
// (components/TourPreview.jsx). action: button on the last step.

// Dispatched by the User Guide's "Start demo" button.
export const START_TOUR_EVENT = 'certichain:start-tour'

const link = (nav, path) => `.${nav} a[href="${path}"]`

export const STUDENT_TOUR = [
    {
        target: null,
        preview: 'welcome',
        title: 'Welcome to CertiChain',
        body: 'Here’s a quick tour of how to request, pay for, track and claim your registrar documents. You can skip it anytime.',
    },
    {
        target: link('student-nav', '/student/dashboard'),
        preview: 'dashboard',
        title: 'Your dashboard',
        body: 'See your active requests, what you need to do next, and announcements from the Registrar.',
    },
    {
        target: link('student-nav', '/student/new-request'),
        preview: 'request',
        title: '1. Request a document',
        body: 'Choose the document, the number of copies and your purpose. A sample preview shows what the document looks like.',
    },
    {
        target: link('student-nav', '/student/upload-receipt'),
        preview: 'payment',
        title: '2. Pay, then upload your receipt',
        body: 'Pay the fee in person at the HCDC Finance Office — there’s no online payment. Then upload a clear photo of your official receipt here so the Registrar can verify it.',
    },
    {
        target: link('student-nav', '/student/my-requests'),
        preview: 'track',
        title: '3. Track your requests',
        body: 'Every request and its status, updated live. You’re notified each time something changes, and any missing requirements show up here.',
    },
    {
        target: link('student-nav', '/student/claim-schedule'),
        preview: 'claim',
        title: '4. Claim your document',
        body: 'When it’s ready you get a claiming date, time and window. Bring a valid ID and your original receipt — or authorize a representative from the request page.',
    },
    {
        target: link('student-nav', '/student/messages'),
        preview: 'messages',
        title: 'Message the Registrar',
        body: 'Chat with the staff handling your requests. Each person has their own conversation.',
    },
    {
        target: link('student-nav', '/student/notifications'),
        preview: 'notifications',
        title: 'Notifications',
        body: 'Every update about your requests lands here.',
    },
    {
        target: link('student-nav', '/student/profile'),
        preview: 'profile',
        title: 'Your profile',
        body: 'Review your student details, update your photo and contact information, and change your password.',
    },
    {
        target: link('student-nav', '/student/guide'),
        preview: 'guide',
        title: 'User Guide',
        body: 'Step-by-step help for everything, plus a “Start demo” button to replay this tour.',
    },
    {
        target: link('student-nav', '/student/help'),
        preview: 'help',
        title: 'Help / Support',
        body: 'Common questions, processing times and fees, and the Registrar’s Office contact details.',
    },
    {
        target: null,
        preview: 'done',
        title: 'You’re all set',
        body: 'Start by requesting your first document. Remember: pay at the Finance Office, then upload your receipt.',
        action: { label: 'Request a document', to: '/student/new-request' },
    },
]

export const EMPLOYEE_TOUR = [
    {
        target: null,
        preview: 'welcome',
        title: 'Welcome to CertiChain',
        body: 'A quick tour of how you’ll handle document requests, from verification to release. You can skip it anytime.',
    },
    {
        target: link('employee-nav', '/employee/dashboard'),
        preview: 'headDashboard',
        title: 'Your dashboard',
        body: 'What needs your attention today: open requests, waiting items and today’s claiming appointments.',
    },
    {
        target: link('employee-nav', '/employee/requests'),
        preview: 'assigned',
        title: 'Assigned requests',
        body: 'Requests routed to you by program, with the student and the time requested. Open one to see receipts, requirements, notes and history.',
    },
    {
        target: link('employee-nav', '/employee/verification'),
        optional: true,
        preview: 'verify',
        title: 'Request verification',
        body: 'Students pay at the Finance Office and upload their official receipt. Verify it, or mark it invalid with a reason.',
    },
    {
        target: link('employee-nav', '/employee/processing'),
        optional: true,
        preview: 'process',
        title: 'Document processing',
        body: 'Prepare the document, generate its signed credential and QR code, then set it ready for claiming.',
    },
    {
        target: link('employee-nav', '/employee/claim-schedule'),
        preview: 'staffClaim',
        title: 'Claim schedule',
        body: 'Schedule claiming and release documents. Check the student’s ID — or an approved representative’s letter and ID.',
    },
    {
        target: link('employee-nav', '/employee/office-calendar'),
        preview: 'calendar',
        title: 'Office calendar',
        body: 'Holidays, office events and upcoming claiming dates, so you schedule on days the office is open.',
    },
    {
        target: link('employee-nav', '/employee/queue'),
        optional: true,
        preview: 'queue',
        title: 'Walk-in queue',
        body: 'Call the next walk-in number; the office Queue Display screen shows and announces it.',
    },
    {
        target: link('employee-nav', '/employee/students'),
        optional: true,
        preview: 'studentList',
        title: 'Students',
        body: 'Look up a student’s details and full request history.',
    },
    {
        target: link('employee-nav', '/employee/messages'),
        optional: true,
        preview: 'staffMessages',
        title: 'Messages',
        body: 'Reply to students about their requests.',
    },
    {
        target: link('employee-nav', '/employee/notifications'),
        preview: 'staffNotifications',
        title: 'Notifications',
        body: 'New assignments, staff notes on your requests, representatives to review, and more.',
    },
    {
        target: link('employee-nav', '/employee/activity-logs'),
        optional: true,
        preview: 'activity',
        title: 'Activity logs',
        body: 'A record of the actions you’ve taken, with dates and times.',
    },
    {
        target: link('employee-nav', '/employee/guide'),
        preview: 'guide',
        title: 'User Guide',
        body: 'Step-by-step help for every task, plus a “Start demo” button to replay this tour.',
    },
    {
        target: link('employee-nav', '/employee/profile'),
        preview: 'profile',
        title: 'Your profile',
        body: 'Your account details, photo and password, plus two-factor authentication.',
    },
    {
        target: null,
        preview: 'done',
        title: 'You’re all set',
        body: 'Head to your assigned requests to get started.',
        action: { label: 'View assigned requests', to: '/employee/requests' },
    },
]

export const HEAD_TOUR = [
    {
        target: null,
        preview: 'welcome',
        title: 'Welcome, Registrar Head',
        body: 'A quick tour of the tools for running the Registrar’s Office in CertiChain. You can skip it anytime.',
    },
    {
        target: link('admin-nav', '/admin/dashboard'),
        preview: 'headDashboard',
        title: 'Dashboard',
        body: 'Office totals, trends, team workload and recent staff activity — all updating live.',
    },
    {
        target: link('admin-nav', '/admin/requests'),
        preview: 'requests',
        title: 'All requests',
        body: 'Every request in the office. Open one to reassign it, override its status, add staff notes or review a representative.',
    },
    {
        target: link('admin-nav', '/admin/assignments'),
        preview: 'assign',
        title: 'Request assignments',
        body: 'Cover programs without an employee, assign waiting requests, and even out the team’s workload.',
    },
    {
        target: link('admin-nav', '/admin/employees'),
        preview: 'employees',
        title: 'Employees',
        body: 'Activate new staff accounts, set their program assignments, or give them a temporary password.',
    },
    {
        target: link('admin-nav', '/admin/students'),
        preview: 'students',
        title: 'Students',
        body: 'Verify new student registrations and manage their details.',
    },
    {
        target: link('admin-nav', '/admin/documents'),
        preview: 'documents',
        title: 'Documents',
        body: 'Fees, processing days, availability and sample images — shown on the public landing page too.',
    },
    {
        target: link('admin-nav', '/admin/announcements'),
        preview: 'announcements',
        title: 'Announcements',
        body: 'Post notices to students — office closures, schedule changes and reminders.',
    },
    {
        target: link('admin-nav', '/admin/colleges-programs'),
        preview: 'programs',
        title: 'Academic divisions & programs',
        body: 'Manage colleges and programs; each program’s assigned employee receives its requests automatically.',
    },
    {
        target: link('admin-nav', '/admin/claim-schedules'),
        preview: 'schedules',
        title: 'Claim schedules',
        body: 'Upcoming, missed and reschedule-requested claiming appointments across the office.',
    },
    {
        target: link('admin-nav', '/admin/office-calendar'),
        preview: 'calendar',
        title: 'Office calendar',
        body: 'Set holidays, office events and open days, so claiming is only scheduled when the office is open.',
    },
    {
        target: link('admin-nav', '/admin/queue'),
        preview: 'queue',
        title: 'Walk-in queue',
        body: 'Manage walk-in numbers; the Queue Display screen shows and announces the number being served.',
    },
    {
        target: link('admin-nav', '/admin/receipts'),
        preview: 'receipts',
        title: 'Official receipts',
        body: 'Every uploaded Finance Office receipt, awaiting verification or verified, in one place.',
    },
    {
        target: link('admin-nav', '/admin/messages'),
        preview: 'staffMessages',
        title: 'Messages',
        body: 'See conversations between students and staff, and reply directly when needed.',
    },
    {
        target: link('admin-nav', '/admin/notifications'),
        preview: 'staffNotifications',
        title: 'Notifications',
        body: 'New employees to activate, requests waiting for an employee, and other office alerts.',
    },
    {
        target: link('admin-nav', '/admin/activity-logs'),
        preview: 'activity',
        title: 'Activity logs',
        body: 'Who did what, and when — every staff action on requests, students and schedules.',
    },
    {
        target: link('admin-nav', '/admin/reports'),
        preview: 'reports',
        title: 'Reports',
        body: 'Monthly requests, fees collected and processing times — export to Excel or PDF.',
    },
    {
        target: link('admin-nav', '/admin/guide'),
        preview: 'guide',
        title: 'User Guide',
        body: 'Step-by-step help for every task, plus a “Start demo” button to replay this tour.',
    },
    {
        target: link('admin-nav', '/admin/profile'),
        preview: 'profile',
        title: 'Your profile',
        body: 'Your account details, photo and password, plus two-factor authentication.',
    },
    {
        target: null,
        preview: 'done',
        title: 'You’re all set',
        body: 'The dashboard is the best place to start each day.',
        action: { label: 'Go to dashboard', to: '/admin/dashboard' },
    },
]
