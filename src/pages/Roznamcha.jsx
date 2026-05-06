import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, BookOpen, RefreshCw } from 'lucide-react'
import { useRoznamcha } from '../hooks/useRoznamcha'
import { formatCurrency } from '../utils/formatCurrency'
import { todayStr } from '../utils/dateHelpers'
import { useLanguage } from '../contexts/LanguageContext'
import { lf } from '../utils/localizedField'

const CAT_ICONS = { fuel: '⛽', salary: '👤', rent: '🏢', maintenance: '🔧', utilities: '💡', other: '📦' }

function entryTime(entry) {
  if (!entry.created_at) return ''
  return new Date(entry.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function prevDay(date) {
  const d = new Date(date)
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

function nextDay(date) {
  const d = new Date(date)
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

function formatDayLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function EntryCard({ entry }) {
  const { t, lang } = useLanguage()

  const TYPE_CONFIG = {
    dispatch:  { label: t('roznamcha.types.dispatch'), badge: 'bg-blue-100 text-blue-700',    border: 'border-l-blue-400',    icon: '🚚', amountColor: 'text-blue-700' },
    payment:   { label: t('roznamcha.types.payment'),  badge: 'bg-green-100 text-green-700',  border: 'border-l-green-500',   icon: '💵', amountColor: 'text-green-700' },
    sale:      { label: t('roznamcha.types.sale'),     badge: 'bg-emerald-100 text-emerald-700', border: 'border-l-emerald-500', icon: '🛒', amountColor: 'text-emerald-700' },
    supply:    { label: t('roznamcha.types.supply'),   badge: 'bg-orange-100 text-orange-700', border: 'border-l-orange-400',  icon: '🛍️', amountColor: 'text-orange-700' },
    expense:   { label: t('roznamcha.types.expense'),  badge: 'bg-red-100 text-red-700',      border: 'border-l-red-400',     icon: '📋', amountColor: 'text-red-700' },
    stock:     { label: t('roznamcha.types.stock'),    badge: 'bg-purple-100 text-purple-700', border: 'border-l-purple-400',  icon: '📦', amountColor: 'text-purple-700' },
  }

  const cfg = TYPE_CONFIG[entry._type]
  const time = entryTime(entry)

  let title = ''
  let detail = ''
  let amount = 0

  switch (entry._type) {
    case 'dispatch':
      title = `${t('roznamcha.dispatchedTo')} ${lf(entry.farms, 'name', lang) || '—'}`
      detail = [
        entry.invoice_number ? `${t('dispatches.invoice')}${entry.invoice_number}` : '',
        entry.dispatch_items?.length ? `${entry.dispatch_items.length} ${t('dispatches.items').toLowerCase()}` : '',
        entry.notes || '',
      ].filter(Boolean).join(' · ')
      amount = entry.total_amount || 0
      break
    case 'payment':
      title = `${t('roznamcha.paymentFrom')} ${lf(entry.farms, 'name', lang) || '—'}`
      detail = entry.notes || ''
      amount = entry.amount || 0
      break
    case 'sale':
      title = `${t('roznamcha.walkInSaleEntry')} — ${entry.customer_name || t('customers.walkIn')}`
      detail = [
        entry.invoice_number ? `${t('dispatches.invoice')}${entry.invoice_number}` : '',
        entry.total_amount ? `${t('common.total')}: ${formatCurrency(entry.total_amount)}` : '',
        entry.payment_type === 'credit' ? t('roznamcha.creditSale') : t('customers.cash'),
        entry.remaining > 0 ? `${t('roznamcha.remaining')}: ${formatCurrency(entry.remaining)}` : '',
        entry.notes || '',
      ].filter(Boolean).join(' · ')
      amount = entry.amount_paid || 0
      break
    case 'supply':
      title = `${t('roznamcha.supplyEntry')}: ${entry.supply_item} → ${lf(entry.farms, 'name', lang) || '—'}`
      detail = entry.notes || ''
      amount = entry.amount || 0
      break
    case 'expense':
      title = `${CAT_ICONS[entry.category] || '📦'} ${entry.title}`
      detail = [entry.category, entry.notes].filter(Boolean).join(' · ')
      amount = entry.amount || 0
      break
    case 'stock':
      title = `${t('roznamcha.restocked')}: ${entry.products?.name || '—'}`
      detail = [
        entry.quantity ? `${entry.quantity} ${t('roznamcha.units')}` : '',
        entry.supplier ? `${t('common.from')} ${entry.supplier}` : '',
        entry.batch_number ? `${t('inventory.batchNo')}: ${entry.batch_number}` : '',
        entry.notes || '',
      ].filter(Boolean).join(' · ')
      amount = entry.total_cost || 0
      break
  }

  return (
    <div className={`bg-white rounded-xl border border-slate-100 border-l-4 ${cfg.border} px-4 py-3 flex items-start gap-4`}>
      <div className="shrink-0 w-16 text-end">
        <p className="text-xs text-slate-400 mt-0.5">{time}</p>
      </div>
      <div className="text-xl shrink-0 mt-0.5">{cfg.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
        </div>
        <p className="text-sm font-medium text-slate-800">{title}</p>
        {detail && <p className="text-xs text-slate-400 mt-0.5 truncate">{detail}</p>}
        {entry._type === 'dispatch' && entry.dispatch_items?.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {entry.dispatch_items.map((item, i) => (
              <span key={i} className="text-xs bg-slate-50 border border-slate-100 px-2 py-0.5 rounded text-slate-600">
                {item.products?.name || '—'} × {item.quantity}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="shrink-0 text-end">
        <p className={`font-bold text-base ${cfg.amountColor}`}>{formatCurrency(amount)}</p>
      </div>
    </div>
  )
}

export default function Roznamcha() {
  const { t } = useLanguage()
  const [date, setDate] = useState(todayStr())
  const { entries, loading, refetch } = useRoznamcha(date)

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') refetch() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refetch])

  const dispatches    = entries.filter(e => e._type === 'dispatch')
  const payments      = entries.filter(e => e._type === 'payment')
  const sales         = entries.filter(e => e._type === 'sale')
  const supplyOuts    = entries.filter(e => e._type === 'supply')
  const expenses      = entries.filter(e => e._type === 'expense')
  const stockBuys     = entries.filter(e => e._type === 'stock')

  const moneyIn       = payments.reduce((s, p) => s + (p.amount || 0), 0)
                      + sales.reduce((s, p) => s + (p.amount_paid || 0), 0)
  const moneyOut      = expenses.reduce((s, e) => s + (e.amount || 0), 0)
                      + supplyOuts.reduce((s, p) => s + (p.amount || 0), 0)
  const debtFromSales = sales.reduce((s, p) => s + (p.remaining || 0), 0)
  const dispatched    = dispatches.reduce((s, d) => s + (d.total_amount || 0), 0)
  const stockSpent    = stockBuys.reduce((s, b) => s + (b.total_cost || 0), 0)
  const netCash       = moneyIn - moneyOut

  const isToday = date === todayStr()

  return (
    <div className="space-y-4 max-w-3xl mx-auto">

      {/* Date Navigation */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <BookOpen size={20} className="text-[#1B3A5C]" />
          <span className="font-bold text-[#1B3A5C] text-lg">{t('nav.roznamcha')}</span>
        </div>
        <div className="flex-1" />
        <button onClick={() => setDate(prevDay(date))} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600">
          <ChevronLeft size={18} />
        </button>
        <input
          type="date" value={date}
          max={todayStr()}
          onChange={e => setDate(e.target.value)}
          className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30 font-medium text-slate-700"
        />
        <button
          onClick={() => setDate(nextDay(date))}
          disabled={isToday}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight size={18} />
        </button>
        {!isToday && (
          <button onClick={() => setDate(todayStr())} className="text-xs px-3 py-1.5 bg-[#1B3A5C] text-white rounded-lg hover:bg-[#2E86AB]">
            {t('roznamcha.today')}
          </button>
        )}
        <button onClick={refetch} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400" title={t('common.refresh')}>
          <RefreshCw size={15} />
        </button>
      </div>

      <p className="text-sm font-medium text-slate-500 px-1">{formatDayLabel(date)}</p>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-xl p-3">
          <p className="text-xs font-medium text-green-700 mb-1">{t('roznamcha.moneyIn')}</p>
          <p className="text-xl font-bold text-green-700">{formatCurrency(moneyIn)}</p>
          <p className="text-xs text-green-600 mt-0.5">{payments.length} {t('roznamcha.payments')} · {sales.length} {t('roznamcha.sales')}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-xs font-medium text-red-700 mb-1">{t('roznamcha.moneyOut')}</p>
          <p className="text-xl font-bold text-red-700">{formatCurrency(moneyOut)}</p>
          <p className="text-xs text-red-600 mt-0.5">{expenses.length} {t('roznamcha.expenses')} · {supplyOuts.length} {t('roznamcha.supply')}</p>
        </div>
        <div className={`rounded-xl p-3 border ${debtFromSales > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
          <p className={`text-xs font-medium mb-1 ${debtFromSales > 0 ? 'text-amber-700' : 'text-slate-500'}`}>{t('roznamcha.debtOut')}</p>
          <p className={`text-xl font-bold ${debtFromSales > 0 ? 'text-amber-700' : 'text-slate-400'}`}>{formatCurrency(debtFromSales)}</p>
          <p className={`text-xs mt-0.5 ${debtFromSales > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{t('roznamcha.creditSale')}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
          <p className="text-xs font-medium text-blue-700 mb-1">{t('roznamcha.dispatched')}</p>
          <p className="text-xl font-bold text-blue-700">{formatCurrency(dispatched)}</p>
          <p className="text-xs text-blue-600 mt-0.5">{dispatches.length} {t('roznamcha.dispatches')}</p>
        </div>
        <div className={`rounded-xl p-3 border ${netCash >= 0 ? 'bg-slate-50 border-slate-200' : 'bg-orange-50 border-orange-200'}`}>
          <p className={`text-xs font-medium mb-1 ${netCash >= 0 ? 'text-slate-600' : 'text-orange-700'}`}>{t('roznamcha.netCash')}</p>
          <p className={`text-xl font-bold ${netCash >= 0 ? 'text-slate-800' : 'text-orange-700'}`}>{formatCurrency(netCash)}</p>
          {stockSpent > 0 && <p className="text-xs text-purple-600 mt-0.5">{t('roznamcha.stockBought')}: {formatCurrency(stockSpent)}</p>}
        </div>
      </div>

      {/* Activity Feed */}
      <div className="space-y-2">
        {loading ? (
          <div className="bg-white rounded-xl border border-slate-100 py-16 text-center text-slate-400">
            <div className="w-8 h-8 border-2 border-[#2E86AB] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            {t('common.loading')}
          </div>
        ) : entries.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-100 py-16 text-center">
            <BookOpen size={40} className="mx-auto text-slate-200 mb-3" />
            <p className="text-slate-400 font-medium">{t('roznamcha.noActivity')}</p>
            <p className="text-slate-300 text-sm mt-1">{t('roznamcha.noActivitySub')}</p>
          </div>
        ) : (
          entries.map((entry, i) => <EntryCard key={`${entry._type}-${entry.id}-${i}`} entry={entry} />)
        )}
      </div>

      {/* Day Total Footer */}
      {entries.length > 0 && (
        <div className="bg-[#1B3A5C] rounded-2xl p-4 text-white">
          <p className="text-white/60 text-xs mb-3 font-medium uppercase tracking-wide">{t('roznamcha.daySummary')} — {entries.length} {t('roznamcha.transactions')}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            {payments.length > 0 && <div><p className="text-white/50 text-xs">{t('roznamcha.farmPayments')}</p><p className="font-bold text-green-300">+{formatCurrency(payments.reduce((s,p) => s+(p.amount||0),0))}</p></div>}
            {sales.length > 0 && <div><p className="text-white/50 text-xs">{t('roznamcha.walkInSales')}</p><p className="font-bold text-emerald-300">+{formatCurrency(sales.reduce((s,p) => s+(p.amount_paid||0),0))}</p></div>}
            {debtFromSales > 0 && <div><p className="text-white/50 text-xs">{t('roznamcha.debtOut')}</p><p className="font-bold text-amber-300">{formatCurrency(debtFromSales)}</p></div>}
            {dispatches.length > 0 && <div><p className="text-white/50 text-xs">{t('roznamcha.dispatchedCredit')}</p><p className="font-bold text-blue-300">{formatCurrency(dispatched)}</p></div>}
            {supplyOuts.length > 0 && <div><p className="text-white/50 text-xs">{t('roznamcha.supplyPayments')}</p><p className="font-bold text-orange-300">-{formatCurrency(supplyOuts.reduce((s,p) => s+(p.amount||0),0))}</p></div>}
            {expenses.length > 0 && <div><p className="text-white/50 text-xs">{t('roznamcha.expenses')}</p><p className="font-bold text-red-300">-{formatCurrency(expenses.reduce((s,e) => s+(e.amount||0),0))}</p></div>}
            {stockBuys.length > 0 && <div><p className="text-white/50 text-xs">{t('roznamcha.stockBought')}</p><p className="font-bold text-purple-300">-{formatCurrency(stockSpent)}</p></div>}
          </div>
          <div className="border-t border-white/10 mt-3 pt-3 flex justify-between items-center">
            <span className="text-white/70 text-sm">{t('roznamcha.netCashFlow')}</span>
            <span className={`text-xl font-bold ${netCash >= 0 ? 'text-green-300' : 'text-red-300'}`}>{netCash >= 0 ? '+' : ''}{formatCurrency(netCash)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
