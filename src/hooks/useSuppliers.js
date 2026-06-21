import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../config/supabase'
import toast from 'react-hot-toast'
import { useLanguage } from '../contexts/LanguageContext'

export function useSuppliers() {
  const { t } = useLanguage()
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) toast.error(t('suppliers.loadFailed'))
    else setSuppliers(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  async function addSupplier(supplier) {
    const { data, error } = await supabase.from('suppliers').insert([supplier]).select().single()
    if (error) { toast.error(error.message); return null }
    toast.success(t('suppliers.added'))
    await fetch()
    return data
  }

  async function updateSupplier(id, updates) {
    const { error } = await supabase.from('suppliers').update(updates).eq('id', id)
    if (error) { toast.error(error.message); return false }
    toast.success(t('suppliers.updated'))
    await fetch()
    return true
  }

  async function deleteSupplier(id) {
    const { error } = await supabase.from('suppliers').delete().eq('id', id)
    if (error) { toast.error(error.message); return false }
    toast.success(t('suppliers.deleted'))
    await fetch()
    return true
  }

  return { suppliers, loading, addSupplier, updateSupplier, deleteSupplier, refetch: fetch }
}

export function useSupplierDetail(supplierId) {
  const { t } = useLanguage()
  const [supplier, setSupplier] = useState(null)
  const [dispatches, setDispatches] = useState([])
  const [payments, setPayments] = useState([])
  const [dispatchedBags, setDispatchedBags] = useState(0)
  const [dispatchedByBill, setDispatchedByBill] = useState({}) // bill_id -> bags already dispatched
  const [outboundsByBill, setOutboundsByBill] = useState({})   // bill_id -> [{dispatch_id, dispatch_date, invoice_number, farms, quantity, sell_price_at_time}]
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!supplierId) return
    setLoading(true)
    const [supplierRes, dispatchRes, paymentRes] = await Promise.all([
      supabase.from('suppliers').select('*').eq('id', supplierId).single(),
      supabase.from('supplier_dispatches').select('*').eq('supplier_id', supplierId).order('dispatch_date', { ascending: false }),
      supabase.from('supplier_payments').select('*').eq('supplier_id', supplierId).order('payment_date', { ascending: false }),
    ])
    if (supplierRes.error) { toast.error(t('suppliers.loadFailed')); setLoading(false); return }
    setSupplier(supplierRes.data)
    setDispatches(dispatchRes.data || [])
    setPayments(paymentRes.data || [])

    // Per-supplier dispatched count: sum of dispatch_items.quantity for items that
    // were drawn from THIS supplier's bills. Items without a supplier_dispatch_id
    // came from the generic-pool flow and aren't attributable here.
    const dispatchIds = (dispatchRes.data || []).map(d => d.id)
    if (dispatchIds.length > 0) {
      // Fetch every dispatch_item drawn from this supplier's bills, joined to its
      // parent dispatch + farm so we can show "which farm got bags from which bill".
      const { data: items } = await supabase
        .from('dispatch_items')
        .select('quantity, supplier_dispatch_id, sell_price_at_time, total_amount, dispatches(id, dispatch_date, invoice_number, farms(name, name_fa, name_ps))')
        .in('supplier_dispatch_id', dispatchIds)
      const byBill = {}
      const outbounds = {}
      let total = 0
      for (const it of items || []) {
        const q = it.quantity || 0
        byBill[it.supplier_dispatch_id] = (byBill[it.supplier_dispatch_id] || 0) + q
        total += q
        if (!outbounds[it.supplier_dispatch_id]) outbounds[it.supplier_dispatch_id] = []
        outbounds[it.supplier_dispatch_id].push({
          dispatch_id: it.dispatches?.id,
          dispatch_date: it.dispatches?.dispatch_date,
          invoice_number: it.dispatches?.invoice_number,
          farms: it.dispatches?.farms,
          quantity: q,
          sell_price_at_time: it.sell_price_at_time,
          total_amount: it.total_amount,
        })
      }
      // Newest first inside each bill's outbound history
      for (const arr of Object.values(outbounds)) {
        arr.sort((a, b) => (b.dispatch_date || '').localeCompare(a.dispatch_date || ''))
      }
      setDispatchedByBill(byBill)
      setOutboundsByBill(outbounds)
      setDispatchedBags(total)
    } else {
      setDispatchedByBill({})
      setOutboundsByBill({})
      setDispatchedBags(0)
    }

    setLoading(false)
  }, [supplierId])

  useEffect(() => { fetch() }, [fetch])

  // Returns true if some OTHER supplier_dispatches row for this supplier
  // already uses this bill number. excludeId lets an edit ignore its own row.
  async function isBillNumberTaken(billNumber, excludeId = null) {
    const bn = (billNumber || '').trim()
    if (!bn) return false
    let q = supabase.from('supplier_dispatches')
      .select('id, bill_number')
      .eq('supplier_id', supplierId)
      .ilike('bill_number', bn)
      .limit(1)
    if (excludeId) q = q.neq('id', excludeId)
    const { data } = await q
    return (data?.length || 0) > 0
  }

  async function findOrCreateProduct(productName, pricePerBag) {
    const { data: results, error: findError } = await supabase
      .from('products')
      .select('id, quantity')
      .eq('name', productName)
      .eq('type', 'meel')
      .limit(1)

    if (findError) { toast.error(findError.message); return null }
    if (results && results.length > 0) return results[0]

    const { data: created, error: createError } = await supabase
      .from('products')
      .insert([{
        name: productName,
        type: 'meel',
        unit: 'bag',
        quantity: 0,
        purchase_price: pricePerBag,
        purchase_price_usd: 0,
        sell_price: pricePerBag,
        low_stock_threshold: 10,
        barcode: null,
        batch_number: null,
        expiry_date: null,
      }])
      .select()
      .single()

    if (createError) { toast.error(createError.message); return null }
    return created
  }

  async function receiveDispatch(data) {
    const quantity = parseFloat(data.quantity) || 0
    const pricePerBag = parseFloat(data.price_per_bag) || 0
    const sellPricePerBag = parseFloat(data.sell_price_per_bag) || 0
    const commissionPerBag = parseFloat(data.commission_per_bag) || 0

    // Bill numbers must be unique per supplier.
    if (await isBillNumberTaken(data.bill_number)) {
      toast.error(`Bill # ${(data.bill_number || '').trim()} already exists for this supplier`)
      return false
    }

    let productId = null
    if (data.product_name) {
      const product = await findOrCreateProduct(data.product_name, pricePerBag)
      if (product) {
        productId = product.id
        const productPatch = {
          quantity: (product.quantity || 0) + quantity,
          purchase_price: pricePerBag,
        }
        // Only bump product-level sell price if a sell price was provided
        if (sellPricePerBag > 0) productPatch.sell_price = sellPricePerBag
        await supabase.from('products').update(productPatch).eq('id', product.id)
      }
    }

    const { error } = await supabase.from('supplier_dispatches').insert([{
      supplier_id: supplierId,
      product_id: productId,
      product_name: data.product_name || null,
      dispatch_date: data.dispatch_date,
      quantity,
      price_per_bag: pricePerBag,
      sell_price_per_bag: sellPricePerBag,
      weight_kg: data.weight_kg ? parseFloat(data.weight_kg) : null,
      total_amount: quantity * pricePerBag,
      commission_per_bag: commissionPerBag,
      total_commission: quantity * commissionPerBag,
      bill_number: data.bill_number || null,
      dana_type: data.dana_type || null,
      notes: data.notes || null,
    }])
    if (error) { toast.error(error.message); return false }

    toast.success(t('suppliers.dispatchRecorded'))
    await fetch()
    return true
  }

  async function updateDispatch(id, data) {
    const quantity = parseFloat(data.quantity) || 0
    const pricePerBag = parseFloat(data.price_per_bag) || 0
    const sellPricePerBag = parseFloat(data.sell_price_per_bag) || 0
    const commissionPerBag = parseFloat(data.commission_per_bag) || 0

    // Bill numbers must be unique per supplier (ignoring this row).
    if (await isBillNumberTaken(data.bill_number, id)) {
      toast.error(`Bill # ${(data.bill_number || '').trim()} already exists for this supplier`)
      return false
    }

    // Guard: refuse to reduce the bill's received quantity below what's
    // already been dispatched out of it — that would instantly create an
    // over-claim (consumed > received) and silently mess up Remaining Bags
    // and the per-bill picker. The user must first reduce/reroute the
    // outbound dispatches if they really want to shrink this bill.
    const { data: outboundItems } = await supabase
      .from('dispatch_items')
      .select('quantity')
      .eq('supplier_dispatch_id', id)
    const alreadyDispatched = (outboundItems || []).reduce((s, r) => s + (r.quantity || 0), 0)
    if (quantity < alreadyDispatched) {
      toast.error(`Cannot reduce this bill to ${quantity} bags — ${alreadyDispatched} have already been dispatched out of it. Lower or re-route those dispatches first.`)
      return false
    }

    // Fetch original to calculate stock difference
    const { data: original } = await supabase
      .from('supplier_dispatches')
      .select('quantity, product_id')
      .eq('id', id)
      .single()

    if (original?.product_id) {
      const { data: product } = await supabase.from('products').select('quantity').eq('id', original.product_id).single()
      if (product) {
        const diff = quantity - (original.quantity || 0)
        const productPatch = {
          quantity: Math.max(0, (product.quantity || 0) + diff),
          purchase_price: pricePerBag,
        }
        if (sellPricePerBag > 0) productPatch.sell_price = sellPricePerBag
        await supabase.from('products').update(productPatch).eq('id', original.product_id)
      }
    }

    const { error } = await supabase.from('supplier_dispatches').update({
      product_name: data.product_name || null,
      dispatch_date: data.dispatch_date,
      quantity,
      price_per_bag: pricePerBag,
      sell_price_per_bag: sellPricePerBag,
      weight_kg: data.weight_kg ? parseFloat(data.weight_kg) : null,
      total_amount: quantity * pricePerBag,
      commission_per_bag: commissionPerBag,
      total_commission: quantity * commissionPerBag,
      bill_number: data.bill_number || null,
      dana_type: data.dana_type || null,
      notes: data.notes || null,
    }).eq('id', id)
    if (error) { toast.error(error.message); return false }
    toast.success(t('suppliers.dispatchUpdated'))
    await fetch()
    return true
  }

  async function deleteDispatch(dispatch) {
    const { error } = await supabase.from('supplier_dispatches').delete().eq('id', dispatch.id)
    if (error) { toast.error(error.message); return false }

    // Restore stock
    if (dispatch.product_id) {
      const { data: product } = await supabase.from('products').select('quantity').eq('id', dispatch.product_id).single()
      if (product) {
        await supabase.from('products').update({
          quantity: Math.max(0, (product.quantity || 0) - dispatch.quantity),
        }).eq('id', dispatch.product_id)
      }
    }

    toast.success(t('suppliers.dispatchDeleted'))
    await fetch()
    return true
  }

  async function recordPayment(data) {
    const { error } = await supabase.from('supplier_payments').insert([{
      supplier_id: supplierId,
      amount: parseFloat(data.amount),
      payment_date: data.payment_date,
      notes: data.notes || null,
    }])
    if (error) { toast.error(error.message); return false }
    toast.success(t('suppliers.paymentRecorded'))
    await fetch()
    return true
  }

  async function updatePayment(id, data) {
    const { error } = await supabase.from('supplier_payments').update({
      amount: parseFloat(data.amount),
      payment_date: data.payment_date,
      notes: data.notes || null,
    }).eq('id', id)
    if (error) { toast.error(error.message); return false }
    toast.success(t('suppliers.paymentUpdated'))
    await fetch()
    return true
  }

  async function deletePayment(id) {
    const { error } = await supabase.from('supplier_payments').delete().eq('id', id)
    if (error) { toast.error(error.message); return false }
    toast.success(t('suppliers.paymentDeleted'))
    await fetch()
    return true
  }

  const totalOwed = dispatches.reduce((s, d) => s + (d.total_amount || 0), 0)
  const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0)
  const remaining = totalOwed - totalPaid
  const totalBags = dispatches.reduce((s, d) => s + (d.quantity || 0), 0)
  // "Remaining" must be the sum of POSITIVE per-bill remainders, not the
  // arithmetic difference of totals. Otherwise an over-dispatched bill (where
  // recorded outbounds exceed the bill's received qty — a data error) silently
  // cancels out real on-hand bags from other bills, and the supplier looks
  // empty when the warehouse actually has stock. Surface the data error too,
  // so the user can investigate the affected bills.
  const overDispatchedBills = dispatches
    .map(d => ({ d, net: (d.quantity || 0) - (dispatchedByBill[d.id] || 0) }))
    .filter(x => x.net < 0)
    .map(x => ({ bill: x.d, overBy: -x.net }))
  const remainingBags = dispatches.reduce(
    (s, d) => s + Math.max(0, (d.quantity || 0) - (dispatchedByBill[d.id] || 0)),
    0,
  )
  const totalCommission = dispatches.reduce((s, d) => s + (d.total_commission || 0), 0)

  return {
    supplier, dispatches, payments, loading,
    totalOwed, totalPaid, remaining, totalBags, dispatchedBags, dispatchedByBill, outboundsByBill, remainingBags, overDispatchedBills, totalCommission,
    receiveDispatch, updateDispatch, deleteDispatch, recordPayment, updatePayment, deletePayment,
    refetch: fetch,
  }
}

