import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import PageLoading from './components/PageLoading'

// Each page is downloaded the first time it's opened (code splitting), so
// signing in doesn't mean downloading every page of every portal.

import ProtectedRoute from './components/ProtectedRoute'
import RequireFullEmployeeAccess from './components/RequireFullEmployeeAccess'
import StudentVerificationGate from './components/StudentVerificationGate'
import HomeRoute from './components/HomeRoute'

const Login = lazy(() => import('./pages/auth/Login'))
const Register = lazy(() => import('./pages/auth/Register'))
const EmployeeRegister = lazy(() => import('./pages/auth/EmployeeRegister'))
const AuthCallback = lazy(() => import('./pages/auth/AuthCallback'))
const CompleteProfile = lazy(() => import('./pages/auth/CompleteProfile'))
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'))
const ForceChangePassword = lazy(() => import('./pages/auth/ForceChangePassword'))

const Terms = lazy(() => import('./pages/legal/Terms'))
const PrivacyPolicy = lazy(() => import('./pages/legal/PrivacyPolicy'))
const CookiePolicy = lazy(() => import('./pages/legal/CookiePolicy'))
const RefundPolicy = lazy(() => import('./pages/legal/RefundPolicy'))

const VerifyCredential = lazy(() => import('./pages/verify/VerifyCredential'))
const QueueDisplay = lazy(() => import('./pages/QueueDisplay'))
const SystemWorkflow = lazy(() => import('./pages/workflow/SystemWorkflow'))

const StudentLayout = lazy(() => import('./pages/student/StudentLayout'))
const Dashboard = lazy(() => import('./pages/student/Dashboard'))
const NewRequest = lazy(() => import('./pages/student/NewRequest'))
const MyRequest = lazy(() => import('./pages/student/MyRequest'))
const StudentRequestDetails = lazy(() => import('./pages/student/RequestDetails'))
const UploadReceipt = lazy(() => import('./pages/student/UploadReceipt'))
const UploadReceiptList = lazy(() => import('./pages/student/UploadReceiptList'))
const UploadRequirements = lazy(() => import('./pages/student/UploadRequirements'))
const StudentClaimSchedule = lazy(() => import('./pages/student/ClaimSchedule'))
const StudentMessages = lazy(() => import('./pages/student/Messages'))
const Notifications = lazy(() => import('./pages/student/Notifications'))
const Profile = lazy(() => import('./pages/student/Profile'))
const HelpSupport = lazy(() => import('./pages/student/HelpSupport'))
const StudentUserGuide = lazy(() => import('./pages/student/UserGuidePage'))
const EmployeeUserGuide = lazy(() => import('./pages/employee/UserGuidePage'))
const AdminUserGuide = lazy(() => import('./pages/admin/UserGuidePage'))

const EmployeeLayout = lazy(() => import('./pages/employee/EmployeeLayout'))
const EmployeeDashboard = lazy(() => import('./pages/employee/Dashboard'))
const EmployeeRequestDetails = lazy(() => import('./pages/employee/RequestDetails'))
const ClaimSchedule = lazy(() => import('./pages/employee/ClaimSchedule'))
const AssignedRequests = lazy(() => import('./pages/employee/AssignedRequests'))
const RequestVerification = lazy(() => import('./pages/employee/RequestVerification'))
const DocumentProcessing = lazy(() => import('./pages/employee/DocumentProcessing'))
const ClaimScheduleList = lazy(() => import('./pages/employee/ClaimScheduleList'))
const EmployeeOfficeCalendar = lazy(() => import('./pages/employee/OfficeCalendar'))
const EmployeeStudents = lazy(() => import('./pages/employee/Students'))
const StudentHistory = lazy(() => import('./pages/employee/StudentHistory'))
const EmployeeMessages = lazy(() => import('./pages/employee/Messages'))
const EmployeeNotifications = lazy(() => import('./pages/employee/Notifications'))
const ActivityLogs = lazy(() => import('./pages/employee/ActivityLogs'))
const EmployeeQueue = lazy(() => import('./pages/employee/Queue'))
const EmployeeProfile = lazy(() => import('./pages/employee/Profile'))

