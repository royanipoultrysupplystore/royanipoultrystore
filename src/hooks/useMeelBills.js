import { useState, useEffect } from 'react'
import { supabase } from '../config/supabase'

// PostgREST caps a single response at db.max_rows (default 1000). To get every
// row from a large table, walk through in pages of 1000 — without this, the
// older rows are silently dropped and dependent computations are wrong.
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

export function useMeelBills() {
  const [meelBills, setMeelBills] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [bills, items] = await Promise.all([
        // Every meel bill ever received — paginated because Royani has well
        // over 1000 historical bills.
        fetchAllPaged(() => supabase
          .from('supplier_dispatches')
          .select('id, product_id, product_name, bill_number, dana_type, quantity, price_per_bag, sell_price_per_bag, dispatch_date, supplier_id, suppliers(company_name), products(sell_price)')
          .not('product_id', 'is', null)
          .order('dispatch_date', { ascending: false })),
        // Every dispatch_item that was drawn from a supplier bill. Without
        // pagination the older rows fall off and bills look "available" when
        // their bags have actually already been sent out.
        fetchAllPaged(() => supabase
          .from('dispatch_items')
          .select('supplier_dispatch_id, quantity')
          .not('supplier_dispatch_id', 'is', null)),
      ])

      // Sum bags already dispatched out of each bill
      const consumed = {}
      for (const it of items) {
        consumed[it.supplier_dispatch_id] = (consumed[it.supplier_dispatch_id] || 0) + (it.quantity || 0)
      }

      setMeelBills(
        bills
          .map(sd => ({
            id: sd.id,
            product_id: sd.product_id,
            product_name: sd.product_name || '—',
            bill_number: sd.bill_number || '',
            dana_type: sd.dana_type || '',
            price_per_bag: sd.price_per_bag || 0,
            dispatch_date: sd.dispatch_date,
            supplier_id: sd.supplier_id,
            supplier_name: sd.suppliers?.company_name || '—',
            available: (sd.quantity || 0) - (consumed[sd.id] || 0),
            // Prefer the bill's own sell price if set; fall back to product-level, then buy price
            sell_price: sd.sell_price_per_bag || sd.products?.sell_price || sd.price_per_bag || 0,
          }))
          .filter(m => m.available > 0)
      )
      setLoading(false)
    }
    load()
  }, [])

  return { meelBills, loading }
}
