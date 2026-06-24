import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Package, Building2, TrendingUp, DollarSign, AlertTriangle, Clock, Truck, CreditCard, Wallet, Pill, Wheat, X, Scale } from 'lucide-react'
import { supabase } from '../config/supabase'
import StatCard from '../components/common/StatCard'
import { formatCurrency } from '../utils/formatCurrency'
import { formatDate, isExpired, isExpiringSoon } from '../utils/dateHelpers'
import { useReports } from '../hooks/useReports'
import { useLanguage } from '../contexts/LanguageContext'
import { lf } from '../utils/localizedField'

// PostgREST caps a single response at db.max_rows (default 1000). To get a true
// all-time sum from a large table, walk through it in pages of 1000 and add as
// we go — `.select('total_profit')` alone would silently truncate.
async function sumAllRows(table, column) {
  let total = 0
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase.from(table).select(column).range(from, from + pageSize - 1)
    if (error || !data || data.length === 0) break
    for (const row of data) total += (row[column] || 0)
    if (data.length < pageSize) break
  }
  return total
}

// Same pagination idea as sumAllRows, but returns the full row set so the
// caller can do multi-column aggregations (used for the commission-car math
// that needs to join cars↔sales↔expenses in JS).
async function fetchAllPaged(table, columns) {
  const out = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + pageSize - 1)
    if (error || !data || data.length === 0) break
    out.push(...data)
    if (data.length < pageSize) break
  }
  return out
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { t, lang } = useLanguage()
  const { getLast6MonthsChart } = useReports()
  const [stats, setStats] = useState({ stockValue: 0, totalDebt: 0, monthRevenue: 0, monthProfit: 0, totalProfit: 0, monthExpenses: 0, cashBalance: 0, medicineValue: 0, meelValue: 0, totalMarketCommission: 0, totalDealersBalance: 0, totalSupplierDebt: 0, netTotal: 0 })
  const [lowStock, setLowStock] = useState([])
  const [expiring, setExpiring] = useState([])
  const [chartData, setChartData] = useState([])
  const [topFarms, setTopFarms] = useState([])
  const [recentDispatches, setRecentDispatches] = useState([])
  const [recentPayments, setRecentPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [medicineProducts, setMedicineProducts] = useState([])
  const [medicineModal, setMedicineModal] = useState({ open: false, loading: false, revenue: 0, profit: 0 })
  const [profitModal, setProfitModal] = useState({ open: false, loading: false, scope: 'month', byType: {}, expanded: new Set() })
  const [totalModal, setTotalModal] = useState({ open: false })

  useEffect(() => {
    async function load(initial = false) {
      if (initial) setLoading(true)

      const now = new Date()
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

      const [
        productsRes, farmsRes, dispatchesRes, expensesRes,
        recentDispRes, recentPayRes, chart,
        allPaymentsTotal, allExpensesTotal,
        allDispatchProfitTotal, allSaleProfitTotal,
        monthChozaProfitRes, allChozaProfitTotal,
        monthSaleRes,
        monthSupplyProfitRes, allSupplyProfitTotal,
        // For the Net Total card breakdown — commission, dealer balance, and
        // what we still owe to meel/medicine/choza suppliers.
        commissionCars, commissionSales, commissionCarExpenses,
        totalDealerPaymentsAll,
        totalSupplierOwed, totalSupplierPaid,
      ] = await Promise.all([
        supabase.from('products').select('*'),
        supabase.from('farms').select('*').eq('is_active', true),
        supabase.from('dispatch_items').select('total_amount, total_profit, purchase_price_at_time, quantity, dispatches!inner(dispatch_date)').gte('dispatches.dispatch_date', monthStart),
        supabase.from('expenses').select('amount').gte('expense_date', monthStart),
        supabase.from('dispatches').select('*, farms(name, name_fa, name_ps)').order('dispatch_date', { ascending: false }).limit(5),
        supabase.from('payments').select('*, farms(name, name_fa, name_ps)').order('payment_date', { ascending: false }).limit(5),
        getLast6MonthsChart(),
        sumAllRows('payments', 'amount'),
        sumAllRows('expenses', 'amount'),
        sumAllRows('dispatch_items', 'total_profit'),
        sumAllRows('sale_items', 'total_profit'),
        supabase.from('choza_transactions').select('total_profit').gte('transaction_date', monthStart),
        sumAllRows('choza_transactions', 'total_profit'),
        supabase.from('sale_items').select('total_amount, total_profit, sales!inner(sale_date)').gte('sales.sale_date', monthStart),
        supabase.from('supply_payments').select('total_profit').gte('payment_date', monthStart),
        sumAllRows('supply_payments', 'total_profit'),
        fetchAllPaged('commission_cars', 'id, dealer_id, commission_rate_per_chicken, is_closed'),
        fetchAllPaged('commission_sales', 'car_id, total_amount, chicken_count'),
        fetchAllPaged('commission_car_expenses', 'car_id, amount'),
        sumAllRows('commission_dealer_payments', 'amount'),
        sumAllRows('supplier_dispatches', 'total_amount'),
        sumAllRows('supplier_payments', 'amount'),
      ])

      const products = productsRes.data || []
      const farms = farmsRes.data || []
      const items = dispatchesRes.data || []
      const expenses = expensesRes.data || []

      const stockValue = products.reduce((s, p) => s + (p.quantity || 0) * (p.purchase_price || 0), 0)
      const medicineValue = products.filter(p => p.type === 'medicine').reduce((s, p) => s + (p.quantity || 0) * (p.purchase_price || 0), 0)
      const meelValue = products.filter(p => p.type === 'meel').reduce((s, p) => s + (p.quantity || 0) * (p.purchase_price || 0), 0)
      const totalDebt = farms.reduce((s, f) => s + (f.total_debt || 0), 0)
      const monthSaleItems = monthSaleRes.data || []
      const monthRevenue =
        items.reduce((s, i) => s + (i.total_amount || 0), 0) +
        monthSaleItems.reduce((s, i) => s + (i.total_amount || 0), 0)
      const monthChozaProfit = (monthChozaProfitRes.data || []).reduce((s, c) => s + (c.total_profit || 0), 0)
      const monthSupplyProfit = (monthSupplyProfitRes.data || []).reduce((s, r) => s + (r.total_profit || 0), 0)
      const monthProfit =
        items.reduce((s, i) => s + (i.total_profit || 0), 0) +
        monthSaleItems.reduce((s, i) => s + (i.total_profit || 0), 0) +
        monthChozaProfit +
        monthSupplyProfit
      const monthExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0)

      const cashBalance = allPaymentsTotal - allExpensesTotal

      const totalProfit = allDispatchProfitTotal + allSaleProfitTotal + allChozaProfitTotal + allSupplyProfitTotal

      // Commission-system aggregates (Net Total card breakdown).
      // For each car: commission_fee = sold_chickens × commission_rate_per_chicken.
      // Dealer payout (only for CLOSED cars with a dealer) = earnings − expenses − commission_fee.
      const soldByCar = {}, earningsByCar = {}, expensesByCar = {}
      for (const s of commissionSales) {
        soldByCar[s.car_id] = (soldByCar[s.car_id] || 0) + (s.chicken_count || 0)
        earningsByCar[s.car_id] = (earningsByCar[s.car_id] || 0) + (s.total_amount || 0)
      }
      for (const e of commissionCarExpenses) {
        expensesByCar[e.car_id] = (expensesByCar[e.car_id] || 0) + (e.amount || 0)
      }
      let totalMarketCommission = 0
      let totalDealersOwedGross = 0
      for (const car of commissionCars) {
        const sold = soldByCar[car.id] || 0
        const rate = car.commission_rate_per_chicken || 5
        totalMarketCommission += sold * rate
        if (car.is_closed && car.dealer_id) {
          const earn = earningsByCar[car.id] || 0
          const exp  = expensesByCar[car.id] || 0
          totalDealersOwedGross += (earn - exp - sold * rate)
        }
      }
      const totalDealersBalance = totalDealersOwedGross - totalDealerPaymentsAll
      const totalSupplierDebt = totalSupplierOwed - totalSupplierPaid

      // Net Total formula (per client request):
      //   + Stock Value
      //   + Total Farm Debt
      //   + Total Profit (all-time)
      //   + Total Market Commission
      //   + Total Market Dealers (what we still owe dealers — held cash on their behalf)
      //   − Meel Stock Value
      //   − Total Supplier Debt (what we still owe suppliers)
      const netTotal =
        stockValue + totalDebt + totalProfit + totalMarketCommission + totalDealersBalance
        - meelValue - totalSupplierDebt

      setStats({ stockValue, totalDebt, monthRevenue, monthProfit, totalProfit, monthExpenses, cashBalance, medicineValue, meelValue, totalMarketCommission, totalDealersBalance, totalSupplierDebt, netTotal })
      setMedicineProducts(products.filter(p => p.type === 'medicine').sort((a, b) => (b.quantity * b.purchase_price) - (a.quantity * a.purchase_price)))
      setLowStock(products.filter(p => (p.quantity || 0) <= (p.low_stock_threshold || 10) && (p.quantity || 0) > 0))
      setExpiring(products.filter(p => isExpiringSoon(p.expiry_date) && !isExpired(p.expiry_date)))
      setTopFarms([...farms].sort((a, b) => b.total_debt - a.total_debt).slice(0, 5))
      setChartData(chart || [])
      setRecentDispatches(recentDispRes.data || [])
      setRecentPayments(recentPayRes.data || [])
      setLoading(false)
    }
    load(true)
    // Refetch when the user comes back to this tab/window so deleting a product,
    // adding a payment, etc. on another page is reflected without manual refresh.
    const onVisible = () => { if (document.visibilityState === 'visible') load(false) }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [])

  async function openMedicineModal() {
    setMedicineModal({ open: true, loading: true, revenue: 0, profit: 0 })
    const ids = medicineProducts.map(p => p.id)
    if (ids.length === 0) { setMedicineModal(m => ({ ...m, loading: false })); return }
    const [dispRes, saleRes] = await Promise.all([
      supabase.from('dispatch_items').select('total_amount, total_profit').in('product_id', ids),
      supabase.from('sale_items').select('total_amount, total_profit').in('product_id', ids),
    ])
    const all = [...(dispRes.data || []), ...(saleRes.data || [])]
    const revenue = all.reduce((s, i) => s + (i.total_amount || 0), 0)
    const profit = all.reduce((s, i) => s + (i.total_profit || 0), 0)
    setMedicineModal({ open: true, loading: false, revenue, profit })
  }

  // Profit-breakdown modal — splits profit into product-type buckets
  // (Medicine / Feed (Dana) / Choza / Coal / Other) and lists every
  // dispatch + walk-in sale line that contributed, so the user can answer
  // "where did this AFN X come from?" at a glance. `scope` is 'month' or 'all'.
  async function openProfitBreakdown(scope = 'month') {
    setProfitModal({ open: true, loading: true, scope, byType: {}, expanded: new Set() })
    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    let dispQuery = supabase.from('dispatch_items')
      .select('quantity, sell_price_at_time, purchase_price_at_time, total_profit, total_amount, products(name, type), dispatches!inner(dispatch_date, farms(name, name_fa, name_ps))')
    let saleQuery = supabase.from('sale_items')
      .select('quantity, sell_price_at_time, purchase_price_at_time, total_profit, total_amount, products(name, type), sales!inner(sale_date, customer_name)')
    // Choza profit lives in its own table (not dispatch_items / sale_items) — it's
    // earned by reselling Choza to farms at a markup, recorded per choza_transaction.
    let chozaQuery = supabase.from('choza_transactions')
      .select('transaction_date, choza_type, total_choza, total_amount, total_profit, supplier_id')
    // Coal supply payments are sold to farms at a per-KG markup — profit is on
    // supply_payments.total_profit (only set for priced items like Coal).
    let supplyQuery = supabase.from('supply_payments')
      .select('payment_date, supply_item, quantity, purchase_price, sale_price, amount, total_profit, farms(name, name_fa, name_ps)')
      .not('total_profit', 'is', null)
    if (scope === 'month') {
      dispQuery = dispQuery.gte('dispatches.dispatch_date', monthStart)
      saleQuery = saleQuery.gte('sales.sale_date', monthStart)
      chozaQuery = chozaQuery.gte('transaction_date', monthStart)
      supplyQuery = supplyQuery.gte('payment_date', monthStart)
    }
    const [dispRes, saleRes, chozaRes, supplyRes] = await Promise.all([dispQuery, saleQuery, chozaQuery, supplyQuery])
    // Fetch supplier names separately — choza_transactions ↔ suppliers FK isn't
    // declared, so an embedded select returns no data.
    const supplierIds = [...new Set((chozaRes.data || []).map(c => c.supplier_id).filter(Boolean))]
    const supplierMap = {}
    if (supplierIds.length > 0) {
      const { data: supRows } = await supabase.from('suppliers').select('id, company_name').in('id', supplierIds)
      for (const s of supRows || []) supplierMap[s.id] = s.company_name
    }
    const byType = {}
    const pushItem = (type, entry) => {
      if (!byType[type]) byType[type] = { type, total: 0, entries: [] }
      byType[type].total += entry.profit
      byType[type].entries.push(entry)
    }
    for (const i of dispRes.data || []) {
      const type = i.products?.type || 'other'
      pushItem(type, {
        kind: 'dispatch',
        date: i.dispatches?.dispatch_date,
        product: i.products?.name || '—',
        quantity: i.quantity || 0,
        revenue: i.total_amount || 0,
        profit: i.total_profit || 0,
        party: lf(i.dispatches?.farms, 'name', lang) || '—',
      })
    }
    for (const i of saleRes.data || []) {
      const type = i.products?.type || 'other'
      pushItem(type, {
        kind: 'sale',
        date: i.sales?.sale_date,
        product: i.products?.name || '—',
        quantity: i.quantity || 0,
        revenue: i.total_amount || 0,
        profit: i.total_profit || 0,
        party: i.sales?.customer_name || 'Walk-in',
      })
    }
    for (const c of chozaRes.data || []) {
      pushItem('choza', {
        kind: 'choza',
        date: c.transaction_date,
        product: c.choza_type ? `Choza — ${c.choza_type}` : 'Choza',
        quantity: c.total_choza || 0,
        revenue: c.total_amount || 0,
        profit: c.total_profit || 0,
        party: supplierMap[c.supplier_id] || 'Supplier',
      })
    }
    for (const r of supplyRes.data || []) {
      // Bucket coal supply payments under 'coal'; anything else priced under 'other'.
      const type = (r.supply_item || '').toLowerCase() === 'coal' ? 'coal' : 'other'
      pushItem(type, {
        kind: 'supply',
        date: r.payment_date,
        product: `${r.supply_item || 'Supply'} ${r.quantity ? `(${r.quantity} kg)` : ''}`.trim(),
        quantity: r.quantity || 0,
        revenue: r.amount || 0,
        profit: r.total_profit || 0,
        party: lf(r.farms, 'name', lang) || 'Farm',
      })
    }
    // Newest first within each type so the most recent activity is on top.
    for (const b of Object.values(byType)) {
      b.entries.sort((a, b2) => (b2.date || '').localeCompare(a.date || ''))
    }
    setProfitModal({ open: true, loading: false, scope, byType, expanded: new Set() })
  }

  function toggleProfitType(type) {
    setProfitModal(m => {
      const next = new Set(m.expanded)
      if (next.has(type)) next.delete(type); else next.add(type)
      return { ...m, expanded: next }
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <div className="w-8 h-8 border-2 border-[#2E86AB] border-t-transparent rounded-full animate-spin me-3" />
        {t('dashboard.loading')}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Net Total — a single "where do we stand" number per the client's formula:
          Stock + Farm Debt + Profit + Market Commission + Dealer Balance − Meel Stock − Supplier Debt.
          Click to see each component contribution. */}
      <div onClick={() => setTotalModal({ open: true })}
           className="bg-gradient-to-r from-[#1B3A5C] to-[#2E86AB] text-white rounded-2xl p-5 shadow-md hover:shadow-lg cursor-pointer transition-shadow flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-white/70 uppercase tracking-wide mb-1">{t('dashboard.netTotal')}</p>
          <p className="text-3xl font-bold truncate">{formatCurrency(stats.netTotal)}</p>
          <p className="text-xs text-white/60 mt-1">{t('dashboard.tapForDetails')}</p>
        </div>
        <div className="p-3 rounded-xl bg-white/10 shrink-0 ms-3">
          <Scale size={26} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title={t('dashboard.stockValue')} value={formatCurrency(stats.stockValue)} icon={Package} color="navy" />
        <StatCard title={t('dashboard.totalFarmDebt')} value={formatCurrency(stats.totalDebt)} icon={Building2} color="red" />
        <StatCard
          title={t('dashboard.cashBalance')}
          value={formatCurrency(stats.cashBalance)}
          icon={Wallet}
          color={stats.cashBalance >= 0 ? 'green' : 'red'}
          subtitle={t('dashboard.cashBalanceSub')}
        />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title={t('dashboard.monthRevenue')} value={formatCurrency(stats.monthRevenue)} icon={DollarSign} color="blue" />
        <StatCard title={t('dashboard.monthProfit')} value={formatCurrency(stats.monthProfit)} icon={TrendingUp} color="green" onClick={() => openProfitBreakdown('month')} subtitle={t('dashboard.tapForDetails')} />
        <StatCard title={t('dashboard.totalProfit')} value={formatCurrency(stats.totalProfit)} icon={TrendingUp} color="green" onClick={() => openProfitBreakdown('all')} subtitle={t('dashboard.tapForDetails')} />
        <StatCard title={t('dashboard.monthExpenses')} value={formatCurrency(stats.monthExpenses)} icon={DollarSign} color="orange" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <StatCard title={t('dashboard.medicineStockValue')} value={formatCurrency(stats.medicineValue)} icon={Pill} color="navy" onClick={openMedicineModal} subtitle={t('dashboard.tapForDetails')} />
        <StatCard title={t('dashboard.meelStockValue')} value={formatCurrency(stats.meelValue)} icon={Wheat} color="blue" />
      </div>

      {/* Alerts */}
      {(lowStock.length > 0 || expiring.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {lowStock.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={18} className="text-orange-600" />
                <h3 className="font-semibold text-orange-800">{t('dashboard.lowStock')} ({lowStock.length})</h3>
              </div>
              <div className="space-y-1.5">
                {lowStock.slice(0, 4).map(p => (
                  <div key={p.id} className="flex justify-between text-sm">
                    <span className="text-orange-800">{p.name}</span>
                    <span className="text-orange-600 font-medium">{p.quantity} {p.unit}</span>
                  </div>
                ))}
                {lowStock.length > 4 && <p className="text-xs text-orange-500">+{lowStock.length - 4} more</p>}
              </div>
            </div>
          )}
          {expiring.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock size={18} className="text-red-600" />
                <h3 className="font-semibold text-red-800">{t('dashboard.expiringSoon')} ({expiring.length})</h3>
              </div>
              <div className="space-y-1.5">
                {expiring.slice(0, 4).map(p => (
                  <div key={p.id} className="flex justify-between text-sm">
                    <span className="text-red-800">{p.name}</span>
                    <span className="text-red-600 font-medium">{formatDate(p.expiry_date)}</span>
                  </div>
                ))}
                {expiring.length > 4 && <p className="text-xs text-red-500">+{expiring.length - 4} more</p>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <h3 className="font-semibold text-slate-700 mb-4">{t('dashboard.revenueVsExpenses')}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="revenue" name={t('dashboard.revenue')} fill="#2E86AB" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name={t('dashboard.expenses')} fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <h3 className="font-semibold text-slate-700 mb-4">{t('dashboard.topFarmsByDebt')}</h3>
          {topFarms.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">{t('dashboard.noDebt')}</p>
          ) : (
            <div className="space-y-3">
              {topFarms.map(farm => (
                <div
                  key={farm.id}
                  className="cursor-pointer hover:bg-slate-50 rounded-lg p-2 -mx-2 transition-colors"
                  onClick={() => navigate(`/farms/${farm.id}`)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-700 truncate">{lf(farm, 'name', lang)}</span>
                    <span className="text-xs font-semibold text-red-600 ms-2">{formatCurrency(farm.total_debt)}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div
                      className="bg-red-400 h-1.5 rounded-full"
                      style={{ width: `${Math.min(100, (farm.total_debt / (topFarms[0]?.total_debt || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <Truck size={16} className="text-[#2E86AB]" /> {t('dashboard.recentDispatches')}
            </h3>
            <button onClick={() => navigate('/dispatches')} className="text-xs text-[#2E86AB] hover:underline">{t('common.viewAll')}</button>
          </div>
          {recentDispatches.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">{t('dashboard.noDispatches')}</p>
          ) : (
            <div className="space-y-2">
              {recentDispatches.map(d => (
                <div key={d.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{lf(d.farms, 'name', lang) || '—'}</p>
                    <p className="text-xs text-slate-400">{formatDate(d.dispatch_date)}</p>
                  </div>
                  <span className="text-sm font-semibold text-[#1B3A5C]">{formatCurrency(d.total_amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <CreditCard size={16} className="text-green-600" /> {t('dashboard.recentPayments')}
            </h3>
            <button onClick={() => navigate('/payments')} className="text-xs text-[#2E86AB] hover:underline">{t('common.viewAll')}</button>
          </div>
          {recentPayments.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">{t('dashboard.noPayments')}</p>
          ) : (
            <div className="space-y-2">
              {recentPayments.map(p => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{lf(p.farms, 'name', lang) || '—'}</p>
                    <p className="text-xs text-slate-400">{formatDate(p.payment_date)}</p>
                  </div>
                  <span className="text-sm font-semibold text-green-600">{formatCurrency(p.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Medicine Detail Modal */}
      {medicineModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setMedicineModal(m => ({ ...m, open: false }))}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-[#1B3A5C]/10">
                  <Pill size={18} className="text-[#1B3A5C]" />
                </div>
                <h2 className="font-bold text-slate-800 text-lg">{t('dashboard.medicineOverview')}</h2>
              </div>
              <button onClick={() => setMedicineModal(m => ({ ...m, open: false }))} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400">
                <X size={18} />
              </button>
            </div>

            {medicineModal.loading ? (
              <div className="flex items-center justify-center py-16 text-slate-400">
                <div className="w-7 h-7 border-2 border-[#2E86AB] border-t-transparent rounded-full animate-spin me-3" />
                {t('common.loading')}
              </div>
            ) : (
              <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
                {/* Summary Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-[#1B3A5C]/5 rounded-xl p-4">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{t('dashboard.stockValue')}</p>
                    <p className="text-xl font-bold text-[#1B3A5C]">{formatCurrency(stats.medicineValue)}</p>
                    <p className="text-xs text-slate-400 mt-1">{medicineProducts.length} {t('dashboard.products')}</p>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-4">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{t('dashboard.totalRevenue')}</p>
                    <p className="text-xl font-bold text-blue-700">{formatCurrency(medicineModal.revenue)}</p>
                    <p className="text-xs text-slate-400 mt-1">{t('dashboard.allTime')}</p>
                  </div>
                  <div className="bg-green-50 rounded-xl p-4">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{t('dashboard.totalProfit')}</p>
                    <p className="text-xl font-bold text-green-700">{formatCurrency(medicineModal.profit)}</p>
                    <p className="text-xs text-slate-400 mt-1">{t('dashboard.allTime')}</p>
                  </div>
                </div>

                {/* Medicine Product List */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-600 mb-3">{t('dashboard.currentStock')}</h3>
                  {medicineProducts.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-6">{t('dashboard.noMedicine')}</p>
                  ) : (
                    <div className="space-y-2">
                      {medicineProducts.map(p => {
                        const stockVal = (p.quantity || 0) * (p.purchase_price || 0)
                        const maxVal = medicineProducts[0] ? medicineProducts[0].quantity * medicineProducts[0].purchase_price : 1
                        return (
                          <div key={p.id} className="bg-slate-50 rounded-xl px-4 py-3">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-sm font-medium text-slate-700">{p.name}</span>
                              <div className="text-end">
                                <span className="text-sm font-bold text-[#1B3A5C]">{formatCurrency(stockVal)}</span>
                                <span className="text-xs text-slate-400 ms-2">{p.quantity} {p.unit}</span>
                              </div>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-1.5">
                              <div className="bg-[#2E86AB] h-1.5 rounded-full" style={{ width: `${Math.min(100, (stockVal / (maxVal || 1)) * 100)}%` }} />
                            </div>
                            <div className="flex justify-between mt-1 text-xs text-slate-400">
                              <span>{t('inventory.purchasePrice')}: {formatCurrency(p.purchase_price)}</span>
                              <span>{t('inventory.sellPrice')}: {formatCurrency(p.sell_price)}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Profit breakdown modal — categorise this month's profit by product type. */}
      {profitModal.open && (() => {
        const TYPE_META = {
          medicine: { label: t('inventory.medicine') !== 'inventory.medicine' ? t('inventory.medicine') : 'Medicine', color: 'bg-blue-50 text-blue-700', dot: 'bg-blue-500' },
          meel:     { label: 'Feed (Dana)',          color: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
          choza:    { label: 'Choza',                color: 'bg-yellow-50 text-yellow-700', dot: 'bg-yellow-500' },
          coal:     { label: 'Coal',                 color: 'bg-stone-100 text-stone-700', dot: 'bg-stone-500' },
          other:    { label: 'Other',                color: 'bg-slate-50 text-slate-700', dot: 'bg-slate-400' },
        }
        const order = ['medicine', 'meel', 'choza', 'coal', 'other']
        const buckets = order
          .map(k => profitModal.byType[k])
          .filter(Boolean)
          .concat(
            Object.values(profitModal.byType).filter(b => !order.includes(b.type))
          )
        const grandTotal = buckets.reduce((s, b) => s + b.total, 0)
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setProfitModal(m => ({ ...m, open: false }))}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-green-50">
                    <TrendingUp size={18} className="text-green-700" />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-800 text-lg">{profitModal.scope === 'all' ? t('dashboard.totalProfit') : t('dashboard.monthProfit')} — breakdown</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Click a category to see every dispatch / sale that contributed.</p>
                  </div>
                </div>
                <button onClick={() => setProfitModal(m => ({ ...m, open: false }))} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400">
                  <X size={18} />
                </button>
              </div>

              {profitModal.loading ? (
                <div className="flex items-center justify-center py-16 text-slate-400">
                  <div className="w-7 h-7 border-2 border-green-500 border-t-transparent rounded-full animate-spin me-3" />
                  {t('common.loading')}
                </div>
              ) : (
                <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-green-700 uppercase tracking-wide">{profitModal.scope === 'all' ? 'Total profit (all time)' : 'Total profit this month'}</p>
                      <p className="text-2xl font-bold text-green-700 mt-0.5">{formatCurrency(grandTotal)}</p>
                    </div>
                    <p className="text-xs text-green-700">
                      {buckets.length} {buckets.length === 1 ? 'category' : 'categories'}
                    </p>
                  </div>

                  {buckets.length === 0 ? (
                    <p className="text-center text-sm text-slate-400 py-10">{profitModal.scope === 'all' ? 'No dispatches or sales recorded yet.' : 'No dispatches or sales this month yet.'}</p>
                  ) : buckets.map(b => {
                    const meta = TYPE_META[b.type] || { label: b.type, color: 'bg-slate-50 text-slate-700', dot: 'bg-slate-400' }
                    const isOpen = profitModal.expanded.has(b.type)
                    const pct = grandTotal > 0 ? Math.round((b.total / grandTotal) * 100) : 0
                    return (
                      <div key={b.type} className="border border-slate-200 rounded-xl overflow-hidden">
                        <button
                          onClick={() => toggleProfitType(b.type)}
                          className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${meta.dot}`} />
                            <div className="text-start min-w-0">
                              <p className="font-semibold text-slate-800 truncate">{meta.label}</p>
                              <p className="text-xs text-slate-500">{b.entries.length} {b.entries.length === 1 ? 'entry' : 'entries'} · {pct}% {profitModal.scope === 'all' ? 'of total' : 'of month'}</p>
                            </div>
                          </div>
                          <div className="text-end">
                            <p className="font-bold text-green-700">{formatCurrency(b.total)}</p>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wide">{isOpen ? 'click to collapse' : 'click to expand'}</p>
                          </div>
                        </button>
                        {isOpen && (
                          <div className="bg-slate-50/60 border-t border-slate-100 px-4 py-3 max-h-72 overflow-y-auto">
                            <div className="space-y-1.5">
                              {b.entries.map((e, i) => (
                                <div key={i} className="flex items-center justify-between gap-3 py-1.5 text-sm border-b border-slate-100 last:border-0">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-slate-700 truncate">
                                      <span className="text-xs text-slate-400 me-2">{formatDate(e.date)}</span>
                                      {e.product} <span className="text-slate-400">× {e.quantity}</span>
                                    </p>
                                    <p className="text-xs text-slate-500 truncate">
                                      {e.kind === 'sale' ? '🛒 ' : e.kind === 'choza' ? '🐥 ' : e.kind === 'supply' ? '⛏ ' : '🚚 '}
                                      {e.party}
                                    </p>
                                  </div>
                                  <p className="font-semibold text-green-700 shrink-0">{formatCurrency(e.profit)}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* Net Total breakdown modal — shows every component contributing to the
          headline number with its sign so the client can verify the math. */}
      {totalModal.open && (() => {
        const rows = [
          { label: t('dashboard.stockValue'),          value: stats.stockValue,            sign: '+' },
          { label: t('dashboard.totalFarmDebt'),       value: stats.totalDebt,             sign: '+' },
          { label: t('dashboard.totalProfit'),         value: stats.totalProfit,           sign: '+' },
          { label: t('dashboard.totalMarketCommission'), value: stats.totalMarketCommission, sign: '+' },
          { label: t('dashboard.totalDealersBalance'), value: stats.totalDealersBalance,   sign: '+' },
          { label: t('dashboard.meelStockValue'),      value: stats.meelValue,             sign: '−' },
          { label: t('dashboard.totalSupplierDebt'),   value: stats.totalSupplierDebt,     sign: '−' },
        ]
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setTotalModal({ open: false })}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-[#1B3A5C]/10">
                    <Scale size={18} className="text-[#1B3A5C]" />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-800 text-lg">{t('dashboard.netTotal')} — breakdown</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Each component contributing to the headline number.</p>
                  </div>
                </div>
                <button onClick={() => setTotalModal({ open: false })} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400">
                  <X size={18} />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 px-5 py-4 space-y-2">
                {rows.map((r, i) => (
                  <div key={i} className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border ${r.sign === '+' ? 'bg-green-50/50 border-green-100' : 'bg-red-50/50 border-red-100'}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${r.sign === '+' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{r.sign}</span>
                      <span className="font-medium text-slate-700 truncate">{r.label}</span>
                    </div>
                    <span className={`font-bold shrink-0 ${r.sign === '+' ? 'text-green-700' : 'text-red-700'}`}>
                      {formatCurrency(r.value)}
                    </span>
                  </div>
                ))}

                <div className="mt-3 px-4 py-4 rounded-xl bg-[#1B3A5C] text-white flex items-center justify-between">
                  <span className="font-semibold uppercase tracking-wide text-xs">{t('dashboard.netTotal')}</span>
                  <span className="text-xl font-bold">{formatCurrency(stats.netTotal)}</span>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
