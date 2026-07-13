import { useState } from 'react'
import { Plus, CreditCard, Edit2 } from 'lucide-react'
import { usePayments } from '../hooks/usePayments'
import { useFarms } from '../hooks/useFarms'
import { useStoreCash } from '../contexts/StoreCashContext'
import { useStoreCashLock } from '../contexts/StoreCashLockContext'
import Modal from '../components/common/Modal'
import ConfirmDialog from '../components/common/ConfirmDialog'
import DataTable from '../components/common/DataTable'
import { formatCurrency } from '../utils/formatCurrency'
import { formatDate, todayStr } from '../utils/dateHelpers'
import { useLanguage } from '../contexts/LanguageContext'
import { lf } from '../utils/localizedField'

const emptyForm = { farm_id: '', amount: '', payment_date: todayStr(), notes: '', currency: 'AFN' }

export default function Payments() {
  const { t, lang } = useLanguage()
  const { payments, loading, recordPayment, updatePayment, deletePayment } = usePayments()
  const { farms } = useFarms()
  const { recordIn, removeByReference } = useStoreCash()
  const { requestUncheck } = useStoreCashLock()
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [toStoreCash, setToStoreCash] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [farmFilter, setFarmFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  function openEdit(item) {
    setEditTarget(item)
    const currency = item.currency === 'USD' ? 'USD' : 'AFN'
    setForm({
      farm_id: item.farm_id,
      amount: String(currency === 'USD' ? (item.amount_usd || 0) : item.amount),
      payment_date: item.payment_date,
      notes: item.notes || '',
      currency,
    })
    setToStoreCash(false) // edit path — don't re-post to store cash; user has to manually recreate the till entry
    setModalOpen(true)
  }

  function openAdd() {
    setEditTarget(null)
    setForm(emptyForm)
    setToStoreCash(true)
    setModalOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const paid = parseFloat(form.amount) || 0
    const currency = form.currency === 'USD' ? 'USD' : 'AFN'
    if (editTarget) {
      // Preserve original currency on edit — we don't allow flipping currency
      // mid-edit because the debt reversal math would need to handle both
      // sides. Users can delete + re-record to change currency.
      const editCurrency = editTarget.currency === 'USD' ? 'USD' : 'AFN'
      await updatePayment(editTarget.id, editCurrency === 'USD' ? (editTarget.amount_usd || 0) : editTarget.amount, editTarget.farm_id, {
        ...form,
        currency: editCurrency,
        amount: editCurrency === 'AFN' ? paid : 0,
        amount_usd: editCurrency === 'USD' ? paid : 0,
      })
    } else {
      const created = await recordPayment({
        farm_id: form.farm_id,
        currency,
        amount: currency === 'AFN' ? paid : 0,
        amount_usd: currency === 'USD' ? paid : 0,
        payment_date: form.payment_date,
        notes: form.notes,
      })
      if (toStoreCash && paid > 0 && created) {
        const farmName = lf(farms.find(f => f.id === form.farm_id), 'name', lang) || 'Farm'
        await recordIn({
          amount: paid,
          currency,
          source: 'payment',
          reference_id: created?.id || null,
          note: farmName,
          date: form.payment_date,
        })
      }
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
    { key: 'amount', label: t('common.amount'), render: r => (
      r.currency === 'USD'
        ? <span className="font-semibold text-emerald-700">${(r.amount_usd || 0).toFixed(2)}</span>
        : <span className="font-semibold text-green-700">{formatCurrency(r.amount)}</span>
    ) },
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
        <button onClick={openAdd}
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
            <div className="bg-slate-50 rounded-xl p-3 text-sm space-y-0.5">
              <div>
                <span className="text-slate-600">{t('payments.currentDebt')}: </span>
                <span className="font-semibold text-red-600">{formatCurrency(selectedFarm.total_debt || 0)}</span>
              </div>
              {(selectedFarm.total_debt_usd || 0) > 0 && (
                <div>
                  <span className="text-slate-600">$ {t('payments.currentDebt')} (USD): </span>
                  <span className="font-semibold text-red-600">${(selectedFarm.total_debt_usd || 0).toFixed(2)}</span>
                </div>
              )}
            </div>
          )}
          {/* Currency selector — AFN payment reduces AFN debt, USD payment reduces USD debt. Locked on edit. */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Currency *</label>
            <div className="grid grid-cols-2 gap-2">
              <label className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors ${form.currency === 'AFN' ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'} ${editTarget ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
                <input type="radio" name="pay-currency" value="AFN" disabled={!!editTarget}
                  checked={form.currency === 'AFN'}
                  onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} className="sr-only" />
                ؋ AFN
              </label>
              <label className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors ${form.currency === 'USD' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'} ${editTarget ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
                <input type="radio" name="pay-currency" value="USD" disabled={!!editTarget}
                  checked={form.currency === 'USD'}
                  onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} className="sr-only" />
                $ USD
              </label>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.amount')} ({form.currency})</label>
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
          {!editTarget && (
            <label className="flex items-center gap-2 text-sm text-slate-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 cursor-pointer">
              <input type="checkbox" checked={toStoreCash} onChange={e => { if (e.target.checked) setToStoreCash(true); else requestUncheck(() => setToStoreCash(false)) }} className="rounded text-green-600" />
              <span>{t('storeCash.toStoreCash')}</span>
            </label>
          )}
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
        onConfirm={async () => {
          const id = deleteTarget?.id
          const currency = deleteTarget?.currency === 'USD' ? 'USD' : 'AFN'
          await deletePayment(id, deleteTarget?.farm_id, deleteTarget?.amount, currency, deleteTarget?.amount_usd)
          if (id) await removeByReference({ source: 'payment', reference_id: id })
        }}
        title={t('payments.deleteTitle')}
        message={`${t('payments.deleteMsg')} (${deleteTarget?.currency === 'USD' ? `$${(deleteTarget?.amount_usd || 0).toFixed(2)}` : formatCurrency(deleteTarget?.amount)})`}
      />
    </div>
  )
}
