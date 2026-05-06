import { useState } from 'react'
import { Plus, CreditCard, Edit2 } from 'lucide-react'
import { usePayments } from '../hooks/usePayments'
import { useFarms } from '../hooks/useFarms'
import Modal from '../components/common/Modal'
import ConfirmDialog from '../components/common/ConfirmDialog'
import DataTable from '../components/common/DataTable'
import { formatCurrency } from '../utils/formatCurrency'
import { formatDate, todayStr } from '../utils/dateHelpers'
import { useLanguage } from '../contexts/LanguageContext'
import { lf } from '../utils/localizedField'

const emptyForm = { farm_id: '', amount: '', payment_date: todayStr(), notes: '' }

export default function Payments() {
  const { t, lang } = useLanguage()
  const { payments, loading, recordPayment, updatePayment, deletePayment } = usePayments()
  const { farms } = useFarms()
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [farmFilter, setFarmFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  function openEdit(item) {
    setEditTarget(item)
    setForm({ farm_id: item.farm_id, amount: String(item.amount), payment_date: item.payment_date, notes: item.notes || '' })
    setModalOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    if (editTarget) {
      await updatePayment(editTarget.id, editTarget.amount, editTarget.farm_id, { ...form, amount: parseFloat(form.amount) })
    } else {
      await recordPayment({ ...form, amount: parseFloat(form.amount) })
    }
    setSaving(false)
    setModalOpen(false)
    setEditTarget(null)
    setForm(emptyForm)
  }

  const filtered = payments.filter(p => {
    if (farmFilter && p.farm_id !== farmFilter) return false
    if (dateFrom && p.payment_date < dateFrom) return false
    if (dateTo && p.payment_date > dateTo) return false
    return true
  })

  const totalFiltered = filtered.reduce((s, p) => s + (p.amount || 0), 0)
  const selectedFarm = farms.find(f => f.id === form.farm_id)

  const columns = [
    { key: 'farm', label: t('dispatches.farm'), render: r => <span className="font-medium">{lf(r.farms, 'name', lang) || '—'}</span> },
    { key: 'payment_date', label: t('common.date'), render: r => formatDate(r.payment_date) },
    { key: 'amount', label: t('common.amount'), render: r => <span className="font-semibold text-green-700">{formatCurrency(r.amount)}</span> },
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
        <button onClick={() => { setEditTarget(null); setForm(emptyForm); setModalOpen(true) }}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#1B3A5C] text-white rounded-xl text-sm font-medium hover:bg-[#2E86AB] transition-colors whitespace-nowrap">
          <Plus size={16} /> {t('payments.recordPayment')}
        </button>
      </div>

      {filtered.length > 0 && (
        <div className="text-sm text-slate-600">
          {filtered.length} {t('payments.count')} — {t('common.total')}: <strong className="text-green-700">{formatCurrency(totalFiltered)}</strong>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <div className="w-6 h-6 border-2 border-[#2E86AB] border-t-transparent rounded-full animate-spin me-3" />{t('common.loading')}
          </div>
        ) : (
          <DataTable columns={columns} data={filtered} loading={false} emptyMessage={t('payments.noPayments')} />
        )}
      </div>

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditTarget(null) }} title={editTarget ? t('payments.editPayment') : t('payments.recordPayment')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('dispatches.farm')} *</label>
            <select required value={form.farm_id} onChange={e => setForm(f => ({ ...f, farm_id: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30">
              <option value="">{t('common.selectFarm')}</option>
              {farms.map(f => <option key={f.id} value={f.id}>{lf(f, 'name', lang)}</option>)}
            </select>
          </div>
          {selectedFarm && (
            <div className="bg-slate-50 rounded-xl p-3 text-sm">
              <span className="text-slate-600">{t('payments.currentDebt')}: </span>
              <span className="font-semibold text-red-600">{formatCurrency(selectedFarm.total_debt)}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('payments.amountAFN')}</label>
              <input required type="number" min="0.01" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
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
            <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">{t('common.cancel')}</button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60">
              {saving ? t('common.saving') : editTarget ? t('common.saveChanges') : t('payments.recordPayment')}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deletePayment(deleteTarget?.id, deleteTarget?.farm_id, deleteTarget?.amount)}
        title={t('payments.deleteTitle')}
        message={`${t('payments.deleteMsg')} (${formatCurrency(deleteTarget?.amount)})`}
      />
    </div>
  )
}
