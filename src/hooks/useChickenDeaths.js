import { useState, useEffect } from 'react'
import { supabase } from '../config/supabase'
import toast from 'react-hot-toast'
import { useLanguage } from '../contexts/LanguageContext'

// When batchId is given, only that batch's deaths are loaded and new deaths
// are tagged with it. Without it, behaves like before (whole-farm).
export function useChickenDeaths(farmId, batchId = null) {
  const { t } = useLanguage()
  const [deaths, setDeaths] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    if (!farmId) { setLoading(false); return }
    setLoading(true)
    let query = supabase
      .from('chicken_deaths')
      .select('*')
      .eq('farm_id', farmId)
      .order('death_date', { ascending: false })
    if (batchId) query = query.eq('batch_id', batchId)
    const { data, error } = await query
    if (error) toast.error(t('chickens.loadFailed'))
    else setDeaths(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [farmId, batchId])

  async function addDeath(data) {
    const { error } = await supabase.from('chicken_deaths').insert([{
      ...data,
      farm_id: farmId,
      batch_id: batchId || null,
    }])
    if (error) { console.error('chicken_deaths error:', error); toast.error(error.message || t('chickens.addFailed')); return false }
    toast.success(t('chickens.added'))
    await load()
    return true
  }

  async function updateDeath(id, data) {
    const { error } = await supabase.from('chicken_deaths').update(data).eq('id', id)
    if (error) { toast.error(t('chickens.updateFailed')); return false }
    toast.success(t('chickens.updated'))
    await load()
    return true
  }

  async function deleteDeath(id) {
    const { error } = await supabase.from('chicken_deaths').delete().eq('id', id)
    if (error) { toast.error(t('chickens.deleteFailed')); return false }
    toast.success(t('chickens.deleted'))
    await load()
    return true
  }

  return { deaths, loading, addDeath, updateDeath, deleteDeath }
}
