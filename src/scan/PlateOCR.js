// src/scan/PlateOCR.js
// Production OCR: Backend EasyOCR + Tesseract.js fallback for Indian license plates

import Tesseract from 'tesseract.js'
import { normalizePlate } from './TextNormalizer'

const getCreateWorker = () => {
  if (typeof Tesseract?.createWorker === 'function') {
    return Tesseract.createWorker
  }
  if (typeof Tesseract?.default?.createWorker === 'function') {
    return Tesseract.default.createWorker
  }
  return null
}

let _worker = null
let _initPromise = null

/**
 * Send cropped plate canvas to backend for EasyOCR extraction.
 * Gracefully falls back to Tesseract if backend is unavailable.
 */
export async function extractPlateWithBackend(canvasBlob, region = 'center') {
  try {
    const formData = new FormData()
    formData.append('image', canvasBlob, 'plate.jpg')
    formData.append('region', region)

    const response = await fetch('/.netlify/functions/ocr', {
      method: 'POST',
      body: formData,
      timeout: 5000,
    })

    if (!response.ok) {
      console.warn(`Backend OCR failed (${response.status})`)
      return null
    }

    const result = await response.json()
    console.log('✅ Backend OCR:', result.plate, `(${result.confidence}%)`)

    return {
      normalized: result.plate,
      raw: result.raw,
      confidence: result.confidence,
      isValid: result.isValid,
      isTwoLine: '\n' in (result.raw || ''),
      source: 'backend',
    }
  } catch (e) {
    console.warn('⚠️ Backend OCR unavailable:', e.message)
    return null
  }
}

/**
 * Pre-initialize the Tesseract worker (used as fallback).
 */
export async function initOCR(onProgress) {
  if (_worker) return _worker
  if (_initPromise) return _initPromise

  _initPromise = (async () => {
    const createWorkerFn = getCreateWorker()
    if (!createWorkerFn) {
      console.warn('Tesseract.createWorker not found')
      return null
    }

    try {
      const worker = await createWorkerFn('eng', 1, {
        logger: (m) => {
          if (onProgress) onProgress(m)
        },
      })

      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 \n',
        tessedit_pageseg_mode: '6',
        preserve_interword_spaces: '1',
      })

      _worker = worker
      return worker
    } catch (err) {
      console.warn('Tesseract init error:', err)
      return null
    }
  })()

  return _initPromise
}

/**
 * Enhance canvas image contrast, sharpness, and resolution for maximum OCR accuracy.
 * Upscales by 2.2x, applies dynamic histogram stretch and stroke sharpening.
 * Special handling for EV green plates by inverting if detected.
 */
export function enhancePlateForOCR(sourceCanvas) {
  const srcW = sourceCanvas.width
  const srcH = sourceCanvas.height

  // Upscale 2.2x so character height is 40-60px (ideal for Tesseract)
  const scale = 2.2
  const width = Math.round(srcW * scale)
  const height = Math.round(srcH * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(sourceCanvas, 0, 0, width, height)

  try {
    const imgData = ctx.getImageData(0, 0, width, height)
    const d = imgData.data

    // Detect background color to identify EV plates (green background)
    const bgColor = detectBackgroundColor(d, width, height)
    const isGreenBg = bgColor.g > Math.max(bgColor.r, bgColor.b) + 30

    // Calculate grayscale and find min/max
    const grays = new Float32Array(width * height)
    let min = 255, max = 0
    for (let i = 0; i < d.length; i += 4) {
      const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      grays[i / 4] = g
      if (g < min) min = g
      if (g > max) max = g
    }

    const range = Math.max(1, max - min)

    // Dynamic contrast stretch & mild sharpening
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x
        const g = grays[idx]

        // Contrast stretched value 0..255
        let val = Math.round(((g - min) / range) * 255)

        // Invert if green background (makes white text dark on light)
        if (isGreenBg) {
          val = 255 - val
        }

        // Mild high-frequency boost on horizontal strokes
        if (x > 0 && x < width - 1) {
          const diff = g - (grays[idx - 1] + grays[idx + 1]) * 0.5
          val = Math.min(255, Math.max(0, val + Math.round(diff * 0.3)))
        }

        const pIdx = idx * 4
        d[pIdx] = val
        d[pIdx + 1] = val
        d[pIdx + 2] = val
      }
    }

    ctx.putImageData(imgData, 0, 0)
    return canvas
  } catch (e) {
    console.warn('Enhancement fallback:', e)
    return sourceCanvas
  }
}

