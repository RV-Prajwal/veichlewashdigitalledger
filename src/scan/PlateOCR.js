// src/scan/PlateOCR.js
// Optimized Tesseract.js engine for Indian number plates (1-line car & 2-line bike plates)

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
 * Pre-initialize the Tesseract worker with multi-line block recognition (PSM 6).
 */
export async function initOCR(onProgress) {
  if (_worker) return _worker
  if (_initPromise) return _initPromise

  _initPromise = (async () => {
    const createWorkerFn = getCreateWorker()
    if (!createWorkerFn) {
      console.warn('createWorker function not found on Tesseract export')
      return null
    }

    try {
      const worker = await createWorkerFn('eng', 1, {
        logger: (m) => {
          if (onProgress) onProgress(m)
        },
      })

      // PSM 6 = Assume a single uniform block of text.
      // This is crucial for Indian number plates because bike plates are 2 lines,
      // and car plates may have spaces between state, district, and sequence numbers.
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 \n',
        tessedit_pageseg_mode: '6',
        preserve_interword_spaces: '1',
      })

      _worker = worker
      return worker
    } catch (err) {
      console.warn('Tesseract worker init error:', err)
      return null
    }
  })()

  return _initPromise
}

/**
 * Enhance canvas image contrast and sharpness for maximum OCR accuracy.
 * Converts to grayscale and stretches high-contrast dark text on white/yellow plate background.
 */
export function enhancePlateForOCR(sourceCanvas) {
  const width = sourceCanvas.width
  const height = sourceCanvas.height
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(sourceCanvas, 0, 0)

  try {
    const imgData = ctx.getImageData(0, 0, width, height)
    const d = imgData.data

    let min = 255
    let max = 0
    for (let i = 0; i < d.length; i += 4) {
      const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2])
      if (g < min) min = g
      if (g > max) max = g
    }

    const range = Math.max(1, max - min)

    // Full dynamic range contrast stretching without destroying character edges
    for (let i = 0; i < d.length; i += 4) {
      const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2])
      const stretched = Math.min(255, Math.max(0, Math.round(((g - min) / range) * 255)))
      d[i] = stretched
      d[i + 1] = stretched
      d[i + 2] = stretched
    }

    ctx.putImageData(imgData, 0, 0)
    return canvas
  } catch (e) {
    console.warn('Canvas enhance fallback:', e)
    return sourceCanvas
  }
}

/**
 * Run OCR on an image source.
 * Returns normalized plate text, confidence, and line structure.
 *
 * @param {HTMLCanvasElement|string|Blob} imageSource
 * @returns {Promise<{ normalized: string, raw: string, confidence: number, isValid: boolean, isTwoLine: boolean }>}
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
    // If given a canvas, enhance contrast first
    let processedSource = imageSource
    if (imageSource instanceof HTMLCanvasElement) {
      processedSource = enhancePlateForOCR(imageSource)
    }

    const result = await worker.recognize(processedSource)
    const rawText = result.data.text.trim()
    const ocrConf = result.data.confidence || 0

    const { normalized, isValid, isTwoLine, confidence: fmtConfidence } = normalizePlate(rawText)

    // Blend OCR confidence and format confidence
    const blendedConfidence = Math.round(ocrConf * 0.5 + fmtConfidence * 0.5)

    return {
      normalized,
      raw: rawText,
      confidence: blendedConfidence,
      isValid,
      isTwoLine,
    }
  } catch (err) {
    console.warn('OCR recognition error:', err)
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
 * Terminate worker.
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
