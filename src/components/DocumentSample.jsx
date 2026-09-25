import hcdcLogo from '../assets/hcdc-logo.png'

// Illustrative mock-ups of each registrar document, drawn as SVG. Shown
// wherever a document has no real sample image uploaded by the head: the
// student's New Request page (filled in with the student's own details)
// and the landing page's Document Catalog (placeholder details).

const YEAR_LEVEL_ORDER = ['First Year', 'Second Year', 'Third Year', 'Fourth Year']


// Every document_code in the document_types table gets an explicit entry
// here so nothing silently falls through to the generic 'letter' layout by
// accident (that's what happened with "DIP-CTC" and "COGRA" previously --
// they were listed as "DIP" and "COGR", which never matched anything).
const SAMPLE_LAYOUT_BY_CODE = {
    TOR: 'grades',
    COG: 'grades',
    POG: 'grades',
    CGCE: 'grades',
    CGWA: 'gwa',
    POCS: 'schedule',
    POE: 'evaluation',
    CRUS: 'evaluation',
    CCAR: 'evaluation',
    CUE: 'evaluation',
    'DIP-CTC': 'diploma',
    COGRA: 'diploma',
    HD: 'diploma',
    AAD: 'letter',
    ADC: 'letter',
    CAAE: 'letter',
    CCEP: 'letter',
    CCOM: 'letter',
    CGS: 'letter',
    CHON: 'letter',
    CIRS: 'letter',
    COE: 'letter',
    COESE: 'letter',
    COEUE: 'letter',
    COR: 'letter',
    'COR-RES': 'letter',
    CTC: 'letter',
    CURR: 'letter',
    LNO: 'letter',
    LOC: 'letter',
    'MAR-CERT': 'letter',
    PRINT: 'letter',
    QAC: 'letter',
    REF: 'letter',
    SCAN: 'letter',
    SO: 'letter',
    VAC: 'letter',
}


function sampleLayoutFor(documentCode) {
    return SAMPLE_LAYOUT_BY_CODE[documentCode] || 'letter'
}

function SealImage({ cx, cy, r, grayscale = false }) {
    const clipId = `seal-clip-${cx}-${cy}-${r}`
    const filterId = `seal-gray-${cx}-${cy}-${r}`

    return (
        <>
            <defs>
                <clipPath id={clipId}>
                    <circle cx={cx} cy={cy} r={r - 1} />
                </clipPath>
                {grayscale && (
                    <filter id={filterId}>
                        <feColorMatrix type="saturate" values="0" />
                    </filter>
                )}
            </defs>
            <image
                href={hcdcLogo}
                x={cx - r}
                y={cy - r}
                width={r * 2}
                height={r * 2}
                clipPath={`url(#${clipId})`}
                filter={grayscale ? `url(#${filterId})` : undefined}
                preserveAspectRatio="xMidYMid slice"
            />
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={grayscale ? 'var(--slate)' : 'var(--red)'} strokeWidth="1.5" />
        </>
    )
}

function SampleHeader({ title }) {
    return (
        <>
            <rect x="0.5" y="0.5" width="559" height="56" rx="8" fill="var(--blue)" />
            <rect x="0.5" y="40" width="559" height="16.5" fill="var(--blue)" />
            <circle cx="34" cy="28" r="16" fill="var(--white)" />
            <SealImage cx={34} cy={28} r={16} />
            <text x="60" y="24" fontSize="13" fontWeight="700" fill="var(--white)">HOLY CROSS OF DAVAO COLLEGE</text>
            <text x="60" y="40" fontSize="11" fill="rgba(255,255,255,0.8)">Office of the Registrar</text>
            <text x="280" y="82" textAnchor="middle" fontSize="13.5" fontWeight="700" fill="var(--ink)" letterSpacing="0.5">
                {title}
            </text>
        </>
    )
}

const REGISTRAR_HEAD_NAME = 'Jen Yee'
const REGISTRAR_HEAD_TITLE = 'Registrar Head'

const fitProps = (text, naturalFitChars, pxWidth) =>
    text && text.length > naturalFitChars
        ? { textLength: pxWidth, lengthAdjust: 'spacingAndGlyphs' }
        : {}

function SampleFooter({ y = 312 }) {
    return (
        <>
            <line x1="24" y1={y} x2="536" y2={y} stroke="var(--line)" />
            <line x1="380" y1={y + 28} x2="536" y2={y + 28} stroke="var(--slate)" />
            <text x="458" y={y + 42} textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--ink)">
                {REGISTRAR_HEAD_NAME}
            </text>
            <text x="458" y={y + 54} textAnchor="middle" fontSize="8" fill="var(--slate)">
                {REGISTRAR_HEAD_TITLE}
            </text>
            <SealImage cx={60} cy={y + 33} r={18} grayscale />
        </>
    )
}

