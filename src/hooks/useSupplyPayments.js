import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../config/supabase'
import toast from 'react-hot-toast'
import { useLanguage } from '../contexts/LanguageContext'

export function useSupplyPayments(farmId = null) {
  const { t } = useLanguage()
  const [supplyPayments, setSupplyPayments] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('supply_payments')
      .select('*, farms(name, name_fa, name_ps)')
      .order('payment_date', { ascending: false })
    if (farmId) query = query.eq('farm_id', farmId)
    const { data, error } = await query
    if (error) toast.error(t('supply.loadFailed'))
    else setSupplyPayments(data || [])
    setLoading(false)
  }, [farmId])

  useEffect(() => { fetch() }, [fetch])

  async function addSupplyPayment(payment) {
    const { error } = await supabase.from('supply_payments').insert([payment])
    if (error) { toast.error(error.message); return false }

    const { data: farm } = await supabase
      .from('farms')
      .select('total_debt')
      .eq('id', payment.farm_id)
      .single()
    if (farm) {
      await supabase.from('farms').update({
        total_debt: (farm.total_debt || 0) + payment.amount,
      }).eq('id', payment.farm_id)
    }

    toast.success(t('supply.recorded'))
    await fetch()
    return true
  }

  async function deleteSupplyPayment(id, farmId, amount) {
    const { error } = await supabase.from('supply_payments').delete().eq('id', id)
    if (error) { toast.error(error.message); return false }
    const { data: farm } = await supabase.from('farms').select('total_debt').eq('id', farmId).single()
    if (farm) {
      await supabase.from('farms').update({
        total_debt: Math.max(0, (farm.total_debt || 0) - amount),
      }).eq('id', farmId)
    }
    toast.success(t('supply.deleted'))
    await fetch()
    return true
  }

  async function updateSupplyPayment(id, oldRecord, newData) {
    const { error } = await supabase.from('supply_payments').update(newData).eq('id', id)
    if (error) { toast.error(error.message); return false }
    if (oldRecord.farm_id === newData.farm_id) {
      const { data: farm } = await supabase.from('farms').select('total_debt').eq('id', newData.farm_id).single()
      if (farm) {
        await supabase.from('farms').update({
          total_debt: Math.max(0, (farm.total_debt || 0) - oldRecord.amount + newData.amount),
        }).eq('id', newData.farm_id)
      }
    } else {
      const [{ data: oldFarm }, { data: newFarm }] = await Promise.all([
        supabase.from('farms').select('total_debt').eq('id', oldRecord.farm_id).single(),
        supabase.from('farms').select('total_debt').eq('id', newData.farm_id).single(),
      ])
      if (oldFarm) await supabase.from('farms').update({ total_debt: Math.max(0, (oldFarm.total_debt || 0) - oldRecord.amount) }).eq('id', oldRecord.farm_id)
      if (newFarm) await supabase.from('farms').update({ total_debt: (newFarm.total_debt || 0) + newData.amount }).eq('id', newData.farm_id)
    }
    toast.success(t('supply.updated'))
    await fetch()
    return true
  }

  return { supplyPayments, loading, addSupplyPayment, updateSupplyPayment, deleteSupplyPayment, refetch: fetch }
}
