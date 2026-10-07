// src/admin/ServicesView.jsx
// Service & pricing configuration view for Admin with instant price modification

import { useState, useEffect } from 'react'
import { fetchServices, createService, updateService } from '../core/firestore'

export default function ServicesView() {
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [name, setName] = useState('')
  const [vehicleType, setVehicleType] = useState('car')
  const [price, setPrice] = useState('')

  // Edit price modal state
  const [editingService, setEditingService] = useState(null)
  const [editPriceValue, setEditPriceValue] = useState('')
  const [savingPrice, setSavingPrice] = useState(false)
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await fetchServices()
      setServices(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!name || !price) return
    await createService({
      name,
      vehicleType,
      price: Number(price),
    })
    setName('')
    setPrice('')
    setShowAddModal(false)
    load()
  }

  const handleOpenEditPrice = (srv) => {
    setEditingService(srv)
    setEditPriceValue(srv.price)
  }

  const handleSavePrice = async (e) => {
    e.preventDefault()
    if (!editingService || !editPriceValue) return

    setSavingPrice(true)
    try {
      await updateService(editingService.id, {
        price: Number(editPriceValue),
      })
      setSaveSuccessMsg(`Updated ${editingService.name} price to ₹${editPriceValue}!`)
      setEditingService(null)
      await load()
      setTimeout(() => setSaveSuccessMsg(null), 3000)
    } catch (err) {
      alert('Failed to update price: ' + err.message)
    } finally {
      setSavingPrice(false)
    }
  }

  const handleToggleStatus = async (srv) => {
    const nextStatus = srv.status === 'active' ? 'inactive' : 'active'
    await updateService(srv.id, { status: nextStatus })
    load()
  }

  const carServices = services.filter((s) => s.vehicleType === 'car')
  const bikeServices = services.filter((s) => s.vehicleType === 'bike')

  return (
    <div className="page fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">Wash Pricing & Services Management</h1>
          <p className="page-sub">Configure wash charges and packages applied during scanning</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn btn-primary btn-sm">
          + Add New Package
        </button>
      </div>

      {saveSuccessMsg && (
        <div className="alert alert-success" style={{ marginBottom: 20 }}>
          <span>✓</span> {saveSuccessMsg}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
        {/* Car Services Card */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 24 }}>🚗</span>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#f0f4ff' }}>Car Wash Charges</h2>
            </div>
            <span className="badge badge-primary">{carServices.length} Packages</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {carServices.map((s) => (
              <div
                key={s.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '14px 16px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 10,
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#f0f4ff' }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>Auto-billed on Car detection</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button
                    onClick={() => handleOpenEditPrice(s)}
                    style={{
                      background: 'rgba(6,214,160,0.12)',
                      border: '1px solid rgba(6,214,160,0.3)',
                      borderRadius: 8,
                      padding: '6px 12px',
                      cursor: 'pointer',
                      textAlign: 'right',
                    }}
                    title="Click to change price"
                  >
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#06d6a0' }}>₹{s.price}</div>
                    <div style={{ fontSize: 10, color: '#6ee7b7', fontWeight: 600 }}>✏️ Edit Price</div>
                  </button>

                  <button
                    onClick={() => handleToggleStatus(s)}
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11, padding: '6px 8px' }}
                  >
                    {s.status === 'active' ? 'Active' : 'Disabled'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bike Services Card */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 24 }}>🏍️</span>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#f0f4ff' }}>Bike Wash Charges</h2>
            </div>
            <span className="badge badge-accent">{bikeServices.length} Packages</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {bikeServices.map((s) => (
              <div
                key={s.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '14px 16px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 10,
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#f0f4ff' }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>Auto-billed on Bike detection</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button
                    onClick={() => handleOpenEditPrice(s)}
                    style={{
                      background: 'rgba(6,214,160,0.12)',
                      border: '1px solid rgba(6,214,160,0.3)',
                      borderRadius: 8,
                      padding: '6px 12px',
                      cursor: 'pointer',
                      textAlign: 'right',
                    }}
                    title="Click to change price"
                  >
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#06d6a0' }}>₹{s.price}</div>
                    <div style={{ fontSize: 10, color: '#6ee7b7', fontWeight: 600 }}>✏️ Edit Price</div>
                  </button>

                  <button
                    onClick={() => handleToggleStatus(s)}
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11, padding: '6px 8px' }}
                  >
                    {s.status === 'active' ? 'Active' : 'Disabled'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Edit Price Modal */}
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
              Adjusting price for <strong style={{ color: '#60a5fa' }}>{editingService.name}</strong> ({editingService.vehicleType.toUpperCase()}). New transactions will immediately reflect this amount.
            </p>

            <form onSubmit={handleSavePrice} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="input-group">
                <label className="input-label">New Amount (₹)</label>
                <input
                  type="number"
                  className="input input--lg"
                  style={{ fontSize: 24, fontWeight: 800, color: '#06d6a0' }}
                  value={editPriceValue}
                  onChange={(e) => setEditPriceValue(e.target.value)}
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
                  disabled={savingPrice}
                  className="btn btn-accent"
                  style={{ flex: 2, fontWeight: 800 }}
                >
                  {savingPrice ? 'Updating...' : '💾 Save New Price'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Package Modal */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 420 }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>Create New Wash Package</h3>
            <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="input-group">
                <label className="input-label">Service Title</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Foam Wash + Wax Polish"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label">Applicable Vehicle Type</label>
                <select
                  className="select"
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                >
                  <option value="car">🚗 Car</option>
                  <option value="bike">🏍️ Bike</option>
                </select>
              </div>

              <div className="input-group">
                <label className="input-label">Standard Price (₹)</label>
                <input
                  type="number"
                  className="input"
                  placeholder="e.g. 500"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-ghost" style={{ flex: 1 }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Save Service
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
