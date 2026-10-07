// src/scan/ScanPipeline.js
// Production scan pipeline with backend EasyOCR + Tesseract fallback
// Frame capture -> Auto plate localization -> Backend OCR -> Best result selection

import { detectVehicle, captureFrame, computeSharpness } from './VehicleDetector'
import { runOCR, extractPlateWithBackend } from './PlateOCR'
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

/**
 * Production scan pipeline: capture -> localize -> backend OCR -> normalize.
 *
 * @param {HTMLVideoElement|HTMLCanvasElement} source
 * @param {function} onStatusChange
 * @returns {Promise<ScanResult>}
 */
export async function runScanPipeline(source, onStatusChange) {
  const t0 = performance.now()
  onStatusChange(SCAN_STATUS.SCANNING)

  // ── Step 1: Capture high-resolution frame ─────────────────────────────────
  let fullFrame = source
  if (source instanceof HTMLVideoElement) {
    fullFrame = await captureHighResolution(source)
  }
  console.log(`📸 Frame: ${fullFrame.width}x${fullFrame.height}px`)

  // ── Step 2: Automatic plate localization ──────────────────────────────────
  onStatusChange(SCAN_STATUS.DETECTING)
  const candidates = locatePlateCandidates(fullFrame)
  console.log(`🎯 Candidates: ${candidates.map(c => `${c.region}(${c.confidence}%)`).join(', ')}`)

  // ── Step 3: OCR with backend-first, Tesseract fallback ────────────────────
  onStatusChange(SCAN_STATUS.OCR_RUNNING)

  let bestResult = null

  // Try backend OCR on best candidate first
  if (candidates.length > 0) {
    const topCandidate = candidates[0]
    try {
      const blob = await canvasToBlob(topCandidate.canvas)
      const backendResult = await extractPlateWithBackend(blob, topCandidate.region)

      if (backendResult && backendResult.confidence >= 70) {
        bestResult = {
          ...backendResult,
          region: topCandidate.region,
          locatorConfidence: topCandidate.confidence,
          plateCanvas: topCandidate.canvas,
          ocrMethod: 'backend',
        }
        console.log(`✅ Backend OCR: ${backendResult.normalized} (${backendResult.confidence}%)`)
      }
    } catch (e) {
      console.warn('⚠️ Backend unavailable:', e.message)
    }
  }

  // Fallback: Tesseract if backend failed or low confidence
  if (!bestResult || (bestResult && bestResult.confidence < 85)) {
    console.log('🔄 Tesseract fallback...')
    const fallbackResults = []

    for (const candidate of candidates) {
      try {
        const result = await runOCR(candidate.canvas)
        fallbackResults.push({
          ...result,
          region: candidate.region,
          locatorConfidence: candidate.confidence,
          plateCanvas: candidate.canvas,
          ocrMethod: 'tesseract',
        })
      } catch (e) {
        console.warn(`Tesseract failed for ${candidate.region}`)
      }
    }

    // Select best from Tesseract results
    const tesseractBest = fallbackResults.find(r => r.isValid && r.confidence >= 75)
      || fallbackResults.find(r => r.isValid)
      || fallbackResults[0]

    if (tesseractBest && (!bestResult || tesseractBest.confidence > bestResult.confidence)) {
      bestResult = tesseractBest
    }
  }

  // Last resort: center crop
  if (!bestResult || bestResult.confidence < 50) {
    const centerCrop = cropCenterArea(fullFrame)
    const centerResult = await runOCR(centerCrop)
    if (centerResult.confidence > (bestResult?.confidence || 0)) {
      bestResult = {
        ...centerResult,
        region: 'center_fallback',
        locatorConfidence: 50,
        plateCanvas: centerCrop,
        ocrMethod: 'tesseract_fallback',
      }
    }
  }

  // Default if everything fails
  if (!bestResult) {
    bestResult = {
      normalized: '',
      raw: '',
      confidence: 0,
      isValid: false,
      isTwoLine: false,
      region: 'none',
      ocrMethod: 'none',
    }
  }

  const finalPlate = bestResult.isValid || bestResult.confidence >= 85
    ? bestResult.normalized
    : ''

  // ── Step 4: Vehicle type determination ────────────────────────────────────
  let vehicleType = 'car'
  if (bestResult.isTwoLine) {
    vehicleType = 'bike'
  }

  try {
    const detection = await detectVehicle(fullFrame)
    if (detection.vehicleType && !bestResult.isTwoLine) {
      vehicleType = detection.vehicleType
    }
  } catch (e) {
    console.warn('Vehicle detection skipped')
  }

  const elapsed = Math.round(performance.now() - t0)
  const isConfident = Boolean(finalPlate && bestResult.isValid)

  onStatusChange(isConfident ? SCAN_STATUS.HIGH_CONF : SCAN_STATUS.LOW_CONF)

  console.log(`✅ Scan (${elapsed}ms, ${bestResult.ocrMethod}): ${finalPlate} (${bestResult.confidence}%)`)

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
    plateCanvas:    bestResult.plateCanvas,
    detectionRegion: bestResult.region,
    ocrMethod:      bestResult.ocrMethod,
  }
}

/**
 * Convert canvas to JPEG blob for transmission.
 */
async function canvasToBlob(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.95)
  })
}

/**
 * Center fallback crop.
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
