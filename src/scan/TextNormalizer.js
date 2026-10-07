// src/scan/TextNormalizer.js
// Normalizes raw OCR output into a clean Indian vehicle registration number.
// Zero network calls — pure synchronous JS — runs in < 5ms.

/**
 * Indian plate format: SS DD LL NNNN
 * Examples: "KA 01 NC 8564", "KA-01-NC-8564", "ka01nc8564"
 * Target:   "KA01NC8564"
 */

const INDIAN_PLATE_REGEX = /^[A-Z]{2}\d{2}[A-Z]{1,3}\d{4}$/

// Common OCR character confusions (zone-aware corrections)
const CHAR_FIXES_IN_DIGIT_ZONE = {
  O: '0',
  o: '0',
  I: '1',
  i: '1',
  l: '1',
  B: '8', // only when in digit zone and context suggests it
  S: '5',
  Z: '2',
  G: '6',
}

const CHAR_FIXES_IN_ALPHA_ZONE = {
  0: 'O',
  1: 'I',
  5: 'S',
  6: 'G',
}

/**
 * Main normalization entry point.
 * @param {string} raw - Raw OCR text
 * @returns {{ normalized: string, isValid: boolean, confidence: number }}
 */
export function normalizePlate(raw) {
  if (!raw) return { normalized: '', isValid: false, confidence: 0 }

  // Step 1: Strip separators, trim, uppercase
  let text = raw.replace(/[\s\-\.\_]/g, '').toUpperCase().trim()

  // Step 2: Remove any characters that aren't alphanumeric
  text = text.replace(/[^A-Z0-9]/g, '')

  // Step 3: Apply zone-aware character corrections
  text = applyZoneCorrections(text)

  // Step 4: Length check — Indian plates are 9-10 chars after normalization
  const isValid = INDIAN_PLATE_REGEX.test(text)

  // Step 5: Confidence heuristic based on format match
  const confidence = computeFormatConfidence(text)

  return { normalized: text, isValid, confidence }
}

/**
 * Apply zone-specific character corrections.
 * Indian plate: [2 alpha][2 digit][1-3 alpha][4 digit]
 * We fix chars that are clearly in the wrong zone.
 */
function applyZoneCorrections(text) {
  if (text.length < 6) return text

  const chars = text.split('')

  // Positions 0-1: State code (must be alpha)
  for (let i = 0; i <= 1 && i < chars.length; i++) {
    if (CHAR_FIXES_IN_ALPHA_ZONE[chars[i]]) chars[i] = CHAR_FIXES_IN_ALPHA_ZONE[chars[i]]
  }

  // Positions 2-3: District code (must be digit)
  for (let i = 2; i <= 3 && i < chars.length; i++) {
    if (CHAR_FIXES_IN_DIGIT_ZONE[chars[i]]) chars[i] = CHAR_FIXES_IN_DIGIT_ZONE[chars[i]]
  }

  // Positions 4 to (len-4): Series letters (must be alpha)
  const seriesEnd = chars.length - 4
  for (let i = 4; i < seriesEnd && i < chars.length; i++) {
    if (CHAR_FIXES_IN_ALPHA_ZONE[chars[i]]) chars[i] = CHAR_FIXES_IN_ALPHA_ZONE[chars[i]]
  }

  // Last 4 positions: Unique number (must be digit)
  for (let i = Math.max(4, chars.length - 4); i < chars.length; i++) {
    if (CHAR_FIXES_IN_DIGIT_ZONE[chars[i]]) chars[i] = CHAR_FIXES_IN_DIGIT_ZONE[chars[i]]
  }

  return chars.join('')
}

/**
 * Compute a format-match confidence score (0–100).
 * This complements OCR engine confidence.
 */
function computeFormatConfidence(text) {
  if (!text) return 0
  if (INDIAN_PLATE_REGEX.test(text)) return 95 // Perfect match

  let score = 0
  if (text.length >= 9 && text.length <= 10) score += 40
  if (/^[A-Z]{2}/.test(text)) score += 20       // Valid state code start
  if (/\d{2}[A-Z]+\d{4}$/.test(text)) score += 30  // Valid suffix pattern
  return Math.min(score, 90)
}

/**
 * Format plate for display: "KA01NC8564" → "KA 01 NC 8564"
 */
export function formatPlateDisplay(normalized) {
  if (!normalized || normalized.length < 9) return normalized
  // Match: (2 alpha)(2 digit)(1-3 alpha)(4 digit)
  const m = normalized.match(/^([A-Z]{2})(\d{2})([A-Z]{1,3})(\d{4})$/)
  if (m) return `${m[1]} ${m[2]} ${m[3]} ${m[4]}`
  return normalized
}
