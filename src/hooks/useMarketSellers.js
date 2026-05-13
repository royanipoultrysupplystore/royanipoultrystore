import { useState, useEffect, useCallback } from 'react'
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

// Cash payments received from a market seller — independent of farm finances.
export function useMarketSellerPayments(sellerId) {
  const { t } = useLanguage()
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!sellerId) { setPayments([]); setLoading(false); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('market_seller_payments')
      .select('*')
      .eq('seller_id', sellerId)
      .order('payment_date', { ascending: false })
    if (error) toast.error(error.message)
    else setPayments(data || [])
    setLoading(false)
  }, [sellerId])

  useEffect(() => { load() }, [load])

  async function addPayment(data) {
    const { error } = await supabase.from('market_seller_payments').insert([{
      seller_id: sellerId,
      amount: parseFloat(data.amount) || 0,
      payment_date: data.payment_date,
      notes: data.notes || null,
    }])
    if (error) { toast.error(error.message); return false }
    toast.success(t('market.paymentRecorded'))
    await load()
    return true
  }

  async function updatePayment(id, data) {
    const { error } = await supabase.from('market_seller_payments').update({
      amount: parseFloat(data.amount) || 0,
      payment_date: data.payment_date,
      notes: data.notes || null,
    }).eq('id', id)
    if (error) { toast.error(error.message); return false }
    toast.success(t('market.paymentUpdated'))
    await load()
    return true
  }

  async function deletePayment(id) {
    const { error } = await supabase.from('market_seller_payments').delete().eq('id', id)
    if (error) { toast.error(error.message); return false }
    toast.success(t('market.paymentDeleted'))
    await load()
    return true
  }

  const totalPaid = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)

  return { payments, loading, totalPaid, addPayment, updatePayment, deletePayment, refetch: load }
}