const YEAR_LEVEL_LABELS = { 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year', 5: '5th Year' }
function formatYearLevel(yearLevel) {
    if (!yearLevel) return ''
    return YEAR_LEVEL_LABELS[yearLevel] || yearLevel
}

function StudentInfoRow({ y = 110, student }) {
    return (
        <g fontSize="10" fill="var(--slate)">
            <text x="24" y={y}>Student Name</text>
            <text
                x="24" y={y + 16} fontSize="11.5" fill="var(--ink)" fontWeight="600"
                {...fitProps(student?.fullName, 34, 260)}
            >
                {student?.fullName || 'Juan Dela Cruz'}
            </text>

            <text x="300" y={y}>Student Number</text>
            <text x="300" y={y + 16} fontSize="11.5" fill="var(--ink)" fontWeight="600">
                {student?.studentNumber || '2021-00000'}
            </text>

            <text x="24" y={y + 36}>Program</text>
            <text
                x="24" y={y + 52} fontSize="11.5" fill="var(--ink)" fontWeight="600"
                {...fitProps(student?.programName, 34, 260)}
            >
                {student?.programName || 'BS Information Technology'}
            </text>

            <text x="300" y={y + 36}>Year Level</text>
            <text
                x="300" y={y + 52} fontSize="11.5" fill="var(--ink)" fontWeight="600"
                {...fitProps(formatYearLevel(student?.yearLevel), 30, 220)}
            >
                {formatYearLevel(student?.yearLevel) || '3rd Year'}
            </text>
        </g>
    )
}

function getMajorSubjectPrefixes(programName = '') {
    const p = programName.toLowerCase()
    const has = (...keywords) => keywords.every((k) => p.includes(k))

    if (has('educational management')) return [['EDUC', 'Educational Leadership'], ['EDUC', 'School Administration']]
    if (has('theology')) return [['THEO', 'Foundations of Theology'], ['THEO', 'Biblical Studies']]
    if (has('guidance and counseling')) return [['GC', 'Theories of Counseling'], ['GC', 'Psychological Assessment']]
    if (has('sped')) return [['SNED', 'Foundations of Special and Inclusive Education'], ['SNED', 'Assessment of Learners with Disabilities']]

    if (has('information technology')) return [['IT', 'Introduction to Computing'], ['IT', 'Computer Programming 1']]
    if (has('computer science')) return [['CS', 'Discrete Mathematics'], ['CS', 'Programming Logic and Design']]
    if (has('computer engineering')) return [['CPE', 'Electrical Circuits'], ['CPE', 'Digital Logic Design']]
    if (has('electronics engineering')) return [['ECE', 'Electricity and Magnetism'], ['ECE', 'Electronic Circuits']]

    if (has('criminology')) return [['CRIM', 'Introduction to Criminology'], ['CRIM', 'Philippine Criminal Justice System']]
    if (has('psychology')) return [['PSYCH', 'General Psychology'], ['PSYCH', 'Abnormal Psychology']]
    if (has('social work')) return [['SW', 'Introduction to Social Work'], ['SW', 'Social Welfare and Development']]

    if (has('management accounting')) return [['ACC', 'Financial Accounting and Reporting'], ['MA', 'Management Accounting']]
    if (has('accountancy')) return [['ACC', 'Financial Accounting and Reporting'], ['ACC', 'Cost Accounting']]
    if (has('financial management')) return [['BA', 'Principles of Management'], ['FM', 'Financial Management']]
    if (has('human resource management')) return [['BA', 'Principles of Management'], ['HRM', 'Human Resource Management']]
    if (has('marketing management')) return [['BA', 'Principles of Management'], ['MKT', 'Marketing Management']]
    if (has('hospitality management')) return [['HM', 'Introduction to Hospitality Management'], ['HM', 'Food and Beverage Services']]
    if (has('tourism management')) return [['TM', 'Introduction to Tourism'], ['TM', 'Tourism Planning and Development']]
    if (has('customs administration')) return [['CA', 'Customs Laws and Regulations'], ['CA', 'Tariff and Trade Policy']]
    if (has('real estate management')) return [['REM', 'Real Estate Fundamentals'], ['REM', 'Property Appraisal']]
    if (has('management')) return [['MGT', 'Strategic Management'], ['MGT', 'Organizational Behavior']]

    if (has('marine transportation')) return [['MT', 'Marine Navigation'], ['MT', 'Seamanship']]
    if (has('economics')) return [['ECON', 'Principles of Economics'], ['ECON', 'Microeconomics']]

    if (has('english language studies')) return [['ENG', 'Introduction to Linguistics'], ['ENG', 'Survey of English Literature']]
    if (has('history')) return [['HIST', 'Philippine History'], ['HIST', 'World History']]
    if (has('arts in philosophy')) return [['PHIL', 'Introduction to Philosophy'], ['PHIL', 'Logic']]
    if (has('political science')) return [['POLS', 'Introduction to Political Science'], ['POLS', 'Philippine Government and Constitution']]

    if (has('journalism')) return [['COM', 'Introduction to Mass Communication'], ['COM', 'Broadcast Journalism']]
    if (has('new media')) return [['COM', 'Introduction to Mass Communication'], ['COM', 'Digital and New Media']]
    if (has('communication')) return [['COM', 'Introduction to Mass Communication'], ['COM', 'Communication Research']]

    if (has('library and information science')) return [['LIS', 'Introduction to Library Science'], ['LIS', 'Cataloguing and Classification']]
    if (has('physical education')) return [['PE', 'Foundations of Physical Education'], ['PE', 'Kinesiology']]

    if (has('early childhood education')) return [['ECED', 'Child Growth and Development'], ['ECED', 'Early Childhood Curriculum']]
    if (has('elementary education')) return [['EDUC', 'Principles of Teaching'], ['EDUC', 'Child and Adolescent Development']]
    if (has('secondary education', 'english')) return [['EDUC', 'Principles of Teaching'], ['ENG', 'Teaching English']]
    if (has('secondary education', 'filipino')) return [['EDUC', 'Principles of Teaching'], ['FIL', 'Pagtuturo ng Filipino']]
    if (has('secondary education', 'mathematics')) return [['EDUC', 'Principles of Teaching'], ['MATH', 'Teaching Mathematics']]
    if (has('secondary education', 'science')) return [['EDUC', 'Principles of Teaching'], ['SCI', 'Teaching Science']]
    if (has('secondary education', 'social studies')) return [['EDUC', 'Principles of Teaching'], ['SS', 'Teaching Social Studies']]
    if (has('secondary education', 'values education')) return [['EDUC', 'Principles of Teaching'], ['VE', 'Values Education']]
    if (has('special needs education') || has('special education')) return [['SNED', 'Foundations of Special and Inclusive Education'], ['SNED', 'Assessment of Learners with Disabilities']]
    if (has('education')) return [['EDUC', 'Curriculum Development'], ['EDUC', 'Educational Research']]

    return [['GE', 'Purposive Communication'], ['GE', 'Mathematics in the Modern World']]
}

function buildCourseCode(prefix, yearLevel, seq) {
    const yearDigit = String(parseInt(yearLevel, 10) || 1)
    return `${prefix} ${yearDigit}0${seq}`
}

function getMajorSubjects(programName, yearLevel) {
    const [[prefix1, title1], [prefix2, title2]] = getMajorSubjectPrefixes(programName)
    return [
        [buildCourseCode(prefix1, yearLevel, 1), title1],
        [buildCourseCode(prefix2, yearLevel, 2), title2],
    ]
}

const GRADES_TERM_ORDER = ['1st Semester', '2nd Semester', 'Summer']
const GRADES_TOP = 224
const GRADES_YEAR_LABEL_H = 18
const GRADES_TERM_LABEL_H = 14
const GRADES_ROW_H = 15
const GRADES_FOOTER_SPACE = 90

// A real TOR lists every course across the student's whole academic
// history -- group all of it by year then term (like the school's own
// evaluation form) instead of sampling a handful of rows.
function groupCoursesByYearAndTerm(courses) {
    const yearMap = new Map()
    for (const c of courses) {
        if (!yearMap.has(c.year_level)) yearMap.set(c.year_level, new Map())
        const termMap = yearMap.get(c.year_level)
        if (!termMap.has(c.term)) termMap.set(c.term, [])
        termMap.get(c.term).push(c)
    }

    return YEAR_LEVEL_ORDER
        .filter((year) => yearMap.has(year))
        .map((year) => ({
            year,
            terms: [...yearMap.get(year).entries()]
                .sort(([a], [b]) => GRADES_TERM_ORDER.indexOf(a) - GRADES_TERM_ORDER.indexOf(b))
                .map(([term, rows]) => ({
                    term,
                    rows: rows.sort((a, b) => a.display_order - b.display_order),
                })),
        }))
}

// Used both to size the SVG (DocumentSample) and to render it (GradesBody)
// so the two can never drift out of sync with each other.
function calcGradesContentHeight(student) {
    const courses = student?.curriculumCourses || []
    if (courses.length === 0) return 380

    let y = GRADES_TOP
    for (const yearGroup of groupCoursesByYearAndTerm(courses)) {
        y += GRADES_YEAR_LABEL_H
        for (const termGroup of yearGroup.terms) {
            y += GRADES_TERM_LABEL_H + termGroup.rows.length * GRADES_ROW_H
        }
    }
    return y + GRADES_FOOTER_SPACE
}

function Watermark({ centerY }) {
    const size = 300
    return (
        <>
            <defs>
                <filter id="watermark-gray">
                    <feColorMatrix type="saturate" values="0" />
                </filter>
            </defs>
            <image
                href={hcdcLogo}
                x={280 - size / 2}
                y={centerY - size / 2}
                width={size}
                height={size}
                filter="url(#watermark-gray)"
                opacity="0.06"
                preserveAspectRatio="xMidYMid meet"
            />
        </>
    )
}

function GradesBody({ student, height = 380 }) {
    const realCourses = student?.curriculumCourses || []
    const watermarkCenterY = (204 + (height - 90)) / 2

    const headerRow = (
        <g fontSize="9.5" fontWeight="700" fill="var(--slate)">
            <text x="24" y="194">COURSE CODE</text>
            <text x="110" y="194">DESCRIPTIVE TITLE</text>
            <text x="380" y="194">UNITS</text>
            <text x="440" y="194">GRADE</text>
            <text x="490" y="194">REMARKS</text>
        </g>
    )

    if (realCourses.length > 0) {
        const elements = []
        let y = GRADES_TOP

        groupCoursesByYearAndTerm(realCourses).forEach((yearGroup) => {
            elements.push(
                <text key={`year-${yearGroup.year}`} x="24" y={y} fontSize="10" fontWeight="700" fill="var(--ink)">
                    {yearGroup.year}
                </text>
            )
            y += GRADES_YEAR_LABEL_H

            yearGroup.terms.forEach((termGroup) => {
                elements.push(
                    <text key={`term-${yearGroup.year}-${termGroup.term}`} x="24" y={y} fontSize="9" fontWeight="700" fill="var(--blue)">
                        {termGroup.term}
                    </text>
                )
                y += GRADES_TERM_LABEL_H

                termGroup.rows.forEach((c) => {
                    elements.push(
                        <g key={c.curriculum_course_id} fontSize="9" fill="var(--ink)">
                            <text x="24" y={y}>{c.course_code}</text>
                            <text x="110" y={y}>{c.course_name}</text>
                            <text x="380" y={y}>{Number(c.units).toFixed(1)}</text>
                            <text x="440" y={y}>{c.grade || '-'}</text>
                            <text x="490" y={y} fill="var(--slate)">{c.grade ? 'Passed' : ''}</text>
                        </g>
                    )
                    y += GRADES_ROW_H
                })
            })
        })

        return (
            <>
                <StudentInfoRow student={student} />
                <line x1="24" y1="176" x2="536" y2="176" stroke="var(--line)" />
                {headerRow}
                <line x1="24" y1="202" x2="536" y2="202" stroke="var(--line)" />
                <Watermark centerY={watermarkCenterY} />
                {elements}
            </>
        )
    }

    const [major1, major2] = getMajorSubjects(student?.programName, student?.yearLevel)
    const rows = [
        [major1[0], major1[1], '3.0', '1.75', 'Passed'],
        [major2[0], major2[1], '3.0', '1.50', 'Passed'],
        ['NSTP 101', 'National Service Training Program 1', '3.0', '2.00', 'Passed'],
        ['PE 101', 'Physical Fitness', '2.0', '1.25', 'Passed'],
    ]

    return (
        <>
            <StudentInfoRow student={student} />
            <line x1="24" y1="176" x2="536" y2="176" stroke="var(--line)" />
            {headerRow}
            <line x1="24" y1="202" x2="536" y2="202" stroke="var(--line)" />

            {rows.map((row, i) => (
                <g key={row[0]} fontSize="9.5" fill="var(--ink)">
                    <text x="24" y={222 + i * 20}>{row[0]}</text>
                    <text x="110" y={222 + i * 20}>{row[1]}</text>
                    <text x="380" y={222 + i * 20}>{row[2]}</text>
                    <text x="440" y={222 + i * 20}>{row[3]}</text>
                    <text x="490" y={222 + i * 20} fill="var(--slate)">{row[4]}</text>
                </g>
            ))}
        </>
    )
}

function GwaBody({ student }) {
    return (
        <>
            <StudentInfoRow student={student} />
            <line x1="24" y1="176" x2="536" y2="176" stroke="var(--line)" />
            <Watermark centerY={230} />

            <rect x="24" y="196" width="512" height="80" rx="6" fill="var(--blue-tint)" />
            <text x="280" y="222" textAnchor="middle" fontSize="10" fill="var(--blue-dark)">GENERAL WEIGHTED AVERAGE</text>
            <text x="280" y="260" textAnchor="middle" fontSize="30" fontWeight="700" fill="var(--blue)">1.75</text>
        </>
    )
}

// Room names are real, verified facilities from HCDC's own published local
// directory (IT Laboratory 3, Computer Laboratory, College of Arts and
// Sciences) rather than invented room numbers -- HCDC doesn't publish a
// classroom numbering scheme, so a specific "Room 301" would be fabricated.
function ScheduleBody({ student }) {
    const [major1, major2] = getMajorSubjects(student?.programName, student?.yearLevel)
    const rows = [
        ['MON / WED', '8:00 – 9:30 AM', major1[1], 'IT Lab 3'],
        ['TUE / THU', '9:30 – 11:00 AM', major2[1], 'Computer Lab'],
        ['MON / WED', '1:00 – 2:30 PM', 'Purposive Communication', 'CAS Building'],
        ['FRIDAY', '3:00 – 5:00 PM', 'Physical Education', 'Gym'],
    ]

    return (
        <>
            <StudentInfoRow student={student} />
            <line x1="24" y1="176" x2="536" y2="176" stroke="var(--line)" />
            <Watermark centerY={230} />

            <g fontSize="9.5" fontWeight="700" fill="var(--slate)">
                <text x="24" y="194">DAY</text>
                <text x="150" y="194">TIME</text>
                <text x="300" y="194">SUBJECT</text>
                <text x="450" y="194">ROOM</text>
            </g>
            <line x1="24" y1="202" x2="536" y2="202" stroke="var(--line)" />

            {rows.map((row, i) => (
                <g key={row[0] + i} fontSize="9" fill="var(--ink)">
                    <text x="24" y={222 + i * 20}>{row[0]}</text>
                    <text x="150" y={222 + i * 20}>{row[1]}</text>
                    <text x="300" y={222 + i * 20}>{row[2]}</text>
                    <text x="450" y={222 + i * 20}>{row[3]}</text>
                </g>
            ))}
        </>
    )
}

function EvaluationBody({ student }) {
    const rows = [
        ['General Education Subjects', '39 units', 'Completed'],
        ['Major / Core Subjects', '78 units', 'Completed'],
        ['Elective Subjects', '9 units', '3 units remaining'],
        ['NSTP / PE', '10 units', 'Completed'],
    ]

    return (
        <>
            <StudentInfoRow student={student} />
            <line x1="24" y1="176" x2="536" y2="176" stroke="var(--line)" />
            <Watermark centerY={230} />

            <g fontSize="9.5" fontWeight="700" fill="var(--slate)">
                <text x="24" y="194">REQUIREMENT</text>
                <text x="330" y="194">UNITS</text>
                <text x="420" y="194">STATUS</text>
            </g>
            <line x1="24" y1="202" x2="536" y2="202" stroke="var(--line)" />

            {rows.map((row, i) => (
                <g key={row[0]} fontSize="9.5">
                    <text x="24" y={222 + i * 20} fill="var(--ink)">{row[0]}</text>
                    <text x="330" y={222 + i * 20} fill="var(--ink)">{row[1]}</text>
                    <text x="420" y={222 + i * 20} fill={row[2] === 'Completed' ? '#1e8a5f' : 'var(--red)'}>
                        {row[2] === 'Completed' ? '✓ ' : '• '}{row[2]}
                    </text>
                </g>
            ))}
        </>
    )
}

// Generic placeholder badge for the CHED accreditation seal that appears on
// a real HCDC diploma -- there's no actual CHED emblem asset in this
// project, so this is a plain labeled circle rather than a fabricated
// reproduction of the real seal.
function ChedBadge({ cx, cy, r }) {
    return (
        <g>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--blue)" strokeWidth="1.5" strokeDasharray="2 1.5" />
            <text x={cx} y={cy - 4} textAnchor="middle" fontSize="7" fontWeight="700" fill="var(--blue)">CHED</text>
            <text x={cx} y={cy + 7} textAnchor="middle" fontSize="5.5" fill="var(--slate)">ACCREDITED</text>
        </g>
    )
}

