// src/shared/hooks/useModelPreload.js
// Pre-loads TF.js and Tesseract workers in the background after login.
// Exports preload status so UI can show "Scanner Ready ✅" indicator.

import { useState, useEffect, useRef } from 'react'
import { initVehicleDetector } from '../../scan/VehicleDetector'
import { initOCR } from '../../scan/PlateOCR'

export function useModelPreload(shouldLoad = true) {
  const [tfReady,      setTfReady]      = useState(false)
  const [ocrReady,     setOcrReady]     = useState(false)
  const [tfProgress,   setTfProgress]   = useState(0)
  const [ocrProgress,  setOcrProgress]  = useState(0)
  const [error,        setError]        = useState(null)
  const loaded = useRef(false)

  useEffect(() => {
    if (!shouldLoad || loaded.current) return
    loaded.current = true

    // Load TF.js + COCO-SSD
    initVehicleDetector((p) => {
      setTfProgress(Math.round((p.progress ?? 0) * 100))
    })
      .then(() => setTfReady(true))
      .catch((e) => setError(e.message))

    // Load Tesseract.js OCR worker
    initOCR((m) => {
      if (m.status === 'recognizing text') {
        setOcrProgress(Math.round((m.progress ?? 0) * 100))
      } else if (m.status === 'loaded tesseract core') {
        setOcrProgress(30)
      } else if (m.status === 'initializing tesseract') {
        setOcrProgress(50)
      } else if (m.status === 'initialized tesseract') {
        setOcrProgress(70)
      } else if (m.status === 'loading language traineddata') {
        setOcrProgress(80)
      } else if (m.status === 'loaded language traineddata') {
        setOcrProgress(95)
      }
    })
      .then(() => {
        setOcrProgress(100)
        setOcrReady(true)
      })
      .catch((e) => setError(e.message))
  }, [shouldLoad])

  const isReady = tfReady && ocrReady
  const overallProgress = Math.round((tfProgress + ocrProgress) / 2)

  return { isReady, tfReady, ocrReady, tfProgress, ocrProgress, overallProgress, error }
}
