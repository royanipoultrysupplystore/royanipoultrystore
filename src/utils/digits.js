// Convert Arabic-Indic (٠-٩) and Persian/Pashto (۰-۹) digits to Western (0-9).
// Used on every numeric input so the system stores only Western digits even when
// the user types with an Arabic/Persian keyboard layout.

const DIGIT_MAP = {
  // Arabic-Indic (U+0660 - U+0669)
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  // Extended Arabic-Indic / Persian / Pashto (U+06F0 - U+06F9)
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
}

const DIGIT_REGEX = /[٠-٩۰-۹]/g

// Convert any Arabic/Persian digits in a string to Western digits.
// Non-digit characters are passed through unchanged.
export function normalizeDigits(str) {
  if (str === null || str === undefined) return str
  return String(str).replace(DIGIT_REGEX, d => DIGIT_MAP[d] || d)
}

// Convenience wrapper: pull digits out and normalize at the same time.
export function digitsOnly(str) {
  return normalizeDigits(str).replace(/\D/g, '')
}
