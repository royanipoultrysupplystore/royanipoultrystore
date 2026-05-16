import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../config/supabase'
import toast from 'react-hot-toast'
import { useLanguage } from '../contexts/LanguageContext'

export function useMarketTransactions({ sellerId = null, farmId = null } = {}) {
  const { t } = useLanguage()
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('market_transactions')
      .select('*, farms(name, name_fa, name_ps), market_sellers(name, shop_number)')
      .order('transaction_date', { ascending: false })
    if (sellerId) query = query.eq('seller_id', sellerId)
    if (farmId) query = query.eq('farm_id', farmId)
    const { data, error } = await query
    if (error) toast.error(t('market.loadFailed'))
    else setTransactions(data || [])
    setLoading(false)
  }, [sellerId, farmId])

  useEffect(() => { load() }, [load])

  // Market transactions track what the seller OWES us (chickens × price).
  // Cash actually received from sellers is recorded separately via market_seller_payments.
  // Farm finances are no longer auto-touched by market transactions — that's now handled
  // independently (existing rows keep their farm_payment_id for historical reference only).
  async function addTransaction(data) {
    // Auto-tag with the farm's current (newest) batch so deaths/sales line up per season.
    let batch_id = null
    if (data.farm_id) {
      const { data: b } = await supabase
        .from('farm_batches')
        .select('id')
        .eq('farm_id', data.farm_id)
        .order('batch_number', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (b) batch_id = b.id
    }
    const { error } = await supabase.from('market_transactions').insert([{ ...data, batch_id }])
    if (error) { toast.error(error.message); return false }
    toast.success(t('market.transactionAdded'))
    await load()
    return true
  }

  async function updateTransaction(id, _oldTx, newData) {
    const { error } = await supabase.from('market_transactions')
      .update(newData)
      .eq('id', id)
    if (error) { toast.error(error.message); return false }
    toast.success(t('market.transactionUpdated'))
    await load()
    return true
  }

  async function deleteTransaction(tx) {
    const { error } = await supabase.from('market_transactions').delete().eq('id', tx.id)
    if (error) { toast.error(error.message); return false }
    toast.success(t('market.transactionDeleted'))
    await load()
    return true
  }

  return { transactions, loading, addTransaction, updateTransaction, deleteTransaction }
}
