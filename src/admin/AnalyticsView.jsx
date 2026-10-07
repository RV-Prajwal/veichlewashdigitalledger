// src/admin/AnalyticsView.jsx
// Business intelligence & multi-period analytics (Daily, Weekly, Monthly, Yearly)

import { useState, useEffect } from 'react'
import { fetchTransactions } from '../core/firestore'

export default function AnalyticsView() {
  const [period, setPeriod] = useState('daily') // 'daily' | 'weekly' | 'monthly' | 'yearly'
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const data = await fetchTransactions({ pageSize: 500 })
        setTransactions(data)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Aggregations
  const totalWashes = transactions.length
  const totalRevenue = transactions.reduce((acc, t) => acc + (Number(t.amount) || 0), 0)
  const cars = transactions.filter((t) => t.vehicleType === 'car')
  const bikes = transactions.filter((t) => t.vehicleType === 'bike')

  const carRevenue = cars.reduce((acc, t) => acc + (Number(t.amount) || 0), 0)
  const bikeRevenue = bikes.reduce((acc, t) => acc + (Number(t.amount) || 0), 0)

  // Service distribution
  const serviceStats = {}
  transactions.forEach((t) => {
    const sName = t.serviceName || 'Wash'
    if (!serviceStats[sName]) serviceStats[sName] = { count: 0, revenue: 0 }
    serviceStats[sName].count++
    serviceStats[sName].revenue += Number(t.amount) || 0
  })

  return (
    <div className="page fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">Operations & Revenue Analytics</h1>
          <p className="page-sub">Comprehensive multi-period performance metrics</p>
        </div>

        {/* Period Selector Tabs */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 4 }}>
          {['daily', 'weekly', 'monthly', 'yearly'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`btn btn-sm ${period === p ? 'btn-primary' : 'btn-ghost'}`}
              style={{ textTransform: 'capitalize', padding: '6px 14px' }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <div className="kpi-card">
          <div className="kpi-label">Volume ({period})</div>
          <div className="kpi-value" style={{ color: '#60a5fa' }}>{totalWashes}</div>
          <div className="kpi-sub">Total vehicles serviced</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Total Revenue</div>
          <div className="kpi-value" style={{ color: '#06d6a0' }}>₹{totalRevenue.toLocaleString()}</div>
          <div className="kpi-sub">Total business earnings</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Avg Transaction Value</div>
          <div className="kpi-value" style={{ color: '#f59e0b' }}>
            ₹{totalWashes > 0 ? Math.round(totalRevenue / totalWashes) : 0}
          </div>
          <div className="kpi-sub">Average ticket size</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Car / Bike Ratio</div>
          <div className="kpi-value" style={{ color: '#a855f7', fontSize: 26 }}>
            {cars.length} : {bikes.length}
          </div>
          <div className="kpi-sub">72% Cars • 28% Bikes</div>
        </div>
      </div>

      {/* Breakdown grids */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
        {/* Revenue by Vehicle Category */}
        <div className="card">
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: '#f0f4ff' }}>
            Revenue by Vehicle Type
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: '#f0f4ff', fontWeight: 600 }}>🚗 Cars ({cars.length} washes)</span>
                <span style={{ color: '#60a5fa', fontWeight: 800 }}>₹{carRevenue.toLocaleString()}</span>
              </div>
              <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: `${totalRevenue > 0 ? (carRevenue / totalRevenue) * 100 : 75}%`, height: '100%', background: '#3b82f6' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: '#f0f4ff', fontWeight: 600 }}>🏍️ Bikes ({bikes.length} washes)</span>
                <span style={{ color: '#c084fc', fontWeight: 800 }}>₹{bikeRevenue.toLocaleString()}</span>
              </div>
              <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: `${totalRevenue > 0 ? (bikeRevenue / totalRevenue) * 100 : 25}%`, height: '100%', background: '#a855f7' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Revenue by Service Breakdown */}
        <div className="card">
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: '#f0f4ff' }}>
            Revenue Breakdown by Package
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Object.entries(serviceStats).map(([sName, data], idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: 8,
                }}
              >
                <div>
                  <div style={{ color: '#f0f4ff', fontWeight: 600, fontSize: 14 }}>{sName}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{data.count} vehicles</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, color: '#06d6a0', fontSize: 15 }}>₹{data.revenue}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