// Diploma layout deliberately mirrors the structure of an actual HCDC
// diploma -- bilingual (Filipino/English) legal-document wording, and
// signed by the VP for Academic Affairs / Board Chairman / President
// rather than the Registrar Head every other document uses. Names below
// are generic placeholders, not the specific individuals who'd actually
// sign a real one.
function DiplomaBody({ student }) {
    const fullName = (student?.fullName || 'Juan Dela Cruz').toUpperCase()
    const programName = (student?.programName || 'Bachelor of Science in Information Technology').toUpperCase()
    const year = new Date().getFullYear()

    return (
        <>
            <Watermark centerY={330} />

            {/* Ribbon banner */}
            <polygon points="30,14 60,14 60,50 45,58 30,50" fill="var(--blue-dark)" />
            <polygon points="530,14 500,14 500,50 515,58 530,50" fill="var(--blue-dark)" />
            <rect x="55" y="10" width="450" height="44" rx="2" fill="var(--blue)" stroke="var(--red)" strokeWidth="1.5" />
            <text x="280" y="37" textAnchor="middle" fontSize="17" fontWeight="700" fontStyle="italic" fill="var(--white)" fontFamily="Georgia, 'Times New Roman', serif">
                Holy Cross of Davao College
            </text>

            <SealImage cx={280} cy={95} r={32} />

            <g textAnchor="middle" fill="var(--ink)">
                <text x="280" y="150" fontSize="8.5">Sa Lahat ng Makatuwirang Kasulatang Ito, Mapagtanggap Bati</text>
                <text x="280" y="163" fontSize="8" fontStyle="italic" fill="var(--slate)">To All Persons To Whom These Presents May Come, Greetings:</text>

                <text x="280" y="188" fontSize="8">Ipinaaalam sa ang Pangulo ng Kolehiyo ng Holy Cross ng Dabaw, sa paggamit ng Kapangyarihang loob ng</text>
                <text x="280" y="200" fontSize="8">Republika ng Pilipinas at sa tagubilin ng mga Guro ng Paaralang Graduado, ay nagkawagi kay</text>
                <text x="280" y="214" fontSize="7.5" fontStyle="italic" fill="var(--slate)">Be it known, that the School President of the Holy Cross of Davao College, by authority of the</text>
                <text x="280" y="226" fontSize="7.5" fontStyle="italic" fill="var(--slate)">Republic of the Philippines, and on the recommendation of the Faculty, has conferred upon</text>

                <text x="280" y="258" fontSize="21" fontWeight="700" fontStyle="italic" fontFamily="Georgia, 'Times New Roman', serif" letterSpacing="0.5">
                    {fullName}
                </text>

                <text x="280" y="284" fontSize="8">na nakatupad sa lahat ng kinakailangang ukol dito, ng titulong</text>
                <text x="280" y="296" fontSize="7.5" fontStyle="italic" fill="var(--slate)">who has fulfilled all the requirements thereof, the degree of</text>

                <text x="280" y="320" fontSize="14" fontWeight="700" fill="var(--blue)">{programName}</text>

                <text x="280" y="346" fontSize="8">kalakip ang lahat ng karapatan, karangalan, at mga pribilehiyo, gayon din ang mga tungkulin</text>
                <text x="280" y="358" fontSize="7.5" fontStyle="italic" fill="var(--slate)">with all the rights, honors, and privileges, as well as the obligations thereunto appertaining.</text>

                <text x="280" y="384" fontSize="8">Bilang katunayan ay taglay nito ang lagda ng Kolehiyo ng Holy Cross ng Dabaw at ang mga lagda</text>
                <text x="280" y="396" fontSize="8">ng Pangalawang Pangulo para sa Kapakanang Pang-akademya, Pangulo ng Lupon ng mga Katiwala,</text>
                <text x="280" y="408" fontSize="8">at Pangulo ng Dalubhasaan.</text>
                <text x="280" y="422" fontSize="7.5" fontStyle="italic" fill="var(--slate)">In testimony whereof, the seal of the College and the signatures of the Vice President for</text>
                <text x="280" y="434" fontSize="7.5" fontStyle="italic" fill="var(--slate)">Academic Affairs, the Chairman of the Board of Trustees, and the President appear below.</text>

                <text x="280" y="458" fontSize="8">Inilagda sa Lungsod ng Dabaw, Republika ng Pilipinas, sa taong {year}.</text>
                <text x="280" y="470" fontSize="7.5" fontStyle="italic" fill="var(--slate)">Signed in the City of Davao, Republic of the Philippines, in the year {year}.</text>
            </g>

            {[
                { cx: 100, name: 'Fr. Michael A. Reyes', tl1: 'Pangalawang Pangulo, Pang-akademya', tl2: 'VP for Academic Affairs' },
                { cx: 280, name: 'Most Rev. Antonio M. Cruz', tl1: 'Tagapangulo, Lupon ng mga Katiwala', tl2: 'Chairman, Board of Trustees' },
                { cx: 460, name: 'Bro. Paulo J. Santos, S.C.', tl1: 'Pangulo', tl2: 'President' },
            ].map((sig) => (
                <g key={sig.cx} textAnchor="middle">
                    <line x1={sig.cx - 75} y1="505" x2={sig.cx + 75} y2="505" stroke="var(--slate)" />
                    <text x={sig.cx} y="519" fontSize="9" fontWeight="600" fill="var(--ink)">{sig.name}</text>
                    <text x={sig.cx} y="530" fontSize="6.5" fill="var(--slate)">{sig.tl1}</text>
                    <text x={sig.cx} y="540" fontSize="6.5" fontStyle="italic" fill="var(--slate)">{sig.tl2}</text>
                </g>
            ))}

            <line x1="24" y1="565" x2="536" y2="565" stroke="var(--line)" />
            <text x="24" y="584" fontSize="8" fill="var(--slate)">
                Special Order No. {String(year).slice(-2)}-{student?.studentNumber || '000000'}-1, Series {year}
            </text>

            <ChedBadge cx={505} cy={575} r={26} />
        </>
    )
}

