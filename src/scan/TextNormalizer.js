// src/scan/TextNormalizer.js
// High precision Indian vehicle registration number extractor & normalizer
// Supports 1-line car plates, 2-line bike plates, HSRP plates with 'IND' badge, and common OCR confusions

export const INDIAN_STATES = [
  'AN', 'AP', 'AR', 'AS', 'BR', 'CG', 'CH', 'DD', 'DL', 'DN', 'GA', 'GJ', 'HP', 'HR',
  'JH', 'JK', 'KA', 'KL', 'LA', 'LD', 'MH', 'ML', 'MN', 'MP', 'MZ', 'NL', 'OD', 'OR',
  'PB', 'PY', 'RJ', 'SK', 'TN', 'TR', 'TS', 'UK', 'UA', 'UP', 'WB', 'BH'
]

// Common character replacements in digit positions
const DIGIT_FIXES = {
  O: '0', o: '0',
  I: '1', i: '1', l: '1', '|': '1',
  Z: '2', z: '2',
  S: '5', s: '5',
  G: '6',
  B: '8',
}

// Common character replacements in alphabet positions
const ALPHA_FIXES = {
  '0': 'O',
  '1': 'I',
  '5': 'S',
  '8': 'B',
}

/**
 * Normalizes raw OCR text into a clean Indian vehicle registration plate.
 * Handles both 1-line and 2-line plates (e.g. BR 01 C / J 6440 -> BR01CJ6440).
 *
 * @param {string} raw - Raw output from OCR engine
 * @returns {{ normalized: string, raw: string, isValid: boolean, isTwoLine: boolean, confidence: number }}
 */
export function normalizePlate(raw) {
  if (!raw) return { normalized: '', raw: '', isValid: false, isTwoLine: false, confidence: 0 }

  const trimmedRaw = String(raw).trim()
  const lines = trimmedRaw.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean)
  const isTwoLine = lines.length >= 2

  // 1. Remove common noise tokens (IND badge, HSRP logo, manufacturer names)
  let cleaned = trimmedRaw
    .toUpperCase()
    .replace(/\bIND\b/g, '')
    .replace(/\bINDIA\b/g, '')
    .replace(/\bHSRP\b/g, '')
    .replace(/[^A-Z0-9]/g, '')

  // Remove leading IND if glued to text (e.g. "INDBR01CJ6440" -> "BR01CJ6440")
  if (cleaned.startsWith('IND') && cleaned.length > 9) {
    cleaned = cleaned.slice(3)
  }

  // Bharat Series match (e.g. 22BH1234AA)
  const bhMatch = cleaned.match(/(\d{2}BH\d{4}[A-Z]{1,2})/)
  if (bhMatch) {
    return {
      normalized: bhMatch[1],
      raw: trimmedRaw,
      isValid: true,
      isTwoLine,
      confidence: 96,
    }
  }

  // 2. Locate first valid Indian state code in string
  let candidate = cleaned
  let foundStateIdx = -1
  let matchedState = ''

  for (const st of INDIAN_STATES) {
    const idx = cleaned.indexOf(st)
    if (idx !== -1 && (foundStateIdx === -1 || idx < foundStateIdx)) {
      foundStateIdx = idx
      matchedState = st
    }
  }

  // If no state found, check if first 2 characters can be fixed to a valid state
  if (foundStateIdx === -1 && cleaned.length >= 2) {
    const c0 = ALPHA_FIXES[cleaned[0]] || cleaned[0]
    const c1 = ALPHA_FIXES[cleaned[1]] || cleaned[1]
    const potentialState = c0 + c1
    if (INDIAN_STATES.includes(potentialState)) {
      cleaned = potentialState + cleaned.slice(2)
      foundStateIdx = 0
      matchedState = potentialState
    }
  }

  if (foundStateIdx !== -1) {
    candidate = cleaned.slice(foundStateIdx)
  }

  // 3. Zone-aware character correction:
  // Format: [2 State letters][1-2 District digits][1-3 Series letters][4 Number digits]
  if (candidate.length >= 7) {
    // Truncate extraneous trailing noise
    candidate = candidate.slice(0, 10)
    const chars = candidate.split('')

    // Position 0-1: State Code (Force Alpha)
    if (ALPHA_FIXES[chars[0]]) chars[0] = ALPHA_FIXES[chars[0]]
    if (ALPHA_FIXES[chars[1]]) chars[1] = ALPHA_FIXES[chars[1]]

    // Position 2: District digit (Force Digit)
    if (chars.length > 2 && DIGIT_FIXES[chars[2]]) chars[2] = DIGIT_FIXES[chars[2]]

    // Position 3: District digit or series letter
    // If followed by digits, it might be district digit
    if (chars.length > 3 && /[0-9]/.test(chars[2]) && DIGIT_FIXES[chars[3]] && chars.length >= 9) {
      chars[3] = DIGIT_FIXES[chars[3]]
    }

    // Last 4 positions: Unique vehicle number (Must be digits)
    const len = chars.length
    const digitZoneStart = Math.max(4, len - 4)
    for (let i = digitZoneStart; i < len; i++) {
      if (DIGIT_FIXES[chars[i]]) chars[i] = DIGIT_FIXES[chars[i]]
    }

    // Middle Series letters zone: between district digits and last 4 numbers
    if (chars.length >= 9 && /[0-9]/.test(chars[2]) && /[0-9]/.test(chars[3])) {
      for (let i = 4; i < digitZoneStart; i++) {
        if (ALPHA_FIXES[chars[i]]) chars[i] = ALPHA_FIXES[chars[i]]
      }
    }

    candidate = chars.join('')
  }

  // 4. Validate Indian registration pattern
  // Standard: KA01NC8564 or KA1NC8564 or BH series 22BH1234AA
  const isValid =
    /^[A-Z]{2}\d{2}[A-Z]{1,3}\d{4}$/.test(candidate) ||
    /^[A-Z]{2}\d{1}[A-Z]{1,3}\d{4}$/.test(candidate) ||
    /^\d{2}BH\d{4}[A-Z]{1,2}$/.test(candidate)

  // 5. Confidence scoring
  let confidence = 0
  if (isValid) {
    confidence = 96
  } else if (candidate.length >= 7 && matchedState) {
    confidence = 75
  } else if (candidate.length >= 4) {
    confidence = 50
  }

  return {
    normalized: candidate,
    raw: trimmedRaw,
    isValid,
    isTwoLine,
    confidence,
  }
}

/**
 * Format plate for human display: "BR01CJ6440" -> "BR 01 CJ 6440"
 */
export function formatPlateDisplay(normalized) {
  if (!normalized) return ''
  const m = normalized.match(/^([A-Z]{2})(\d{1,2})([A-Z]{1,3})(\d{4})$/)
  if (m) {
    return `${m[1]} ${m[2]} ${m[3]} ${m[4]}`
  }
  const bh = normalized.match(/^(\d{2})(BH)(\d{4})([A-Z]{1,2})$/)
  if (bh) {
    return `${bh[1]} ${bh[2]} ${bh[3]} ${bh[4]}`
  }
  return normalized
}
