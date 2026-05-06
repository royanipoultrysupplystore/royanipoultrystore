import { useState } from 'react'
import { Plus, Trash2, ShoppingBag, Edit2 } from 'lucide-react'
import { useSupplyPayments } from '../hooks/useSupplyPayments'
import { useFarms } from '../hooks/useFarms'
import Modal from '../components/common/Modal'
import ConfirmDialog from '../components/common/ConfirmDialog'
import { formatCurrency } from '../utils/formatCurrency'
import { formatDate, todayStr } from '../utils/dateHelpers'
import { useLanguage } from '../contexts/LanguageContext'
import { lf } from '../utils/localizedField'

const SUPPLY_ITEMS = ['Sugar', 'Coal', 'Wood Flour', 'Other']

const emptyForm = {
  farm_id: '',
  supply_item: 'Sugar',
  other_item: '',
  amount: '',
  payment_date: todayStr(),
  notes: '',
}

export default function SupplyPayments() {
  const { t, lang } = useLanguage()
  const { supplyPayments, loading, addSupplyPayment, updateSupplyPayment, deleteSupplyPayment } = useSupplyPayments()
  const { farms } = useFarms()
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [filterFarm, setFilterFarm] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  function openAdd() { setEditTarget(null); setForm(emptyForm); setModalOpen(true) }

  function openEdit(item) {
    setEditTarget(item)
    const isCustom = !SUPPLY_ITEMS.slice(0, -1).includes(item.supply_item)
    setForm({
      farm_id: item.farm_id,
      supply_item: isCustom ? 'Other' : item.supply_item,
      other_item: isCustom ? item.supply_item : '',
      amount: String(item.amount),
      payment_date: item.payment_date,
      notes: item.notes || '',
    })
    setModalOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.farm_id) return
    setSaving(true)
    const supplyItem = form.supply_item === 'Other' ? form.other_item.trim() : form.supply_item
    if (!supplyItem) { setSaving(false); return }
    const payload = { farm_id: form.farm_id, supply_item: supplyItem, amount: parseFloat(form.amount), payment_date: form.payment_date, notes: form.notes || null }
    const ok = editTarget
      ? await updateSupplyPayment(editTarget.id, editTarget, payload)
      : await addSupplyPayment(payload)
    setSaving(false)
    if (ok) { setModalOpen(false); setEditTarget(null) }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    await deleteSupplyPayment(deleteTarget.id, deleteTarget.farm_id, deleteTarget.amount)
    setDeleteTarget(null)
  }

  const filtered = supplyPayments.filter(p => {
    if (filterFarm && p.farm_id !== filterFarm) return false
    if (dateFrom && p.payment_date < dateFrom) return false
    if (dateTo && p.payment_date > dateTo) return false
    return true
  })

  const totalAmount = filtered.reduce((s, p) => s + (p.amount || 0), 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
        <select
          value={filterFarm}
          onChange={e => setFilterFarm(e.target.value)}
          className="px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30 min-w-45"
        >
          <option value="">{t('common.allFarms')}</option>
          {farms.map(f => <option key={f.id} value={f.id}>{lf(f, 'name', lang)}</option>)}
        </select>

        <div className="flex items-center gap-2">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
          <span className="text-slate-400 text-sm">{t('common.to')}</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo('') }} className="text-xs text-slate-400 hover:text-slate-600 underline">
              {t('common.clear')}
            </button>
          )}
        </div>

        <div className="flex-1" />

        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 bg-[#1B3A5C] text-white rounded-xl text-sm font-medium hover:bg-[#2E86AB] transition-colors">
          <Plus size={16} /> {t('supply.recordPayment')}
        </button>
      </div>

      <div className="bg-[#1B3A5C] rounded-2xl p-5 text-white flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
          <ShoppingBag size={24} />
        </div>
        <div>
          <p className="text-white/60 text-sm">{t('supply.totalSupply')} {filterFarm ? `(${t('common.all')})` : ''}</p>
          <p className="text-3xl font-bold">{formatCurrency(totalAmount)}</p>
        </div>
        <div className="ms-auto text-end">
          <p className="text-white/60 text-sm">{t('supply.records')}</p>
          <p className="text-2xl font-bold">{filtered.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400">{t('common.loading')}</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <ShoppingBag size={40} className="mx-auto text-slate-200 mb-3" />
            <p className="text-slate-400">{t('supply.noPayments')}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-start px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('common.date')}</th>
                <th className="text-start px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('dispatches.farm')}</th>
                <th className="text-start px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('supply.supplyItem')}</th>
                <th className="text-start px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('common.notes')}</th>
                <th className="text-end px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('common.amount')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-600">{formatDate(p.payment_date)}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{lf(p.farms, 'name', lang) || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                      {t(`supply.items.${p.supply_item}`) !== `supply.items.${p.supply_item}` ? t(`supply.items.${p.supply_item}`) : p.supply_item}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{p.notes || '—'}</td>
                  <td className="px-4 py-3 text-end font-bold text-[#1B3A5C]">{formatCurrency(p.amount)}</td>
                  <td className="px-4 py-3 text-end">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(p)} className="p-1.5 text-slate-400 hover:text-[#1B3A5C] hover:bg-slate-100 rounded"><Edit2 size={15} /></button>
                      <button onClick={() => setDeleteTarget(p)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50">
                <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-slate-600">{t('common.total')}</td>
                <td className="px-4 py-3 text-end font-bold text-[#1B3A5C]">{formatCurrency(totalAmount)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditTarget(null) }} title={editTarget ? t('supply.editPayment') : t('supply.recordPayment')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {t('supply.debtNote')}
          </p>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('dispatches.farm')} *</label>
            <select required value={form.farm_id} onChange={e => setForm(f => ({ ...f, farm_id: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30">
              <option value="">{t('common.selectFarm')}</option>
              {farms.filter(f => f.is_active).map(f => (
                <option key={f.id} value={f.id}>{lf(f, 'name', lang)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('supply.supplyItem')} *</label>
            <select value={form.supply_item} onChange={e => setForm(f => ({ ...f, supply_item: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30">
              {SUPPLY_ITEMS.map(item => <option key={item} value={item}>{t(`supply.items.${item}`)}</option>)}
            </select>
          </div>
          {form.supply_item === 'Other' && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('supply.specifyItem')} *</label>
              <input required value={form.other_item} onChange={e => setForm(f => ({ ...f, other_item: e.target.value }))}
                placeholder={t('supply.specifyPlaceholder')}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('supply.amountAFN')}</label>
              <input required type="number" min="1" step="0.01" value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.date')}</label>
              <input type="date" value={form.payment_date} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.notes')}</label>
            <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30 resize-none" />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">{t('common.cancel')}</button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium bg-[#1B3A5C] text-white rounded-lg hover:bg-[#2E86AB] disabled:opacity-60">
              {saving ? t('common.saving') : editTarget ? t('common.saveChanges') : t('supply.recordPayment')}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title={t('supply.deleteTitle')}
        message={`${formatCurrency(deleteTarget?.amount)} — ${t('supply.supplyItem')}: ${deleteTarget?.supply_item}`}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  )
}