export function useMedicineSupplierDetail(supplierId) {
  const { t } = useLanguage()
  const [supplier, setSupplier] = useState(null)
  const [purchases, setPurchases] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!supplierId) return
    setLoading(true)
    const [supplierRes, purchaseRes, paymentRes] = await Promise.all([
      supabase.from('suppliers').select('*').eq('id', supplierId).single(),
      supabase.from('stock_purchases')
        .select('*, products(name, unit, type)')
        .eq('supplier_id', supplierId)
        .order('purchase_date', { ascending: false }),
      supabase.from('supplier_payments').select('*').eq('supplier_id', supplierId).order('payment_date', { ascending: false }),
    ])
    if (supplierRes.error) { toast.error(t('suppliers.loadFailed')); setLoading(false); return }
    setSupplier(supplierRes.data)
    setPurchases(purchaseRes.data || [])
    setPayments(paymentRes.data || [])
    setLoading(false)
  }, [supplierId])

  useEffect(() => { fetch() }, [fetch])

  async function recordPayment(data) {
    const currency = data.currency || 'AFN'
    const amt = parseFloat(data.amount) || 0
    const { error } = await supabase.from('supplier_payments').insert([{
      supplier_id: supplierId,
      amount: currency === 'AFN' ? amt : 0,
      amount_usd: currency === 'USD' ? amt : 0,
      payment_date: data.payment_date,
      notes: data.notes || null,
    }])
    if (error) { toast.error(error.message); return false }
    toast.success(t('suppliers.paymentRecorded'))
    await fetch()
    return true
  }

  async function updatePayment(id, data) {
    const currency = data.currency || 'AFN'
    const amt = parseFloat(data.amount) || 0
    const { error } = await supabase.from('supplier_payments').update({
      amount: currency === 'AFN' ? amt : 0,
      amount_usd: currency === 'USD' ? amt : 0,
      payment_date: data.payment_date,
      notes: data.notes || null,
    }).eq('id', id)
    if (error) { toast.error(error.message); return false }
    toast.success(t('suppliers.paymentUpdated'))
    await fetch()
    return true
  }

  async function deletePayment(id) {
    const { error } = await supabase.from('supplier_payments').delete().eq('id', id)
    if (error) { toast.error(error.message); return false }
    toast.success(t('suppliers.paymentDeleted'))
    await fetch()
    return true
  }

  async function updatePurchase(id, data) {
    const newQty = parseFloat(data.quantity) || 0
    const usdPrice = parseFloat(data.purchase_price_usd) || 0
    const rate = parseFloat(data.usd_to_afn_rate) || 0
    const afnPrice = usdPrice > 0 && rate > 0
      ? usdPrice * rate
      : parseFloat(data.purchase_price) || 0

    const { data: original } = await supabase
      .from('stock_purchases').select('quantity, product_id').eq('id', id).single()

    if (original?.product_id) {
      const { data: product } = await supabase.from('products').select('quantity').eq('id', original.product_id).single()
      if (product) {
        const diff = newQty - (original.quantity || 0)
        await supabase.from('products').update({
          quantity: Math.max(0, (product.quantity || 0) + diff),
        }).eq('id', original.product_id)
      }
    }

    const patch = {
      quantity: newQty,
      purchase_price: afnPrice,
      purchase_price_usd: usdPrice,
      usd_to_afn_rate: rate,
      total_cost: newQty * afnPrice,
      batch_number: data.batch_number || null,
      purchase_date: data.purchase_date,
      notes: data.notes || null,
    }
    // Only update supplier_id when explicitly provided so legacy callers don't accidentally null it out
    if (data.supplier_id !== undefined) patch.supplier_id = data.supplier_id || null

    const { error } = await supabase.from('stock_purchases').update(patch).eq('id', id)
    if (error) { toast.error(error.message); return false }
    toast.success(t('inventory.stockUpdated'))
    await fetch()
    return true
  }

  async function deletePurchase(purchase) {
    if (purchase.product_id) {
      const { data: product } = await supabase.from('products').select('quantity').eq('id', purchase.product_id).single()
      if (product) {
        await supabase.from('products').update({
          quantity: Math.max(0, (product.quantity || 0) - (purchase.quantity || 0)),
        }).eq('id', purchase.product_id)
      }
    }
    const { error } = await supabase.from('stock_purchases').delete().eq('id', purchase.id)
    if (error) { toast.error(error.message); return false }
    toast.success(t('inventory.stockDeleted'))
    await fetch()
    return true
  }

  // A purchase contributes to whichever currency totals it has a price in.
  // USD-only purchase → only USD totals.
  // AFN-only purchase → only AFN totals.
  // Both entered (or AFN auto-filled from USD via rate) → both totals.
  const totalOwedAFN = purchases
    .filter(p => (p.purchase_price || 0) > 0)
    .reduce((s, p) => s + (p.total_cost || 0), 0)
  const totalOwedUSD = purchases
    .filter(p => (p.purchase_price_usd || 0) > 0)
    .reduce((s, p) => s + ((p.purchase_price_usd || 0) * (p.quantity || 0)), 0)
  const totalPaidAFN = payments.reduce((s, p) => s + (p.amount || 0), 0)
  const totalPaidUSD = payments.reduce((s, p) => s + (p.amount_usd || 0), 0)
  const remainingAFN = totalOwedAFN - totalPaidAFN
  const remainingUSD = totalOwedUSD - totalPaidUSD
  const totalUnits = purchases.reduce((s, p) => s + (p.quantity || 0), 0)

  return {
    supplier, purchases, payments, loading,
    totalOwedAFN, totalOwedUSD, totalPaidAFN, totalPaidUSD, remainingAFN, remainingUSD,
    totalUnits,
    recordPayment, updatePayment, deletePayment,
    updatePurchase, deletePurchase,
    refetch: fetch,
  }
}

