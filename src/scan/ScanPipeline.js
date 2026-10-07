// src/scan/ScanPipeline.js
// Upgraded scan pipeline with automatic plate detection anywhere in frame
// Frame capture -> Auto plate localization -> Multi-candidate OCR -> Best result selection

import { detectVehicle, captureFrame, computeSharpness } from './VehicleDetector'
import { runOCR } from './PlateOCR'
import { locatePlateCandidates, captureHighResolution } from './PlateLocator'

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
 * Run the upgraded scan pipeline with automatic plate detection anywhere in frame.
 *
 * @param {HTMLVideoElement|HTMLCanvasElement} source - Live camera stream or uploaded canvas
 * @param {function} onStatusChange - Called with SCAN_STATUS updates
 * @returns {Promise<ScanResult>}
 */
export async function runScanPipeline(source, onStatusChange) {
  const t0 = performance.now()
  onStatusChange(SCAN_STATUS.SCANNING)

  // ── Step 1: Capture high-resolution frame ─────────────────────────────────
  let fullFrame = source
  if (source instanceof HTMLVideoElement) {
    // Use ImageCapture API for native sensor resolution (not 720p video element)
    fullFrame = await captureHighResolution(source)
  }

  console.log(`📸 Frame captured: ${fullFrame.width}x${fullFrame.height}px`)

  // ── Step 2: Automatic plate localization (find plate anywhere in frame) ────
  onStatusChange(SCAN_STATUS.DETECTING)
  const candidates = locatePlateCandidates(fullFrame)

  console.log(`🎯 Found ${candidates.length} plate candidates:`,
    candidates.map(c => `${c.region} (${c.confidence}%)`).join(', '))

  // ── Step 3: Run OCR on all candidates and select best result ───────────────
  onStatusChange(SCAN_STATUS.OCR_RUNNING)

  const ocrResults = []

  // Run OCR on each candidate crop in parallel
  for (const candidate of candidates) {
    try {
      const result = await runOCR(candidate.canvas)
      ocrResults.push({
        ...result,
        region: candidate.region,
        locatorConfidence: candidate.confidence,
        plateCanvas: candidate.canvas,
      })
    } catch (e) {
      console.warn(`OCR failed for ${candidate.region}:`, e)
    }
  }

  // Select best result: prioritize valid plates, then highest confidence
  let bestResult = ocrResults.find(r => r.isValid) || ocrResults[0] || {
    normalized: '',
    raw: '',
    confidence: 0,
    isValid: false,
    isTwoLine: false,
    region: 'none',
  }

  // If all candidates failed, try a center fallback crop
  if (!bestResult.isValid && ocrResults.length === 0) {
    const centerCrop = cropCenterArea(fullFrame)
    bestResult = await runOCR(centerCrop)
    bestResult.region = 'center_fallback'
  }

  const finalPlate = bestResult.isValid || bestResult.confidence >= 75
    ? bestResult.normalized
    : ''

  // ── Step 4: Determine vehicle type ─────────────────────────────────────────
  let vehicleType = 'car'
  if (bestResult.isTwoLine) {
    vehicleType = 'bike'
  }

  // Run vehicle detection in background for additional context
  try {
    const detection = await detectVehicle(fullFrame)
    if (detection.vehicleType && !bestResult.isTwoLine) {
      vehicleType = detection.vehicleType
    }
  } catch (e) {
    console.warn('Vehicle detection skipped:', e)
  }

  const elapsed = Math.round(performance.now() - t0)
  const isConfident = Boolean(finalPlate && bestResult.isValid)

  onStatusChange(isConfident ? SCAN_STATUS.HIGH_CONF : SCAN_STATUS.LOW_CONF)

  console.log(`✅ Scan complete in ${elapsed}ms:`, {
    plate: finalPlate,
    region: bestResult.region,
    vehicleType,
    confidence: bestResult.confidence,
    isValid: bestResult.isValid,
  })

  return {
    vehicleNumber:  finalPlate,
    rawOCR:         bestResult.raw,
    vehicleType,
    ocrConfidence:  bestResult.confidence,
    isValid:        bestResult.isValid,
    isConfident,
    elapsedMs:      elapsed,
    detectionScore: bestResult.locatorConfidence || 85,
    frameCanvas:    fullFrame,
    plateCanvas:    bestResult.plateCanvas, // Cropped plate preview
    detectionRegion: bestResult.region,
  }
}


function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * Center fallback crop for when plate localization fails.
 */
function cropCenterArea(canvas) {
  const { width, height } = canvas
  const cropW = Math.floor(width * 0.7)
  const cropH = Math.floor(height * 0.3)
  const startX = Math.floor((width - cropW) / 2)
  const startY = Math.floor((height - cropH) / 2)

  const cropped = document.createElement('canvas')
  cropped.width = cropW
  cropped.height = cropH
  const ctx = cropped.getContext('2d')
  ctx.drawImage(canvas, startX, startY, cropW, cropH, 0, 0, cropW, cropH)
  return cropped
}
