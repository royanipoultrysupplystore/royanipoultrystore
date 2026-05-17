import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../config/supabase'
import toast from 'react-hot-toast'
import { useLanguage } from '../contexts/LanguageContext'

// A farm runs chickens in seasons ("batches"). Each batch has its own initial
// count, price, deaths, and market sales. Multiple batches can stay open; the
// newest batch (highest batch_number) is treated as the current one for
// auto-assigning new deaths / market transactions.
export function useFarmBatches(farmId) {
  const { t } = useLanguage()
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!farmId) { setBatches([]); setLoading(false); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('farm_batches')
      .select('*, suppliers(company_name)')
      .eq('farm_id', farmId)
      .order('batch_number', { ascending: false })
    if (error) toast.error(t('batches.loadFailed'))
    else setBatches(data || [])
    setLoading(false)
  }, [farmId])

  useEffect(() => { load() }, [load])

  // Current batch = newest still-open batch (falls back to newest overall).
  const currentBatch = batches.find(b => b.is_active) || batches[0] || null

  async function createBatch(data) {
    const nextNumber = batches.reduce((m, b) => Math.max(m, b.batch_number || 0), 0) + 1
    const { data: created, error } = await supabase.from('farm_batches').insert([{
      farm_id: farmId,
      batch_number: nextNumber,
      start_date: data.start_date,
      initial_chicken_count: parseInt(data.initial_chicken_count) || 0,
      price_per_chicken: parseFloat(data.price_per_chicken) || 0,
      supplier_id: data.supplier_id || null,
      notes: data.notes || null,
      is_active: true,
    }]).select().single()
    if (error) { toast.error(error.message); return null }
    toast.success(t('batches.created'))
    await load()
    return created
  }

  async function updateBatch(id, data) {
    const { error } = await supabase.from('farm_batches').update({
      start_date: data.start_date,
      initial_chicken_count: parseInt(data.initial_chicken_count) || 0,
      price_per_chicken: parseFloat(data.price_per_chicken) || 0,
      supplier_id: data.supplier_id || null,
      notes: data.notes || null,
    }).eq('id', id)
    if (error) { toast.error(error.message); return false }
    toast.success(t('batches.updated'))
    await load()
    return true
  }

  async function closeBatch(id) {
    const { error } = await supabase.from('farm_batches').update({
      is_active: false,
      end_date: new Date().toISOString().slice(0, 10),
    }).eq('id', id)
    if (error) { toast.error(error.message); return false }
    toast.success(t('batches.closed'))
    await load()
    return true
  }

  async function reopenBatch(id) {
    const { error } = await supabase.from('farm_batches').update({
      is_active: true,
      end_date: null,
    }).eq('id', id)
    if (error) { toast.error(error.message); return false }
    toast.success(t('batches.reopened'))
    await load()
    return true
  }

  async function deleteBatch(id) {
    const { error } = await supabase.from('farm_batches').delete().eq('id', id)
    if (error) { toast.error(error.message); return false }
    toast.success(t('batches.deleted'))
    await load()
    return true
  }

  // Cumulative chicken value across every batch of this farm.
  const totalChickenValue = batches.reduce(
    (s, b) => s + (b.initial_chicken_count || 0) * (b.price_per_chicken || 0), 0
  )

  // How much choza a given Choza supplier still has available:
  // total bought (choza_transactions) − total already assigned to farm batches.
  // excludeBatchId lets an edited batch's own count be added back.
  async function getSupplierChozaBalance(supplierId, excludeBatchId = null) {
    if (!supplierId) return { bought: 0, sent: 0, remaining: Infinity }
    const [txRes, batchRes] = await Promise.all([
      supabase.from('choza_transactions').select('total_choza').eq('supplier_id', supplierId),
      supabase.from('farm_batches').select('id, initial_chicken_count').eq('supplier_id', supplierId),
    ])
    const bought = (txRes.data || []).reduce((s, t) => s + (t.total_choza || 0), 0)
    const sent = (batchRes.data || [])
      .filter(b => b.id !== excludeBatchId)
      .reduce((s, b) => s + (b.initial_chicken_count || 0), 0)
    return { bought, sent, remaining: bought - sent }
  }

  return {
    batches, currentBatch, loading, totalChickenValue,
    createBatch, updateBatch, closeBatch, reopenBatch, deleteBatch,
    getSupplierChozaBalance, refetch: load,
  }
}
