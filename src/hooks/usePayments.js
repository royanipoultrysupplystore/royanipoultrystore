import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../config/supabase'
import toast from 'react-hot-toast'
import { useLanguage } from '../contexts/LanguageContext'

export function usePayments(farmId = null) {
  const { t } = useLanguage()
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('payments')
      .select('*, farms(name, name_fa, name_ps)')
      .order('payment_date', { ascending: false })
    if (farmId) query = query.eq('farm_id', farmId)
    const { data, error } = await query
    if (error) toast.error(t('payments.loadFailed'))
    else setPayments(data || [])
    setLoading(false)
  }, [farmId])

  useEffect(() => { fetch() }, [fetch])

  // recordPayment now accepts a currency ('AFN' or 'USD'). AFN reduces
  // farms.total_debt; USD reduces farms.total_debt_usd. Only one column ever
  // moves per payment. Returns the inserted row so callers can link Store Cash.
  async function recordPayment(payment) {
    const currency = payment.currency === 'USD' ? 'USD' : 'AFN'
    const amountAFN = currency === 'AFN' ? (parseFloat(payment.amount) || 0) : 0
    const amountUSD = currency === 'USD' ? (parseFloat(payment.amount_usd ?? payment.amount) || 0) : 0

    const { data: row, error } = await supabase.from('payments').insert([{
      farm_id: payment.farm_id,
      currency,
      amount: amountAFN,
      amount_usd: amountUSD,
      payment_date: payment.payment_date,
      notes: payment.notes || null,
    }]).select().single()
    if (error) { toast.error(error.message); return null }

    const { data: farm } = await supabase.from('farms')
      .select('total_debt, total_debt_usd').eq('id', payment.farm_id).single()
    if (farm) {
      const patch = currency === 'USD'
        ? { total_debt_usd: Math.max(0, (farm.total_debt_usd || 0) - amountUSD) }
        : { total_debt:     Math.max(0, (farm.total_debt     || 0) - amountAFN) }
      await supabase.from('farms').update(patch).eq('id', payment.farm_id)
    }

    toast.success(t('payments.recorded'))
    await fetch()
    return row
  }

  async function deletePayment(id, farmId, amount, currency = 'AFN', amountUsd = 0) {
    const { error } = await supabase.from('payments').delete().eq('id', id)
    if (error) { toast.error(error.message); return false }
    const { data: farm } = await supabase.from('farms')
      .select('total_debt, total_debt_usd').eq('id', farmId).single()
    if (farm) {
      const patch = currency === 'USD'
        ? { total_debt_usd: (farm.total_debt_usd || 0) + (amountUsd || 0) }
        : { total_debt:     (farm.total_debt     || 0) + (amount    || 0) }
      await supabase.from('farms').update(patch).eq('id', farmId)
    }
    toast.success(t('payments.deleted'))
    await fetch()
    return true
  }

  // Assumes the currency does not change on edit (matches the UI, which only
  // lets you change amount/date/notes).
  async function updatePayment(id, oldAmount, farmId, newData) {
    const currency = newData.currency === 'USD' ? 'USD' : 'AFN'
    const newAmountAFN = currency === 'AFN' ? (parseFloat(newData.amount) || 0) : 0
    const newAmountUSD = currency === 'USD' ? (parseFloat(newData.amount_usd ?? newData.amount) || 0) : 0
    const oldAmountAFN = currency === 'AFN' ? (parseFloat(oldAmount) || 0) : 0
    const oldAmountUSD = currency === 'USD' ? (parseFloat(oldAmount) || 0) : 0

    const { error } = await supabase.from('payments').update({
      currency,
      amount: newAmountAFN,
      amount_usd: newAmountUSD,
      payment_date: newData.payment_date,
      notes: newData.notes || null,
    }).eq('id', id)
    if (error) { toast.error(error.message); return false }
    const { data: farm } = await supabase.from('farms')
      .select('total_debt, total_debt_usd').eq('id', farmId).single()
    if (farm) {
      const patch = currency === 'USD'
        ? { total_debt_usd: Math.max(0, (farm.total_debt_usd || 0) + oldAmountUSD - newAmountUSD) }
        : { total_debt:     Math.max(0, (farm.total_debt     || 0) + oldAmountAFN - newAmountAFN) }
      await supabase.from('farms').update(patch).eq('id', farmId)
    }
    toast.success(t('payments.updated'))
    await fetch()
    return true
  }

  return { payments, loading, recordPayment, updatePayment, deletePayment, refetch: fetch }
}
