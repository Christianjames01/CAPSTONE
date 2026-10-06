// The demo video, scene by scene (seconds). Each scene: what the phone shows
// (left), what happens in the real-world scene (right), the voice-over line
// and its sound cues (seconds into the scene).

export const SCENES = [
    {
        id: 'intro', a: 0, b: 5,
        voice: { at: 0.8, text: 'CertiChain. The online registrar of Holy Cross of Davao College.' },
        cues: [[0.3, 'swell']],
    },
    {
        id: 'login', a: 5, b: 14, step: 1, title: 'Sign in',
        place: 'On campus · any phone',
        voice: { at: 0.4, text: 'Students sign in with their account. A quick security check keeps bots out.' },
        cues: [[0.9, 'tick'], [2.5, 'tick'], [3.9, 'transfer'], [5.1, 'confirm'], [5.8, 'click'], [6.6, 'panel']],
    },
    {
        id: 'request', a: 14, b: 27, step: 2, title: 'Request a document',
        place: 'On campus · any phone',
        voice: { at: 0.4, text: 'Choose the document you need, enter the copies and purpose, and submit. You get a request number right away.' },
        cues: [[1.2, 'click'], [1.6, 'panel'], [5.0, 'click'], [6.2, 'click'], [6.5, 'panel'], [7.6, 'click'], [8.1, 'confirm']],
    },
    {
        id: 'requirements', a: 27, b: 37, step: 3, title: 'Upload requirements',
        place: 'Taking a photo of the requirements',
        voice: { at: 0.4, text: 'Upload clear photos of the requirements, straight from your phone.' },
        cues: [[1.0, 'click'], [1.6, 'shimmer'], [3.0, 'click'], [3.2, 'upload'], [4.6, 'confirm'], [5.6, 'click'], [6.2, 'shimmer'], [7.4, 'click'], [8.7, 'confirm']],
    },
    {
        id: 'payment', a: 37, b: 48, step: 4, title: 'Pay & upload the receipt',
        place: 'HCDC Finance Office',
        voice: { at: 0.4, text: 'Pay at the HCDC Finance Office, then upload a photo of your official receipt.' },
        cues: [[1.0, 'transfer'], [3.0, 'click'], [3.5, 'shimmer'], [5.2, 'click'], [5.4, 'upload'], [6.6, 'confirm']],
    },
    {
        id: 'track', a: 48, b: 58, step: 5, title: 'Track it live',
        place: 'Anywhere · notifications',
        voice: { at: 0.4, text: 'Follow every step live. You are notified when your payment is verified, and when your document is ready.' },
        cues: [[2.6, 'notify'], [3.0, 'tick'], [6.2, 'notify'], [6.5, 'tick']],
    },
    {
        id: 'pickup', a: 58, b: 68, step: 6, title: 'Pick up your document',
        place: "Registrar's Office · Window 2",
        voice: { at: 0.4, text: "Claim it on your schedule at the Registrar's window. Bring a valid ID and your receipt." },
        cues: [[0.8, 'calendar'], [1.5, 'tick'], [2.2, 'tick'], [2.9, 'tick'], [4.4, 'transfer'], [5.5, 'complete']],
    },
    {
        id: 'verify', a: 68, b: 76, step: 7, title: 'Verify it anywhere',
        place: 'An employer or another school',
        voice: { at: 0.4, text: "Schools and employers scan the QR code to confirm it's genuine." },
        cues: [[0.6, 'scan'], [3.4, 'confirm']],
    },
    {
        id: 'outro', a: 76, b: 82,
        voice: { at: 0.5, text: 'CertiChain. Your records, verified and provable.' },
        cues: [[0.4, 'swell'], [1.6, 'complete']],
    },
]

export const DURATION = SCENES[SCENES.length - 1].b
export const STEP_COUNT = 7

export const sceneAt = (t) => SCENES.find((s) => t >= s.a && t < s.b) || SCENES[SCENES.length - 1]
