import { BrowserRouter, Routes, Route } from 'react-router-dom'

import ProtectedRoute from './components/ProtectedRoute'

import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import EmployeeRegister from './pages/auth/EmployeeRegister'
import AuthCallback from './pages/auth/AuthCallback'
import CompleteProfile from './pages/auth/CompleteProfile'

// LANDING PAGE
import LandingPage from './pages/LandingPage/LandingPage'

// STUDENT
import StudentLayout from './pages/student/StudentLayout'
import Dashboard from './pages/student/Dashboard'
import NewRequest from './pages/student/NewRequest'
import MyRequest from './pages/student/MyRequest'
import StudentRequestDetails from './pages/student/RequestDetails'
import UploadReceipt from './pages/student/UploadReceipt'
import UploadReceiptList from './pages/student/UploadReceiptList'
import UploadRequirements from './pages/student/UploadRequirements'
import StudentClaimSchedule from './pages/student/ClaimSchedule'
import StudentMessages from './pages/student/Messages'
import Notifications from './pages/student/Notifications'
import Profile from './pages/student/Profile'
import HelpSupport from './pages/student/HelpSupport'

// EMPLOYEE
import EmployeeLayout from './pages/employee/EmployeeLayout'
import EmployeeDashboard from './pages/employee/Dashboard'
import EmployeeRequestDetails from './pages/employee/RequestDetails'
import ClaimSchedule from './pages/employee/ClaimSchedule'
import AssignedRequests from './pages/employee/AssignedRequests'
import RequestVerification from './pages/employee/RequestVerification'
import DocumentProcessing from './pages/employee/DocumentProcessing'
import ClaimScheduleList from './pages/employee/ClaimScheduleList'
import EmployeeStudents from './pages/employee/Students'
import StudentHistory from './pages/employee/StudentHistory'
import EmployeeMessages from './pages/employee/Messages'
import EmployeeNotifications from './pages/employee/Notifications'
import ActivityLogs from './pages/employee/ActivityLogs'
import EmployeeProfile from './pages/employee/Profile'

