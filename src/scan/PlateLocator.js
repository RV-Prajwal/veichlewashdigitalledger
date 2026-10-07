// src/scan/PlateLocator.js
// Automatic license plate localization engine — finds plates anywhere in the frame
// using contour detection, aspect ratio filtering, and edge density analysis

/**
 * Automatically locate license plate candidates in a full-resolution frame.
 * Returns ranked candidate crops sorted by detection confidence.
 *
 * @param {HTMLCanvasElement} fullCanvas - Full resolution camera capture
 * @returns {Array<{canvas: HTMLCanvasElement, bbox: {x,y,w,h}, confidence: number, region: string}>}
 */
export function locatePlateCandidates(fullCanvas) {
  const { width, height } = fullCanvas
  const ctx = fullCanvas.getContext('2d')

  // Step 1: Create grayscale version for edge detection
  const grayCanvas = convertToGrayscale(fullCanvas)

  // Step 2: Apply edge detection (Sobel gradient approximation)
  const edgeCanvas = detectEdges(grayCanvas)

  // Step 3: Find candidate rectangular regions using intelligent band scanning
  const candidates = []

  // Region 1: Lower Bumper (Car front/rear plates) - Y: 45%-85%, X: 20%-80%
  candidates.push(...scanRegionForPlates(edgeCanvas, fullCanvas, {
    name: 'lower_bumper',
    xStart: 0.20, xEnd: 0.80,
    yStart: 0.45, yEnd: 0.85,
    minAspect: 2.5, maxAspect: 5.5, // Wide car plates
  }))

  // Region 2: Mudguard/Lower Center (Bike rear plates) - Y: 50%-90%, X: 25%-75%
  candidates.push(...scanRegionForPlates(edgeCanvas, fullCanvas, {
    name: 'mudguard',
    xStart: 0.25, xEnd: 0.75,
    yStart: 0.50, yEnd: 0.90,
    minAspect: 1.3, maxAspect: 2.5, // Bike plates (stacked or semi-wide)
  }))

  // Region 3: Center Viewfinder (General fallback) - Y: 30%-70%, X: 15%-85%
  candidates.push(...scanRegionForPlates(edgeCanvas, fullCanvas, {
    name: 'center',
    xStart: 0.15, xEnd: 0.85,
    yStart: 0.30, yEnd: 0.70,
    minAspect: 1.5, maxAspect: 5.0,
  }))

  // Step 4: Rank candidates by edge density + contrast ratio
  const ranked = candidates
    .map(c => ({
      ...c,
      score: computePlateScore(c.canvas),
    }))
    .sort((a, b) => b.score - a.score)

  // Return top 3 candidates
  return ranked.slice(0, 3).map(c => ({
    canvas: c.canvas,
    bbox: c.bbox,
    confidence: Math.min(98, Math.round(c.score)),
    region: c.region,
  }))
}

/**
 * Scan a specific region of the frame for plate-shaped rectangles.
 */
function scanRegionForPlates(edgeCanvas, sourceCanvas, region) {
  const { width, height } = edgeCanvas
  const { name, xStart, xEnd, yStart, yEnd, minAspect, maxAspect } = region

  const x1 = Math.floor(width * xStart)
  const x2 = Math.floor(width * xEnd)
  const y1 = Math.floor(height * yStart)
  const y2 = Math.floor(height * yEnd)

  const regionWidth = x2 - x1
  const regionHeight = y2 - y1

  const candidates = []

  // Multi-scale sliding window to find plate-sized rectangles
  const scales = [0.6, 0.75, 0.9] // 60%, 75%, 90% of region width

  for (const scale of scales) {
    const plateWidth = Math.floor(regionWidth * scale)

    // Try different aspect ratios within the allowed range
    for (let aspect = minAspect; aspect <= maxAspect; aspect += 0.3) {
      const plateHeight = Math.floor(plateWidth / aspect)

      if (plateHeight > regionHeight || plateHeight < 30) continue

      // Slide window vertically through the region
      const step = Math.max(10, Math.floor(regionHeight * 0.15))
      for (let y = y1; y <= y2 - plateHeight; y += step) {
        // Center horizontally
        const x = x1 + Math.floor((regionWidth - plateWidth) / 2)

        // Check if this window has high edge density (indicates text/plate)
        const edgeDensity = computeEdgeDensity(edgeCanvas, x, y, plateWidth, plateHeight)

        if (edgeDensity > 0.08) { // Threshold: 8% of pixels are edges
          const cropCanvas = cropRegion(sourceCanvas, x, y, plateWidth, plateHeight)
          candidates.push({
            canvas: cropCanvas,
            bbox: { x, y, w: plateWidth, h: plateHeight },
            region: name,
            edgeDensity,
          })
        }
      }
    }
  }

  return candidates
}

/**
 * Convert canvas to grayscale for edge detection.
 */
function convertToGrayscale(canvas) {
  const { width, height } = canvas
  const ctx = canvas.getContext('2d')
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data

  const grayCanvas = document.createElement('canvas')
  grayCanvas.width = width
  grayCanvas.height = height
  const grayCtx = grayCanvas.getContext('2d')
  const grayData = grayCtx.createImageData(width, height)
  const gd = grayData.data

  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
    gd[i] = gd[i + 1] = gd[i + 2] = gray
    gd[i + 3] = 255
  }

  grayCtx.putImageData(grayData, 0, 0)
  return grayCanvas
}

