/**
 * Returns the localized value of a field from a database record.
 * Falls back through: requested lang → English → raw field value.
 *
 * DB convention: Dari variant stored as `field_fa`, Pashto as `field_ps`.
 * English value is the base column (e.g. `name`).
 *
 * Usage: lf(farm, 'name', lang)  →  farm.name_fa || farm.name
 */
export function lf(record, field, lang) {
  if (!record) return ''
  if (lang === 'en') return record[field] || ''
  const langVal = record[`${field}_${lang}`]
  if (langVal) return langVal
  // fallback: for Pashto, try Dari next
  if (lang === 'ps') {
    const faVal = record[`${field}_fa`]
    if (faVal) return faVal
  }
  return record[field] || ''
}
