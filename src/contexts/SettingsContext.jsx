import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../config/supabase'

const SettingsContext = createContext({
  rate: 73,
  commissionRate: 5,
  loading: true,
  saveRate: async () => false,
  saveCommissionRate: async () => false,
})

export function SettingsProvider({ children }) {
  const [rate, setRate] = useState(73)
  const [commissionRate, setCommissionRate] = useState(5)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase.from('settings').select('key, value')
    if (data) {
      for (const row of data) {
        if (row.key === 'usd_to_afn_rate') setRate(parseFloat(row.value) || 73)
        if (row.key === 'commission_rate_per_chicken') setCommissionRate(parseFloat(row.value) || 5)
      }
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function saveRate(newRate) {
    const r = parseFloat(newRate)
    if (!r || r <= 0) return false
    const { error } = await supabase
      .from('settings')
      .upsert({ key: 'usd_to_afn_rate', value: String(r) }, { onConflict: 'key' })
    if (error) { console.error('saveRate error:', error); return { ok: false, message: error.message } }
    setRate(r)
    return { ok: true }
  }

  async function saveCommissionRate(newRate) {
    const r = parseFloat(newRate)
    if (isNaN(r) || r < 0) return false
    const { error } = await supabase
      .from('settings')
      .upsert({ key: 'commission_rate_per_chicken', value: String(r) }, { onConflict: 'key' })
    if (error) { console.error('saveCommissionRate error:', error); return { ok: false, message: error.message } }
    setCommissionRate(r)
    return { ok: true }
  }

  return (
    <SettingsContext.Provider value={{ rate, commissionRate, loading, saveRate, saveCommissionRate }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useExchangeRate() {
  return useContext(SettingsContext)
}

export function useCommissionRate() {
  return useContext(SettingsContext)
}
