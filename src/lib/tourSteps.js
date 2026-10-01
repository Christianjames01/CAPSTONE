// Guided demo tour steps per portal (components/ProductTour.jsx). Every
// sidebar item has a step, in sidebar order (the student tour follows the
// request process instead).
//
// target: the sidebar link; the tour opens its page (or step.route) and
// spotlights the real section there -- step.area, else the page's main
// section (see ProductTour.jsx). null = no page (a picture is shown).
// optional: skip when the target isn't on the page (links hidden for
// limited-access employees). preview: mock-up shown in the card
// (components/TourPreview.jsx). action: button on the last step.

// Dispatched by the User Guide's "Start demo" button.
export const START_TOUR_EVENT = 'certichain:start-tour'

// The walk-in queue, part by part. While a demo is on the Queue page it shows
// sample tickets (lib/queueDemo.js), and the Call / serving / completed
// clicks below move those samples -- nothing is saved.
const queueHighlights = () => [
    { selector: '[data-demo="issue"]', text: 'Issue a number to each walk-in — type a count to print a whole block.' },
    { selector: '.page-stats', text: 'Now serving, waiting, served and no-shows — updated live.' },
    { selector: '[data-demo="waiting"]', text: 'Everyone waiting, in order.' },
    { selector: '[data-demo="call"]', click: true, text: 'Call the next number — the lobby display shows it and announces it out loud.' },
    { selector: '[data-demo="serving"]', text: 'Called numbers move to Now Serving.' },
    { selector: '[data-demo="recall"]', text: 'Not here yet? Recall announces the number again.' },
    { selector: '[data-demo="serve"]', click: true, text: 'Mark as serving once they reach the counter.' },
    { selector: '[data-demo="complete"]', click: true, text: 'Mark completed when you’re done with them.' },
    { selector: '[data-demo="history"]', text: 'Finished numbers and no-shows move to Earlier Today.' },
    { selector: '[data-demo="display"]', text: 'Open the Queue Display on the lobby TV so walk-ins can see what’s next.' },
]

// The Queue page's own "Demo" button runs just this.
export const QUEUE_TOUR = {
    employee: queueTour('/employee/queue'),
    head: queueTour('/admin/queue'),
}

function queueTour(route) {
    return [
        {
            target: null,
            preview: 'queue',
            title: 'Walk-in queue demo',
            body: 'How numbers go from the ticket to the counter: issue a number, call it, serve it, and finish — while the lobby display shows and announces who’s next. The demo uses sample numbers; nothing is saved.',
        },
        {
            route,
            highlights: queueHighlights(),
            title: 'Running the queue',
            body: 'Watch a walk-in go from waiting to served. These are sample numbers — your real queue comes back when the demo ends.',
        },
        {
            target: null,
            preview: 'queue',
            title: 'On the lobby TV',
            body: 'The Queue Display shows Now Serving and the next numbers, and chimes and announces each call. Open it once on the TV and tap Start.',
        },
    ]
}

const link = (nav, path) => `.${nav} a[href="${path}"]`

