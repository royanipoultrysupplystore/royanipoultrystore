export function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB') // DD/MM/YYYY
}

export function toInputDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  return d.toISOString().split('T')[0]
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
  return new Date().toISOString().split('T')[0]
}
