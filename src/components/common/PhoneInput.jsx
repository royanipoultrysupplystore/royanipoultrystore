// Reusable Afghan phone input with +93 (0) prefix.
// - First digit must be 7 (Afghan mobile)
// - Exactly 9 digits after the prefix
// - Stored format: "+93 (0) 7XXXXXXXX"
// - Accepts Arabic/Persian digits and auto-converts to Western

import { digitsOnly } from '../../utils/digits'

const STORAGE_PREFIX = '+93 (0) '

// Extract just the 9-digit local part from any stored format
export function extractLocalDigits(stored) {
  if (!stored) return ''
  let digits = digitsOnly(stored)
  if (digits.startsWith('93')) digits = digits.slice(2)
  if (digits.startsWith('0')) digits = digits.slice(1)
  return digits.slice(0, 9)
}

// Reconstruct full storage string from local digits
export function buildStoredPhone(localDigits) {
  if (!localDigits) return ''
  return STORAGE_PREFIX + localDigits
}

export default function PhoneInput({ value, onChange, required = false, className = '' }) {
  const local = extractLocalDigits(value)

  function handleChange(e) {
    // Normalize Arabic/Persian digits → Western, then strip non-digits
    let digits = digitsOnly(e.target.value).slice(0, 9)
    // Enforce: first digit must be 7
    if (digits.length > 0 && digits[0] !== '7') {
      digits = '7' + digits.slice(1)
    }
    onChange(digits ? buildStoredPhone(digits) : '')
  }

  return (
    <div className={`flex items-stretch border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#2E86AB]/30 ${className}`} dir="ltr">
      <span className="px-3 py-2 bg-slate-100 text-slate-600 text-sm font-medium border-e border-slate-200 select-none whitespace-nowrap">
        +93 (0)
      </span>
      <input
        type="tel"
        inputMode="numeric"
        required={required}
        value={local}
        onChange={handleChange}
        placeholder="7XXXXXXXX"
        maxLength={9}
        dir="ltr"
        className="flex-1 px-3 py-2 text-sm focus:outline-none"
      />
    </div>
  )
}
