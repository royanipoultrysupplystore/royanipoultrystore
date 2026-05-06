// Convert a stored phone string to wa.me-compatible international format.
// Stored format examples we may encounter:
//   "+93 (0) 7XXXXXXXX"  ← new canonical format
//   "0 7XX XXX XXX"
//   "07XXXXXXXX"
//   "7XXXXXXXX"
//   "+937XXXXXXXX"
// All become "937XXXXXXXX" for wa.me.
export function phoneToWaFormat(phone) {
  if (!phone) return null
  // Strip everything except digits
  let digits = String(phone).replace(/\D/g, '')
  if (!digits) return null
  // Strip leading "93" country code if already present
  if (digits.startsWith('93')) digits = digits.slice(2)
  // Strip the "0" trunk prefix if present
  if (digits.startsWith('0')) digits = digits.slice(1)
  // Must be exactly 9 digits starting with 7 to be a valid Afghan mobile
  if (digits.length !== 9 || digits[0] !== '7') return null
  return `93${digits}`
}

// Build a wa.me URL with pre-filled message
export function buildWhatsAppUrl(phone, message) {
  const wa = phoneToWaFormat(phone)
  if (!wa) return null
  return `https://wa.me/${wa}?text=${encodeURIComponent(message)}`
}

// Check if a phone number is sendable via WhatsApp
export function canSendWhatsApp(phone) {
  return phoneToWaFormat(phone) !== null
}
