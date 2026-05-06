export function formatCurrency(amount) {
  if (amount === null || amount === undefined) return 'AFN 0'
  const num = parseFloat(amount)
  if (isNaN(num)) return 'AFN 0'
  return `AFN ${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export function formatNumber(amount) {
  if (amount === null || amount === undefined) return '0'
  const num = parseFloat(amount)
  if (isNaN(num)) return '0'
  return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}
