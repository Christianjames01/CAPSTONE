// The Registrar's Office contact details, in one place so every screen that
// shows them (Help & Support, the "waiting for verification" screen) stays
// in sync. `*Href` values are dialable/linkable forms of the display text.
//
// The flat telephone/mobile fields below are the Main Campus numbers, kept
// for screens that only show one set of contact details. `campuses` holds
// both campuses for screens that should show Bajada too.

export const REGISTRAR_CONTACT = {
    office: 'Office of Registration and Records Management (ORRM)',
    address: 'Sta. Ana Avenue corner C. De Guzman Street, Brgy. 14-B, Davao City, Philippines',
    email: 'registrar@hcdc.edu.ph',
    telephone: '(082) 221-9071 to 79 loc. 116 or 167',
    telephoneHref: 'tel:+63822219071',
    telefax: '(082) 221-3008',
    mobile: 'Smart (+63) 946 810 8617 · Globe (+63) 906 150 9582',
    mobileNumbers: [
        { label: 'Smart', display: '(+63) 946 810 8617', href: 'tel:+639468108617' },
        { label: 'Globe', display: '(+63) 906 150 9582', href: 'tel:+639061509582' },
    ],
    website: 'www.hcdc.edu.ph',
    campuses: [
        {
            name: 'Main Campus',
            telephone: '(082) 221-9071 to 79 loc. 116 or 167',
            telephoneHref: 'tel:+63822219071',
            mobileNumbers: [
                { label: 'Smart', display: '(+63) 946 810 8617', href: 'tel:+639468108617' },
                { label: 'Globe', display: '(+63) 906 150 9582', href: 'tel:+639061509582' },
            ],
        },
        {
            name: 'Bajada Campus',
            telephone: '(082) 287-4251 loc. 1502',
            telephoneHref: 'tel:+63822874251',
            mobileNumbers: [
                { label: 'Mobile', display: '(+63) 907 302 1334', href: 'tel:+639073021334' },
            ],
        },
    ],
}
