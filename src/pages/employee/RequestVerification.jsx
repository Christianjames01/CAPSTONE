import EmployeeRequestList from './RequestList'

function RequestVerification() {
    return (
        <EmployeeRequestList
            title="Request Verification"
            subtitle="Requests awaiting payment or requirement verification. Open a request to review student information, submitted requirements, and the official receipt."
            statusFilter={['pending', 'payment_pending', 'receipt_uploaded']}
            emptyText="Nothing needs verification right now."
        />
    )
}

export default RequestVerification
