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

    const itemsToInsert = items.map(item => {
      // Currency defaults to AFN — only medicine lines may switch to USD, and
      // the UI only exposes the toggle for medicine. Whichever currency the
      // line is in, we STILL populate the AFN columns as 0 (or vice versa) so
      // Σ total_amount + Σ total_amount_usd are always meaningful.
      const isUSD = item.currency === 'USD'
      const afnBuy = isUSD ? 0 : (parseFloat(item.purchase_price) || 0)
      const afnSell = isUSD ? 0 : (parseFloat(item.sell_price) || 0)
      const usdBuy = isUSD ? (parseFloat(item.purchase_price_usd) || 0) : 0
      const usdSell = isUSD ? (parseFloat(item.sell_price_usd) || 0) : 0
      return {
        dispatch_id: dispatchData.id,
        product_id: item.product_id,
        supplier_dispatch_id: item.supplier_dispatch_id || null,
        batch_number: item.batch_number || null,
        quantity: item.quantity,
        currency: isUSD ? 'USD' : 'AFN',
        purchase_price_at_time: afnBuy,
        sell_price_at_time: afnSell,
        profit_per_item: (afnSell - afnBuy),
        total_profit: (afnSell - afnBuy) * item.quantity,
        total_amount: afnSell * item.quantity,
        purchase_price_usd_at_time: isUSD ? usdBuy : null,
        sell_price_usd_at_time: isUSD ? usdSell : null,
        total_amount_usd: usdSell * item.quantity,
        total_profit_usd: (usdSell - usdBuy) * item.quantity,
      }
    })

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

    // Totals split by currency. AFN lines contribute to total_amount; USD lines
    // contribute to total_amount_usd. Same split for profit and farm debt.
    const totalAmount = items.reduce((s, i) => {
      if (i.currency === 'USD') return s
      return s + (parseFloat(i.sell_price) || 0) * i.quantity
    }, 0)
    const totalProfit = items.reduce((s, i) => {
      if (i.currency === 'USD') return s
      return s + ((parseFloat(i.sell_price) || 0) - (parseFloat(i.purchase_price) || 0)) * i.quantity
    }, 0)
    const totalAmountUsd = items.reduce((s, i) => {
      if (i.currency !== 'USD') return s
      return s + (parseFloat(i.sell_price_usd) || 0) * i.quantity
    }, 0)
    const totalProfitUsd = items.reduce((s, i) => {
      if (i.currency !== 'USD') return s
      return s + ((parseFloat(i.sell_price_usd) || 0) - (parseFloat(i.purchase_price_usd) || 0)) * i.quantity
    }, 0)

    // Persist the dispatch's own USD total (dispatches.total_amount was set
    // to the AFN total on insert; overwrite with correct AFN and set USD).
    await supabase.from('dispatches').update({
      total_amount: totalAmount,
      total_amount_usd: totalAmountUsd,
    }).eq('id', dispatchData.id)

    const { data: farm } = await supabase
      .from('farms')
      .select('total_debt, total_profit_generated, total_debt_usd, total_profit_generated_usd')
      .eq('id', dispatch.farm_id)
      .single()
    if (farm) {
      await supabase.from('farms').update({
        total_debt: (farm.total_debt || 0) + totalAmount,
        total_profit_generated: (farm.total_profit_generated || 0) + totalProfit,
        total_debt_usd: (farm.total_debt_usd || 0) + totalAmountUsd,
        total_profit_generated_usd: (farm.total_profit_generated_usd || 0) + totalProfitUsd,
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
      const oldTotalAmountUsd = oldDispatch.total_amount_usd || 0
      const oldTotalProfit = (oldDispatch.dispatch_items || []).reduce((s, i) => s + (i.total_profit || 0), 0)
      const oldTotalProfitUsd = (oldDispatch.dispatch_items || []).reduce((s, i) => s + (i.total_profit_usd || 0), 0)

      const newItems = editedItems.map(item => {
        const qty = parseFloat(item.quantity)
        const isUSD = item.currency === 'USD'
        const afnSell = isUSD ? 0 : (parseFloat(item.sell_price_at_time) || 0)
        const afnBuy = isUSD ? 0 : (parseFloat(item.purchase_price_at_time) || 0)
        const usdSell = isUSD ? (parseFloat(item.sell_price_usd_at_time) || 0) : 0
        const usdBuy = isUSD ? (parseFloat(item.purchase_price_usd_at_time) || 0) : 0
        return {
          dispatch_id: dispatchId,
          product_id: item.product_id,
          supplier_dispatch_id: item.supplier_dispatch_id || null,
          batch_number: item.batch_number || null,
          quantity: qty,
          currency: isUSD ? 'USD' : 'AFN',
          purchase_price_at_time: afnBuy,
          sell_price_at_time: afnSell,
          profit_per_item: afnSell - afnBuy,
          total_profit: (afnSell - afnBuy) * qty,
          total_amount: afnSell * qty,
          purchase_price_usd_at_time: isUSD ? usdBuy : null,
          sell_price_usd_at_time: isUSD ? usdSell : null,
          total_amount_usd: usdSell * qty,
          total_profit_usd: (usdSell - usdBuy) * qty,
        }
      })

      const overdrawError = await validateBillAvailability(newItems, dispatchId)
      if (overdrawError) { toast.error(overdrawError); return false }

      const newTotalAmount = newItems.reduce((s, i) => s + i.total_amount, 0)
      const newTotalProfit = newItems.reduce((s, i) => s + i.total_profit, 0)
      const newTotalAmountUsd = newItems.reduce((s, i) => s + i.total_amount_usd, 0)
      const newTotalProfitUsd = newItems.reduce((s, i) => s + i.total_profit_usd, 0)

      for (const item of newItems) {
        const { data: product } = await supabase.from('products').select('quantity').eq('id', item.product_id).single()
        if (product) await supabase.from('products').update({ quantity: Math.max(0, (product.quantity || 0) - item.quantity) }).eq('id', item.product_id)
      }

      const { data: farm } = await supabase.from('farms')
        .select('total_debt, total_profit_generated, total_debt_usd, total_profit_generated_usd')
        .eq('id', oldDispatch.farm_id).single()
      if (farm) {
        await supabase.from('farms').update({
          total_debt: Math.max(0, (farm.total_debt || 0) - oldTotalAmount + newTotalAmount),
          total_profit_generated: Math.max(0, (farm.total_profit_generated || 0) - oldTotalProfit + newTotalProfit),
          total_debt_usd: Math.max(0, (farm.total_debt_usd || 0) - oldTotalAmountUsd + newTotalAmountUsd),
          total_profit_generated_usd: Math.max(0, (farm.total_profit_generated_usd || 0) - oldTotalProfitUsd + newTotalProfitUsd),
        }).eq('id', oldDispatch.farm_id)
      }

      await supabase.from('dispatch_items').delete().eq('dispatch_id', dispatchId)
      if (newItems.length > 0) await supabase.from('dispatch_items').insert(newItems)

      await supabase.from('dispatches').update({
        dispatch_date: newData.dispatch_date,
        notes: newData.notes || null,
        total_amount: newTotalAmount,
        total_amount_usd: newTotalAmountUsd,
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
      const itemProfitUsd = (dispatch.dispatch_items || []).reduce((s, i) => s + (i.total_profit_usd || 0), 0)
      const { data: farm } = await supabase.from('farms')
        .select('total_debt, total_profit_generated, total_debt_usd, total_profit_generated_usd')
        .eq('id', dispatch.farm_id).single()
      if (farm) {
        await supabase.from('farms').update({
          total_debt: Math.max(0, (farm.total_debt || 0) - (dispatch.total_amount || 0)),
          total_profit_generated: Math.max(0, (farm.total_profit_generated || 0) - itemProfit),
          total_debt_usd: Math.max(0, (farm.total_debt_usd || 0) - (dispatch.total_amount_usd || 0)),
          total_profit_generated_usd: Math.max(0, (farm.total_profit_generated_usd || 0) - itemProfitUsd),
        }).eq('id', dispatch.farm_id)
      }
    }

    toast.success(t('dispatches.deleted'))
    await fetch()
    return true
  }

  return { dispatches, loading, createDispatch, updateDispatch, deleteDispatch, refetch: fetch }
}
