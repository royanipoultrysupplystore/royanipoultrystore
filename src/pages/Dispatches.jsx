import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Truck, Edit2 } from 'lucide-react'
import { useDispatches } from '../hooks/useDispatches'
import { useFarms } from '../hooks/useFarms'
import ConfirmDialog from '../components/common/ConfirmDialog'
import Modal from '../components/common/Modal'
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
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [editDispatch, setEditDispatch] = useState(null)
  const [editForm, setEditForm] = useState({ dispatch_date: '', notes: '' })
  const [editItems, setEditItems] = useState([])
  const [saving, setSaving] = useState(false)

  function openEdit(dispatch) {
    setEditDispatch(dispatch)
    setEditForm({ dispatch_date: dispatch.dispatch_date, notes: dispatch.notes || '' })
    setEditItems((dispatch.dispatch_items || []).map(item => ({
      ...item,
      quantity: String(item.quantity),
      sell_price_at_time: String(item.sell_price_at_time),
      purchase_price_at_time: String(item.purchase_price_at_time),
    })))
  }

  async function handleEditSave(e) {
    e.preventDefault()
    setSaving(true)
    await updateDispatch(editDispatch.id, editDispatch, editForm, editItems)
    setSaving(false)
    setEditDispatch(null)
  }

  const filtered = dispatches.filter(d => {
    if (farmFilter && d.farm_id !== farmFilter) return false
    if (dateFrom && d.dispatch_date < dateFrom) return false
    if (dateTo && d.dispatch_date > dateTo) return false
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
    { key: 'total_amount', label: t('common.amount'), render: r => <span className="font-semibold text-[#1B3A5C]">{formatCurrency(r.total_amount)}</span> },
    { key: 'notes', label: t('common.notes'), render: r => r.notes || '—' },
    {
      key: 'actions', label: '',
      render: r => (
        <div className="flex items-center gap-2">
          <button onClick={() => openEdit(r)} className="p-1.5 text-slate-500 hover:text-[#1B3A5C] hover:bg-slate-100 rounded"><Edit2 size={14} /></button>
          <button onClick={() => setDeleteTarget(r)} className="text-xs text-red-500 hover:text-red-700 hover:underline">{t('common.delete')}</button>
        </div>
      )
    },
  ]

  return (
    <div className="space-y-4">
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
          <span>{t('common.total')}: <strong className="text-[#1B3A5C]">{formatCurrency(filtered.reduce((s, d) => s + (d.total_amount || 0), 0))}</strong></span>
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
                            {row.dispatch_items.map(item => (
                              <div key={item.id} className="flex items-center gap-4 text-sm">
                                <span className="text-slate-700 flex-1">{item.products?.name || '—'}</span>
                                <span className="text-slate-500">{t('dispatches.quantity')}: {item.quantity} {item.products?.unit || ''}</span>
                                <span className="text-slate-500">@ {formatCurrency(item.sell_price_at_time)}</span>
                                <span className="text-slate-700 font-medium">{formatCurrency(item.total_amount)}</span>
                                <span className="text-green-600 font-medium">{t('common.profit')}: {formatCurrency(item.total_profit)}</span>
                              </div>
                            ))}
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

      <Modal open={!!editDispatch} onClose={() => setEditDispatch(null)} title={`${t('dispatches.editDispatch')} ${editDispatch?.invoice_number ? `#${editDispatch.invoice_number}` : ''}`} size="lg">
        {editDispatch && (
          <form onSubmit={handleEditSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('dispatches.farm')}</label>
                <p className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700">{lf(editDispatch.farms, 'name', lang) || '—'}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.date')}</label>
                <input type="date" value={editForm.dispatch_date} onChange={e => setEditForm(f => ({ ...f, dispatch_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.notes')}</label>
              <input value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">{t('dispatches.items')}</label>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-start px-3 py-2 text-xs font-semibold text-slate-500">{t('dispatches.product')}</th>
                      <th className="text-start px-3 py-2 text-xs font-semibold text-slate-500 w-24">{t('dispatches.quantity')}</th>
                      <th className="text-start px-3 py-2 text-xs font-semibold text-slate-500 w-32">{t('dispatches.sellPrice')}</th>
                      <th className="text-end px-3 py-2 text-xs font-semibold text-slate-500 w-28">{t('common.total')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {editItems.map((item, idx) => {
                      const total = parseFloat(item.quantity || 0) * parseFloat(item.sell_price_at_time || 0)
                      return (
                        <tr key={item.id || idx}>
                          <td className="px-3 py-2 text-slate-700 font-medium">{item.products?.name || '—'}</td>
                          <td className="px-3 py-2">
                            <input type="number" min="0.01" step="0.01" value={item.quantity}
                              onChange={e => setEditItems(items => items.map((it, i) => i === idx ? { ...it, quantity: e.target.value } : it))}
                              className="w-full px-2 py-1 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" min="0" step="0.01" value={item.sell_price_at_time}
                              onChange={e => setEditItems(items => items.map((it, i) => i === idx ? { ...it, sell_price_at_time: e.target.value } : it))}
                              className="w-full px-2 py-1 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
                          </td>
                          <td className="px-3 py-2 text-end font-semibold text-slate-700">{formatCurrency(total)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                    <tr>
                      <td colSpan={3} className="px-3 py-2 text-xs font-semibold text-slate-600">{t('dispatches.newTotal')}</td>
                      <td className="px-3 py-2 text-end font-bold text-[#1B3A5C]">
                        {formatCurrency(editItems.reduce((s, it) => s + parseFloat(it.quantity || 0) * parseFloat(it.sell_price_at_time || 0), 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="text-xs text-slate-400 mt-1">{t('dispatches.costNote')}</p>
            </div>

            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setEditDispatch(null)} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">{t('common.cancel')}</button>
              <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium bg-[#1B3A5C] text-white rounded-lg hover:bg-[#2E86AB] disabled:opacity-60">
                {saving ? t('common.saving') : t('common.saveChanges')}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
