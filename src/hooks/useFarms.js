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
    if (error) toast.error(t('farms.loadFailed'))
    else setFarms(data || [])
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
    const { name, owner_name, phone, location, notes, is_active, initial_chicken_count, price_per_chicken, advance_payment } = updates
    const patch = { name, owner_name, phone, location, notes, is_active, initial_chicken_count, price_per_chicken, advance_payment }
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
