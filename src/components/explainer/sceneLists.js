import * as Employee from './EmployeeScenes'
import * as Head from './HeadScenes'
import * as Student from './StudentScenes'

// Scene lists for ExplainerPlayer. Each scene: key, the View component,
// chapter label, title, caption text and how long it plays (ms).

// Student story: from the counter line to a verified credential.
export const STUDENT_SCENES = [
    { key: "intro", View: Student.SceneIntro, chapter: "Intro", title: "Registrar documents, without the counter line", text: "CertiChain is HCDC’s online registrar service. Request, track and verify academic documents from one account instead of queuing at the office.", ms: 6000 },
    { key: "account", View: Student.SceneAccount, chapter: "Account", title: "Create your account", text: "Register with your student details. The Registrar verifies your record, so only real students can request.", ms: 5500 },
    { key: "request", View: Student.SceneRequest, chapter: "Step 1", title: "Request a document", text: "Choose the document, check what it requires, type the copies and purpose, then submit and confirm. Your request number appears right away.", ms: 7000 },
    { key: "requirements", View: Student.SceneRequirements, chapter: "Step 2", title: "Upload your requirements", text: "Upload a clear photo or PDF of each requirement. If one is rejected, you see the reason and upload it again.", ms: 6500 },
    { key: "payment", View: Student.ScenePayment, chapter: "Step 3", title: "Pay, then upload the receipt", text: "Pay at the HCDC Finance Office, then upload a photo of your Official Receipt. The Registrar checks it online.", ms: 6500 },
    { key: "tracking", View: Student.SceneTracking, chapter: "Step 4", title: "Registrar review and processing", text: "Follow your request through six steps. You always see what is happening now and what to do next, with a notification at every change.", ms: 7000 },
    { key: "schedule", View: Student.SceneSchedule, chapter: "Step 5", title: "Get your pickup schedule", text: "When it is ready you get a date, time and window. Bring a valid ID and your Official Receipt, or send a representative.", ms: 6000 },
    { key: "claim", View: Student.SceneClaim, chapter: "Result", title: "Claim it — and prove it’s genuine", text: "Claim it at the Registrar’s Office and your request is completed. Its QR code lets any school or employer verify it in seconds.", ms: 6500 },
    { key: "cta", View: Student.SceneCta, chapter: "Start", title: "Your records, verified and provable", text: "Create a free account and request your first document today.", ms: 5000 },
]

// Employee story: an assigned request from receipt to release.
export const EMPLOYEE_SCENES = [
    { key: 'assigned', View: Employee.SceneEmpIntro, chapter: 'Intro', title: 'Your assigned requests', text: 'Requests from your colleges and programs are routed to you automatically, newest first, with their status.', ms: 5500 },
    { key: 'verify', View: Employee.SceneEmpVerify, chapter: 'Step 1', title: 'Verify the payment', text: 'Check the uploaded official receipt against the request — number, amount and that it hasn’t been used before.', ms: 6500 },
    { key: 'process', View: Employee.SceneEmpProcess, chapter: 'Step 2', title: 'Process and schedule', text: 'Move the request through processing, then set the claiming date and time. The student is notified instantly.', ms: 6000 },
    { key: 'release', View: Employee.SceneEmpRelease, chapter: 'Step 3', title: 'Release on claim day', text: 'Call the walk-in number, check the ID and receipt, and mark it claimed — the signed credential is issued.', ms: 6000 },
    { key: 'chat', View: Employee.SceneEmpChat, chapter: 'Messages', title: 'Answer students quickly', text: 'Status inquiries get an automatic reply that quotes the question, and you can reply or follow up anytime.', ms: 6000 },
    { key: 'cta', View: Employee.SceneStaffCta, chapter: 'Try it', title: 'Now try it on the real pages', text: 'Start the guided demo to walk through each page of your portal.', ms: 5000 },
]

// Registrar Head story: overview, assignment, publishing, office days, oversight.
export const HEAD_SCENES = [
    { key: 'dashboard', View: Head.SceneHeadDash, chapter: 'Overview', title: 'The whole office at a glance', text: 'Live totals for every status and the week’s requests, updating as your staff work.', ms: 5500 },
    { key: 'assign', View: Head.SceneHeadAssign, chapter: 'Step 1', title: 'Assign requests to staff', text: 'Requests are routed to employees by college and program; assign or reassign any request in one click.', ms: 6000 },
    { key: 'publish', View: Head.SceneHeadPublish, chapter: 'Step 2', title: 'Announce to students', text: 'Publish announcements with office hours — they appear on every student’s dashboard right away.', ms: 6000 },
    { key: 'calendar', View: Head.SceneHeadCalendar, chapter: 'Step 3', title: 'Open extra office days', text: 'Mondays and weekends are closed by default. Open one with hours, and claims can be scheduled there.', ms: 5500 },
    { key: 'oversee', View: Head.SceneHeadOversee, chapter: 'Step 4', title: 'Oversee and report', text: 'Every action is logged with who and when, and reports export requests and revenue.', ms: 6000 },
    { key: 'cta', View: Employee.SceneStaffCta, chapter: 'Try it', title: 'Now try it on the real pages', text: 'Start the guided demo to walk through each page of the Registrar Head portal.', ms: 5000 },
]
