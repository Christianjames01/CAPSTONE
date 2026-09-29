import UserGuide from '../../components/UserGuide'
import { EMPLOYEE_GUIDE } from '../../lib/userGuideContent'

function EmployeeUserGuide() {
    return (
        <UserGuide
            title="User Guide"
            intro="How to handle assigned requests, from verification to release."
            sections={EMPLOYEE_GUIDE}
            cardClassName="employee-card"
            walkthrough="employee"
        />
    )
}

export default EmployeeUserGuide
