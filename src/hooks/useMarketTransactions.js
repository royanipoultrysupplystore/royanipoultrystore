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

  async function addTransaction(data) {
    let farm_payment_id = null
    if (data.total_amount > 0 && data.farm_id) {
      const { data: p, error: pe } = await supabase
        .from('payments')
        .insert([{
          farm_id: data.farm_id,
          amount: data.total_amount,
          payment_date: data.transaction_date,
          notes: `${t('market.paymentNote')}${data.bill_number ? ` — Bill #${data.bill_number}` : ''}`,
        }])
        .select()
        .single()
      if (!pe && p) {
        farm_payment_id = p.id
        const { data: farm } = await supabase.from('farms').select('total_debt').eq('id', data.farm_id).single()
        if (farm) {
          await supabase.from('farms').update({
            total_debt: Math.max(0, (farm.total_debt || 0) - data.total_amount),
          }).eq('id', data.farm_id)
        }
      }
    }
    const { error } = await supabase.from('market_transactions').insert([{ ...data, farm_payment_id }])
    if (error) { toast.error(error.message); return false }
    toast.success(t('market.transactionAdded'))
    await load()
    return true
  }

  async function updateTransaction(id, oldTx, newData) {
    // Reverse old payment
    if (oldTx.farm_payment_id) {
      await supabase.from('payments').delete().eq('id', oldTx.farm_payment_id)
      if (oldTx.farm_id && oldTx.total_amount > 0) {
        const { data: farm } = await supabase.from('farms').select('total_debt').eq('id', oldTx.farm_id).single()
        if (farm) {
          await supabase.from('farms').update({
            total_debt: (farm.total_debt || 0) + oldTx.total_amount,
          }).eq('id', oldTx.farm_id)
        }
      }
    }
    // Create new payment
    let farm_payment_id = null
    if (newData.total_amount > 0 && newData.farm_id) {
      const { data: p } = await supabase
        .from('payments')
        .insert([{
          farm_id: newData.farm_id,
          amount: newData.total_amount,
          payment_date: newData.transaction_date,
          notes: `${t('market.paymentNote')}${newData.bill_number ? ` — Bill #${newData.bill_number}` : ''}`,
        }])
        .select()
        .single()
      if (p) {
        farm_payment_id = p.id
        const { data: farm } = await supabase.from('farms').select('total_debt').eq('id', newData.farm_id).single()
        if (farm) {
          await supabase.from('farms').update({
            total_debt: Math.max(0, (farm.total_debt || 0) - newData.total_amount),
          }).eq('id', newData.farm_id)
        }
      }
    }
    const { error } = await supabase.from('market_transactions')
      .update({ ...newData, farm_payment_id })
      .eq('id', id)
    if (error) { toast.error(error.message); return false }
    toast.success(t('market.transactionUpdated'))
    await load()
    return true
  }

  async function deleteTransaction(tx) {
    if (tx.farm_payment_id) {
      await supabase.from('payments').delete().eq('id', tx.farm_payment_id)
      if (tx.farm_id && tx.total_amount > 0) {
        const { data: farm } = await supabase.from('farms').select('total_debt').eq('id', tx.farm_id).single()
        if (farm) {
          await supabase.from('farms').update({
            total_debt: (farm.total_debt || 0) + tx.total_amount,
          }).eq('id', tx.farm_id)
        }
      }
    }
    const { error } = await supabase.from('market_transactions').delete().eq('id', tx.id)
    if (error) { toast.error(error.message); return false }
    toast.success(t('market.transactionDeleted'))
    await load()
    return true
  }

  return { transactions, loading, addTransaction, updateTransaction, deleteTransaction }
}
