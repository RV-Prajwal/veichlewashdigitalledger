// src/scan/ScanPipeline.js
// Orchestrates the high-precision < 2 second scan pipeline:
// Frame capture -> Aiming reticle crop -> Vehicle/Bike detection -> OCR -> Normalization

import { detectVehicle, captureFrame, computeSharpness } from './VehicleDetector'
import { runOCR } from './PlateOCR'

export const SCAN_STATUS = {
  IDLE:           'idle',
  SCANNING:       'scanning',
  DETECTING:      'detecting',
  OCR_RUNNING:    'ocr_running',
  HIGH_CONF:      'high_conf',
  LOW_CONF:       'low_conf',
  ERROR:          'error',
}

const FRAME_SAMPLE_INTERVAL_MS = 250 // Fast frame sampling

/**
 * Run the full scan pipeline on a live camera video element or image canvas.
 *
 * @param {HTMLVideoElement|HTMLCanvasElement} source - Live camera stream or uploaded canvas
 * @param {function} onStatusChange - Called with SCAN_STATUS updates
 * @returns {Promise<ScanResult>}
 */
export async function runScanPipeline(source, onStatusChange) {
  const t0 = performance.now()
  onStatusChange(SCAN_STATUS.SCANNING)

  // ── Step 1: Capture best sharp frame ──────────────────────────────────────
  let bestFrame = source
  if (source instanceof HTMLVideoElement) {
    const frames = await collectSharpFrames(source, 2)
    bestFrame = frames[0] || captureFrame(source)
  }

  // ── Step 2: Vehicle detection (in parallel or fast sequence) ───────────────
  onStatusChange(SCAN_STATUS.DETECTING)
  let detection = { vehicleType: null, score: 0 }
  try {
    detection = await detectVehicle(bestFrame)
  } catch (e) {
    console.warn('Vehicle detection skipped:', e)
  }

  // ── Step 3: Targeted Crop to Aiming Reticle Area ───────────────────────────
  onStatusChange(SCAN_STATUS.OCR_RUNNING)

  // First attempt: Crop the central aiming box where the user aligned the plate
  const reticleCanvas = cropReticleArea(bestFrame)
  let ocrResult = await runOCR(reticleCanvas)

  // Fallback attempt: If reticle didn't yield a valid plate, try the full frame
  if (!ocrResult.isValid) {
    const fullResult = await runOCR(bestFrame)
    if (fullResult.isValid || (fullResult.normalized.length > ocrResult.normalized.length)) {
      ocrResult = fullResult
    }
  }

  // ── Step 4: Classify Vehicle Type (Car vs. Bike) ───────────────────────────
  // In India:
  // - 2-line plates (e.g. BR01C / J6440) are almost exclusively Two-Wheelers / Bikes
  // - 1-line wide plates are standard Cars
  let vehicleType = 'car'
  if (ocrResult.isTwoLine) {
    vehicleType = 'bike'
  } else if (detection.vehicleType === 'bike') {
    vehicleType = 'bike'
  } else if (detection.vehicleType === 'car') {
    vehicleType = 'car'
  }

  const elapsed = Math.round(performance.now() - t0)
  const isConfident = ocrResult.isValid || ocrResult.confidence >= 70

  onStatusChange(isConfident ? SCAN_STATUS.HIGH_CONF : SCAN_STATUS.LOW_CONF)

  console.log(`🔍 Scan Completed in ${elapsed}ms:`, {
    normalizedPlate: ocrResult.normalized,
    rawText: ocrResult.raw,
    vehicleType,
    isValid: ocrResult.isValid,
  })

  return {
    vehicleNumber:  ocrResult.normalized,
    rawOCR:         ocrResult.raw,
    vehicleType,
    ocrConfidence:  ocrResult.confidence,
    isValid:        ocrResult.isValid,
    isConfident,
    elapsedMs:      elapsed,
    detectionScore: detection.score || 85,
    frameCanvas:    bestFrame,
  }
}

/**
 * Crops the exact central reticle area corresponding to the viewfinder overlay.
 * Centered horizontally (75% width) and vertically (center 45% height).
 */
function cropReticleArea(canvas) {
  const { width, height } = canvas
  const cropW = Math.floor(width * 0.80)
  const cropH = Math.floor(height * 0.45)
  const startX = Math.floor((width - cropW) / 2)
  const startY = Math.floor((height - cropH) / 2)

  const cropped = document.createElement('canvas')
  cropped.width  = cropW
  cropped.height = cropH
  const ctx = cropped.getContext('2d')
  ctx.drawImage(canvas, startX, startY, cropW, cropH, 0, 0, cropW, cropH)
  return cropped
}

/**
 * Collect sharp frames from video stream.
 */
async function collectSharpFrames(videoEl, n = 2) {
  const frames = []
  for (let i = 0; i < n; i++) {
    const canvas = captureFrame(videoEl)
    const sharpness = computeSharpness(canvas)
    frames.push({ canvas, sharpness })
    if (i < n - 1) await sleep(FRAME_SAMPLE_INTERVAL_MS)
  }
  frames.sort((a, b) => b.sharpness - a.sharpness)
  return frames.map((f) => f.canvas)
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}
