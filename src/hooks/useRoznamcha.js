import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../config/supabase'
import toast from 'react-hot-toast'
import { useLanguage } from '../contexts/LanguageContext'

export function useRoznamcha(date) {
  const { t } = useLanguage()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!date) return
    setLoading(true)

    const [
      { data: dispatches, error: e1 },
      { data: payments, error: e2 },
      { data: sales, error: e3 },
      { data: supplyPayments, error: e4 },
      { data: expenses, error: e5 },
      { data: stockPurchases, error: e6 },
    ] = await Promise.all([
      supabase.from('dispatches').select('*, farms(name, name_fa, name_ps), dispatch_items(quantity, sell_price_at_time, total_amount, products(name))').eq('dispatch_date', date).order('created_at'),
      supabase.from('payments').select('*, farms(name, name_fa, name_ps)').eq('payment_date', date).order('created_at'),
      supabase.from('sales').select('*').eq('sale_date', date).order('created_at'),
      supabase.from('supply_payments').select('*, farms(name, name_fa, name_ps)').eq('payment_date', date).order('created_at'),
      supabase.from('expenses').select('*').eq('expense_date', date).order('created_at'),
      supabase.from('stock_purchases').select('*, products(name)').eq('purchase_date', date).order('created_at'),
    ])

    const firstError = e1 || e2 || e3 || e4 || e5 || e6
    if (firstError) toast.error(t('roznamcha.loadFailed'))

    const all = [
      ...(dispatches || []).map(d => ({ ...d, _type: 'dispatch' })),
      ...(payments || []).map(p => ({ ...p, _type: 'payment' })),
      ...(sales || []).map(s => ({ ...s, _type: 'sale' })),
      ...(supplyPayments || []).map(sp => ({ ...sp, _type: 'supply' })),
      ...(expenses || []).map(e => ({ ...e, _type: 'expense' })),
      ...(stockPurchases || []).map(sp => ({ ...sp, _type: 'stock' })),
    ].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

    setEntries(all)
    setLoading(false)
  }, [date])

  useEffect(() => { fetch() }, [fetch])

  return { entries, loading, refetch: fetch }
}
