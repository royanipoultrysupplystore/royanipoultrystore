import { useState, useEffect } from 'react'
import { supabase } from '../config/supabase'
import toast from 'react-hot-toast'
import { useLanguage } from '../contexts/LanguageContext'

export function useChickenDeaths(farmId) {
  const { t } = useLanguage()
  const [deaths, setDeaths] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    if (!farmId) { setLoading(false); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('chicken_deaths')
      .select('*')
      .eq('farm_id', farmId)
      .order('death_date', { ascending: false })
    if (error) toast.error(t('chickens.loadFailed'))
    else setDeaths(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [farmId])

  async function addDeath(data) {
    const { error } = await supabase.from('chicken_deaths').insert([{ ...data, farm_id: farmId }])
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
