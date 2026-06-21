import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../config/supabase'
import toast from 'react-hot-toast'
import { useLanguage } from '../contexts/LanguageContext'

// Pre-flight guard against over-dispatching a meel bill. Reads each bill's
// current consumed total straight from the DB so it survives stale UI state
// and concurrent saves, then refuses the operation if the items would push
// any bill past its received quantity.
//
// `excludeDispatchId` lets the EDIT flow ignore its own existing items when
// counting what's already drawn — otherwise replacing an item would always
// look like it's doubling consumption against itself.
//
// Returns null if every bill has room; otherwise returns a user-readable
// error string naming the offending bill, what's available, and what was
// asked for.
async function validateBillAvailability(items, excludeDispatchId = null) {
  const wanted = {}
  for (const it of items) {
    const sdId = it.supplier_dispatch_id
    if (!sdId) continue
    wanted[sdId] = (wanted[sdId] || 0) + (parseFloat(it.quantity) || 0)
  }
  const billIds = Object.keys(wanted)
  if (billIds.length === 0) return null

  let consumedQuery = supabase
    .from('dispatch_items')
    .select('supplier_dispatch_id, quantity')
    .in('supplier_dispatch_id', billIds)
  if (excludeDispatchId) consumedQuery = consumedQuery.neq('dispatch_id', excludeDispatchId)

  const [billsRes, consumedRes] = await Promise.all([
    supabase.from('supplier_dispatches').select('id, bill_number, quantity').in('id', billIds),
    consumedQuery,
  ])

  const consumed = {}
  for (const r of consumedRes.data || []) {
    consumed[r.supplier_dispatch_id] = (consumed[r.supplier_dispatch_id] || 0) + (r.quantity || 0)
  }

  for (const bill of billsRes.data || []) {
    const want = wanted[bill.id] || 0
    const already = consumed[bill.id] || 0
    const available = Math.max(0, (bill.quantity || 0) - already)
    if (want > available) {
      const label = bill.bill_number ? `#${bill.bill_number}` : bill.id.slice(0, 8)
      return `Bill ${label} only has ${available} bags available (${bill.quantity} received, ${already} already dispatched). You tried to dispatch ${want}.`
    }
  }
  return null
}

export function useDispatches(farmId = null) {
  const { t } = useLanguage()
  const [dispatches, setDispatches] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('dispatches')
      .select(`*, farms(name, name_fa, name_ps), dispatch_items(*, products(name, unit), supplier_dispatches(bill_number, dana_type, suppliers(company_name)))`)
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
    // Block over-dispatching at the source: if any line would draw more
    // bags from a meel bill than the bill has left, refuse before writing
    // anything. This is the guard that should have always existed — its
    // absence is what let bills end up over-claimed in past data.
    const overdrawError = await validateBillAvailability(items)
    if (overdrawError) { toast.error(overdrawError); return false }

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

      // Same guard as createDispatch, but pass dispatchId so this dispatch's
      // OWN existing items aren't counted as "already consumed" against itself
      // — otherwise editing the quantity from 20 → 25 would falsely look like
      // a 20+25=45 draw. The DB transaction conceptually replaces the items,
      // so we check post-replacement state.
      const overdrawError = await validateBillAvailability(newItems, dispatchId)
      if (overdrawError) { toast.error(overdrawError); return false }

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

    // Explicitly remove the line items first instead of relying on the FK cascade.
    // If the cascade isn't actually set on the live DB, orphan dispatch_items keep
    // showing up in the per-bill "consumed" sum, which leaves each touched meel
    // bill stuck at 0 available -- so the user can't pick that bill for a new
    // dispatch even after deleting the bad one.
    await supabase.from('dispatch_items').delete().eq('dispatch_id', id)

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
