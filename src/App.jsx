import { BrowserRouter, Routes, Route } from 'react-router-dom'

import Login from './pages/auth/Login'
import Register from './pages/auth/Register'

// LANDING PAGE
import LandingPage from './pages/LandingPage/LandingPage'

// STUDENT
import Dashboard from './pages/student/Dashboard'
import NewRequest from './pages/student/NewRequest'
import MyRequest from './pages/student/MyRequest'
import StudentRequestDetails from './pages/student/RequestDetails'
import UploadReceipt from './pages/student/UploadReceipt'

// EMPLOYEE
import EmployeeDashboard from './pages/employee/Dashboard'
import EmployeeRequestDetails from './pages/employee/RequestDetails'
import ClaimSchedule from './pages/employee/ClaimSchedule'

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

        {/* ========================= */}
        {/* STUDENT */}
        {/* ========================= */}

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

        {/* ========================= */}
        {/* EMPLOYEE */}
        {/* ========================= */}

        <Route
          path="/employee/dashboard"
          element={<EmployeeDashboard />}
        />

        <Route
          path="/employee/requests/:requestId"
          element={<EmployeeRequestDetails />}
        />

        <Route
          path="/employee/requests/:requestId/claim-schedule"
          element={<ClaimSchedule />}
        />

      </Routes>
    </BrowserRouter>
  )
}

export default App