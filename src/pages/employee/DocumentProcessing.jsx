import EmployeeRequestList from './RequestList'

function DocumentProcessing() {
    return (
        <EmployeeRequestList
            title="Document Processing"
            subtitle="Requests that are verified and ready to process, or currently being prepared. Open a request to update its status and generate the digital credential."
            statusFilter={['receipt_verified', 'processing']}
            emptyText="Nothing is currently in processing."
        />
    )
}

export default DocumentProcessing
