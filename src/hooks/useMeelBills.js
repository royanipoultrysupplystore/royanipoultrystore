import { useState, useEffect } from 'react'
import { supabase } from '../config/supabase'

export function useMeelBills() {
  const [meelBills, setMeelBills] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('supplier_dispatches')
        .select('id, product_id, product_name, bill_number, dana_type, quantity, price_per_bag, sell_price_per_bag, dispatch_date, suppliers(company_name), products(quantity, sell_price)')
        .not('product_id', 'is', null)
        .order('dispatch_date', { ascending: false })

      setMeelBills(
        (data || [])
          .map(sd => ({
            id: sd.id,
            product_id: sd.product_id,
            product_name: sd.product_name || '—',
            bill_number: sd.bill_number || '',
            dana_type: sd.dana_type || '',
            price_per_bag: sd.price_per_bag || 0,
            dispatch_date: sd.dispatch_date,
            supplier_name: sd.suppliers?.company_name || '—',
            available: sd.products?.quantity || 0,
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
