// src/worker/ConfirmModal.jsx
// Fast confirmation & service selection modal with duplicate detection

import { useState, useEffect } from 'react'
import { fetchServices, checkDuplicate, createTransaction } from '../core/firestore'
import { normalizePlate, formatPlateDisplay } from '../scan/TextNormalizer'

export default function ConfirmModal({ scanData, worker, onSaved, onCancel }) {
  const [vehicleNumber, setVehicleNumber] = useState(scanData.vehicleNumber || '')
  const [vehicleType, setVehicleType] = useState(scanData.vehicleType || 'car')
  const [services, setServices] = useState([])
  const [selectedServiceId, setSelectedServiceId] = useState('')
  const [selectedService, setSelectedService] = useState(null)
  const [duplicateWarning, setDuplicateWarning] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loadingServices, setLoadingServices] = useState(true)

  // Current formatted time
  const [currentTime] = useState(() => {
    const d = new Date()
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
  })

  // Sync scanData updates
  useEffect(() => {
    if (scanData?.vehicleNumber) {
      setVehicleNumber(scanData.vehicleNumber)
    }
    if (scanData?.vehicleType) {
      setVehicleType(scanData.vehicleType)
    }
  }, [scanData])

  // Load available services for this vehicle type
  useEffect(() => {
    async function load() {
      setLoadingServices(true)
      try {
        const list = await fetchServices(vehicleType)
        setServices(list)
        if (list.length > 0) {
          // Default to first service or popular one (e.g. Premium)
          const def = list.find((s) => s.name.toLowerCase().includes('premium')) || list[0]
          setSelectedServiceId(def.id)
          setSelectedService(def)
        }
      } catch (err) {
        console.error('Failed to load services:', err)
      } finally {
        setLoadingServices(false)
      }
    }
    load()
  }, [vehicleType])

  // Update selected service when dropdown changes
  const handleServiceChange = (e) => {
    const sId = e.target.value
    setSelectedServiceId(sId)
    const found = services.find((s) => s.id === sId)
    setSelectedService(found || null)
  }

  // Check for duplicates
  useEffect(() => {
    async function runDupCheck() {
      if (vehicleNumber.trim().length >= 6) {
        const dup = await checkDuplicate(vehicleNumber, 60)
        setDuplicateWarning(dup)
      } else {
        setDuplicateWarning(null)
      }
    }
    runDupCheck()
  }, [vehicleNumber])

  // Handle vehicle type change
  const handleTypeChange = (type) => {
    setVehicleType(type)
  }

  // Confirm and save to digital ledger
  const handleConfirmSave = async () => {
    if (!vehicleNumber.trim()) {
      alert('Please enter or scan a vehicle number.')
      return
    }
    if (!selectedService) {
      alert('Please select a wash service.')
      return
    }

    setIsSubmitting(true)
    const t0 = performance.now()

    try {
      const txData = {
        vehicleNumber: vehicleNumber.trim(),
        vehicleType,
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        amount: selectedService.price,
        ocrConfidence: scanData.ocrConfidence || 95,
      }

      const txId = await createTransaction(
        txData,
        worker.uid || worker.id || 'worker-01',
        worker.displayName || worker.name || 'Worker'
      )

      const writeLatency = Math.round(performance.now() - t0)
      console.log(`✅ Ledger saved in ${writeLatency}ms! (Tx ID: ${txId})`)

      onSaved({
        ...txData,
        id: txId,
        writeLatency,
        totalScanToLedgerLatency: (scanData.elapsedMs || 0) + writeLatency,
      })
    } catch (err) {
      console.error('Transaction save error:', err)
      alert('Failed to save transaction: ' + err.message)
      setIsSubmitting(false)
    }
  }

  const confidenceScore = scanData.ocrConfidence || 90

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth: 500, padding: '24px 24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'rgba(6,214,160,0.15)',
                color: '#06d6a0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
              }}
            >
              ✓
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#f0f4ff' }}>
                Vehicle Recognized
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                Captured in {scanData.elapsedMs || 320}ms • Ready for Ledger
              </div>
            </div>
          </div>

          <div
            className={`badge ${confidenceScore >= 75 ? 'badge-accent' : 'badge-warn'}`}
            style={{ fontSize: 12, padding: '4px 10px' }}
          >
            {confidenceScore}% Match
          </div>
        </div>

        {/* Duplicate warning alert banner */}
        {duplicateWarning && (
          <div
            className="alert alert-warn"
            style={{ marginBottom: 16, fontSize: 13, display: 'flex', gap: 10 }}
          >
            <span style={{ fontSize: 18 }}>⚠️</span>
            <div>
              <strong>Recent Duplicate Detected!</strong>
              <div>
                {duplicateWarning.vehicleNumber} was recorded today at{' '}
                {new Date(duplicateWarning.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{' '}
                ({duplicateWarning.serviceName} - ₹{duplicateWarning.amount}).
              </div>
            </div>
          </div>
        )}

        {/* Form Body */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Registration Number Field */}
          <div className="input-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="input-label">Vehicle Registration Number</label>
              {vehicleNumber ? (
                <span style={{ fontSize: 11, color: '#06d6a0', fontWeight: 700 }}>✓ Plate Detected</span>
              ) : (
                <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700 }}>⚠️ Enter Number</span>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="input input--mono"
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  paddingRight: 40,
                  letterSpacing: '0.08em',
                  borderColor: vehicleNumber ? 'rgba(6,214,160,0.4)' : 'rgba(245,158,11,0.5)',
                }}
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value.toUpperCase().replace(/[\s\-\.]/g, ''))}
                placeholder="TYPE NUMBER HERE"
                autoFocus={!vehicleNumber}
              />
              <span
                style={{
                  position: 'absolute',
                  right: 14,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8',
                  fontSize: 16,
                }}
              >
                ✏️
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              {vehicleNumber
                ? 'Extracted via camera OCR • Tap above to correct if needed'
                : 'OCR was unable to read the plate clearly • Please type it above'}
            </div>
          </div>

          {/* Vehicle Type Toggle */}
          <div className="input-group">
            <label className="input-label">Vehicle Type</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button
                type="button"
                onClick={() => handleTypeChange('car')}
                className={`btn ${vehicleType === 'car' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '12px 16px', fontSize: 15 }}
              >
                🚗 Car
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange('bike')}
                className={`btn ${vehicleType === 'bike' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '12px 16px', fontSize: 15 }}
              >
                🏍️ Bike / Two Wheeler
              </button>
            </div>
          </div>

          {/* Service Selector & Auto Price */}
          <div className="input-group">
            <label className="input-label">Select Wash Service</label>
            {loadingServices ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, color: '#94a3b8' }}>
                <div className="spinner" /> Loading services...
              </div>
            ) : (
              <select
                className="select"
                value={selectedServiceId}
                onChange={handleServiceChange}
                style={{ fontSize: 16 }}
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — ₹{s.price}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Price & Time Summary Card */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
                Time Recorded
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f4ff', marginTop: 2 }}>
                ⏱️ {currentTime} (Auto)
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
                Amount Charged
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#06d6a0', lineHeight: 1.1 }}>
                ₹{selectedService ? selectedService.price : 0}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="btn btn-ghost"
            style={{ flex: 1, padding: 14 }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmSave}
            disabled={isSubmitting}
            className="btn btn-accent"
            style={{ flex: 2, padding: 14, fontSize: 16, fontWeight: 800 }}
          >
            {isSubmitting ? (
              <>
                <div className="spinner spinner--accent" /> Saving...
              </>
            ) : (
              '⚡ CONFIRM & SAVE'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
