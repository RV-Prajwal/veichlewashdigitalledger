// src/scan/PlateOCR.js
// Tesseract.js wrapper — pre-initialized worker for < 2s scan pipeline.

import Tesseract from 'tesseract.js'
import { normalizePlate } from './TextNormalizer'

// Support both ESM default export and named export formats
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
 * Pre-initialize the Tesseract worker.
 * Call this at login — so it's ready before the worker taps SCAN.
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

      // Optimize OCR settings for number plates
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
        tessedit_pageseg_mode: '8', // PSM_SINGLE_WORD
        preserve_interword_spaces: '0',
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
 * Run OCR on an image source (canvas, blob, or URL).
 * Returns normalized plate text and confidence.
 *
 * @param {HTMLCanvasElement|string|Blob} imageSource
 * @returns {{ normalized: string, raw: string, confidence: number, isValid: boolean }}
 */
export async function runOCR(imageSource) {
  const worker = await initOCR()
  if (!worker) {
    // If worker couldn't initialize on device, return graceful fallback
    return {
      normalized: '',
      raw: '',
      confidence: 0,
      isValid: false,
    }
  }

  try {
    const result = await worker.recognize(imageSource)
    const rawText = result.data.text.trim()
    const ocrConf = result.data.confidence || 0

    const { normalized, isValid, confidence: fmtConfidence } = normalizePlate(rawText)

    // Blend OCR confidence and format confidence
    const blendedConfidence = Math.round((ocrConf * 0.6) + (fmtConfidence * 0.4))

    return {
      normalized,
      raw: rawText,
      confidence: blendedConfidence,
      isValid,
    }
  } catch (err) {
    console.warn('OCR recognition error:', err)
    return {
      normalized: '',
      raw: '',
      confidence: 0,
      isValid: false,
    }
  }
}

/**
 * Terminate the worker (call on app unmount if needed).
 */
export async function terminateOCR() {
  if (_worker) {
    try {
      await _worker.terminate()
    } catch {
      // ignore
    }
    _worker = null
    _initPromise = null
  }
}
