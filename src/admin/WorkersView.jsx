// src/admin/WorkersView.jsx
// Worker account management & performance tracking

import { useState, useEffect } from 'react'
import { fetchWorkers, fetchTransactions, updateWorker } from '../core/firestore'

export default function WorkersView() {
  const [workers, setWorkers] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [wrks, txs] = await Promise.all([
        fetchWorkers(),
        fetchTransactions({ pageSize: 500 }),
      ])
      setWorkers(wrks)
      setTransactions(txs)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleToggleStatus = async (w) => {
    const next = w.status === 'active' ? 'disabled' : 'active'
    await updateWorker(w.uid || w.id, { status: next })
    load()
  }

  return (
    <div className="page fade-in">
      <div className="page-header">
        <h1 className="page-title">Worker Management & Accountability</h1>
        <p className="page-sub">
          Monitor individual worker throughput, logs, and account statuses
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        {workers.map((w) => {
          const workerId = w.uid || w.id
          const workerTxs = transactions.filter((t) => t.workerId === workerId)
          const totalLogged = workerTxs.length
          const totalRevenue = workerTxs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0)

          return (
            <div key={workerId} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #3b82f6, #06d6a0)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: 18,
                    }}
                  >
                    {w.name?.charAt(0) || 'W'}
                  </div>
                  <div>
                    <h2 style={{ fontSize: 17, fontWeight: 800, color: '#f0f4ff' }}>{w.name}</h2>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>
                      @{w.username || 'user'} • {w.mobile || 'No mobile'}
                    </div>
                  </div>
                </div>

                <span className={`badge ${w.status === 'active' ? 'badge-accent' : 'badge-danger'}`}>
                  {w.status || 'active'}
                </span>
              </div>

              {/* Stats Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, margin: '16px 0' }}>
                <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase' }}>Transactions</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#60a5fa' }}>{totalLogged} washes</div>
                </div>

                <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase' }}>Revenue Handled</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#06d6a0' }}>₹{totalRevenue}</div>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <button
                  onClick={() => handleToggleStatus(w)}
                  className="btn btn-ghost btn-sm"
                  style={{ flex: 1 }}
                >
                  {w.status === 'active' ? 'Disable Account' : 'Enable Account'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
