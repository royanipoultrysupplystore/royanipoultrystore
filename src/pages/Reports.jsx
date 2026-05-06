import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts'
import { Download } from 'lucide-react'
import { useReports } from '../hooks/useReports'
import { useFarms } from '../hooks/useFarms'
import { useInventory } from '../hooks/useInventory'
import { useExpenses } from '../hooks/useExpenses'
import { formatCurrency } from '../utils/formatCurrency'
import { formatDate, isExpired, isExpiringSoon } from '../utils/dateHelpers'
import { exportToExcel, exportMultiSheet } from '../utils/exportExcel'
import { supabase } from '../config/supabase'
import { useLanguage } from '../contexts/LanguageContext'
import { lf } from '../utils/localizedField'

const COLORS = ['#1B3A5C', '#2E86AB', '#ef4444', '#f97316', '#8b5cf6', '#06b6d4']
const CAT_ICONS = { fuel: '⛽', salary: '👤', rent: '🏢', maintenance: '🔧', utilities: '💡', other: '📦' }

export default function Reports() {
  const { t, lang } = useLanguage()

  const TABS = [
    { key: 'Monthly', label: t('reports.monthly') },
    { key: 'Farms', label: t('reports.farms') },
    { key: 'Inventory', label: t('reports.inventory') },
    { key: 'Expenses', label: t('reports.expenses') },
  ]

  const [tab, setTab] = useState('Monthly')
  const { getMonthlyReport, getLast6MonthsChart, loading: repLoading } = useReports()
  const { farms } = useFarms()
  const { products, loading: invLoading } = useInventory()
  const { expenses } = useExpenses()

  const now = new Date()
  const [selYear, setSelYear] = useState(now.getFullYear())
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1)
  const [monthData, setMonthData] = useState(null)
  const [chartData, setChartData] = useState([])

  const [farmReports, setFarmReports] = useState([])
  const [frLoading, setFrLoading] = useState(false)

  useEffect(() => {
    if (tab === 'Monthly') {
      getMonthlyReport(selYear, selMonth).then(setMonthData)
      getLast6MonthsChart().then(setChartData)
    }
    if (tab === 'Farms') loadFarmReports()
  }, [tab, selYear, selMonth])

  async function loadFarmReports() {
    setFrLoading(true)
    const { data: dispatches } = await supabase.from('dispatches').select('farm_id, total_amount')
    const { data: payments } = await supabase.from('payments').select('farm_id, amount')
    const result = farms.map(farm => {
      const totalDispatched = (dispatches || []).filter(d => d.farm_id === farm.id).reduce((s, d) => s + (d.total_amount || 0), 0)
      const totalPaid = (payments || []).filter(p => p.farm_id === farm.id).reduce((s, p) => s + (p.amount || 0), 0)
      return {
        farm,
        totalDispatched,
        totalPaid,
        debt: farm.total_debt,
        profit: farm.total_profit_generated,
      }
    })
    setFarmReports(result)
    setFrLoading(false)
  }

  const stockValue = products.reduce((s, p) => s + (p.quantity || 0) * (p.purchase_price || 0), 0)
  const lowStock = products.filter(p => (p.quantity || 0) <= (p.low_stock_threshold || 10))
  const expiringSoon = products.filter(p => isExpiringSoon(p.expiry_date) && !isExpired(p.expiry_date))
  const expired = products.filter(p => isExpired(p.expiry_date))

  const catTotals = ['fuel', 'salary', 'rent', 'maintenance', 'utilities', 'other'].map(cat => ({
    name: cat,
    value: expenses.filter(e => e.category === cat).reduce((s, e) => s + (e.amount || 0), 0),
  })).filter(c => c.value > 0)

  function exportFarmReport() {
    exportToExcel(farmReports.map(f => ({
      'Farm': f.farm.name, 'Owner': f.farm.owner_name,
      'Total Dispatched (AFN)': f.totalDispatched,
      'Total Paid (AFN)': f.totalPaid,
      'Current Debt (AFN)': f.debt,
      'Total Profit (AFN)': f.profit,
    })), 'farm-report')
  }

  function exportInventoryReport() {
    exportMultiSheet([
      {
        name: 'All Products',
        data: products.map(p => ({
          'Name': p.name, 'Type': p.type, 'Barcode': p.barcode,
          'Unit': p.unit, 'Quantity': p.quantity,
          'Purchase Price': p.purchase_price, 'Sell Price': p.sell_price,
          'Stock Value': (p.quantity || 0) * (p.purchase_price || 0),
          'Expiry Date': p.expiry_date || '',
          'Status': isExpired(p.expiry_date) ? 'Expired' : (p.quantity <= p.low_stock_threshold ? 'Low Stock' : 'In Stock'),
        }))
      },
      { name: 'Low Stock', data: lowStock.map(p => ({ 'Name': p.name, 'Type': p.type, 'Quantity': p.quantity, 'Threshold': p.low_stock_threshold })) },
      { name: 'Expiring Soon', data: expiringSoon.map(p => ({ 'Name': p.name, 'Expiry': p.expiry_date, 'Quantity': p.quantity })) },
    ], 'inventory-report')
  }

  function exportExpenseReport() {
    exportToExcel(expenses.map(e => ({
      'Title': e.title, 'Category': e.category,
      'Amount (AFN)': e.amount, 'Date': e.expense_date, 'Notes': e.notes || '',
    })), 'expense-report')
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-white rounded-xl p-1 border border-slate-100 shadow-sm w-fit flex-wrap">
        {TABS.map(tabItem => (
          <button key={tabItem.key} onClick={() => setTab(tabItem.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === tabItem.key ? 'bg-[#1B3A5C] text-white shadow' : 'text-slate-600 hover:bg-slate-100'}`}>
            {tabItem.label}
          </button>
        ))}
      </div>

      {/* Monthly Report */}
      {tab === 'Monthly' && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <select value={selMonth} onChange={e => setSelMonth(Number(e.target.value))}
              className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30">
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString('en', { month: 'long' })}</option>
              ))}
            </select>
            <select value={selYear} onChange={e => setSelYear(Number(e.target.value))}
              className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30">
              {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {repLoading ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <div className="w-6 h-6 border-2 border-[#2E86AB] border-t-transparent rounded-full animate-spin me-3" />{t('common.loading')}
            </div>
          ) : monthData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                  { label: t('reports.revenue'), value: monthData.revenue, color: 'text-blue-700', bg: 'bg-blue-50' },
                  { label: t('reports.costOfGoods'), value: monthData.costOfGoods, color: 'text-slate-700', bg: 'bg-slate-50' },
                  { label: t('reports.grossProfit'), value: monthData.grossProfit, color: 'text-green-700', bg: 'bg-green-50' },
                  { label: t('reports.monthExpenses'), value: monthData.totalExpenses, color: 'text-red-700', bg: 'bg-red-50' },
                  { label: t('reports.netProfit'), value: monthData.netProfit, color: monthData.netProfit >= 0 ? 'text-green-700' : 'text-red-700', bg: monthData.netProfit >= 0 ? 'bg-green-50' : 'bg-red-50' },
                ].map(card => (
                  <div key={card.label} className={`${card.bg} rounded-xl p-4`}>
                    <p className="text-xs font-medium text-slate-500 mb-1">{card.label}</p>
                    <p className={`text-xl font-bold ${card.color}`}>{formatCurrency(card.value)}</p>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
                <h3 className="font-semibold text-slate-700 mb-4">{t('reports.last6Months')}</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartData}>
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={v => formatCurrency(v)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="revenue" name={t('reports.revenue')} fill="#2E86AB" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" name={t('reports.monthExpenses')} fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Farm Report */}
      {tab === 'Farms' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={exportFarmReport} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700">
              <Download size={15} /> {t('reports.exportExcel')}
            </button>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-x-auto">
            {frLoading ? (
              <div className="py-12 text-center text-slate-400">{t('common.loading')}</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    {[t('reports.farmReport'), t('reports.ownerReport'), t('reports.dispatched'), t('reports.paid'), t('common.debt'), t('common.profit')].map(h => (
                      <th key={h} className="text-start px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {farmReports.map((f, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-700">{lf(f.farm, 'name', lang)}</td>
                      <td className="px-4 py-3 text-slate-500">{lf(f.farm, 'owner_name', lang)}</td>
                      <td className="px-4 py-3 text-[#1B3A5C] font-medium">{formatCurrency(f.totalDispatched)}</td>
                      <td className="px-4 py-3 text-green-700 font-medium">{formatCurrency(f.totalPaid)}</td>
                      <td className="px-4 py-3"><span className={`font-semibold ${f.debt > 0 ? 'text-red-700' : 'text-green-700'}`}>{formatCurrency(f.debt)}</span></td>
                      <td className="px-4 py-3 text-green-700 font-semibold">{formatCurrency(f.profit)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 font-bold text-slate-700">{t('reports.totals')}</td>
                    <td className="px-4 py-3 font-bold text-[#1B3A5C]">{formatCurrency(farmReports.reduce((s, f) => s + f.totalDispatched, 0))}</td>
                    <td className="px-4 py-3 font-bold text-green-700">{formatCurrency(farmReports.reduce((s, f) => s + f.totalPaid, 0))}</td>
                    <td className="px-4 py-3 font-bold text-red-700">{formatCurrency(farmReports.reduce((s, f) => s + f.debt, 0))}</td>
                    <td className="px-4 py-3 font-bold text-green-700">{formatCurrency(farmReports.reduce((s, f) => s + f.profit, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Inventory Report */}
      {tab === 'Inventory' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={exportInventoryReport} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700">
              <Download size={15} /> {t('reports.exportExcel')}
            </button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: t('reports.totalStockValue'), value: formatCurrency(stockValue), bg: 'bg-[#1B3A5C]', text: 'text-white' },
              { label: t('reports.totalProducts'), value: products.length, bg: 'bg-slate-100', text: 'text-slate-800' },
              { label: t('reports.lowStockItems'), value: lowStock.length, bg: 'bg-orange-50', text: 'text-orange-700' },
              { label: t('reports.expiringSoon'), value: expiringSoon.length + expired.length, bg: 'bg-red-50', text: 'text-red-700' },
            ].map(c => (
              <div key={c.label} className={`${c.bg} rounded-xl p-4`}>
                <p className={`text-xs font-medium mb-1 ${c.text} opacity-70`}>{c.label}</p>
                <p className={`text-2xl font-bold ${c.text}`}>{c.value}</p>
              </div>
            ))}
          </div>

          {lowStock.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-orange-100 p-4">
              <h3 className="font-semibold text-orange-700 mb-3">⚠ {t('reports.lowStockItems')}</h3>
              <div className="divide-y divide-slate-100">
                {lowStock.map(p => (
                  <div key={p.id} className="flex justify-between py-2 text-sm">
                    <span className="text-slate-700">{p.name}</span>
                    <span className="text-orange-600 font-medium">{p.quantity} / {p.low_stock_threshold} {p.unit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {expiringSoon.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-red-100 p-4">
              <h3 className="font-semibold text-red-700 mb-3">🕐 {t('reports.expiringSoon')}</h3>
              <div className="divide-y divide-slate-100">
                {expiringSoon.map(p => (
                  <div key={p.id} className="flex justify-between py-2 text-sm">
                    <span className="text-slate-700">{p.name}</span>
                    <span className="text-red-600 font-medium">{formatDate(p.expiry_date)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Expense Report */}
      {tab === 'Expenses' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={exportExpenseReport} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700">
              <Download size={15} /> {t('reports.exportExcel')}
            </button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
              <h3 className="font-semibold text-slate-700 mb-4">{t('reports.byCategory')}</h3>
              {catTotals.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">{t('reports.noExpenses')}</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={catTotals} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${formatCurrency(value)}`} labelLine={false}>
                      {catTotals.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={v => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
              <h3 className="font-semibold text-slate-700 mb-4">{t('reports.categoryBreakdown')}</h3>
              <div className="space-y-3">
                {catTotals.map((cat, i) => (
                  <div key={cat.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="capitalize text-slate-600">{CAT_ICONS[cat.name]} {t(`expenses.categories.${cat.name}`)}</span>
                      <span className="font-semibold text-slate-800">{formatCurrency(cat.value)}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full" style={{ width: `${(cat.value / catTotals.reduce((s, c) => s + c.value, 0)) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                    </div>
                  </div>
                ))}
                <div className="border-t border-slate-200 pt-3 flex justify-between font-semibold text-sm">
                  <span className="text-slate-700">{t('common.total')}</span>
                  <span className="text-red-700">{formatCurrency(catTotals.reduce((s, c) => s + c.value, 0))}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