// Distinct body text per document_code -- each entry is what follows "This
// is to certify that / [NAME]" for a standard certification letter. Kept
// short and code-specific rather than one paragraph reused for every type.
const CERTIFY_LETTER_LINES = {
    AAD: (p) => [
        `is a bona fide student under the ${p} program of Holy Cross of Davao College.`,
        'The academic documents on file for the above-named student are hereby',
        'authenticated as true and genuine records issued by this institution.',
    ],
    ADC: (p) => [
        `is a bona fide student under the ${p} program of Holy Cross of Davao College.`,
        'This certificate is issued for submission to the Embassy/Consulate of the',
        'United Arab Emirates, or other requiring party in Abu Dhabi.',
    ],
    CAAE: (p) => [
        `enrolled under the ${p} program, is in good academic standing with this`,
        'institution as of the date of issuance, with no derogatory academic record',
        'on file.',
    ],
    CCEP: (p) => [
        `a bona fide student under the ${p} program, is permitted to cross-enroll`,
        'in the subject(s) requested at another institution for the current',
        'academic term.',
    ],
    CCOM: (p) => [
        `has satisfactorily completed all academic requirements under the`,
        `${p} program of Holy Cross of Davao College.`,
    ],
    CGS: (p) => [
        `enrolled under the ${p} program, is a student in good standing at`,
        'Holy Cross of Davao College, with no pending disciplinary case or',
        'unsettled obligation on record.',
    ],
    CHON: (p) => [
        `enrolled under the ${p} program, has been included in the Dean's List`,
        'for outstanding academic performance at Holy Cross of Davao College.',
    ],
    CIRS: (p) => [
        `enrolled under the ${p} program, is currently classified as a regular`,
        'student based on the academic units enrolled for the current term.',
    ],
    COE: (p) => [
        `is officially enrolled under the ${p} program of Holy Cross of Davao`,
        'College for the current academic year and semester.',
    ],
    COESE: (p) => [
        `is officially enrolled under the ${p} program for the current term,`,
        'with the following subjects enrolled: Data Structures and Algorithms,',
        'Information Management 1, and Networking 1.',
    ],
    COEUE: (p) => [
        `enrolled under the ${p} program, has earned a total of 96 units`,
        'as of the current academic term.',
    ],
    COR: (p) => [
        `enrolled under the ${p} program, has been officially registered`,
        'for the current academic term at Holy Cross of Davao College.',
    ],
    'COR-RES': (p) => [
        `enrolled under the ${p} program, has been a resident student of`,
        'Holy Cross of Davao College for the duration of their studies to date.',
    ],
    CTC: () => [
        'The attached document(s) are true and faithful copies of the original',
        'records on file with the Office of the Registrar for the above-named',
        'student.',
    ],
    LNO: (p) => [
        `Holy Cross of Davao College has no objection to the request of the`,
        `above-named student, enrolled under the ${p} program, for the`,
        'purpose stated in their application.',
    ],
    LOC: (p) => [
        `is a bona fide student of Holy Cross of Davao College under the`,
        `${p} program, currently enrolled and in good standing.`,
    ],
    'MAR-CERT': (p) => [
        `enrolled under the ${p} program, has met the academic requirements`,
        'set forth by the Maritime Industry Authority (MARINA) as of the',
        'date of issuance.',
    ],
    QAC: (p) => [
        `is a bona fide student under the ${p} program of Holy Cross of Davao College.`,
        'This certificate is issued for submission to the Embassy/Consulate of',
        'the State of Qatar, or other requiring party in Qatar.',
    ],
    REF: (p) => [
        `has been a student under the ${p} program of Holy Cross of Davao`,
        'College, and is known to this institution for their conduct and',
        'academic performance during their studies.',
    ],
    VAC: (p) => [
        `enrolled under the ${p} program, is hereby verified against the`,
        'academic records on file with the Office of the Registrar as of',
        'the date of issuance.',
    ],
}

