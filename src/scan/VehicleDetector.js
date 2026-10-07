// src/scan/VehicleDetector.js
// TensorFlow.js + COCO-SSD wrapper for vehicle type detection.
// Pre-loaded at login for zero startup latency at scan time.

import * as cocoSsd from '@tensorflow-models/coco-ssd'
import '@tensorflow/tfjs'

let _model = null
let _modelPromise = null

// COCO-SSD class names for vehicles we care about
const CAR_CLASSES  = ['car', 'truck', 'bus', 'train']
const BIKE_CLASSES = ['motorcycle', 'bicycle']

/**
 * Pre-load the COCO-SSD model.
 * Call at app startup / login — model stays in memory.
 */
export async function initVehicleDetector(onProgress) {
  if (_model) return _model
  if (_modelPromise) return _modelPromise

  _modelPromise = (async () => {
    if (onProgress) onProgress({ status: 'loading_model', progress: 0 })
    // 'lite_mobilenet_v2' is fastest; trades some accuracy for speed
    const model = await cocoSsd.load({ base: 'lite_mobilenet_v2' })
    _model = model
    if (onProgress) onProgress({ status: 'model_ready', progress: 1 })
    return model
  })()

  return _modelPromise
}

/**
 * Detect vehicles in a video frame or image element.
 * Returns detected vehicle type and bounding box.
 *
 * @param {HTMLVideoElement|HTMLCanvasElement|HTMLImageElement} source
 * @returns {{ vehicleType: 'car'|'bike'|null, bbox: [x,y,w,h]|null, score: number }}
 */
export async function detectVehicle(source) {
  const model = await initVehicleDetector()
  if (!model) return { vehicleType: null, bbox: null, score: 0 }

  const predictions = await model.detect(source)

  // Find the highest-confidence vehicle prediction
  let best = null
  for (const pred of predictions) {
    const cls = pred.class.toLowerCase()
    const isVehicle = CAR_CLASSES.includes(cls) || BIKE_CLASSES.includes(cls)
    if (!isVehicle) continue
    if (!best || pred.score > best.score) best = pred
  }

  if (!best) return { vehicleType: null, bbox: null, score: 0 }

  const vehicleType = BIKE_CLASSES.includes(best.class.toLowerCase()) ? 'bike' : 'car'

  return {
    vehicleType,
    bbox: best.bbox, // [x, y, width, height]
    score: Math.round(best.score * 100),
    rawClass: best.class,
  }
}

/**
 * Crop the detected vehicle region from a video frame into a canvas.
 * Used to feed a tighter crop to the OCR engine.
 */
export function cropToCanvas(videoElement, bbox, padding = 20) {
  const [x, y, w, h] = bbox
  const canvas = document.createElement('canvas')

  const px = Math.max(0, x - padding)
  const py = Math.max(0, y - padding)
  const pw = Math.min(videoElement.videoWidth  - px, w + padding * 2)
  const ph = Math.min(videoElement.videoHeight - py, h + padding * 2)

  canvas.width  = pw
  canvas.height = ph
  const ctx = canvas.getContext('2d')
  ctx.drawImage(videoElement, px, py, pw, ph, 0, 0, pw, ph)
  return canvas
}

/**
 * Capture the full video frame to a canvas.
 */
export function captureFrame(videoElement) {
  const canvas = document.createElement('canvas')
  canvas.width  = videoElement.videoWidth
  canvas.height = videoElement.videoHeight
  const ctx = canvas.getContext('2d')
  ctx.drawImage(videoElement, 0, 0)
  return canvas
}

/**
 * Compute Laplacian variance for frame sharpness scoring.
 * Higher = sharper. Used to auto-select the best frame.
 */
export function computeSharpness(canvas) {
  const ctx = canvas.getContext('2d')
  const { width, height } = canvas
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data

  // Convert to grayscale and apply simple Laplacian kernel
  let sum = 0
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = (y * width + x) * 4
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      const above = 0.299 * data[((y - 1) * width + x) * 4]     + 0.587 * data[((y - 1) * width + x) * 4 + 1] + 0.114 * data[((y - 1) * width + x) * 4 + 2]
      const below = 0.299 * data[((y + 1) * width + x) * 4]     + 0.587 * data[((y + 1) * width + x) * 4 + 1] + 0.114 * data[((y + 1) * width + x) * 4 + 2]
      const left  = 0.299 * data[(y * width + (x - 1)) * 4]     + 0.587 * data[(y * width + (x - 1)) * 4 + 1] + 0.114 * data[(y * width + (x - 1)) * 4 + 2]
      const right = 0.299 * data[(y * width + (x + 1)) * 4]     + 0.587 * data[(y * width + (x + 1)) * 4 + 1] + 0.114 * data[(y * width + (x + 1)) * 4 + 2]
      const lap = Math.abs(4 * gray - above - below - left - right)
      sum += lap
    }
  }
  return sum / (width * height)
}
