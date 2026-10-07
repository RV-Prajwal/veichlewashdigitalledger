// src/worker/WorkerDashboard.jsx
// Minimal, ultra-fast mobile worker interface with big scan button and instant feedback

import { useState, useEffect } from 'react'
import { subscribeTodayWorkerTransactions } from '../core/firestore'
import { useModelPreload } from '../shared/hooks/useModelPreload'
import CameraScanner from './CameraScanner'
import ConfirmModal from './ConfirmModal'

export default function WorkerDashboard({ worker, onSwitchToAdmin, onLogout }) {
  const [showScanner, setShowScanner] = useState(false)
  const [pendingScanData, setPendingScanData] = useState(null)
  const [todayTransactions, setTodayTransactions] = useState([])
  const [justSavedTx, setJustSavedTx] = useState(null)
  const [showManualEntry, setShowManualEntry] = useState(false)

  // Pre-load AI models in background right away on dashboard load
  const { isReady: isAIReady, overallProgress } = useModelPreload(true)

  // Subscribe to today's worker transactions in real-time
  useEffect(() => {
    if (!worker) return
    const unsub = subscribeTodayWorkerTransactions(
      worker.uid || worker.id,
      (txs) => {
        setTodayTransactions(txs)
      }
    )
    return unsub
  }, [worker])

  // Handle scan completion from camera
  const handleScanComplete = (scanResult) => {
    setShowScanner(false)
    setPendingScanData(scanResult)
  }

  // Handle saved transaction
  const handleSaved = (savedTx) => {
    setPendingScanData(null)
    setShowManualEntry(false)
    setJustSavedTx(savedTx)

    // Clear flash after 1.6s
    setTimeout(() => {
      setJustSavedTx(null)
    }, 1600)
  }

  // Manual entry modal trigger
  const handleStartManualEntry = () => {
    setPendingScanData({
      vehicleNumber: '',
      vehicleType: 'car',
      ocrConfidence: 100,
      elapsedMs: 0,
    })
  }

  const todayCount = todayTransactions.length
  const todayRevenue = todayTransactions.reduce((acc, t) => acc + (Number(t.amount) || 0), 0)

  return (
    <div className="worker-layout">
      {/* Top Header */}
      <header className="worker-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #3b82f6, #06d6a0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
            }}
          >
            🚗
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#f0f4ff', lineHeight: 1.2 }}>
              WashLedger
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              Worker: <strong style={{ color: '#60a5fa' }}>{worker.displayName || worker.name || 'Worker'}</strong>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={onLogout}
            className="btn btn-ghost btn-sm"
            title="Logout"
            style={{ padding: '6px 12px', fontSize: 12, color: '#94a3b8' }}
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: '20px 16px', maxWidth: 500, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>
        
        {/* Model Readiness Status Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 12,
            padding: '8px 14px',
            fontSize: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: isAIReady ? '#06d6a0' : '#f59e0b', fontSize: 14 }}>
              {isAIReady ? '●' : '○'}
            </span>
            <span style={{ color: isAIReady ? '#f0f4ff' : '#94a3b8' }}>
              {isAIReady ? 'AI Engine Ready (<2s Speed)' : `Warming AI Engine (${overallProgress}%)`}
            </span>
          </div>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>
            On-Device OCR
          </span>
        </div>

        {/* Big Hero Scan Section */}
        <div
          className="card card--glow"
          style={{
            padding: '32px 20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: 18,
          }}
        >
          <button
            onClick={() => setShowScanner(true)}
            className="btn-scan"
            style={{ width: '100%', maxWidth: 320 }}
          >
            📷 SCAN VEHICLE
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={handleStartManualEntry}
              style={{
                fontSize: 13,
                color: '#60a5fa',
                textDecoration: 'underline',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ⌨️ Enter Vehicle Manually
            </button>
            <span style={{ color: '#475569' }}>•</span>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>
              Auto Car/Bike Detect
            </span>
          </div>
        </div>

        {/* Today's KPI Metric Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="kpi-card" style={{ padding: '16px 18px' }}>
            <div className="kpi-label">Today's Washes</div>
            <div className="kpi-value" style={{ fontSize: 32, color: '#60a5fa' }}>
              {todayCount}
            </div>
            <div className="kpi-sub">Logged by you</div>
          </div>

          <div className="kpi-card" style={{ padding: '16px 18px' }}>
            <div className="kpi-label">Today's Total</div>
            <div className="kpi-value" style={{ fontSize: 32, color: '#06d6a0' }}>
              ₹{todayRevenue}
            </div>
            <div className="kpi-sub">Total revenue collected</div>
          </div>
        </div>

        {/* Recent Transactions List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f4ff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Recent Washes Today
            </div>
            <div className="badge badge-neutral">
              {todayTransactions.length} Total
            </div>
          </div>

          {todayTransactions.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '36px 16px',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: 12,
                border: '1px dashed rgba(255,255,255,0.1)',
                color: '#94a3b8',
                fontSize: 14,
              }}
            >
              No vehicles recorded yet today.<br />
              Tap <strong style={{ color: '#3b82f6' }}>SCAN VEHICLE</strong> to begin!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {todayTransactions.slice(0, 10).map((tx) => {
                const timeStr = tx.timestamp
                  ? new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : '--:--'
                return (
                  <div
                    key={tx.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: 12,
                      transition: 'background 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span
                        className={tx.vehicleType === 'bike' ? 'chip-bike' : 'chip-car'}
                        style={{ padding: '4px 8px', fontSize: 10 }}
                      >
                        {tx.vehicleType === 'bike' ? '🏍️' : '🚗'}
                      </span>
                      <div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 15, color: '#f0f4ff' }}>
                          {tx.vehicleNumber}
                        </div>
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>
                          {tx.serviceName} • {timeStr}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, fontSize: 16, color: '#06d6a0' }}>
                        ₹{tx.amount}
                      </div>
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>
                        #{tx.id.replace('tx-', '')}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {/* Camera Scanner Modal */}
      {showScanner && (
        <CameraScanner
          isModelReady={isAIReady}
          onScanComplete={handleScanComplete}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Confirmation & Service Select Modal */}
      {pendingScanData && (
        <ConfirmModal
          scanData={pendingScanData}
          worker={worker}
          onSaved={handleSaved}
          onCancel={() => setPendingScanData(null)}
        />
      )}

      {/* Success Flash Notification */}
      {justSavedTx && (
        <div className="saved-flash">
          <div className="saved-check">✅</div>
          <div className="saved-text">SAVED TO LEDGER!</div>
          <div style={{ color: '#f0f4ff', fontSize: 18, fontFamily: 'var(--font-mono)', marginTop: 8 }}>
            {justSavedTx.vehicleNumber} • ₹{justSavedTx.amount}
          </div>
          <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>
            Saved in {justSavedTx.writeLatency}ms (Total: {justSavedTx.totalScanToLedgerLatency}ms)
          </div>
        </div>
      )}
    </div>
  )
}