export const STUDENT_TOUR = [
    {
        target: null,
        preview: 'welcome',
        title: 'Welcome to CertiChain',
        body: 'A quick tour of the five steps: request a document, upload requirements, pay and upload your receipt, follow the Registrar’s review, then pick it up. You can skip it anytime.',
    },
    {
        target: null,
        preview: 'security',
        title: 'Signing in safely',
        body: 'When you log in, register, continue with Google or change your password, a quick security check pops up: slide the puzzle piece into the gap. It keeps bots out of student accounts.',
    },
    {
        target: link('student-nav', '/student/dashboard'),
        highlights: [
            { selector: '.sd-hero', text: "Start here — “Request a Document” is always one tap away." },
            { selector: '.sd-summary', text: "Active requests, actions waiting for you, completed and ready documents. Tap a card to open that list." },
            { selector: '.sd-current', text: "Each current request with its status and the next thing to do." },
            { selector: '.sd-action-btn', text: "When something is needed from you, the button is right here — orange means action required." },
            { selector: '.student-announcements', text: "Announcements from the Registrar, like office days and closures." },
        ],
        area: '.sd-summary',
        preview: 'dashboard',
        title: 'Your dashboard',
        body: 'The dashboard answers: what are my requests, where is each one, and what do I need to do next. Requests that need you come first.',
    },
    {
        target: link('student-nav', '/student/new-request'),
        highlights: [
            { selector: '.ss-steps', text: "Your progress: choose → check requirements → submit." },
            { selector: '.student-request-grid input.form-input', text: "Search for the document you need." },
            { selector: ['.student-request-grid button.student-list-card[data-has-preview]', '.student-request-grid button.student-list-card'], click: true, text: "Pick a document — the fee is on the right." },
            { selector: '.rq-preview', text: "A sample of the document appears here. Tap it to enlarge." },
            { selector: '#request-quantity', text: "Type how many copies you need." },
            { selector: '.student-request-grid textarea', text: "Say what the document is for." },
            { selector: '.rq-add-button', text: "Add it to your list — you can add more documents." },
            { selector: '.rq-cart', text: "Submit your list. You'll confirm the total first, then get your request number." },
        ],
        area: '.student-request-grid',
        preview: 'request',
        title: 'Step 1 · Request a document',
        body: 'Choose the document, read what it requires, type the copies and purpose, then submit and confirm. Each document becomes its own request with a request number.',
    },
    {
        target: link('student-nav', '/student/my-requests'),
        highlights: [
            { selector: '.rq-needs-action', text: "A request that needs something from you is outlined in orange." },
            { selector: '.rq-needs-action .sd-action-btn', text: "Tap “Upload Requirements” and add a clear photo or PDF of each item." },
        ],
        preview: 'track',
        title: 'Step 2 · Upload your requirements',
        body: 'If the document needs requirements (like a signed clearance or an ID), upload each one from the request. If one is rejected you see the reason and upload it again.',
    },
    {
        target: link('student-nav', '/student/upload-receipt'),
        highlights: [
            { selector: '.ss-steps', text: "Pay at the Finance Office → upload the receipt → the Registrar checks it." },
            { selector: '.page-stats', text: "What still needs a receipt, and the amount due." },
            { selector: '.student-list-card', text: "Each request waiting for payment." },
            { selector: '.student-list-card .ui-card-actions', text: "Upload a photo of your Official Receipt here." },
        ],
        area: '.page-stats',
        preview: 'payment',
        title: 'Step 3 · Pay, then upload your receipt',
        body: 'Pay in person at the HCDC Finance Office — there’s no online payment. Then enter the receipt number and upload a clear photo. One receipt can cover several documents; each receipt can only be used once.',
    },
    {
        target: link('student-nav', '/student/my-requests'),
        highlights: [
            { selector: '.sp-progress', text: "Six steps: submitted, payment & requirements, registrar review, processing, ready, completed." },
            { selector: '.rq-next', text: "What’s happening now — or the action required from you." },
            { selector: '.sd-view-btn', text: "Open a request for the full timeline and what happens next." },
            { selector: '.student-filter-row', text: "Filter your requests by status." },
        ],
        preview: 'track',
        title: 'Step 4 · Registrar review and processing',
        body: 'The Registrar checks your receipt and requirements, then prepares your document. Each request shows its current step and what to do next, and you’re notified at every change — plus reminders if it waits on you.',
    },
    {
        target: link('student-nav', '/student/claim-schedule'),
        highlights: [
            { selector: '.ss-info', text: "What to bring: a valid ID and your Official Receipt." },
            { selector: '.page-stats', text: "Upcoming, claimed and missed pickups." },
            { selector: '.student-list-card', text: "Your pickup date, time and window. You can ask to reschedule." },
        ],
        preview: 'claim',
        title: 'Step 5 · Pick up your document',
        body: 'When it’s ready you get a pickup date, time and window on an office day. Bring a valid ID and your Official Receipt — or add a representative on the request page to claim it for you. Once claimed, the request is completed and its QR code can be verified by anyone.',
    },
    {
        target: link('student-nav', '/student/messages'),
        highlights: [
            { selector: '.chat-list', text: "Your conversations with the registrar staff." },
            { selector: '.chat-body', text: "Messages show here, like Messenger. Long-press one to reply." },
            { selector: '.req-ask', text: "Ask about a request — the status is sent to you right away." },
            { selector: '.chat-composer textarea', text: "Type your message here." },
        ],
        area: '.chat-app',
        preview: 'messages',
        title: 'Message the Registrar',
        body: 'Chat like in Messenger: see when staff are typing, and long-press a message to reply, edit or delete. Use “Ask about a request” to get the status of one — or all — of your requests right away.',
    },
    {
        target: link('student-nav', '/student/notifications'),
        highlights: [
            { selector: '.page-stats', text: "Unread and today’s notifications." },
            { selector: '.student-list-card', text: "Every update about your requests, including reminders." },
        ],
        preview: 'notifications',
        title: 'Notifications',
        body: 'Every update about your requests lands here, live — no need to refresh — including reminders when a request still needs your payment or requirements.',
    },
    {
        target: link('student-nav', '/student/profile'),
        preview: 'profile',
        title: 'Your profile',
        body: 'Review your student details, update your photo and contact information, and change your password (after a quick security check).',
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
        title: 'Help & Support',
        body: 'Common questions, processing times and fees, and the Registrar’s Office contact details.',
    },
    {
        target: null,
        preview: 'done',
        title: 'You’re all set',
        body: 'Start by requesting your first document. Your dashboard will always show the next step — and orange means it’s waiting for you.',
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
        target: null,
        preview: 'security',
        title: 'Signing in safely',
        body: 'Logging in and changing your password start with a quick slide-puzzle security check, and you can add two-factor authentication in your profile for extra protection.',
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
        body: 'Check the receipt number and amount, then verify or mark it invalid with a reason. When one receipt covers several requests you’ll see the total to check, and the decision applies to all of them. Reused photos or numbers are flagged.',
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
        highlights: [
            { selector: '.ocal-grid', text: "Tap a day to add an event, or open a Monday or weekend with office hours." },
            { selector: '.ocal-sidebar', text: "Coming up: events, opened days and claiming appointments." },
        ],
        area: '.ocal-layout',
        preview: 'calendar',
        title: 'Office calendar',
        body: 'The office is closed on Mondays and weekends by default. Tap one to mark it open and set the office hours (like 8 AM – 5 PM) — students see them on their dashboard.',
    },
    {
        target: link('employee-nav', '/employee/queue'),
        highlights: queueHighlights(),
        optional: true,
        preview: 'queue',
        title: 'Walk-in queue',
        body: 'Issue queue numbers to walk-ins, call the next one, then mark them serving or completed. The Queue Display screen shows and announces the number being served.',
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
        highlights: [
            { selector: '.chat-list', text: "Conversations with students, newest first." },
            { selector: '.chat-tabs', text: "Show all or only unread conversations." },
            { selector: '.chat-body', text: "Replies, typing, and quick status answers happen here." },
        ],
        area: '.chat-app',
        optional: true,
        preview: 'staffMessages',
        title: 'Messages',
        body: 'Messenger-style chats with students: typing indicator, replies to specific messages, and a one-tap “Reply with status” when a student asks about a request.',
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
        target: null,
        preview: 'security',
        title: 'Signing in safely',
        body: 'Logging in, creating staff accounts and changing passwords start with a quick slide-puzzle security check. Staff contact details are only visible to signed-in registrar staff, and two-factor authentication is available in your profile.',
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
        body: 'Post notices to students — closures, schedule changes and reminders. For a day the office is open, add the office hours so students know when to come.',
    },
    {
        target: link('admin-nav', '/admin/colleges-programs'),
        preview: 'programs',
        title: 'Academic divisions & programs',
        body: 'Manage the colleges and their programs that students choose when they register.',
    },
    {
        target: link('admin-nav', '/admin/claim-schedules'),
        preview: 'schedules',
        title: 'Claim schedules',
        body: 'Upcoming, missed and reschedule-requested claiming appointments across the office.',
    },
    {
        target: link('admin-nav', '/admin/office-calendar'),
        highlights: [
            { selector: '.ocal-grid', text: "Tap a day to add an event, or open a Monday or weekend with office hours." },
            { selector: '.ocal-sidebar', text: "Coming up: events, opened days and claiming appointments." },
        ],
        area: '.ocal-layout',
        preview: 'calendar',
        title: 'Office calendar',
        body: 'Mondays and weekends are closed by default. Mark a day open with its office hours, and add holidays and events, so claiming is only scheduled when the office is open.',
    },
    {
        target: link('admin-nav', '/admin/queue'),
        highlights: queueHighlights(),
        preview: 'queue',
        title: 'Walk-in queue',
        body: 'Issue queue numbers to walk-ins, call the next one, then mark them serving or completed. The Queue Display screen shows and announces the number being served.',
    },
    {
        target: link('admin-nav', '/admin/receipts'),
        preview: 'receipts',
        title: 'Official receipts',
        body: 'Every uploaded receipt with its number. Receipts covering several requests are checked as one, and reused photos or receipt numbers are flagged.',
    },
    {
        target: link('admin-nav', '/admin/messages'),
        highlights: [
            { selector: '.chat-list', text: "Conversations with students, newest first." },
            { selector: '.chat-tabs', text: "Show all or only unread conversations." },
            { selector: '.chat-body', text: "Replies, typing, and quick status answers happen here." },
        ],
        area: '.chat-app',
        preview: 'staffMessages',
        title: 'Messages',
        body: 'Message a student directly (their own conversation with you), oversee student–staff chats and reply in them, with typing, replies and quick status answers.',
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
