// src/admin/AdminLayout.jsx
// Dedicated Admin console layout with pure admin management tools

import { useState } from 'react'
import AdminDashboard from './AdminDashboard'
import LedgerView from './LedgerView'
import VehicleHistoryView from './VehicleHistoryView'
import AnalyticsView from './AnalyticsView'
import ServicesView from './ServicesView'
import WorkersView from './WorkersView'

export default function AdminLayout({ adminUser, onLogout }) {
  const [activeTab, setActiveTab] = useState('dashboard') // 'dashboard' | 'ledger' | 'history' | 'analytics' | 'services' | 'workers'

  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: '📊' },
    { id: 'ledger', label: 'Digital Ledger', icon: '📖' },
    { id: 'services', label: 'Wash Pricing & Services', icon: '🏷️' },
    { id: 'history', label: 'Vehicle History', icon: '🔍' },
    { id: 'analytics', label: 'Analytics', icon: '📈' },
    { id: 'workers', label: 'Workers', icon: '👷' },
  ]

  return (
    <div className="admin-layout">
      {/* Sidebar Navigation */}
      <aside className="admin-sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-text">WashLedger</div>
          <div className="sidebar-logo-sub">Business Admin Portal</div>
        </div>

        <div className="nav-section" style={{ flex: 1 }}>
          <div className="nav-section-label">Management</div>
          {navItems.map((item) => (
            <div
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        {/* User badge & logout */}
        <div
          style={{
            padding: '16px',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f4ff' }}>
              {adminUser.displayName || adminUser.name || 'Admin'}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>Administrator</div>
          </div>
          <button
            onClick={onLogout}
            className="btn btn-ghost btn-sm"
            style={{ fontSize: 12, padding: '4px 8px' }}
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="admin-main">
        {/* Mobile top bar toggle */}
        <div
          style={{
            display: 'none',
            padding: '12px 16px',
            background: 'var(--clr-bg-surface)',
            borderBottom: '1px solid var(--clr-border)',
            gap: 8,
            overflowX: 'auto',
          }}
          className="admin-mobile-nav"
        >
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`btn btn-sm ${activeTab === item.id ? 'btn-primary' : 'btn-ghost'}`}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </div>

        {activeTab === 'dashboard' && (
          <AdminDashboard
            onNavigateToLedger={() => setActiveTab('ledger')}
            onNavigateToServices={() => setActiveTab('services')}
          />
        )}
        {activeTab === 'ledger' && <LedgerView adminUser={adminUser} />}
        {activeTab === 'services' && <ServicesView />}
        {activeTab === 'history' && <VehicleHistoryView />}
        {activeTab === 'analytics' && <AnalyticsView />}
        {activeTab === 'workers' && <WorkersView />}
      </main>
    </div>
  )
}
