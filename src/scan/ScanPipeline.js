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

  // ── Step 3: Multi-Window Targeted OCR ─────────────────────────────────────
  onStatusChange(SCAN_STATUS.OCR_RUNNING)

  // Pass 1: Primary Viewfinder Reticle (2.0:1 Aspect Ratio)
  const reticleCanvas = cropReticleArea(bestFrame)
  let ocrResult = await runOCR(reticleCanvas)

  // Pass 2: Lower-Center Bike Reticle (where rear bike plates typically sit)
  if (!ocrResult.isValid) {
    const bikeCanvas = cropBikePlateArea(bestFrame)
    const bikeResult = await runOCR(bikeCanvas)
    if (bikeResult.isValid || (bikeResult.confidence > ocrResult.confidence && bikeResult.normalized.length >= 7)) {
      ocrResult = bikeResult
    }
  }

  // Pass 3: Full Frame Fallback — STRICTLY ONLY accepted if it is a validated Indian plate!
  if (!ocrResult.isValid) {
    const fullResult = await runOCR(bestFrame)
    if (fullResult.isValid) {
      ocrResult = fullResult
    }
  }

  // If plate is not valid and low confidence, do not present hallucinated noise
  const finalPlate = ocrResult.isValid || ocrResult.confidence >= 75 ? ocrResult.normalized : ''

  // ── Step 4: Classify Vehicle Type (Car vs. Bike) ───────────────────────────
  let vehicleType = 'car'
  if (ocrResult.isTwoLine) {
    vehicleType = 'bike'
  } else if (detection.vehicleType === 'bike') {
    vehicleType = 'bike'
  } else if (detection.vehicleType === 'car') {
    vehicleType = 'car'
  }

  const elapsed = Math.round(performance.now() - t0)
  const isConfident = Boolean(finalPlate && ocrResult.isValid)

  onStatusChange(isConfident ? SCAN_STATUS.HIGH_CONF : SCAN_STATUS.LOW_CONF)

  console.log(`🔍 Scan Completed in ${elapsed}ms:`, {
    normalizedPlate: finalPlate,
    rawText: ocrResult.raw,
    vehicleType,
    isValid: ocrResult.isValid,
  })

  return {
    vehicleNumber:  finalPlate,
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
 * Crops the exact central reticle area corresponding to the viewfinder overlay (2.0:1 ratio).
 */
function cropReticleArea(canvas) {
  const { width, height } = canvas
  const cropW = Math.floor(width * 0.84)
  const cropH = Math.min(Math.floor(height * 0.40), Math.floor(cropW / 2.0))
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
 * Crops a lower-center window tailored for two-wheeler plates mounted on rear mudguards.
 */
function cropBikePlateArea(canvas) {
  const { width, height } = canvas
  const cropW = Math.floor(width * 0.80)
  const cropH = Math.floor(cropW / 1.7)
  const startX = Math.floor((width - cropW) / 2)
  // Shifted slightly below vertical center (Y: 53%)
  const startY = Math.min(height - cropH, Math.floor(height * 0.35))

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
