import { useState, useEffect } from 'react'
import { supabase } from '../config/supabase'
import toast from 'react-hot-toast'
import { useLanguage } from '../contexts/LanguageContext'

export function useMarketSellers() {
  const { t } = useLanguage()
  const [sellers, setSellers] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('market_sellers')
      .select('*, market_transactions(chicken_count, total_amount)')
      .order('created_at', { ascending: false })
    if (error) toast.error(t('market.loadFailed'))
    else setSellers(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function addSeller(data) {
    const { error } = await supabase.from('market_sellers').insert([data])
    if (error) { toast.error(error.message); return false }
    toast.success(t('market.sellerAdded'))
    await load()
    return true
  }

  async function updateSeller(id, data) {
    const { error } = await supabase.from('market_sellers').update(data).eq('id', id)
    if (error) { toast.error(error.message); return false }
    toast.success(t('market.sellerUpdated'))
    await load()
    return true
  }

  async function deleteSeller(id) {
    const { error } = await supabase.from('market_sellers').delete().eq('id', id)
    if (error) { toast.error(error.message); return false }
    toast.success(t('market.sellerDeleted'))
    await load()
    return true
  }

  async function getSellerById(id) {
    const { data } = await supabase.from('market_sellers').select('*').eq('id', id).single()
    return data
  }

  return { sellers, loading, addSeller, updateSeller, deleteSeller, getSellerById }
}
