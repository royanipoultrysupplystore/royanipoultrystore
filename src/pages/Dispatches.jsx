import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Truck, Edit2, Search, X } from 'lucide-react'
import { useDispatches } from '../hooks/useDispatches'
import { useFarms } from '../hooks/useFarms'
import ConfirmDialog from '../components/common/ConfirmDialog'
import EditDispatchModal from '../components/common/EditDispatchModal'
import { formatCurrency } from '../utils/formatCurrency'
import { formatDate } from '../utils/dateHelpers'
import { useLanguage } from '../contexts/LanguageContext'
import { lf } from '../utils/localizedField'

export default function Dispatches() {
  const { t, lang } = useLanguage()
  const navigate = useNavigate()
  const { dispatches, loading, updateDispatch, deleteDispatch } = useDispatches()
  const { farms } = useFarms()
  const [farmFilter, setFarmFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [editDispatch, setEditDispatch] = useState(null)

  const filtered = dispatches.filter(d => {
    if (farmFilter && d.farm_id !== farmFilter) return false
    if (dateFrom && d.dispatch_date < dateFrom) return false
    if (dateTo && d.dispatch_date > dateTo) return false
    if (search) {
      // Match against invoice number, farm name (any language), notes, and
      // amount (as digits) so users can type "498", part of a farm name, or
      // "61550" and it lights up. Case-insensitive.
      const q = search.trim().toLowerCase()
      if (!q) return true
      const invoice = String(d.invoice_number || '').toLowerCase()
      const farmEn = (d.farms?.name    || '').toLowerCase()
      const farmFa = (d.farms?.name_fa || '').toLowerCase()
      const farmPs = (d.farms?.name_ps || '').toLowerCase()
      const notes  = (d.notes          || '').toLowerCase()
      const amount = String(d.total_amount     || '')
      const amtUsd = String(d.total_amount_usd || '')
      const hit = invoice.includes(q) || farmEn.includes(q) || farmFa.includes(q) || farmPs.includes(q) || notes.includes(q) || amount.includes(q) || amtUsd.includes(q)
      if (!hit) return false
    }
    return true
  })

  const columns = [
    {
      key: 'expand', label: '', width: '40px',
      render: r => (
        <button onClick={() => setExpanded(expanded === r.id ? null : r.id)} className="text-slate-400 hover:text-slate-600 font-mono text-lg leading-none">
          {expanded === r.id ? '−' : '+'}
        </button>
      )
    },
    {
      key: 'invoice_number', label: t('dispatches.invoice'),
      render: r => r.invoice_number
        ? <span className="font-mono font-semibold text-[#1B3A5C]">#{r.invoice_number}</span>
        : <span className="text-slate-400">—</span>
    },
    { key: 'farm', label: t('dispatches.farm'), render: r => <span className="font-medium">{lf(r.farms, 'name', lang) || '—'}</span> },
    { key: 'dispatch_date', label: t('common.date'), render: r => formatDate(r.dispatch_date) },
    { key: 'items', label: t('dispatches.items'), render: r => r.dispatch_items?.length || 0 },
    { key: 'total_amount', label: t('common.amount'), render: r => {
      const afn = r.total_amount || 0
      const usd = r.total_amount_usd || 0
      if (afn > 0 && usd > 0) return (
        <span className="font-semibold">
          <span className="text-[#1B3A5C]">{formatCurrency(afn)}</span>
          <span className="text-emerald-700 ms-1.5">+ ${usd.toFixed(2)}</span>
        </span>
      )
      if (usd > 0) return <span className="font-semibold text-emerald-700">${usd.toFixed(2)}</span>
      return <span className="font-semibold text-[#1B3A5C]">{formatCurrency(afn)}</span>
    } },
    { key: 'notes', label: t('common.notes'), render: r => r.notes || '—' },
    {
      key: 'actions', label: '',
      render: r => (
        <div className="flex items-center gap-2">
          <button onClick={() => setEditDispatch(r)} className="p-1.5 text-slate-500 hover:text-[#1B3A5C] hover:bg-slate-100 rounded"><Edit2 size={14} /></button>
          <button onClick={() => setDeleteTarget(r)} className="text-xs text-red-500 hover:text-red-700 hover:underline">{t('common.delete')}</button>
        </div>
      )
    },
  ]

  return (
    <div className="space-y-4">
      {/* Search sits on its own row so it can be wide enough to type into
          comfortably; the filters + New Dispatch button live on the row below. */}
      <div className="relative">
        <Search size={16} className="absolute inset-s-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('dispatches.searchPlaceholder')}
          className="w-full ps-9 pe-10 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute inset-e-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <select value={farmFilter} onChange={e => setFarmFilter(e.target.value)}
          className="flex-1 px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30">
          <option value="">{t('common.allFarms')}</option>
          {farms.map(f => <option key={f.id} value={f.id}>{lf(f, 'name', lang)}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          className="px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
        <button onClick={() => navigate('/dispatches/new')} className="flex items-center gap-2 px-4 py-2.5 bg-[#1B3A5C] text-white rounded-xl text-sm font-medium hover:bg-[#2E86AB] transition-colors whitespace-nowrap">
          <Plus size={16} /> {t('dispatches.newDispatch')}
        </button>
      </div>

      {filtered.length > 0 && (
        <div className="flex gap-4 text-sm text-slate-600">
          <span>{filtered.length} {t('dispatches.count')}</span>
          <span>{t('common.total')}: <strong className="text-[#1B3A5C]">{formatCurrency(filtered.reduce((s, d) => s + (d.total_amount || 0), 0))}</strong>
          {filtered.reduce((s, d) => s + (d.total_amount_usd || 0), 0) > 0 && (
            <strong className="text-emerald-700 ms-2">+ ${filtered.reduce((s, d) => s + (d.total_amount_usd || 0), 0).toFixed(2)}</strong>
          )}</span>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <div className="w-6 h-6 border-2 border-[#2E86AB] border-t-transparent rounded-full animate-spin me-3" />{t('common.loading')}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Truck size={40} className="mb-3 opacity-30" />
            <p className="text-sm">{t('dispatches.noDispatches')}</p>
            <button onClick={() => navigate('/dispatches/new')} className="mt-3 text-sm text-[#2E86AB] hover:underline">{t('dispatches.createFirst')}</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {columns.map(col => (
                    <th key={col.key} className="text-start px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap" style={col.width ? { width: col.width } : {}}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <>
                    <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      {columns.map(col => (
                        <td key={col.key} className="px-3 py-3 text-slate-700 whitespace-nowrap">
                          {col.render ? col.render(row) : row[col.key] ?? '—'}
                        </td>
                      ))}
                    </tr>
                    {expanded === row.id && row.dispatch_items?.length > 0 && (
                      <tr key={`${row.id}-exp`} className="bg-slate-50">
                        <td colSpan={columns.length} className="px-6 py-3">
                          <div className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">{t('dispatches.items')}</div>
                          <div className="space-y-1">
                            {row.dispatch_items.map(item => {
                              const sd = item.supplier_dispatches
                              const danaLabel = sd?.dana_type === '4_number'  ? '4 Number'
                                              : sd?.dana_type === '6_number'  ? '6 Number'
                                              : sd?.dana_type === '9_number'  ? '9 Number'
                                              : sd?.dana_type === '12_number' ? '12 Number'
                                              : sd?.dana_type === 'other'     ? 'Other Dana'
                                              : null
                              const danaCls = sd?.dana_type === '4_number'  ? 'bg-blue-100 text-blue-700'
                                            : sd?.dana_type === '6_number'  ? 'bg-cyan-100 text-cyan-700'
                                            : sd?.dana_type === '9_number'  ? 'bg-green-100 text-green-700'
                                            : sd?.dana_type === '12_number' ? 'bg-purple-100 text-purple-700'
                                            : 'bg-slate-100 text-slate-600'
                              return (
                                <div key={item.id} className="flex items-center gap-3 text-sm flex-wrap">
                                  <span className="text-slate-700">{item.products?.name || '—'}</span>
                                  {sd?.bill_number && (
                                    <span className="text-[11px] font-mono bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Bill #{sd.bill_number}</span>
                                  )}
                                  {danaLabel && (
                                    <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${danaCls}`}>{danaLabel}</span>
                                  )}
                                  <span className="text-slate-500 ms-auto">{t('dispatches.quantity')}: {item.quantity} {item.products?.unit || ''}</span>
                                  {item.currency === 'USD' ? (
                                    <>
                                      <span className="text-slate-500">@ ${(item.sell_price_usd_at_time || 0).toFixed(2)}</span>
                                      <span className="text-emerald-700 font-medium">${(item.total_amount_usd || 0).toFixed(2)}</span>
                                      <span className="text-emerald-600 font-medium">{t('common.profit')}: ${(item.total_profit_usd || 0).toFixed(2)}</span>
                                    </>
                                  ) : (
                                    <>
                                      <span className="text-slate-500">@ {formatCurrency(item.sell_price_at_time)}</span>
                                      <span className="text-slate-700 font-medium">{formatCurrency(item.total_amount)}</span>
                                      <span className="text-green-600 font-medium">{t('common.profit')}: {formatCurrency(item.total_profit)}</span>
                                    </>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteDispatch(deleteTarget?.id)}
        title={t('dispatches.deleteTitle')}
        message={t('dispatches.deleteMsg')}
      />

      <EditDispatchModal
        dispatch={editDispatch}
        onClose={() => setEditDispatch(null)}
        updateDispatch={updateDispatch}
      />
    </div>
  )
}
