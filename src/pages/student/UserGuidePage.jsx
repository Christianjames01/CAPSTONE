import UserGuide from '../../components/UserGuide'
import { STUDENT_GUIDE } from '../../lib/userGuideContent'

function StudentUserGuide() {
    return (
        <UserGuide
            title="User Guide"
            intro="How to request, pay for, track and claim your documents."
            sections={STUDENT_GUIDE}
            cardClassName="student-card"
        />
    )
}

export default StudentUserGuide
