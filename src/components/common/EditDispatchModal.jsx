import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import Modal from './Modal'
import { formatCurrency } from '../../utils/formatCurrency'
import { useLanguage } from '../../contexts/LanguageContext'
import { lf } from '../../utils/localizedField'

// Shared edit-dispatch modal — used on the Dispatches page and on the Dispatches
// tab inside a farm profile. Pass `dispatch` (null when closed) and `updateDispatch`
// from the useDispatches() hook.
export default function EditDispatchModal({ dispatch, onClose, updateDispatch }) {
  const { t, lang } = useLanguage()
  const [editForm, setEditForm] = useState({ dispatch_date: '', notes: '' })
  const [editItems, setEditItems] = useState([])
  const [saving, setSaving] = useState(false)

  // Prefill when a new dispatch comes in
  useEffect(() => {
    if (!dispatch) return
    setEditForm({ dispatch_date: dispatch.dispatch_date, notes: dispatch.notes || '' })
    setEditItems((dispatch.dispatch_items || []).map(item => ({
      ...item,
      quantity: String(item.quantity),
      sell_price_at_time: String(item.sell_price_at_time),
      purchase_price_at_time: String(item.purchase_price_at_time),
    })))
  }, [dispatch])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const ok = await updateDispatch(dispatch.id, dispatch, editForm, editItems)
    setSaving(false)
    if (ok) onClose()
  }

  return (
    <Modal
      open={!!dispatch}
      onClose={onClose}
      title={`${t('dispatches.editDispatch')} ${dispatch?.invoice_number ? `#${dispatch.invoice_number}` : ''}`}
      size="lg"
    >
      {dispatch && (
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('dispatches.farm')}</label>
              <p className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700">{lf(dispatch.farms, 'name', lang) || '—'}</p>
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
            <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
              <table className="w-full text-sm min-w-[480px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-start px-3 py-2 text-xs font-semibold text-slate-500">{t('dispatches.product')}</th>
                    <th className="text-start px-3 py-2 text-xs font-semibold text-slate-500 w-24">{t('dispatches.quantity')}</th>
                    <th className="text-start px-3 py-2 text-xs font-semibold text-slate-500 w-32">{t('dispatches.sellPrice')}</th>
                    <th className="text-end px-3 py-2 text-xs font-semibold text-slate-500 w-28">{t('common.total')}</th>
                    <th className="w-10"></th>
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
                        <td className="px-2 py-2 text-end">
                          <button
                            type="button"
                            disabled={editItems.length <= 1}
                            onClick={() => setEditItems(items => items.filter((_, i) => i !== idx))}
                            title={editItems.length <= 1 ? 'A dispatch needs at least one item' : 'Remove this item'}
                            className="p-1.5 rounded text-slate-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 disabled:cursor-not-allowed transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
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
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="text-xs text-slate-400 mt-1">{t('dispatches.costNote')}</p>
          </div>

          <div className="flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">{t('common.cancel')}</button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium bg-[#1B3A5C] text-white rounded-lg hover:bg-[#2E86AB] disabled:opacity-60">
              {saving ? t('common.saving') : t('common.saveChanges')}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