// ADMIN / REGISTRAR HEAD
import AdminLayout from './pages/admin/AdminLayout'
import AdminDashboard from './pages/admin/Dashboard'
import AllRequests from './pages/admin/AllRequests'
import AdminRequestDetails from './pages/admin/RequestDetails'
import Assignments from './pages/admin/Assignments'
import AdminEmployees from './pages/admin/Employees'
import EmployeeDetails from './pages/admin/EmployeeDetails'
import AdminStudents from './pages/admin/Students'
import AdminStudentDetails from './pages/admin/StudentDetails'
import AdminDocuments from './pages/admin/Documents'
import CollegesPrograms from './pages/admin/CollegesPrograms'
import AdminClaimSchedules from './pages/admin/ClaimSchedules'
import OfficialReceipts from './pages/admin/OfficialReceipts'
import AdminMessages from './pages/admin/Messages'
import AdminNotifications from './pages/admin/Notifications'
import AdminActivityLogs from './pages/admin/ActivityLogs'
import Reports from './pages/admin/Reports'
import AdminProfile from './pages/admin/Profile'

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* ========================= */}
        {/* LANDING PAGE */}
        {/* ========================= */}

        <Route
          path="/"
          element={<LandingPage />}
        />

        {/* ========================= */}
        {/* AUTH */}
        {/* ========================= */}

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/register"
          element={<Register />}
        />

        <Route
          path="/register/employee"
          element={<EmployeeRegister />}
        />

        <Route
          path="/auth/callback"
          element={<AuthCallback />}
        />

        <Route
          path="/complete-profile"
          element={<CompleteProfile />}
        />

        {/* ========================= */}
        {/* STUDENT */}
        {/* ========================= */}

        <Route element={<StudentLayout />}>

          <Route
            path="/student/dashboard"
            element={<Dashboard />}
          />

          <Route
            path="/student/new-request"
            element={<NewRequest />}
          />

          <Route
            path="/student/my-requests"
            element={<MyRequest />}
          />

          <Route
            path="/student/request/:requestId"
            element={<StudentRequestDetails />}
          />

          <Route
            path="/student/request/:requestId/upload-receipt"
            element={<UploadReceipt />}
          />

          <Route
            path="/student/request/:requestId/requirements"
            element={<UploadRequirements />}
          />

          <Route
            path="/student/upload-receipt"
            element={<UploadReceiptList />}
          />

          <Route
            path="/student/claim-schedule"
            element={<StudentClaimSchedule />}
          />

          <Route
            path="/student/messages"
            element={<StudentMessages />}
          />

          <Route
            path="/student/notifications"
            element={<Notifications />}
          />

          <Route
            path="/student/profile"
            element={<Profile />}
          />

          <Route
            path="/student/help"
            element={<HelpSupport />}
          />

        </Route>

        {/* ========================= */}
        {/* EMPLOYEE */}
        {/* ========================= */}

        <Route element={<EmployeeLayout />}>

          <Route
            path="/employee/dashboard"
            element={<EmployeeDashboard />}
          />

          <Route
            path="/employee/requests"
            element={<AssignedRequests />}
          />

          <Route
            path="/employee/requests/:requestId"
            element={<EmployeeRequestDetails />}
          />

          <Route
            path="/employee/requests/:requestId/claim-schedule"
            element={<ClaimSchedule />}
          />

          <Route
            path="/employee/verification"
            element={<RequestVerification />}
          />

          <Route
            path="/employee/processing"
            element={<DocumentProcessing />}
          />

          <Route
            path="/employee/claim-schedule"
            element={<ClaimScheduleList />}
          />

          <Route
            path="/employee/students"
            element={<EmployeeStudents />}
          />

          <Route
            path="/employee/students/:studentId"
            element={<StudentHistory />}
          />

          <Route
            path="/employee/messages"
            element={<EmployeeMessages />}
          />

          <Route
            path="/employee/notifications"
            element={<EmployeeNotifications />}
          />

          <Route
            path="/employee/activity-logs"
            element={<ActivityLogs />}
          />

          <Route
            path="/employee/profile"
            element={<EmployeeProfile />}
          />

        </Route>

        {/* ========================= */}
        {/* ADMIN / REGISTRAR HEAD */}
        {/* ========================= */}

        <Route
          element={
            <ProtectedRoute allowedRoles={['admin', 'registrar_head']}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >

          <Route
            path="/admin/dashboard"
            element={<AdminDashboard />}
          />

          <Route
            path="/admin/requests"
            element={<AllRequests />}
          />

          <Route
            path="/admin/requests/:requestId"
            element={<AdminRequestDetails />}
          />

          <Route
            path="/admin/assignments"
            element={<Assignments />}
          />

          <Route
            path="/admin/employees"
            element={<AdminEmployees />}
          />

          <Route
            path="/admin/employees/:employeeId"
            element={<EmployeeDetails />}
          />

          <Route
            path="/admin/students"
            element={<AdminStudents />}
          />

          <Route
            path="/admin/students/:studentId"
            element={<AdminStudentDetails />}
          />

          <Route
            path="/admin/documents"
            element={<AdminDocuments />}
          />

          <Route
            path="/admin/colleges-programs"
            element={<CollegesPrograms />}
          />

          <Route
            path="/admin/claim-schedules"
            element={<AdminClaimSchedules />}
          />

          <Route
            path="/admin/receipts"
            element={<OfficialReceipts />}
          />

          <Route
            path="/admin/messages"
            element={<AdminMessages />}
          />

          <Route
            path="/admin/notifications"
            element={<AdminNotifications />}
          />

          <Route
            path="/admin/activity-logs"
            element={<AdminActivityLogs />}
          />

          <Route
            path="/admin/reports"
            element={<Reports />}
          />

          <Route
            path="/admin/profile"
            element={<AdminProfile />}
          />

        </Route>

      </Routes>
    </BrowserRouter>
  )
}

export default App