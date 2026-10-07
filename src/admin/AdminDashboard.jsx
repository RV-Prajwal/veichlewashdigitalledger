// src/admin/AdminDashboard.jsx
// Main business oversight dashboard with high-level KPIs, activity distribution, and live pricing editor

import { useState, useEffect } from 'react'
import { subscribeTodayTransactions, fetchTransactions, fetchServices, updateService } from '../core/firestore'
import { formatPlateDisplay } from '../scan/TextNormalizer'
import { seedFirestoreDatabase } from '../core/seedFirestore'
import { isFirebaseConfigured } from '../core/firebase'

export default function AdminDashboard({ onNavigateToLedger, onNavigateToServices }) {
  const [todayTxs, setTodayTxs] = useState([])
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [seedStatus, setSeedStatus] = useState(null)

  // Quick price editing on Dashboard
  const [editingService, setEditingService] = useState(null)
  const [editPriceVal, setEditPriceVal] = useState('')
  const [priceSuccess, setPriceSuccess] = useState(null)

  const handleSeedFirestore = async () => {
    if (!window.confirm('Seed your Firestore database with default wash services, worker profiles, and initial ledger transactions?')) return
    try {
      setSeedStatus('Seeding...')
      await seedFirestoreDatabase((msg) => setSeedStatus(msg))
      loadServices()
      setTimeout(() => setSeedStatus(null), 3000)
    } catch (err) {
      alert(err.message)
      setSeedStatus(null)
    }
  }

  const loadServices = async () => {
    try {
      const srvs = await fetchServices()
      setServices(srvs)
    } catch (e) {
      console.warn('Failed to load services on dashboard:', e)
    }
  }

  useEffect(() => {
    // Real-time subscribe to today
    const unsub = subscribeTodayTransactions((txs) => {
      setTodayTxs(txs)
      setLoading(false)
    })

    loadServices()

    return unsub
  }, [])

  // Quick save price from dashboard
  const handleQuickSavePrice = async (e) => {
    e.preventDefault()
    if (!editingService || !editPriceVal) return
    try {
      await updateService(editingService.id, { price: Number(editPriceVal) })
      setPriceSuccess(`Updated ${editingService.name} to ₹${editPriceVal}`)
      setEditingService(null)
      await loadServices()
      setTimeout(() => setPriceSuccess(null), 3000)
    } catch (err) {
      alert('Price update error: ' + err.message)
    }
  }

  // KPI Calculations
  const todayCount = todayTxs.length
  const todayRevenue = todayTxs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
  const carsCount = todayTxs.filter((t) => t.vehicleType === 'car').length
  const bikesCount = todayTxs.filter((t) => t.vehicleType === 'bike').length
  const carPercent = todayCount > 0 ? Math.round((carsCount / todayCount) * 100) : 70
  const bikePercent = todayCount > 0 ? Math.round((bikesCount / todayCount) * 100) : 30
  const avgTicket = todayCount > 0 ? Math.round(todayRevenue / todayCount) : 0

  // Hourly distribution (8 AM to 8 PM)
  const hourlyCounts = Array(12).fill(0)
  todayTxs.forEach((t) => {
    const h = t.hour !== undefined ? t.hour : (t.timestamp ? new Date(t.timestamp).getHours() : 10)
    if (h >= 8 && h <= 19) {
      hourlyCounts[h - 8]++
    }
  })
  const maxHourly = Math.max(...hourlyCounts, 1)

  return (
    <div className="page fade-in">
      {/* Top Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 className="page-title">Wash Center Overview</h1>
          <p className="page-sub">
            Real-time business operations, revenue intelligence, and price management
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {isFirebaseConfigured && (
            <button
              onClick={handleSeedFirestore}
              className="btn btn-ghost btn-sm"
              style={{ border: '1px solid rgba(6,214,160,0.3)', color: '#06d6a0' }}
              title="Populate Firestore with initial services, workers, and sample transactions"
            >
              {seedStatus || '🌱 Seed Firestore'}
            </button>
          )}
          <button onClick={onNavigateToServices} className="btn btn-accent btn-sm">
            🏷️ Edit Wash Pricing
          </button>
          <button onClick={onNavigateToLedger} className="btn btn-primary btn-sm">
            📖 View Full Ledger
          </button>
        </div>
      </div>

      {priceSuccess && (
        <div className="alert alert-success" style={{ marginBottom: 20 }}>
          <span>✓</span> {priceSuccess}
        </div>
      )}

      {/* Main KPI Cards Grid */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <div className="kpi-card">
          <div className="kpi-label">Today's Washes</div>
          <div className="kpi-value" style={{ color: '#60a5fa' }}>{todayCount}</div>
          <div className="kpi-sub">
            🚗 {carsCount} Cars • 🏍️ {bikesCount} Bikes
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Today's Revenue</div>
          <div className="kpi-value" style={{ color: '#06d6a0' }}>₹{todayRevenue.toLocaleString()}</div>
          <div className="kpi-sub">Average ₹{avgTicket} per wash</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Vehicle Distribution</div>
          <div className="kpi-value" style={{ fontSize: 24, display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ color: '#93c5fd' }}>{carPercent}% Cars</span>
            <span style={{ color: '#c4b5fd' }}>{bikePercent}% Bikes</span>
          </div>
          <div className="kpi-sub">
            <div style={{ height: 6, background: '#a855f7', borderRadius: 999, overflow: 'hidden', marginTop: 8 }}>
              <div style={{ width: `${carPercent}%`, height: '100%', background: '#3b82f6' }} />
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Active Wash Packages</div>
          <div className="kpi-value" style={{ color: '#f59e0b', fontSize: 28 }}>
            {services.length} Configured
          </div>
          <div className="kpi-sub">
            <button
              onClick={onNavigateToServices}
              style={{ color: '#60a5fa', textDecoration: 'underline', fontSize: 12, cursor: 'pointer' }}
            >
              Modify pricing rules →
            </button>
          </div>
        </div>
      </div>

      {/* Pricing Quick Control Widget */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#f0f4ff' }}>
              🏷️ Current Wash Charges & Pricing Rules
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>
              Click any price tag below to adjust charges in real time
            </div>
          </div>
          <button onClick={onNavigateToServices} className="btn btn-ghost btn-sm">
            All Packages →
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          {services.slice(0, 6).map((srv) => (
            <div
              key={srv.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 14px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 10,
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f4ff' }}>
                  {srv.vehicleType === 'car' ? '🚗' : '🏍️'} {srv.name}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>
                  {srv.vehicleType.toUpperCase()}
                </div>
              </div>

              <button
                onClick={() => {
                  setEditingService(srv)
                  setEditPriceVal(srv.price)
                }}
                className="btn btn-ghost btn-sm"
                style={{
                  background: 'rgba(6,214,160,0.1)',
                  borderColor: 'rgba(6,214,160,0.3)',
                  color: '#06d6a0',
                  fontWeight: 800,
                  fontSize: 15,
                  padding: '4px 10px',
                }}
                title="Click to edit price"
              >
                ₹{srv.price} ✏️
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Analytics Charts & Activity Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20, marginBottom: 24 }}>
        {/* Hourly Distribution Card */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f4ff' }}>Hourly Wash Activity</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>Peak wash hours (8:00 AM – 8:00 PM)</div>
            </div>
            <div className="badge badge-primary">Today</div>
          </div>

          {/* Bar Chart Visualization */}
          <div style={{ display: 'flex', alignItems: 'flex-end', height: 160, gap: 8, padding: '10px 0' }}>
            {hourlyCounts.map((count, idx) => {
              const hourLabel = `${idx + 8}${idx + 8 >= 12 ? 'p' : 'a'}`
              const barHeight = Math.max(12, Math.round((count / maxHourly) * 120))
              const isPeak = count === maxHourly && count > 0

              return (
                <div
                  key={idx}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: isPeak ? '#06d6a0' : '#94a3b8' }}>
                    {count > 0 ? count : ''}
                  </div>
                  <div
                    style={{
                      width: '100%',
                      maxWidth: 24,
                      height: barHeight,
                      background: isPeak
                        ? 'linear-gradient(180deg, #06d6a0, #059669)'
                        : 'linear-gradient(180deg, #3b82f6, #1d4ed8)',
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 0.3s ease',
                    }}
                  />
                  <div style={{ fontSize: 10, color: '#64748b' }}>
                    {hourLabel}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Service Popularity Breakdown */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f4ff' }}>Revenue Contribution by Package</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>Wash volume breakdown</div>
            </div>
            <span style={{ fontSize: 18 }}>🏆</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { name: 'Car Full Wash', share: 45 },
              { name: 'Car Premium Wash', share: 30 },
              { name: 'Bike Premium Wash', share: 15 },
              { name: 'Basic Wash Packages', share: 10 },
            ].map((srv, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#f0f4ff', fontWeight: 600 }}>{srv.name}</span>
                  <span style={{ color: '#06d6a0', fontWeight: 700 }}>{srv.share}%</span>
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${srv.share}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #3b82f6, #06d6a0)',
                      borderRadius: 999,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live Recent Transactions Stream */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f4ff' }}>Live Transactions Feed</div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Real-time stream of incoming washes</div>
          </div>
          <button onClick={onNavigateToLedger} className="btn btn-ghost btn-sm">
            View All →
          </button>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Vehicle Plate</th>
                <th>Type</th>
                <th>Service</th>
                <th>Amount</th>
                <th>Worker</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {todayTxs.slice(0, 6).map((tx) => (
                <tr key={tx.id}>
                  <td>
                    <span className="time">
                      {tx.timestamp ? new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                    </span>
                  </td>
                  <td>
                    <span className="plate">{formatPlateDisplay(tx.vehicleNumber)}</span>
                  </td>
                  <td>
                    <span className={tx.vehicleType === 'bike' ? 'chip-bike' : 'chip-car'}>
                      {tx.vehicleType === 'bike' ? '🏍️' : '🚗'} {tx.vehicleType}
                    </span>
                  </td>
                  <td>{tx.serviceName}</td>
                  <td>
                    <span className="amount">₹{tx.amount}</span>
                  </td>
                  <td>
                    <span style={{ color: '#94a3b8', fontSize: 13 }}>{tx.workerName}</span>
                  </td>
                  <td>
                    <span className="badge badge-accent">Recorded</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Price Modal on Dashboard */}
      {editingService && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 420 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#f0f4ff' }}>
                Change Wash Price
              </h3>
              <button onClick={() => setEditingService(null)} className="btn btn-ghost btn-sm">✕</button>
            </div>

            <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20 }}>
              Adjusting charge for <strong style={{ color: '#60a5fa' }}>{editingService.name}</strong> ({editingService.vehicleType.toUpperCase()}).
            </p>

            <form onSubmit={handleQuickSavePrice} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="input-group">
                <label className="input-label">New Amount (₹)</label>
                <input
                  type="number"
                  className="input input--lg"
                  style={{ fontSize: 24, fontWeight: 800, color: '#06d6a0' }}
                  value={editPriceVal}
                  onChange={(e) => setEditPriceVal(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setEditingService(null)}
                  className="btn btn-ghost"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-accent"
                  style={{ flex: 2, fontWeight: 800 }}
                >
                  💾 Save New Price
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
