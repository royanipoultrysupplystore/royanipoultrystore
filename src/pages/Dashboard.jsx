import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Package, Building2, TrendingUp, DollarSign, AlertTriangle, Clock, Truck, CreditCard, Wallet, Pill, Wheat, X } from 'lucide-react'
import { supabase } from '../config/supabase'
import StatCard from '../components/common/StatCard'
import { formatCurrency } from '../utils/formatCurrency'
import { formatDate, isExpired, isExpiringSoon } from '../utils/dateHelpers'
import { useReports } from '../hooks/useReports'
import { useLanguage } from '../contexts/LanguageContext'
import { lf } from '../utils/localizedField'

export default function Dashboard() {
  const navigate = useNavigate()
  const { t, lang } = useLanguage()
  const { getLast6MonthsChart } = useReports()
  const [stats, setStats] = useState({ stockValue: 0, totalDebt: 0, monthRevenue: 0, monthProfit: 0, monthExpenses: 0, cashBalance: 0, medicineValue: 0, meelValue: 0 })
  const [lowStock, setLowStock] = useState([])
  const [expiring, setExpiring] = useState([])
  const [chartData, setChartData] = useState([])
  const [topFarms, setTopFarms] = useState([])
  const [recentDispatches, setRecentDispatches] = useState([])
  const [recentPayments, setRecentPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [medicineProducts, setMedicineProducts] = useState([])
  const [medicineModal, setMedicineModal] = useState({ open: false, loading: false, revenue: 0, profit: 0 })

  useEffect(() => {
    async function load() {
      setLoading(true)

      const now = new Date()
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

      const [
        productsRes, farmsRes, dispatchesRes, expensesRes,
        recentDispRes, recentPayRes, chart,
        allPaymentsRes, allExpensesRes
      ] = await Promise.all([
        supabase.from('products').select('*'),
        supabase.from('farms').select('*').eq('is_active', true),
        supabase.from('dispatch_items').select('total_amount, total_profit, purchase_price_at_time, quantity, dispatches!inner(dispatch_date)').gte('dispatches.dispatch_date', monthStart),
        supabase.from('expenses').select('amount').gte('expense_date', monthStart),
        supabase.from('dispatches').select('*, farms(name, name_fa, name_ps)').order('dispatch_date', { ascending: false }).limit(5),
        supabase.from('payments').select('*, farms(name, name_fa, name_ps)').order('payment_date', { ascending: false }).limit(5),
        getLast6MonthsChart(),
        supabase.from('payments').select('amount'),
        supabase.from('expenses').select('amount'),
      ])

      const products = productsRes.data || []
      const farms = farmsRes.data || []
      const items = dispatchesRes.data || []
      const expenses = expensesRes.data || []

      const stockValue = products.reduce((s, p) => s + (p.quantity || 0) * (p.purchase_price || 0), 0)
      const medicineValue = products.filter(p => p.type === 'medicine').reduce((s, p) => s + (p.quantity || 0) * (p.purchase_price || 0), 0)
      const meelValue = products.filter(p => p.type === 'meel').reduce((s, p) => s + (p.quantity || 0) * (p.purchase_price || 0), 0)
      const totalDebt = farms.reduce((s, f) => s + (f.total_debt || 0), 0)
      const monthRevenue = items.reduce((s, i) => s + (i.total_amount || 0), 0)
      const monthProfit = items.reduce((s, i) => s + (i.total_profit || 0), 0)
      const monthExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0)

      const totalPaymentsReceived = (allPaymentsRes.data || []).reduce((s, p) => s + (p.amount || 0), 0)
      const totalExpensesPaid = (allExpensesRes.data || []).reduce((s, e) => s + (e.amount || 0), 0)
      const cashBalance = totalPaymentsReceived - totalExpensesPaid

      setStats({ stockValue, totalDebt, monthRevenue, monthProfit, monthExpenses, cashBalance, medicineValue, meelValue })
      setMedicineProducts(products.filter(p => p.type === 'medicine').sort((a, b) => (b.quantity * b.purchase_price) - (a.quantity * a.purchase_price)))
      setLowStock(products.filter(p => (p.quantity || 0) <= (p.low_stock_threshold || 10) && (p.quantity || 0) > 0))
      setExpiring(products.filter(p => isExpiringSoon(p.expiry_date) && !isExpired(p.expiry_date)))
      setTopFarms([...farms].sort((a, b) => b.total_debt - a.total_debt).slice(0, 5))
      setChartData(chart || [])
      setRecentDispatches(recentDispRes.data || [])
      setRecentPayments(recentPayRes.data || [])
      setLoading(false)
    }
    load()
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
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard title={t('dashboard.monthRevenue')} value={formatCurrency(stats.monthRevenue)} icon={DollarSign} color="blue" />
        <StatCard title={t('dashboard.monthProfit')} value={formatCurrency(stats.monthProfit)} icon={TrendingUp} color="green" />
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
    </div>
  )
}
