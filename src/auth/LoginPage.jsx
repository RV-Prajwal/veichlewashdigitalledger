// src/auth/LoginPage.jsx
// Fast login screen with 1-click test credentials for Worker & Admin

import { useState } from 'react'
import { signIn } from '../core/auth'

export default function LoginPage({ onLoginSuccess }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    if (e) e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await signIn(email, password)
      onLoginSuccess(res.user, res.profile)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleQuickLogin = async (userEmail, userPass, forceLocal = false) => {
    setEmail(userEmail)
    setPassword(userPass)
    setLoading(true)
    setError(null)
    try {
      const res = await signIn(userEmail, userPass, forceLocal)
      onLoginSuccess(res.user, res.profile)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        background: 'radial-gradient(circle at 50% 20%, rgba(59,130,246,0.15), transparent 70%), var(--clr-bg-base)',
      }}
    >
      <div
        className="card card--glow"
        style={{
          width: '100%',
          maxWidth: 440,
          padding: 32,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #3b82f6, #06d6a0)',
              margin: '0 auto 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
            }}
          >
            🚗
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#f0f4ff', letterSpacing: '-0.02em' }}>
            WashLedger
          </h1>
          <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
            Digital Vehicle Wash Management & Analytics
          </p>
        </div>

        {error && (
          <div className="alert alert-danger" style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div>⚠️ {error}</div>
            <button
              onClick={() => handleQuickLogin('admin@washledger.com', 'admin123', true)}
              className="btn btn-ghost btn-sm"
              style={{ marginTop: 4, alignSelf: 'flex-start', background: 'rgba(255,255,255,0.1)', fontSize: 11 }}
            >
              👉 Continue in Standalone Demo Mode
            </button>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="input-group">
            <label className="input-label">Email or Username</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. admin@washledger.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label className="input-label">Password</label>
            <input
              type="password"
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ padding: 14, marginTop: 6 }}
          >
            {loading ? <div className="spinner" /> : 'Sign In'}
          </button>
        </form>

        {/* 1-Click Demo Login Shortcuts */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            1-Click Quick Access
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <button
              type="button"
              onClick={() => handleQuickLogin('ravi@washledger.com', 'worker123')}
              className="btn btn-ghost"
              style={{ flex: 1, padding: '10px 12px', fontSize: 13, borderColor: 'rgba(59,130,246,0.3)' }}
            >
              👷 Worker (Ravi)
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('admin@washledger.com', 'admin123')}
              className="btn btn-ghost"
              style={{ flex: 1, padding: '10px 12px', fontSize: 13, borderColor: 'rgba(6,214,160,0.3)' }}
            >
              📊 Admin (Manager)
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleQuickLogin('admin@washledger.com', 'admin123', true)}
            className="btn btn-ghost btn-sm"
            style={{ width: '100%', fontSize: 11, color: '#94a3b8' }}
          >
            ⚡ Test in Offline / Local Mode (Bypass Firebase Auth)
          </button>
        </div>
      </div>
    </div>
  )
}
