// src/scan/ScanPipeline.js
// Orchestrates the full < 2 second scan pipeline:
// Camera frame → Vehicle detection → OCR → Normalization → Result

import { detectVehicle, captureFrame, cropToCanvas, computeSharpness } from './VehicleDetector'
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

const OCR_CONFIDENCE_THRESHOLD = 70  // Below this → low confidence flow
const FRAME_SAMPLE_INTERVAL_MS = 400 // Analyze a frame every 400ms
const MAX_SCAN_ATTEMPTS = 5          // Auto-stop after N attempts

/**
 * Run the full scan pipeline on a video element.
 * Samples multiple frames, picks the sharpest, runs detection + OCR.
 *
 * @param {HTMLVideoElement} videoEl - Live camera stream
 * @param {function} onStatusChange - Called with SCAN_STATUS updates
 * @returns {Promise<ScanResult>}
 */
export async function runScanPipeline(videoEl, onStatusChange) {
  const t0 = performance.now()
  onStatusChange(SCAN_STATUS.SCANNING)

  // ── Step 1: Collect frames over a short window and pick the sharpest ──────
  const frames = await collectSharpFrames(videoEl, 3)
  const bestFrame = frames[0] // Already sorted by sharpness desc

  // ── Step 2: Vehicle detection ──────────────────────────────────────────────
  onStatusChange(SCAN_STATUS.DETECTING)
  const detection = await detectVehicle(bestFrame)
  let vehicleType = detection.vehicleType ?? 'car' // Default to car if unsure

  // ── Step 3: Crop + OCR ─────────────────────────────────────────────────────
  onStatusChange(SCAN_STATUS.OCR_RUNNING)

  // If we detected a vehicle bbox, crop tighter for better OCR
  let ocrSource = bestFrame
  if (detection.bbox) {
    // Draw the full frame into a temp video-sized canvas
    const fullCanvas = document.createElement('canvas')
    fullCanvas.width  = bestFrame.width
    fullCanvas.height = bestFrame.height
    fullCanvas.getContext('2d').drawImage(bestFrame, 0, 0)

    // Create a fake video-like object for cropToCanvas (it just needs videoWidth/videoHeight)
    const fakeVideo = { videoWidth: bestFrame.width, videoHeight: bestFrame.height }
    Object.defineProperty(fakeVideo, 'drawImage', { value: null })
    
    // Crop to bottom half of frame where plates typically appear
    ocrSource = cropPlateRegion(fullCanvas)
  }

  const ocrResult = await runOCR(ocrSource)

  const elapsed = Math.round(performance.now() - t0)

  // ── Step 4: Evaluate confidence ────────────────────────────────────────────
  const confident = ocrResult.confidence >= OCR_CONFIDENCE_THRESHOLD && ocrResult.isValid

  onStatusChange(confident ? SCAN_STATUS.HIGH_CONF : SCAN_STATUS.LOW_CONF)

  return {
    vehicleNumber:  ocrResult.normalized,
    rawOCR:         ocrResult.raw,
    vehicleType,
    ocrConfidence:  ocrResult.confidence,
    isValid:        ocrResult.isValid,
    isConfident:    confident,
    elapsedMs:      elapsed,
    detectionScore: detection.score,
    frameCanvas:    bestFrame,
  }
}

/**
 * Collect N frames from the video stream and sort by sharpness (desc).
 */
async function collectSharpFrames(videoEl, n = 3) {
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

/**
 * Crop the bottom 40% of the frame where the number plate typically is.
 * This significantly improves OCR accuracy and speed.
 */
function cropPlateRegion(canvas) {
  const { width, height } = canvas
  const cropY      = Math.floor(height * 0.45) // Start at 45% from top
  const cropHeight = height - cropY

  const cropped = document.createElement('canvas')
  cropped.width  = width
  cropped.height = cropHeight
  cropped.getContext('2d').drawImage(canvas, 0, cropY, width, cropHeight, 0, 0, width, cropHeight)
  return cropped
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}