function CertifyLetterBody({ documentCode, student }) {
    const programName = student?.programName || 'Bachelor of Science in Information Technology'
    const lines = CERTIFY_LETTER_LINES[documentCode]?.(programName)
        || [
            `is a bona fide student of Holy Cross of Davao College under the`,
            `${programName} program, and is currently in good academic standing.`,
        ]

    return (
        <>
            <line x1="180" y1="94" x2="380" y2="94" stroke="var(--red)" strokeWidth="1.5" />
            <Watermark centerY={230} />

            <g fontSize="9" fill="var(--slate)">
                <text x="24" y="130">This is to certify that</text>
                <text x="24" y="148" fontSize="12" fill="var(--ink)" fontWeight="600">
                    {student?.fullName || 'Juan Dela Cruz'}
                </text>

                {lines.map((line, i) => (
                    <text key={i} x="24" y={172 + i * 20}>{line}</text>
                ))}
            </g>

            <StudentInfoRow y={272} student={student} />
        </>
    )
}

// Course Description / Syllabus isn't a certify-that letter at all -- it's a
// listing of course content, so it gets its own table-shaped arrangement.
function CourseDescriptionBody({ student }) {
    const rows = [
        ['CC 101', 'Introduction to Computing', 'Overview of computing concepts, hardware, and information systems.'],
        ['CC 102', 'Computer Programming 1', 'Fundamentals of programming logic, syntax, and problem-solving.'],
        ['IPT 101', 'Integrative Programming and Technologies 1', 'Web-based application development using current frameworks.'],
    ]

    return (
        <>
            <StudentInfoRow student={student} />
            <line x1="24" y1="176" x2="536" y2="176" stroke="var(--line)" />
            <Watermark centerY={230} />

            <g fontSize="9.5" fontWeight="700" fill="var(--slate)">
                <text x="24" y="194">COURSE</text>
                <text x="90" y="194">TITLE</text>
                <text x="280" y="194">DESCRIPTION</text>
            </g>
            <line x1="24" y1="202" x2="536" y2="202" stroke="var(--line)" />

            {rows.map((row, i) => (
                <g key={row[0]} fontSize="8.5" fill="var(--ink)">
                    <text x="24" y={222 + i * 32}>{row[0]}</text>
                    <text x="90" y={222 + i * 32} fontWeight="600">{row[1]}</text>
                    <text x="280" y={222 + i * 32} fill="var(--slate)">{row[2].slice(0, 46)}</text>
                    <text x="280" y={222 + i * 32 + 14} fill="var(--slate)">{row[2].slice(46)}</text>
                </g>
            ))}
        </>
    )
}