/**
 * Detect background color by sampling corners.
 */
function detectBackgroundColor(data, width, height) {
  const margin = Math.floor(Math.min(width, height) * 0.1)
  const corners = [
    margin, margin,
    width - margin - 1, margin,
    margin, height - margin - 1,
    width - margin - 1, height - margin - 1,
  ]

  let avgR = 0, avgG = 0, avgB = 0
  for (let i = 0; i < corners.length; i += 2) {
    const x = corners[i], y = corners[i + 1]
    const idx = (y * width + x) * 4
    avgR += data[idx]
    avgG += data[idx + 1]
    avgB += data[idx + 2]
  }
  const n = corners.length / 2
  return { r: avgR / n, g: avgG / n, b: avgB / n }
}

/**
 * Dual-line OCR for 2-line Indian two-wheeler plates.
 * Slices top line (State + District + Series) and bottom line (Number).
 */
async function runDualLineOCR(canvas, worker) {
  const width = canvas.width
  const height = canvas.height

  // Top half slice (Line 1: 0 to 58% height)
  const topH = Math.floor(height * 0.58)
  const topCanvas = document.createElement('canvas')
  topCanvas.width = width
  topCanvas.height = topH
  topCanvas.getContext('2d').drawImage(canvas, 0, 0, width, topH, 0, 0, width, topH)

  // Bottom half slice (Line 2: 42% to 100% height)
  const botY = Math.floor(height * 0.42)
  const botH = height - botY
  const botCanvas = document.createElement('canvas')
  botCanvas.width = width
  botCanvas.height = botH
  botCanvas.getContext('2d').drawImage(canvas, 0, botY, width, botH, 0, 0, width, botH)

  // Single line mode (PSM 7) prevents line-wrap errors
  await worker.setParameters({ tessedit_pageseg_mode: '7' })
  const res1 = await worker.recognize(enhancePlateForOCR(topCanvas))
  const res2 = await worker.recognize(enhancePlateForOCR(botCanvas))
  await worker.setParameters({ tessedit_pageseg_mode: '6' })

  const line1 = res1.data.text.trim()
  const line2 = res2.data.text.trim()
  const combined = `${line1}\n${line2}`

  const norm = normalizePlate(combined)
  const avgConf = Math.round(((res1.data.confidence || 0) + (res2.data.confidence || 0)) / 2)
  const blendedConf = Math.round(avgConf * 0.5 + norm.confidence * 0.5)

  return {
    normalized: norm.normalized,
    raw: combined,
    confidence: blendedConf,
    isValid: norm.isValid,
    isTwoLine: true,
  }
}

/**
 * Run OCR on an image source (Tesseract fallback).
 * Returns normalized plate text, confidence, and line structure.
 */
export async function runOCR(imageSource) {
  const worker = await initOCR()
  if (!worker) {
    return {
      normalized: '',
      raw: '',
      confidence: 0,
      isValid: false,
      isTwoLine: false,
    }
  }

  try {
    let processedSource = imageSource
    if (imageSource instanceof HTMLCanvasElement) {
      processedSource = enhancePlateForOCR(imageSource)
    }

    // Pass 1: Full uniform block recognition (PSM 6)
    await worker.setParameters({ tessedit_pageseg_mode: '6' })
    const result = await worker.recognize(processedSource)
    const rawText = result.data.text.trim()
    const ocrConf = result.data.confidence || 0

    const blockResult = normalizePlate(rawText)
    blockResult.raw = rawText
    blockResult.confidence = Math.round(ocrConf * 0.5 + blockResult.confidence * 0.5)

    // Pass 2: If canvas and not already valid, try dual-line slice (for bike plates)
    if (imageSource instanceof HTMLCanvasElement && !blockResult.isValid) {
      const dualResult = await runDualLineOCR(imageSource, worker)
      if (dualResult.isValid || dualResult.confidence > blockResult.confidence) {
        return dualResult
      }
    }

    return blockResult
  } catch (err) {
    console.warn('OCR error:', err)
    return {
      normalized: '',
      raw: '',
      confidence: 0,
      isValid: false,
      isTwoLine: false,
    }
  }
}

/**
 * Terminate Tesseract worker.
 */
export async function terminateOCR() {
  if (_worker) {
    try {
      await _worker.terminate()
    } catch {}
    _worker = null
    _initPromise = null
  }
}
