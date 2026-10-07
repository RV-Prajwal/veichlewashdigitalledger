// src/admin/VehicleHistoryView.jsx
// Detailed vehicle lifetime history & analytics by registration number

import { useState } from 'react'
import { fetchVehicleHistory } from '../core/firestore'
import { formatPlateDisplay } from '../scan/TextNormalizer'

export default function VehicleHistoryView() {
  const [searchInput, setSearchInput] = useState('')
  const [searchedPlate, setSearchedPlate] = useState('')
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const handleSearch = async (plateToSearch) => {
    const query = (plateToSearch || searchInput).trim()
    if (!query) return

    setLoading(true)
    setHasSearched(true)
    setSearchedPlate(query)

    try {
      const results = await fetchVehicleHistory(query)
      setRecords(results)
    } catch (err) {
      console.error('History fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Quick test plate search shortcut
  const handleQuickSearch = (plate) => {
    setSearchInput(plate)
    handleSearch(plate)
  }

  // Compute lifetime statistics
  const totalVisits = records.length
  const totalSpend = records.reduce((sum, r) => sum + (Number(r.amount) || 0), 0)
  const firstVisit = records.length > 0 ? records[records.length - 1] : null
  const lastVisit = records.length > 0 ? records[0] : null

  // Most used service
  const serviceCounts = {}
  records.forEach((r) => {
    serviceCounts[r.serviceName] = (serviceCounts[r.serviceName] || 0) + 1
  })
  const mostUsedService = Object.entries(serviceCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'

  return (
    <div className="page fade-in">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Vehicle Lifetime History</h1>
        <p className="page-sub">
          Instant service history, visit frequency, and customer lifetime value by vehicle plate
        </p>
      </div>

      {/* Search Bar */}
      <div className="card" style={{ padding: '20px', marginBottom: 24 }}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSearch()
          }}
          style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}
        >
          <div className="input-group" style={{ flex: 1, minWidth: 260 }}>
            <label className="input-label">Vehicle Registration Number</label>
            <input
              type="text"
              className="input input--mono"
              placeholder="e.g. KA01NC8564"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
              style={{ fontSize: 18 }}
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ padding: '14px 28px' }}>
            🔍 Search History
          </button>
        </form>

        {/* Quick Suggestions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Try sample plates:</span>
          {['KA01NC8564', 'KA01JJ8846', 'KA03AN0368', 'KA03MW6100'].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => handleQuickSearch(p)}
              className="btn btn-ghost btn-sm"
              style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
          <div className="spinner spinner--lg" style={{ margin: '0 auto 12px' }} />
          Retrieving lifetime vehicle history...
        </div>
      )}

      {/* Results view */}
      {!loading && hasSearched && records.length > 0 && (
        <div className="slide-up">
          {/* Summary KPIs */}
          <div className="grid-4" style={{ marginBottom: 24 }}>
            <div className="kpi-card">
              <div className="kpi-label">Total Visits</div>
              <div className="kpi-value" style={{ color: '#60a5fa' }}>{totalVisits}</div>
              <div className="kpi-sub">Lifetime wash count</div>
            </div>

            <div className="kpi-card">
              <div className="kpi-label">Total Spend</div>
              <div className="kpi-value" style={{ color: '#06d6a0' }}>₹{totalSpend.toLocaleString()}</div>
              <div className="kpi-sub">Lifetime customer value</div>
            </div>

            <div className="kpi-card">
              <div className="kpi-label">Most Used Service</div>
              <div className="kpi-value" style={{ fontSize: 20, color: '#f0f4ff', marginTop: 10 }}>
                {mostUsedService}
              </div>
              <div className="kpi-sub">Customer preference</div>
            </div>

            <div className="kpi-card">
              <div className="kpi-label">Last Visit</div>
              <div className="kpi-value" style={{ fontSize: 18, color: '#f59e0b', marginTop: 10 }}>
                {lastVisit ? lastVisit.date : 'N/A'}
              </div>
              <div className="kpi-sub">
                {lastVisit && lastVisit.timestamp
                  ? new Date(lastVisit.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : ''}
              </div>
            </div>
          </div>

          {/* Timeline of Visits Table */}
          <div className="card">
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: '#f0f4ff' }}>
              Service Visit Timeline for{' '}
              <span style={{ color: '#60a5fa', fontFamily: 'var(--font-mono)' }}>
                {formatPlateDisplay(searchedPlate)}
              </span>
            </h3>

            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Visit Date & Time</th>
                    <th>Service Provided</th>
                    <th>Vehicle Type</th>
                    <th>Amount Charged</th>
                    <th>Attending Worker</th>
                    <th>Transaction ID</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, idx) => {
                    const dt = r.timestamp ? new Date(r.timestamp) : new Date(r.date)
                    return (
                      <tr key={r.id || idx}>
                        <td>
                          <div style={{ fontWeight: 600, color: '#f0f4ff' }}>
                            {dt.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                          <div className="time">
                            {dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td>
                          <strong style={{ color: '#f0f4ff' }}>{r.serviceName}</strong>
                        </td>
                        <td>
                          <span className={r.vehicleType === 'bike' ? 'chip-bike' : 'chip-car'}>
                            {r.vehicleType === 'bike' ? '🏍️ Bike' : '🚗 Car'}
                          </span>
                        </td>
                        <td>
                          <span className="amount">₹{r.amount}</span>
                        </td>
                        <td>{r.workerName || 'Worker'}</td>
                        <td>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#94a3b8' }}>
                            #{r.id}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* No results */}
      {!loading && hasSearched && records.length === 0 && (
        <div
          className="card"
          style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#f0f4ff', marginBottom: 6 }}>
            No records found for "{searchedPlate}"
          </div>
          <div>This vehicle has not been recorded in the digital ledger yet.</div>
        </div>
      )}
    </div>
  )
}