// A Special Order is a CHED-recognized official document, not a plain
// certify-that letter -- it carries its own reference number and cites the
// governing authority.
function SpecialOrderBody({ student }) {
    const programName = student?.programName || 'Bachelor of Science in Information Technology'

    return (
        <>
            <Watermark centerY={220} />
            <text x="280" y="120" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="var(--ink)">
                SPECIAL ORDER NO. 2026-000123
            </text>
            <g fontSize="9" fill="var(--slate)">
                <text x="24" y="156">Pursuant to the authority vested in the Commission on Higher Education</text>
                <text x="24" y="176">(CHED), this Special Order is hereby issued in favor of</text>
            </g>
            <text x="24" y="200" fontSize="12" fill="var(--ink)" fontWeight="600">
                {student?.fullName || 'Juan Dela Cruz'}
            </text>
            <g fontSize="9" fill="var(--slate)">
                <text x="24" y="224">enrolled under the {programName} program of Holy Cross of Davao</text>
                <text x="24" y="244">College, in accordance with the requirements set by CHED.</text>
            </g>
            <StudentInfoRow y={280} student={student} />
        </>
    )
}

function RegistrarPrintoutBody({ student }) {
    return (
        <>
            <StudentInfoRow student={student} />
            <line x1="24" y1="176" x2="536" y2="176" stroke="var(--line)" />
            <Watermark centerY={230} />

            <g fontSize="9" fill="var(--slate)">
                <text x="24" y="200">The following is a printout of the records currently on file with the</text>
                <text x="24" y="220">Office of the Registrar for the above-named student, produced for</text>
                <text x="24" y="240">reference purposes.</text>
            </g>
        </>
    )
}

