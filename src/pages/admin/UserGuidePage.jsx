import UserGuide from '../../components/UserGuide'
import { HEAD_GUIDE } from '../../lib/userGuideContent'

function AdminUserGuide() {
    return (
        <UserGuide
            title="User Guide"
            intro="How to run the Registrar’s Office in CertiChain as Registrar Head."
            sections={HEAD_GUIDE}
            cardClassName="admin-card"
        />
    )
}

export default AdminUserGuide
