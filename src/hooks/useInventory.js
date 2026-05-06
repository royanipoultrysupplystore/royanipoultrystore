import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../config/supabase'
import toast from 'react-hot-toast'
import { useLanguage } from '../contexts/LanguageContext'

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
    const [dispatchRes, productsRes] = await Promise.all([
      supabase
        .from('supplier_dispatches')
        .select('supplier_id, product_name, product_id, quantity, dispatch_date, suppliers(id, company_name, owner_name, phone)')
        .order('dispatch_date', { ascending: false }),
      supabase.from('products').select('id, quantity').eq('type', 'meel'),
    ])

    if (!dispatchRes.error && dispatchRes.data) {
      const productStock = {}
      for (const p of productsRes.data || []) productStock[p.id] = p.quantity || 0

      const map = {}
      for (const d of dispatchRes.data) {
        const sid = d.supplier_id
        if (!map[sid]) {
          map[sid] = {
            supplier_id: sid,
            company_name: d.suppliers?.company_name || '—',
            owner_name: d.suppliers?.owner_name,
            phone: d.suppliers?.phone,
            total_bags_received: 0,
            products: {},
            product_ids: {},
            last_dispatch: d.dispatch_date,
          }
        }
        map[sid].total_bags_received += parseFloat(d.quantity) || 0
        const pname = d.product_name || '—'
        if (!map[sid].products[pname]) {
          map[sid].products[pname] = { received: 0, product_id: d.product_id }
        }
        map[sid].products[pname].received += parseFloat(d.quantity) || 0
        if (d.product_id) map[sid].product_ids[d.product_id] = true
        if (d.dispatch_date > map[sid].last_dispatch) map[sid].last_dispatch = d.dispatch_date
      }

      const result = Object.values(map).map(s => {
        const remaining_bags = Object.keys(s.product_ids).reduce(
          (sum, pid) => sum + (productStock[pid] || 0), 0
        )
        const products = Object.fromEntries(
          Object.entries(s.products).map(([name, p]) => [
            name,
            { received: p.received, remaining: p.product_id ? (productStock[p.product_id] || 0) : 0 }
          ])
        )
        return { ...s, remaining_bags, products }
      })

      setStock(result.sort((a, b) => a.company_name.localeCompare(b.company_name)))
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])
  return { stock, loading }
}