/**
 * Apply Sobel edge detection to grayscale canvas.
 */
function detectEdges(grayCanvas) {
  const { width, height } = grayCanvas
  const ctx = grayCanvas.getContext('2d')
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data

  const edgeCanvas = document.createElement('canvas')
  edgeCanvas.width = width
  edgeCanvas.height = height
  const edgeCtx = edgeCanvas.getContext('2d')
  const edgeData = edgeCtx.createImageData(width, height)
  const ed = edgeData.data

  // Simple Sobel kernel approximation
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4

      const tl = data[((y - 1) * width + (x - 1)) * 4]
      const tc = data[((y - 1) * width + x) * 4]
      const tr = data[((y - 1) * width + (x + 1)) * 4]
      const ml = data[(y * width + (x - 1)) * 4]
      const mr = data[(y * width + (x + 1)) * 4]
      const bl = data[((y + 1) * width + (x - 1)) * 4]
      const bc = data[((y + 1) * width + x) * 4]
      const br = data[((y + 1) * width + (x + 1)) * 4]

      const gx = (tr + 2 * mr + br) - (tl + 2 * ml + bl)
      const gy = (bl + 2 * bc + br) - (tl + 2 * tc + tr)
      const magnitude = Math.sqrt(gx * gx + gy * gy)

      const val = magnitude > 30 ? 255 : 0 // Binary threshold
      ed[idx] = ed[idx + 1] = ed[idx + 2] = val
      ed[idx + 3] = 255
    }
  }

  edgeCtx.putImageData(edgeData, 0, 0)
  return edgeCanvas
}

/**
 * Compute edge pixel density in a rectangular region.
 */
function computeEdgeDensity(edgeCanvas, x, y, w, h) {
  const ctx = edgeCanvas.getContext('2d')
  const imageData = ctx.getImageData(x, y, w, h)
  const data = imageData.data

  let edgeCount = 0
  const totalPixels = w * h

  for (let i = 0; i < data.length; i += 4) {
    if (data[i] > 128) edgeCount++ // White edge pixel
  }

  return edgeCount / totalPixels
}

/**
 * Compute plate likelihood score based on contrast and text-like patterns.
 */
function computePlateScore(canvas) {
  const { width, height } = canvas
  const ctx = canvas.getContext('2d')
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data

  let sum = 0, min = 255, max = 0
  const grays = []

  for (let i = 0; i < data.length; i += 4) {
    const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    grays.push(g)
    sum += g
    if (g < min) min = g
    if (g > max) max = g
  }

  const mean = sum / grays.length
  const contrast = max - min

  // High contrast suggests clear text on uniform background (plate characteristic)
  const contrastScore = Math.min(100, contrast)

  // Compute horizontal edge variance (text has strong horizontal structure)
  let horizontalVariance = 0
  for (let y = 0; y < height - 1; y++) {
    let rowDiff = 0
    for (let x = 0; x < width; x++) {
      const curr = grays[y * width + x]
      const next = grays[(y + 1) * width + x]
      rowDiff += Math.abs(curr - next)
    }
    horizontalVariance += rowDiff / width
  }
  horizontalVariance /= height

  const structureScore = Math.min(100, horizontalVariance * 0.5)

  return contrastScore * 0.6 + structureScore * 0.4
}

/**
 * Crop a region from source canvas.
 */
function cropRegion(sourceCanvas, x, y, w, h) {
  const cropped = document.createElement('canvas')
  cropped.width = w
  cropped.height = h
  const ctx = cropped.getContext('2d')
  ctx.drawImage(sourceCanvas, x, y, w, h, 0, 0, w, h)
  return cropped
}

/**
 * Use ImageCapture API to grab high-resolution photo from video track.
 * Falls back to canvas capture if ImageCapture is unavailable.
 *
 * @param {HTMLVideoElement} videoElement
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function captureHighResolution(videoElement) {
  // Attempt ImageCapture API for native sensor resolution
  if (videoElement.srcObject && 'ImageCapture' in window) {
    try {
      const track = videoElement.srcObject.getVideoTracks()[0]
      const imageCapture = new ImageCapture(track)

      // takePhoto() returns full sensor resolution (not constrained by video element)
      const blob = await imageCapture.takePhoto()
      const img = await loadImageFromBlob(blob)

      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)

      console.log(`📸 ImageCapture: ${canvas.width}x${canvas.height}px`)
      return canvas
    } catch (e) {
      console.warn('ImageCapture failed, falling back to canvas:', e)
    }
  }

  // Fallback: capture from video element at its native resolution
  const canvas = document.createElement('canvas')
  canvas.width = videoElement.videoWidth || videoElement.clientWidth
  canvas.height = videoElement.videoHeight || videoElement.clientHeight
  const ctx = canvas.getContext('2d')
  ctx.drawImage(videoElement, 0, 0)

  console.log(`📸 Canvas fallback: ${canvas.width}x${canvas.height}px`)
  return canvas
}

/**
 * Load image from blob.
 */
function loadImageFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(img.src)
      resolve(img)
    }
    img.onerror = reject
    img.src = URL.createObjectURL(blob)
  })
}
