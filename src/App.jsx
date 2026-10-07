// src/App.jsx
// Root application container with strict role isolation between Worker and Admin

import { AuthProvider, useAuth } from './shared/hooks/useAuth'
import LoginPage from './auth/LoginPage'
import WorkerDashboard from './worker/WorkerDashboard'
import AdminLayout from './admin/AdminLayout'

function MainApp() {
  const { user, profile, loading, logout } = useAuth()

  if (loading) {
    return (
      <div className="page-loader">
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: 'linear-gradient(135deg, #3b82f6, #06d6a0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            marginBottom: 8,
          }}
        >
          🚗
        </div>
        <div className="spinner spinner--lg" />
        <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 8 }}>
          Initializing WashLedger Engine...
        </div>
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  // Strict role detection: Admin goes ONLY to Admin view, Worker goes ONLY to Worker view
  const userRole = profile?.role || (user.email?.includes('admin') ? 'admin' : 'worker')

  const currentUserData = {
    ...user,
    ...profile,
    role: userRole,
  }

  // Complete UI Isolation:
  if (userRole === 'admin') {
    return <AdminLayout adminUser={currentUserData} onLogout={logout} />
  }

  // Worker Interface:
  return <WorkerDashboard worker={currentUserData} onLogout={logout} />
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  )
}
