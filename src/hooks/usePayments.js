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

  async function recordPayment(payment) {
    const { error } = await supabase.from('payments').insert([payment])
    if (error) { toast.error(error.message); return false }

    const { data: farm } = await supabase.from('farms').select('total_debt').eq('id', payment.farm_id).single()
    if (farm) {
      await supabase.from('farms').update({
        total_debt: Math.max(0, (farm.total_debt || 0) - payment.amount),
      }).eq('id', payment.farm_id)
    }

    toast.success(t('payments.recorded'))
    await fetch()
    return true
  }

  async function deletePayment(id, farmId, amount) {
    const { error } = await supabase.from('payments').delete().eq('id', id)
    if (error) { toast.error(error.message); return false }
    const { data: farm } = await supabase.from('farms').select('total_debt').eq('id', farmId).single()
    if (farm) {
      await supabase.from('farms').update({ total_debt: (farm.total_debt || 0) + amount }).eq('id', farmId)
    }
    toast.success(t('payments.deleted'))
    await fetch()
    return true
  }

  async function updatePayment(id, oldAmount, farmId, newData) {
    const { error } = await supabase.from('payments').update(newData).eq('id', id)
    if (error) { toast.error(error.message); return false }
    const { data: farm } = await supabase.from('farms').select('total_debt').eq('id', farmId).single()
    if (farm) {
      await supabase.from('farms').update({
        total_debt: Math.max(0, (farm.total_debt || 0) + oldAmount - parseFloat(newData.amount)),
      }).eq('id', farmId)
    }
    toast.success(t('payments.updated'))
    await fetch()
    return true
  }

  return { payments, loading, recordPayment, updatePayment, deletePayment, refetch: fetch }
}
