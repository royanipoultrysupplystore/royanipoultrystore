export function formatDate(dateStr) {
  if (!dateStr) return '—'
  // Pure YYYY-MM-DD strings get rearranged directly — never via new Date(),
  // which parses them as UTC midnight and then shifts back a day for any
  // user west of London.
  const dateOnly = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB') // DD/MM/YYYY
}

export function toInputDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  // Use LOCAL date parts — toISOString() returns UTC, which shifts the day
  // by one for any user east of London past local midnight.
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function isExpiringSoon(dateStr, days = 30) {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const now = new Date()
  const diff = (d - now) / (1000 * 60 * 60 * 24)
  return diff >= 0 && diff <= days
}

export function isExpired(dateStr) {
  if (!dateStr) return false
  const d = new Date(dateStr)
  return d < new Date()
}

export function getMonthYear(date = new Date()) {
  return { month: date.getMonth() + 1, year: date.getFullYear() }
}

export function monthLabel(year, month) {
  return new Date(year, month - 1).toLocaleString('en-US', { month: 'short', year: 'numeric' })
}

export function todayStr() {
  // Local YYYY-MM-DD, not UTC. toISOString() silently dates entries one day
  // earlier for users east of London between 00:00 and their UTC offset.
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
