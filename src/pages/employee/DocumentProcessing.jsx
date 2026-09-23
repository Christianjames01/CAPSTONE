import EmployeeRequestList from './RequestList'

function DocumentProcessing() {
    return (
        <EmployeeRequestList
            title="Document Processing"
            subtitle="Requests that are verified and ready to process, being prepared, or waiting on missing requirements. Open a request to update its status and generate the digital credential."
            statusFilter={['receipt_verified', 'processing', 'lacking_requirements']}
            emptyText="Nothing is currently in processing."
        />
    )
}

export default DocumentProcessing
