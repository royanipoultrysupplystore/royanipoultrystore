import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../config/supabase'
import toast from 'react-hot-toast'
import { useLanguage } from '../contexts/LanguageContext'

export function useFarms() {
  const { t } = useLanguage()
  const [farms, setFarms] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('farms')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) { toast.error(t('farms.loadFailed')); setLoading(false); return }

    // Compute current_debt live per farm the same way FarmDetail does, so the
    // Farms list never shows a stale stored total_debt (which has historically
    // drifted from reality when dispatches/payments edited debt unevenly).
    const [disp, pay, supply, batches] = await Promise.all([
      supabase.from('dispatches').select('farm_id, total_amount'),
      supabase.from('payments').select('farm_id, amount'),
      supabase.from('supply_payments').select('farm_id, amount'),
      supabase.from('farm_batches').select('farm_id, initial_chicken_count, price_per_chicken'),
    ])
    const sumBy = (res, key) => {
      const m = {}
      for (const r of (res.data || [])) m[r.farm_id] = (m[r.farm_id] || 0) + (parseFloat(r[key]) || 0)
      return m
    }
    const dispatched = sumBy(disp, 'total_amount')
    const paid = sumBy(pay, 'amount')
    const supplyOut = sumBy(supply, 'amount')
    const chickenDebt = {}
    for (const b of (batches.data || [])) {
      chickenDebt[b.farm_id] = (chickenDebt[b.farm_id] || 0) + (b.initial_chicken_count || 0) * (b.price_per_chicken || 0)
    }
    const enriched = (data || []).map(f => ({
      ...f,
      current_debt: Math.max(0, (dispatched[f.id] || 0) + (supplyOut[f.id] || 0) + (chickenDebt[f.id] || 0) - (paid[f.id] || 0)),
    }))
    setFarms(enriched)
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  async function addFarm(farm) {
    const { data, error } = await supabase.from('farms').insert([farm]).select().single()
    if (error) { toast.error(error.message); return null }
    toast.success(t('farms.added'))
    await fetch()
    return data
  }

  async function updateFarm(id, updates) {
    // Whitelist which columns callers may set, but only include keys that are
    // actually present on `updates` — a partial patch like { is_active: false }
    // used to null every other column because destructuring produced undefined.
    const allowed = ['name', 'owner_name', 'phone', 'location', 'notes', 'is_active', 'initial_chicken_count', 'price_per_chicken', 'advance_payment']
    const patch = {}
    for (const k of allowed) {
      if (Object.prototype.hasOwnProperty.call(updates, k)) patch[k] = updates[k]
    }
    const { error } = await supabase.from('farms').update(patch).eq('id', id)
    if (error) { toast.error(error.message); return false }
    toast.success(t('farms.updated'))
    await fetch()
    return true
  }

  async function deleteFarm(id) {
    const { error } = await supabase.from('farms').delete().eq('id', id)
    if (error) { toast.error(error.message); return false }
    toast.success(t('farms.deleted'))
    await fetch()
    return true
  }

  async function getFarmById(id) {
    const { data, error } = await supabase.from('farms').select('*').eq('id', id).single()
    if (error) return null
    return data
  }

  return { farms, loading, addFarm, updateFarm, deleteFarm, getFarmById, refetch: fetch }
}