const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'))
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'))
const AllRequests = lazy(() => import('./pages/admin/AllRequests'))
const AdminRequestDetails = lazy(() => import('./pages/admin/RequestDetails'))
const Assignments = lazy(() => import('./pages/admin/Assignments'))
const AdminEmployees = lazy(() => import('./pages/admin/Employees'))
const EmployeeDetails = lazy(() => import('./pages/admin/EmployeeDetails'))
const AdminStudents = lazy(() => import('./pages/admin/Students'))
const AdminStudentDetails = lazy(() => import('./pages/admin/StudentDetails'))
const AdminDocuments = lazy(() => import('./pages/admin/Documents'))
const Announcements = lazy(() => import('./pages/admin/Announcements'))
const CollegesPrograms = lazy(() => import('./pages/admin/CollegesPrograms'))
const AdminClaimSchedules = lazy(() => import('./pages/admin/ClaimSchedules'))
const OfficeCalendar = lazy(() => import('./pages/admin/OfficeCalendar'))
const AdminQueue = lazy(() => import('./pages/admin/Queue'))
const AdminClaimSchedule = lazy(() => import('./pages/admin/ClaimSchedule'))
const OfficialReceipts = lazy(() => import('./pages/admin/OfficialReceipts'))
const AdminMessages = lazy(() => import('./pages/admin/Messages'))
const AdminNotifications = lazy(() => import('./pages/admin/Notifications'))
const AdminActivityLogs = lazy(() => import('./pages/admin/ActivityLogs'))
const Reports = lazy(() => import('./pages/admin/Reports'))
const AdminProfile = lazy(() => import('./pages/admin/Profile'))

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoading />}>
      <Routes>

        <Route
          path="/"
          element={<HomeRoute />}
        />

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

        <Route
          path="/forgot-password"
          element={<ForgotPassword />}
        />

        <Route
          path="/reset-password"
          element={<ResetPassword />}
        />

        <Route
          path="/force-change-password"
          element={
            <ProtectedRoute>
              <ForceChangePassword />
            </ProtectedRoute>
          }
        />

        <Route
          path="/terms"
          element={<Terms />}
        />

        <Route
          path="/privacy-policy"
          element={<PrivacyPolicy />}
        />

        <Route
          path="/cookie-policy"
          element={<CookiePolicy />}
        />

        <Route
          path="/refund-policy"
          element={<RefundPolicy />}
        />

        <Route
          path="/verify"
          element={<VerifyCredential />}
        />

        <Route
          path="/verify/:credentialNumber"
          element={<VerifyCredential />}
        />

        {/* Public narrated 3D walkthrough of the workflow (capstone defense /
            system demo). */}
        <Route path="/system-workflow" element={<SystemWorkflow />} />

        {/* Standalone, no portal sidebar -- meant to be opened full-screen
            on a lobby TV/monitor and left running. */}
        <Route
          path="/queue-display"
          element={
            <ProtectedRoute allowedRoles={['registrar_head', 'admin', 'employee']}>
              <QueueDisplay />
            </ProtectedRoute>
          }
        />

        <Route
          element={
            <ProtectedRoute allowedRoles={['student']}>
              <StudentVerificationGate>
                <StudentLayout />
              </StudentVerificationGate>
            </ProtectedRoute>
          }
        >

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

          <Route
            path="/student/guide"
            element={<StudentUserGuide />}
          />

        </Route>

        <Route
          element={
            <ProtectedRoute allowedRoles={['employee', 'registrar_head']}>
              <EmployeeLayout />
            </ProtectedRoute>
          }
        >

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
            element={<RequireFullEmployeeAccess><RequestVerification /></RequireFullEmployeeAccess>}
          />

          <Route
            path="/employee/processing"
            element={<RequireFullEmployeeAccess><DocumentProcessing /></RequireFullEmployeeAccess>}
          />

          <Route
            path="/employee/claim-schedule"
            element={<ClaimScheduleList />}
          />

          <Route
            path="/employee/office-calendar"
            element={<EmployeeOfficeCalendar />}
          />

          <Route
            path="/employee/queue"
            element={<RequireFullEmployeeAccess><EmployeeQueue /></RequireFullEmployeeAccess>}
          />

          <Route
            path="/employee/students"
            element={<RequireFullEmployeeAccess><EmployeeStudents /></RequireFullEmployeeAccess>}
          />

          <Route
            path="/employee/students/:studentId"
            element={<RequireFullEmployeeAccess><StudentHistory /></RequireFullEmployeeAccess>}
          />

          <Route
            path="/employee/messages"
            element={<RequireFullEmployeeAccess><EmployeeMessages /></RequireFullEmployeeAccess>}
          />

          <Route
            path="/employee/notifications"
            element={<EmployeeNotifications />}
          />

          <Route
            path="/employee/activity-logs"
            element={<RequireFullEmployeeAccess><ActivityLogs /></RequireFullEmployeeAccess>}
          />

          <Route
            path="/employee/profile"
            element={<EmployeeProfile />}
          />

          <Route
            path="/employee/guide"
            element={<EmployeeUserGuide />}
          />

        </Route>

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
            path="/admin/requests/:requestId/claim-schedule"
            element={<AdminClaimSchedule />}
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
            path="/admin/announcements"
            element={<Announcements />}
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
            path="/admin/office-calendar"
            element={<OfficeCalendar />}
          />

          <Route
            path="/admin/queue"
            element={<AdminQueue />}
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
            path="/admin/guide"
            element={<AdminUserGuide />}
          />

          <Route
            path="/admin/profile"
            element={<AdminProfile />}
          />

        </Route>

      </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App