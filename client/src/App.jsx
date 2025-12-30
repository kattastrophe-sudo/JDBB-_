import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

// Pages
import Login from './pages/Login'
import AdminDashboard from './pages/admin/Dashboard'
import StudentDashboard from './pages/student/Dashboard'
import MonitorDashboard from './pages/monitor/Dashboard'
import NotFound from './pages/NotFound'

// Admin pages
import Students from './pages/admin/Students'
import Tools from './pages/admin/Tools'
import Store from './pages/admin/Store'
import Lockup from './pages/admin/Lockup'
import Transactions from './pages/admin/Transactions'
import Reports from './pages/admin/Reports'
import Settings from './pages/admin/Settings'

// Monitor pages
import ToolCheckout from './pages/monitor/ToolCheckout'
import LockupPOS from './pages/monitor/LockupPOS'

// Student pages
import MyItems from './pages/student/MyItems'
import SubmitItem from './pages/student/SubmitItem'
import MyTransactions from './pages/student/MyTransactions'

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
  },
})

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />

            {/* Admin routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['Admin']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/students"
              element={
                <ProtectedRoute allowedRoles={['Admin']}>
                  <Students />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/tools"
              element={
                <ProtectedRoute allowedRoles={['Admin']}>
                  <Tools />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/store"
              element={
                <ProtectedRoute allowedRoles={['Admin']}>
                  <Store />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/lockup"
              element={
                <ProtectedRoute allowedRoles={['Admin']}>
                  <Lockup />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/transactions"
              element={
                <ProtectedRoute allowedRoles={['Admin']}>
                  <Transactions />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/reports"
              element={
                <ProtectedRoute allowedRoles={['Admin']}>
                  <Reports />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <ProtectedRoute allowedRoles={['Admin']}>
                  <Settings />
                </ProtectedRoute>
              }
            />

            {/* Monitor routes */}
            <Route
              path="/monitor"
              element={
                <ProtectedRoute allowedRoles={['Monitor', 'Admin']}>
                  <MonitorDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/monitor/tools"
              element={
                <ProtectedRoute allowedRoles={['Monitor', 'Admin']}>
                  <ToolCheckout />
                </ProtectedRoute>
              }
            />
            <Route
              path="/monitor/lockup"
              element={
                <ProtectedRoute allowedRoles={['Monitor', 'Admin']}>
                  <LockupPOS />
                </ProtectedRoute>
              }
            />

            {/* Student routes */}
            <Route
              path="/student"
              element={
                <ProtectedRoute allowedRoles={['Student']}>
                  <StudentDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/my-items"
              element={
                <ProtectedRoute allowedRoles={['Student']}>
                  <MyItems />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/submit"
              element={
                <ProtectedRoute allowedRoles={['Student']}>
                  <SubmitItem />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/transactions"
              element={
                <ProtectedRoute allowedRoles={['Student']}>
                  <MyTransactions />
                </ProtectedRoute>
              }
            />

            {/* Default redirects */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
