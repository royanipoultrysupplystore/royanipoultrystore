import { useState, useCallback } from 'react'
import { supabase } from '../config/supabase'
import toast from 'react-hot-toast'
import { useLanguage } from '../contexts/LanguageContext'

export function useReports() {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(false)

  const getMonthlyReport = useCallback(async (year, month) => {
    setLoading(true)
    const start = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = new Date(year, month, 0)
    const end = `${year}-${String(month).padStart(2, '0')}-${endDate.getDate()}`

    const [dispatchRes, expenseRes] = await Promise.all([
      supabase.from('dispatch_items')
        .select('quantity, purchase_price_at_time, sell_price_at_time, total_profit, total_amount, dispatches!inner(dispatch_date)')
        .gte('dispatches.dispatch_date', start)
        .lte('dispatches.dispatch_date', end),
      supabase.from('expenses')
        .select('amount')
        .gte('expense_date', start)
        .lte('expense_date', end),
    ])

    if (dispatchRes.error || expenseRes.error) {
      toast.error(t('reports.loadFailed'))
      setLoading(false)
      return null
    }

    const items = dispatchRes.data || []
    const expenseList = expenseRes.data || []

    const revenue = items.reduce((s, i) => s + (i.total_amount || 0), 0)
    const costOfGoods = items.reduce((s, i) => s + (i.purchase_price_at_time || 0) * (i.quantity || 0), 0)
    const grossProfit = revenue - costOfGoods
    const totalExpenses = expenseList.reduce((s, e) => s + (e.amount || 0), 0)
    const netProfit = grossProfit - totalExpenses

    setLoading(false)
    return { revenue, costOfGoods, grossProfit, totalExpenses, netProfit }
  }, [])

  const getLast6MonthsChart = useCallback(async () => {
    const months = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({ year: d.getFullYear(), month: d.getMonth() + 1 })
    }

    const results = await Promise.all(months.map(async ({ year, month }) => {
      const start = `${year}-${String(month).padStart(2, '0')}-01`
      const endDate = new Date(year, month, 0)
      const end = `${year}-${String(month).padStart(2, '0')}-${endDate.getDate()}`
      const label = new Date(year, month - 1).toLocaleString('en-US', { month: 'short' })

      const [dRes, eRes] = await Promise.all([
        supabase.from('dispatches').select('total_amount').gte('dispatch_date', start).lte('dispatch_date', end),
        supabase.from('expenses').select('amount').gte('expense_date', start).lte('expense_date', end),
      ])

      const revenue = (dRes.data || []).reduce((s, d) => s + (d.total_amount || 0), 0)
      const expenses = (eRes.data || []).reduce((s, e) => s + (e.amount || 0), 0)
      return { label, revenue, expenses }
    }))

    return results
  }, [])

  return { loading, getMonthlyReport, getLast6MonthsChart }
}
