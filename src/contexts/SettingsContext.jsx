import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../config/supabase'
import { setStoreSignature } from '../utils/whatsappTemplates'

const DEFAULT_NAME = 'Royani Poultry'
const DEFAULT_NAME_PS = 'رویاني پولټري'

const SettingsContext = createContext({
  rate: 73,
  commissionRate: 5,
  businessName: DEFAULT_NAME,
  businessNamePs: DEFAULT_NAME_PS,
  loading: true,
  saveRate: async () => false,
  saveCommissionRate: async () => false,
  saveBusinessName: async () => false,
})

export function SettingsProvider({ children }) {
  const [rate, setRate] = useState(73)
  const [commissionRate, setCommissionRate] = useState(5)
  const [businessName, setBusinessName] = useState(DEFAULT_NAME)
  const [businessNamePs, setBusinessNamePs] = useState(DEFAULT_NAME_PS)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase.from('settings').select('key, value')
    if (data) {
      let nameEn = DEFAULT_NAME
      let namePs = DEFAULT_NAME_PS
      for (const row of data) {
        if (row.key === 'usd_to_afn_rate') setRate(parseFloat(row.value) || 73)
        if (row.key === 'commission_rate_per_chicken') setCommissionRate(parseFloat(row.value) || 5)
        if (row.key === 'business_name' && row.value) nameEn = row.value
        if (row.key === 'business_name_ps' && row.value) namePs = row.value
      }
      setBusinessName(nameEn)
      setBusinessNamePs(namePs)
      // Push into the WhatsApp template signature so messages use the right name.
      setStoreSignature(nameEn, namePs)
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

  async function saveBusinessName(nameEn, namePs) {
    const en = (nameEn || '').trim()
    const ps = (namePs || '').trim()
    if (!en) return { ok: false, message: 'Business name is required' }
    const { error } = await supabase
      .from('settings')
      .upsert([
        { key: 'business_name', value: en },
        { key: 'business_name_ps', value: ps },
      ], { onConflict: 'key' })
    if (error) { console.error('saveBusinessName error:', error); return { ok: false, message: error.message } }
    setBusinessName(en)
    setBusinessNamePs(ps)
    setStoreSignature(en, ps)
    return { ok: true }
  }

  return (
    <SettingsContext.Provider value={{
      rate, commissionRate, businessName, businessNamePs, loading,
      saveRate, saveCommissionRate, saveBusinessName,
    }}>
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

export function useBusinessInfo() {
  return useContext(SettingsContext)
}