export function useChozaSupplierDetail(supplierId) {
  const { t } = useLanguage()
  const [supplier, setSupplier] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [payments, setPayments] = useState([])
  const [chozaBatches, setChozaBatches] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!supplierId) return
    setLoading(true)
    const [supplierRes, txRes, paymentRes, batchRes] = await Promise.all([
      supabase.from('suppliers').select('*').eq('id', supplierId).single(),
      supabase.from('choza_transactions').select('*').eq('supplier_id', supplierId).order('transaction_date', { ascending: false }),
      supabase.from('supplier_payments').select('*').eq('supplier_id', supplierId).order('payment_date', { ascending: false }),
      supabase.from('farm_batches')
        .select('id, batch_number, initial_chicken_count, start_date, farm_id, farms(name, name_fa, name_ps)')
        .eq('supplier_id', supplierId)
        .order('start_date', { ascending: false }),
    ])
    if (supplierRes.error) { toast.error(t('suppliers.loadFailed')); setLoading(false); return }
    setSupplier(supplierRes.data)
    setTransactions(txRes.data || [])
    setPayments(paymentRes.data || [])
    setChozaBatches(batchRes.data || [])
    setLoading(false)
  }, [supplierId])

  useEffect(() => { fetch() }, [fetch])

  async function getOrCreateChozaProduct(chozaType, pricePerChoza) {
    const productName = `Choza - ${chozaType}`
    const { data: existing } = await supabase
      .from('products')
      .select('id, quantity')
      .eq('name', productName)
      .eq('type', 'choza')
      .limit(1)
    if (existing && existing.length > 0) return existing[0]
    const { data: created } = await supabase
      .from('products')
      .insert([{
        name: productName,
        type: 'choza',
        unit: 'chick',
        quantity: 0,
        purchase_price: pricePerChoza,
        sell_price: pricePerChoza,
        low_stock_threshold: 100,
      }])
      .select()
      .single()
    return created
  }

  async function addTransaction(data) {
    const qty = parseInt(data.total_choza) || 0
    const price = parseFloat(data.price_per_choza) || 0
    const { data: inserted, error } = await supabase.from('choza_transactions').insert([{
      supplier_id: supplierId,
      transaction_date: data.transaction_date,
      choza_type: data.choza_type,
      afghani_subtype: data.afghani_subtype || null,
      price_per_choza: price,
      total_choza: qty,
      total_amount: parseFloat(data.total_amount) || 0,
      sale_price_per_choza: parseFloat(data.sale_price_per_choza) || 0,
      total_profit: parseFloat(data.total_profit) || 0,
      notes: data.notes || null,
    }]).select().single()
    if (error) { toast.error(error.message); return false }

    const product = await getOrCreateChozaProduct(data.choza_type, price)
    if (product) {
      await supabase.from('products').update({
        quantity: (product.quantity || 0) + qty,
        purchase_price: price,
      }).eq('id', product.id)
    }

    toast.success(t('suppliers.added'))
    await fetch()
    return true
  }

  async function updateTransaction(id, data) {
    const newQty = parseInt(data.total_choza) || 0
    const price = parseFloat(data.price_per_choza) || 0

    const { data: original } = await supabase
      .from('choza_transactions').select('total_choza, choza_type').eq('id', id).single()

    const { error } = await supabase.from('choza_transactions').update({
      transaction_date: data.transaction_date,
      choza_type: data.choza_type,
      afghani_subtype: data.afghani_subtype || null,
      price_per_choza: price,
      total_choza: newQty,
      total_amount: parseFloat(data.total_amount) || 0,
      sale_price_per_choza: parseFloat(data.sale_price_per_choza) || 0,
      total_profit: parseFloat(data.total_profit) || 0,
      notes: data.notes || null,
    }).eq('id', id)
    if (error) { toast.error(error.message); return false }

    if (original) {
      const product = await getOrCreateChozaProduct(data.choza_type, price)
      if (product) {
        const diff = newQty - (original.total_choza || 0)
        await supabase.from('products').update({
          quantity: Math.max(0, (product.quantity || 0) + diff),
          purchase_price: price,
        }).eq('id', product.id)
      }
    }

    toast.success(t('suppliers.updated'))
    await fetch()
    return true
  }

  async function deleteTransaction(id) {
    const { data: original } = await supabase
      .from('choza_transactions').select('total_choza, choza_type').eq('id', id).single()

    const { error } = await supabase.from('choza_transactions').delete().eq('id', id)
    if (error) { toast.error(error.message); return false }

    if (original) {
      const productName = `Choza - ${original.choza_type}`
      const { data: prod } = await supabase
        .from('products').select('id, quantity').eq('name', productName).eq('type', 'choza').limit(1)
      if (prod && prod.length > 0) {
        await supabase.from('products').update({
          quantity: Math.max(0, (prod[0].quantity || 0) - (original.total_choza || 0)),
        }).eq('id', prod[0].id)
      }
    }

    toast.success(t('suppliers.deleted'))
    await fetch()
    return true
  }

  async function recordPayment(data) {
    const { error } = await supabase.from('supplier_payments').insert([{
      supplier_id: supplierId,
      amount: parseFloat(data.amount),
      payment_date: data.payment_date,
      notes: data.notes || null,
    }])
    if (error) { toast.error(error.message); return false }
    toast.success(t('suppliers.paymentRecorded'))
    await fetch()
    return true
  }

  async function updatePayment(id, data) {
    const { error } = await supabase.from('supplier_payments').update({
      amount: parseFloat(data.amount),
      payment_date: data.payment_date,
      notes: data.notes || null,
    }).eq('id', id)
    if (error) { toast.error(error.message); return false }
    toast.success(t('suppliers.paymentUpdated'))
    await fetch()
    return true
  }

  async function deletePayment(id) {
    const { error } = await supabase.from('supplier_payments').delete().eq('id', id)
    if (error) { toast.error(error.message); return false }
    toast.success(t('suppliers.paymentDeleted'))
    await fetch()
    return true
  }

  const totalInvested = transactions.reduce((s, tx) => s + (tx.total_amount || 0), 0)
  const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0)
  const remaining = totalInvested - totalPaid
  const totalChoza = transactions.reduce((s, tx) => s + (tx.total_choza || 0), 0)
  const totalProfit = transactions.reduce((s, tx) => s + (tx.total_profit || 0), 0)
  const chozaSentToFarms = chozaBatches.reduce((s, b) => s + (b.initial_chicken_count || 0), 0)
  const remainingChoza = totalChoza - chozaSentToFarms

  return {
    supplier, transactions, payments, loading,
    totalInvested, totalPaid, remaining, totalChoza, totalProfit,
    chozaSentToFarms, remainingChoza, chozaBatches,
    addTransaction, updateTransaction, deleteTransaction,
    recordPayment, updatePayment, deletePayment,
    refetch: fetch,
  }
}
