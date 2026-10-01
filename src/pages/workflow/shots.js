// The System Workflow presentation, shot by shot: what the narrator says,
// which station the camera visits, and the sound cues (seconds into the shot).
//
// step: the numbered stage shown on the timeline (0 = intro/outro).
// audio: optional recorded narration in /public/workflow-narration/ -- when
// every file is there, the recording is used instead of the browser voice.

export const SHOTS = [
    {
        id: 'intro',
        step: 0,
        title: 'CertiChain System Workflow',
        narration: 'Here is how an academic document request moves through the online registrar system, from the first click to the final release.',
        audio: '00-intro.mp3',
        minMs: 7000,
        cues: [],
    },
    {
        id: 'request',
        step: 1,
        title: 'Student Request',
        narration: 'First, the student submits a request for the academic document they need through the online registrar system.',
        audio: '01-request.mp3',
        minMs: 9000,
        cues: [[2.2, 'panel'], [4.6, 'click'], [5.4, 'transfer']],
    },
    {
        id: 'upload',
        step: 2,
        title: 'Upload Required Credentials',
        narration: 'The student then provides the required information, and uploads the necessary credentials for verification.',
        audio: '02-upload.mp3',
        minMs: 9000,
        cues: [[1.8, 'upload'], [6.3, 'confirm']],
    },
    {
        id: 'record',
        step: 3,
        title: 'Employee Checks Student Record',
        narration: "Once the request is received, the registrar employee checks the student's academic record, and verifies the submitted information.",
        audio: '03-record.mp3',
        minMs: 9500,
        cues: [[1.4, 'server'], [2.4, 'tick'], [3.1, 'tick'], [3.8, 'tick'], [4.5, 'tick'], [6.2, 'confirm']],
    },
    {
        id: 'process',
        step: 4,
        title: 'Employee Processes Request',
        narration: 'After the records are confirmed, the registrar employee processes the request, and prepares the requested academic document.',
        audio: '04-process.mp3',
        minMs: 9500,
        cues: [[2.0, 'tick'], [3.0, 'tick'], [4.0, 'tick'], [5.0, 'tick'], [5.8, 'transfer']],
    },
    {
        id: 'verify',
        step: 5,
        title: 'Credential Verification',
        narration: 'The system then verifies the academic credential, to help ensure that the document information is authentic, and has not been altered.',
        audio: '05-verify.mp3',
        minMs: 9500,
        cues: [[1.6, 'scan'], [6.4, 'confirm']],
    },
    {
        id: 'generate',
        step: 6,
        title: 'Digital Credential Generation',
        narration: 'After verification, the requested academic credential is generated, and prepared for release.',
        audio: '06-generate.mp3',
        minMs: 8500,
        cues: [[1.4, 'transfer'], [4.6, 'confirm']],
    },
    {
        id: 'secure',
        step: 7,
        title: 'Secure Verification',
        narration: 'A unique verification value is generated for the document, allowing its digital integrity to be checked later.',
        audio: '07-secure.mp3',
        minMs: 9000,
        cues: [[1.2, 'shimmer'], [6.0, 'confirm']],
    },
    {
        id: 'digital',
        step: 8,
        title: 'Credential Release · Digital',
        narration: 'For digital release, the student receives a notification, and can securely access the completed credential.',
        audio: '08a-digital.mp3',
        minMs: 8500,
        cues: [[1.6, 'notify'], [4.4, 'click'], [4.8, 'transfer'], [6.6, 'confirm']],
    },
    {
        id: 'physical',
        step: 8,
        title: 'Credential Release · Physical',
        narration: "For physical release, the student receives a scheduled date and time, for claiming the document at the registrar's office.",
        audio: '08b-physical.mp3',
        minMs: 9000,
        cues: [[2.0, 'calendar'], [3.4, 'click'], [5.2, 'confirm']],
    },
    {
        id: 'complete',
        step: 9,
        title: 'Completion',
        narration: 'Once the credential has been released, the transaction is recorded in the system, and the request is marked as completed.',
        audio: '09-complete.mp3',
        minMs: 9500,
        cues: [[1.2, 'tick'], [1.8, 'tick'], [2.4, 'tick'], [3.0, 'tick'], [3.6, 'tick'], [5.0, 'complete']],
    },
    {
        id: 'finale',
        step: 0,
        title: 'Request Completed',
        narration: '',
        audio: null,
        minMs: 9000,
        cues: [[0.6, 'swell']],
    },
]

// The nine stages on the timeline.
export const STEPS = [
    'Student Request',
    'Upload Credentials',
    'Academic Record',
    'Registrar Processing',
    'Verification',
    'Digital Credential',
    'Secure Verification',
    'Release',
    'Completed',
]

export const FLOW = ['Student Request', 'Credentials', 'Academic Record', 'Registrar Processing', 'Verification', 'Digital Credential', 'Release', 'Completed']
