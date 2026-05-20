import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../config/supabase'
import toast from 'react-hot-toast'
import { useLanguage } from '../contexts/LanguageContext'

export function useDispatches(farmId = null) {
  const { t } = useLanguage()
  const [dispatches, setDispatches] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('dispatches')
      .select(`*, farms(name, name_fa, name_ps), dispatch_items(*, products(name, unit))`)
      .order('dispatch_date', { ascending: false })
    if (farmId) query = query.eq('farm_id', farmId)
    const { data, error } = await query
    if (error) toast.error(t('dispatches.loadFailed'))
    else setDispatches(data || [])
    setLoading(false)
  }, [farmId])

  useEffect(() => { fetch() }, [fetch])

  async function getNextInvoiceNumber() {
    const { data } = await supabase
      .from('dispatches')
      .select('invoice_number')
      .order('invoice_number', { ascending: false })
      .limit(1)
    if (data && data.length > 0 && data[0].invoice_number) {
      return data[0].invoice_number + 1
    }
    return 1
  }

  async function createDispatch(dispatch, items) {
    const invoiceNumber = await getNextInvoiceNumber()

    const { data: dispatchData, error: dispatchError } = await supabase
      .from('dispatches')
      .insert([{ ...dispatch, invoice_number: invoiceNumber }])
      .select()
      .single()
    if (dispatchError) { toast.error(dispatchError.message); return false }

    const itemsToInsert = items.map(item => ({
      dispatch_id: dispatchData.id,
      product_id: item.product_id,
      // Link to the specific supplier dispatch (meel bill) the bags came out of,
      // so per-supplier remaining stock can be computed accurately.
      supplier_dispatch_id: item.supplier_dispatch_id || null,
      batch_number: item.batch_number || null,
      quantity: item.quantity,
      purchase_price_at_time: item.purchase_price,
      sell_price_at_time: item.sell_price,
      profit_per_item: item.sell_price - item.purchase_price,
      total_profit: (item.sell_price - item.purchase_price) * item.quantity,
      total_amount: item.sell_price * item.quantity,
    }))

    const { error: itemsError } = await supabase.from('dispatch_items').insert(itemsToInsert)
    if (itemsError) { toast.error(itemsError.message); return false }

    for (const item of items) {
      const { data: product } = await supabase
        .from('products')
        .select('quantity')
        .eq('id', item.product_id)
        .single()
      if (product) {
        await supabase
          .from('products')
          .update({ quantity: Math.max(0, product.quantity - item.quantity) })
          .eq('id', item.product_id)
      }
    }

    const totalAmount = items.reduce((s, i) => s + i.sell_price * i.quantity, 0)
    const totalProfit = items.reduce((s, i) => s + (i.sell_price - i.purchase_price) * i.quantity, 0)
    const { data: farm } = await supabase
      .from('farms')
      .select('total_debt, total_profit_generated')
      .eq('id', dispatch.farm_id)
      .single()
    if (farm) {
      await supabase.from('farms').update({
        total_debt: (farm.total_debt || 0) + totalAmount,
        total_profit_generated: (farm.total_profit_generated || 0) + totalProfit,
      }).eq('id', dispatch.farm_id)
    }

    toast.success(t('dispatches.created') + invoiceNumber)
    await fetch()
    return invoiceNumber
  }

  async function updateDispatch(dispatchId, oldDispatch, newData, editedItems) {
    try {
      for (const item of oldDispatch.dispatch_items || []) {
        const { data: product } = await supabase.from('products').select('quantity').eq('id', item.product_id).single()
        if (product) await supabase.from('products').update({ quantity: (product.quantity || 0) + item.quantity }).eq('id', item.product_id)
      }

      const oldTotalAmount = oldDispatch.total_amount || 0
      const oldTotalProfit = (oldDispatch.dispatch_items || []).reduce((s, i) => s + (i.total_profit || 0), 0)

      const newItems = editedItems.map(item => {
        const qty = parseFloat(item.quantity)
        const sellPrice = parseFloat(item.sell_price_at_time)
        const buyPrice = parseFloat(item.purchase_price_at_time)
        return {
          dispatch_id: dispatchId,
          product_id: item.product_id,
          // Preserve the supplier_dispatch_id from the original row so per-supplier
          // remaining stock stays accurate after an edit.
          supplier_dispatch_id: item.supplier_dispatch_id || null,
          batch_number: item.batch_number || null,
          quantity: qty,
          purchase_price_at_time: buyPrice,
          sell_price_at_time: sellPrice,
          profit_per_item: sellPrice - buyPrice,
          total_profit: (sellPrice - buyPrice) * qty,
          total_amount: sellPrice * qty,
        }
      })

      const newTotalAmount = newItems.reduce((s, i) => s + i.total_amount, 0)
      const newTotalProfit = newItems.reduce((s, i) => s + i.total_profit, 0)

      for (const item of newItems) {
        const { data: product } = await supabase.from('products').select('quantity').eq('id', item.product_id).single()
        if (product) await supabase.from('products').update({ quantity: Math.max(0, (product.quantity || 0) - item.quantity) }).eq('id', item.product_id)
      }

      const { data: farm } = await supabase.from('farms').select('total_debt, total_profit_generated').eq('id', oldDispatch.farm_id).single()
      if (farm) {
        await supabase.from('farms').update({
          total_debt: Math.max(0, (farm.total_debt || 0) - oldTotalAmount + newTotalAmount),
          total_profit_generated: Math.max(0, (farm.total_profit_generated || 0) - oldTotalProfit + newTotalProfit),
        }).eq('id', oldDispatch.farm_id)
      }

      await supabase.from('dispatch_items').delete().eq('dispatch_id', dispatchId)
      if (newItems.length > 0) await supabase.from('dispatch_items').insert(newItems)

      await supabase.from('dispatches').update({
        dispatch_date: newData.dispatch_date,
        notes: newData.notes || null,
        total_amount: newTotalAmount,
      }).eq('id', dispatchId)

      toast.success(t('dispatches.updated'))
      await fetch()
      return true
    } catch {
      toast.error(t('dispatches.updateFailed'))
      return false
    }
  }

  async function deleteDispatch(id) {
    const { data: dispatch } = await supabase
      .from('dispatches')
      .select('*, dispatch_items(*)')
      .eq('id', id)
      .single()

    const { error } = await supabase.from('dispatches').delete().eq('id', id)
    if (error) { toast.error(error.message); return false }

    if (dispatch) {
      for (const item of dispatch.dispatch_items || []) {
        const { data: product } = await supabase.from('products').select('quantity').eq('id', item.product_id).single()
        if (product) {
          await supabase.from('products').update({
            quantity: (product.quantity || 0) + item.quantity,
          }).eq('id', item.product_id)
        }
      }
      const itemProfit = (dispatch.dispatch_items || []).reduce((s, i) => s + (i.total_profit || 0), 0)
      const { data: farm } = await supabase.from('farms').select('total_debt, total_profit_generated').eq('id', dispatch.farm_id).single()
      if (farm) {
        await supabase.from('farms').update({
          total_debt: Math.max(0, (farm.total_debt || 0) - (dispatch.total_amount || 0)),
          total_profit_generated: Math.max(0, (farm.total_profit_generated || 0) - itemProfit),
        }).eq('id', dispatch.farm_id)
      }
    }

    toast.success(t('dispatches.deleted'))
    await fetch()
    return true
  }

  return { dispatches, loading, createDispatch, updateDispatch, deleteDispatch, refetch: fetch }
}
