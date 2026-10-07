// src/admin/LedgerView.jsx
// Complete Digital Wash Ledger with search, filters, sorting, inline edit, and CSV export

import { useState, useEffect } from 'react'
import { fetchTransactions, fetchServices, fetchWorkers, adminUpdateTransaction } from '../core/firestore'
import { formatPlateDisplay } from '../scan/TextNormalizer'

export default function LedgerView({ adminUser }) {
  const [transactions, setTransactions] = useState([])
  const [services, setServices] = useState([])
  const [workers, setWorkers] = useState([])
  const [loading, setLoading] = useState(true)

  // Filter States
  const [searchQuery, setSearchQuery] = useState('')
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState('all')
  const [serviceFilter, setServiceFilter] = useState('all')
  const [workerFilter, setWorkerFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('') // YYYY-MM-DD
  const [sortField, setSortField] = useState('timestamp')
  const [sortDir, setSortDir] = useState('desc')

  // Edit modal state
  const [editingTx, setEditingTx] = useState(null)
  const [editAmount, setEditAmount] = useState('')

  const loadData = async () => {
    setLoading(true)
    try {
      const [txs, srvs, wrks] = await Promise.all([
        fetchTransactions({
          searchQuery,
          vehicleType: vehicleTypeFilter,
          serviceId: serviceFilter,
          workerId: workerFilter,
          dateFrom: dateFilter || undefined,
          dateTo: dateFilter || undefined,
          sortField,
          sortDir,
        }),
        fetchServices(),
        fetchWorkers(),
      ])
      setTransactions(txs)
      setServices(srvs)
      setWorkers(wrks)
    } catch (err) {
      console.error('Ledger fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [searchQuery, vehicleTypeFilter, serviceFilter, workerFilter, dateFilter, sortField, sortDir])

  // Handle Sort Toggle
  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  // Handle Admin Price Edit
  const handleSaveEdit = async () => {
    if (!editingTx) return
    try {
      await adminUpdateTransaction(
        editingTx.id,
        'amount',
        Number(editAmount),
        adminUser.uid || 'admin'
      )
      setEditingTx(null)
      loadData()
    } catch (err) {
      alert('Failed to update: ' + err.message)
    }
  }

  // CSV Export
  const handleExportCSV = () => {
    if (transactions.length === 0) {
      alert('No transactions to export')
      return
    }

    const headers = ['Transaction ID', 'Vehicle Number', 'Type', 'Service', 'Amount', 'Date', 'Time', 'Worker']
    const rows = transactions.map((t) => [
      t.id,
      t.vehicleNumber,
      t.vehicleType,
      t.serviceName,
      t.amount,
      t.date,
      t.timestamp ? new Date(t.timestamp).toLocaleTimeString() : '',
      t.workerName,
    ])

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `wash_ledger_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const totalAmount = transactions.reduce((acc, t) => acc + (Number(t.amount) || 0), 0)

  return (
    <div className="page fade-in">
      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 className="page-title">Digital Wash Ledger</h1>
          <p className="page-sub">
            Real-time searchable transaction records replacing the handwritten notebook
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={loadData} className="btn btn-ghost btn-sm" title="Refresh">
            🔄 Refresh
          </button>
          <button onClick={handleExportCSV} className="btn btn-accent btn-sm">
            📥 Export CSV
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div
        className="card"
        style={{
          padding: '16px 20px',
          marginBottom: 20,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
        }}
      >
        {/* Search */}
        <div className="input-group">
          <label className="input-label">Search Vehicle #</label>
          <input
            type="text"
            className="input input--mono"
            placeholder="e.g. KA01"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ fontSize: 14 }}
          />
        </div>

        {/* Vehicle Type */}
        <div className="input-group">
          <label className="input-label">Vehicle Type</label>
          <select
            className="select"
            value={vehicleTypeFilter}
            onChange={(e) => setVehicleTypeFilter(e.target.value)}
          >
            <option value="all">All Vehicles</option>
            <option value="car">🚗 Cars Only</option>
            <option value="bike">🏍️ Bikes Only</option>
          </select>
        </div>

        {/* Service */}
        <div className="input-group">
          <label className="input-label">Service</label>
          <select
            className="select"
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
          >
            <option value="all">All Services</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Worker */}
        <div className="input-group">
          <label className="input-label">Worker</label>
          <select
            className="select"
            value={workerFilter}
            onChange={(e) => setWorkerFilter(e.target.value)}
          >
            <option value="all">All Workers</option>
            {workers.map((w) => (
              <option key={w.uid || w.id} value={w.uid || w.id}>
                {w.name || w.username}
              </option>
            ))}
          </select>
        </div>

        {/* Date Filter */}
        <div className="input-group">
          <label className="input-label">Date Filter</label>
          <input
            type="date"
            className="input"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
        </div>
      </div>

      {/* Summary Row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          padding: '0 4px',
        }}
      >
        <div style={{ fontSize: 13, color: '#94a3b8' }}>
          Showing <strong>{transactions.length}</strong> transactions
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f4ff' }}>
          Filtered Total: <span style={{ color: '#06d6a0' }}>₹{totalAmount.toLocaleString()}</span>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th onClick={() => toggleSort('timestamp')} style={{ cursor: 'pointer' }}>
                Date & Time {sortField === 'timestamp' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => toggleSort('vehicleNumber')} style={{ cursor: 'pointer' }}>
                Vehicle Number {sortField === 'vehicleNumber' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th>Type</th>
              <th>Service</th>
              <th onClick={() => toggleSort('amount')} style={{ cursor: 'pointer' }}>
                Amount {sortField === 'amount' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th>Worker</th>
              <th>OCR Conf</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                  <div className="spinner spinner--lg" style={{ margin: '0 auto 10px' }} />
                  Loading transactions...
                </td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                  No records match your filters.
                </td>
              </tr>
            ) : (
              transactions.map((tx) => {
                const dateObj = tx.timestamp ? new Date(tx.timestamp) : new Date(tx.createdAt || Date.now())
                return (
                  <tr key={tx.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#f0f4ff' }}>
                        {dateObj.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                      <div className="time">
                        {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td>
                      <span className="plate">{formatPlateDisplay(tx.vehicleNumber)}</span>
                    </td>
                    <td>
                      <span className={tx.vehicleType === 'bike' ? 'chip-bike' : 'chip-car'}>
                        {tx.vehicleType === 'bike' ? '🏍️ Bike' : '🚗 Car'}
                      </span>
                    </td>
                    <td>{tx.serviceName}</td>
                    <td>
                      <span className="amount">₹{tx.amount}</span>
                    </td>
                    <td>
                      <span style={{ color: '#94a3b8', fontSize: 13 }}>
                        {tx.workerName || 'Worker'}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          (tx.ocrConfidence || 90) >= 80 ? 'badge-accent' : 'badge-warn'
                        }`}
                      >
                        {tx.ocrConfidence ? `${tx.ocrConfidence}%` : 'N/A'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => {
                          setEditingTx(tx)
                          setEditAmount(tx.amount)
                        }}
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '4px 8px', fontSize: 11 }}
                      >
                        ✏️ Edit Price
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Amount Modal */}
      {editingTx && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 400 }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>
              Edit Amount for {editingTx.vehicleNumber}
            </h3>
            <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>
              All administrative changes are automatically logged in the audit trail.
            </p>

            <div className="input-group" style={{ marginBottom: 20 }}>
              <label className="input-label">New Amount (₹)</label>
              <input
                type="number"
                className="input"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                autoFocus
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setEditingTx(null)}
                className="btn btn-ghost"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                Save Change
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
