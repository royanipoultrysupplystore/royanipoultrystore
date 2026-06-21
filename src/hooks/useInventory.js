import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../config/supabase'
import toast from 'react-hot-toast'
import { useLanguage } from '../contexts/LanguageContext'

// PostgREST caps a single response at db.max_rows (default 1000). Pages through
// a large table so the older rows aren't silently dropped.
async function fetchAllPaged(buildQuery) {
  const out = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1)
    if (error || !data || data.length === 0) break
    out.push(...data)
    if (data.length < pageSize) break
  }
  return out
}

export function useInventory() {
  const { t } = useLanguage()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) toast.error(t('inventory.loadFailed'))
    else setProducts(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  async function addProduct(product) {
    const { data, error } = await supabase.from('products').insert([product]).select().single()
    if (error) {
      if (error.code === '23505') {
        toast.error('A product with this barcode already exists. Use a different barcode or leave it empty.')
      } else {
        toast.error(error.message)
      }
      return null
    }
    toast.success(t('inventory.added'))
    await fetch()
    return data
  }

  async function updateProduct(id, updates) {
    const { error } = await supabase.from('products').update(updates).eq('id', id)
    if (error) { toast.error(error.message); return false }
    toast.success(t('inventory.updated'))
    await fetch()
    return true
  }

  async function deleteProduct(id) {
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) {
      if (error.code === '23503') {
        toast.error(t('inventory.deleteBlocked'))
      } else {
        toast.error(error.message)
      }
      return false
    }
    toast.success(t('inventory.deleted'))
    await fetch()
    return true
  }

  async function getByBarcode(barcode) {
    const { data } = await supabase.from('products').select('*').eq('barcode', barcode).single()
    return data
  }

  async function addStockPurchase(purchase, supplierId = null) {
    const payload = { ...purchase, supplier_id: supplierId || null }
    const { error: purchaseError } = await supabase.from('stock_purchases').insert([payload])
    if (purchaseError) { toast.error(purchaseError.message); return false }
    const product = products.find(p => p.id === purchase.product_id)
    if (product) {
      await supabase.from('products').update({
        quantity: (product.quantity || 0) + purchase.quantity,
        purchase_price: purchase.purchase_price,
      }).eq('id', purchase.product_id)
    }
    toast.success(t('inventory.stockRecorded'))
    await fetch()
    return true
  }

  return { products, loading, addProduct, updateProduct, deleteProduct, getByBarcode, addStockPurchase, refetch: fetch }
}

export function useMeelStock() {
  const [stock, setStock] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    // Paginate both tables — PostgREST caps each response at db.max_rows
    // (default 1000). Without this, older dispatches and dispatch_items get
    // silently dropped and per-bill "remaining" counts are wrong.
    const [dispatches, items] = await Promise.all([
      fetchAllPaged(() => supabase
        .from('supplier_dispatches')
        .select('id, supplier_id, product_name, product_id, quantity, dispatch_date, suppliers(id, company_name, owner_name, phone)')
        .order('dispatch_date', { ascending: false })),
      fetchAllPaged(() => supabase
        .from('dispatch_items').select('supplier_dispatch_id, quantity').not('supplier_dispatch_id', 'is', null)),
    ])

    if (dispatches.length > 0 || items.length > 0) {
      // Consumed bags per bill (supplier_dispatch_id)
      const consumedByBill = {}
      for (const it of items) {
        consumedByBill[it.supplier_dispatch_id] = (consumedByBill[it.supplier_dispatch_id] || 0) + (parseFloat(it.quantity) || 0)
      }

      const map = {}
      for (const d of dispatches) {
        const sid = d.supplier_id
        if (!map[sid]) {
          map[sid] = {
            supplier_id: sid,
            company_name: d.suppliers?.company_name || '—',
            owner_name: d.suppliers?.owner_name,
            phone: d.suppliers?.phone,
            total_bags_received: 0,
            remaining_bags: 0,
            products: {},
            last_dispatch: d.dispatch_date,
          }
        }
        const qty = parseFloat(d.quantity) || 0
        const remaining = qty - (consumedByBill[d.id] || 0)
        map[sid].total_bags_received += qty
        map[sid].remaining_bags += remaining
        const pname = d.product_name || '—'
        if (!map[sid].products[pname]) {
          map[sid].products[pname] = { received: 0, remaining: 0, product_id: d.product_id }
        }
        map[sid].products[pname].received += qty
        map[sid].products[pname].remaining += remaining
        if (d.dispatch_date > map[sid].last_dispatch) map[sid].last_dispatch = d.dispatch_date
      }

      const result = Object.values(map)
      setStock(result.sort((a, b) => a.company_name.localeCompare(b.company_name)))
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])
  return { stock, loading }
}
