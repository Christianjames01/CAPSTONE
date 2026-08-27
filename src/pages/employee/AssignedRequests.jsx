import EmployeeRequestList from './RequestList'

function AssignedRequests() {
    return (
        <EmployeeRequestList
            title="Assigned Requests"
            subtitle="All document requests assigned to you."
            statusFilter={null}
            showFilterChips
            emptyText="There are currently no requests assigned to you."
        />
    )
}

export default AssignedRequests