function ScanningReceiptBody({ student }) {
    return (
        <>
            <StudentInfoRow student={student} />
            <line x1="24" y1="176" x2="536" y2="176" stroke="var(--line)" />
            <Watermark centerY={230} />

            <g fontSize="9" fill="var(--slate)">
                <text x="24" y="200">This confirms that document scanning services have been completed</text>
                <text x="24" y="220">for the file(s) submitted by the above-named student, ready for</text>
                <text x="24" y="240">release to the requesting party.</text>
            </g>
        </>
    )
}

const LETTER_LAYOUT_BODY = {
    CURR: CourseDescriptionBody,
    SO: SpecialOrderBody,
    PRINT: RegistrarPrintoutBody,
    SCAN: ScanningReceiptBody,
}

function LetterBody({ documentCode, student }) {
    const Special = LETTER_LAYOUT_BODY[documentCode]
    if (Special) return <Special student={student} />

    return <CertifyLetterBody documentCode={documentCode} student={student} />
}

const SAMPLE_BODY = {
    grades: GradesBody,
    gwa: GwaBody,
    schedule: ScheduleBody,
    evaluation: EvaluationBody,
    diploma: DiplomaBody,
    letter: LetterBody,
}

export function DocumentSample({ name, documentCode, student }) {
    const layout = sampleLayoutFor(documentCode)
    const Body = SAMPLE_BODY[layout] || LetterBody

    // Every other layout is a short, fixed illustrative mockup -- only
    // 'grades' (TOR/COG/POG/CGCE) renders the student's real, full-length
    // curriculum, which needs a canvas sized to fit however long that is.
    // 'diploma' draws its own ribbon header and three-signature footer
    // (a diploma isn't signed by the Registrar Head like every other
    // document), so it skips the shared header/footer entirely.
    const height = layout === 'grades' ? calcGradesContentHeight(student) : layout === 'diploma' ? 620 : 380
    const footerY = height - 68
    const isDiploma = layout === 'diploma'

    // This mockup represents a physical printed document -- it must always
    // look like paper (dark ink on a white page), never invert with the
    // app's dark mode. Re-pinning the tokens it draws with here, rather
    // than rewriting every fill/stroke inside it, keeps it immune to
    // whatever dark-mode values are in effect on an ancestor element.
    const paperColors = {
        '--white': '#FFFFFF',
        '--ink': '#101827',
        '--slate': '#57616F',
        '--line': 'rgba(16, 24, 39, 0.12)',
        '--blue': '#123B78',
        '--blue-dark': '#0A2450',
        '--blue-tint': '#EAF1FB',
        '--red': '#C8102E',
    }

    return (
        <svg
            viewBox={`0 0 560 ${height}`}
            style={{ width: '100%', height: 'auto', ...paperColors }}
            role="img"
            aria-label={`Sample layout of ${name}`}
        >
            <rect x="0.5" y="0.5" width="559" height={height - 1} rx="8" fill="var(--white)" stroke="var(--line)" />
            {!isDiploma && <SampleHeader title={name.toUpperCase()} />}
            <Body name={name} documentCode={documentCode} student={student} height={height} />
            {!isDiploma && <SampleFooter y={footerY} />}
        </svg>
    )
}
