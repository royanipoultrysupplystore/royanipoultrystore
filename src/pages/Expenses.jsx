import { useState } from 'react'
import { Plus, Edit2 } from 'lucide-react'
import { useExpenses } from '../hooks/useExpenses'
import { useStoreCash } from '../contexts/StoreCashContext'
import Modal from '../components/common/Modal'
import ConfirmDialog from '../components/common/ConfirmDialog'
import DataTable from '../components/common/DataTable'
import { formatCurrency } from '../utils/formatCurrency'
import { formatDate, todayStr } from '../utils/dateHelpers'
import { useLanguage } from '../contexts/LanguageContext'
import { lf } from '../utils/localizedField'

const CATEGORIES = ['fuel', 'salary', 'rent', 'maintenance', 'utilities', 'other']
const CAT_COLORS = { fuel: 'bg-yellow-100 text-yellow-700', salary: 'bg-blue-100 text-blue-700', rent: 'bg-purple-100 text-purple-700', maintenance: 'bg-orange-100 text-orange-700', utilities: 'bg-cyan-100 text-cyan-700', other: 'bg-slate-100 text-slate-700' }
const CAT_ICONS = { fuel: '⛽', salary: '👤', rent: '🏢', maintenance: '🔧', utilities: '💡', other: '📦' }

const emptyForm = { title: '', amount: '', category: 'other', expense_date: todayStr(), notes: '' }

export default function Expenses() {
  const { t, lang } = useLanguage()
  const { expenses, loading, addExpense, updateExpense, deleteExpense } = useExpenses()
  const { recordOut, removeByReference } = useStoreCash()
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [fromStoreCash, setFromStoreCash] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [catFilter, setCatFilter] = useState('')
  const [monthFilter, setMonthFilter] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  function openEdit(item) {
    setEditTarget(item)
    setForm({ title: item.title, amount: String(item.amount), category: item.category, expense_date: item.expense_date, notes: item.notes || '' })
    setFromStoreCash(false)
    setModalOpen(true)
  }

  function openAdd() {
    setEditTarget(null)
    setForm({ ...emptyForm, expense_date: todayStr() })
    setFromStoreCash(true)
    setModalOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    if (editTarget) {
      await updateExpense(editTarget.id, { ...form, amount: parseFloat(form.amount) })
    } else {
      const created = await addExpense({ ...form, amount: parseFloat(form.amount) })
      const amt = parseFloat(form.amount) || 0
      if (fromStoreCash && amt > 0) {
        await recordOut({
          amount: amt,
          source: 'expense',
          reference_id: created?.id || null,
          note: form.title,
          date: form.expense_date,
        })
      }
    }
    setSaving(false)
    setModalOpen(false)
    setEditTarget(null)
    setForm(emptyForm)
  }

  const filtered = expenses.filter(e => {
    if (catFilter && e.category !== catFilter) return false
    if (monthFilter && !e.expense_date.startsWith(monthFilter)) return false
    return true
  })

  const monthlyCatTotals = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = filtered.filter(e => e.category === cat).reduce((s, e) => s + (e.amount || 0), 0)
    return acc
  }, {})
  const monthTotal = filtered.reduce((s, e) => s + (e.amount || 0), 0)

  const columns = [
    { key: 'title', label: t('expenses.title'), render: r => <span className="font-medium text-slate-700">{lf(r, 'title', lang)}</span> },
    {
      key: 'category', label: t('expenses.category'),
      render: r => (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CAT_COLORS[r.category] || CAT_COLORS.other}`}>
          {CAT_ICONS[r.category]} {t(`expenses.categories.${r.category}`)}
        </span>
      )
    },
    { key: 'amount', label: t('common.amount'), render: r => <span className="font-semibold text-red-700">{formatCurrency(r.amount)}</span> },
    { key: 'expense_date', label: t('common.date'), render: r => formatDate(r.expense_date) },
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
      {/* Category summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setCatFilter(catFilter === cat ? '' : cat)}
            className={`rounded-xl p-3 text-center transition-all border-2 ${catFilter === cat ? 'border-[#1B3A5C] bg-[#1B3A5C] text-white' : 'border-transparent bg-white hover:border-slate-200'}`}
          >
            <div className="text-lg">{CAT_ICONS[cat]}</div>
            <div className={`text-xs font-medium mt-0.5 ${catFilter === cat ? 'text-white' : 'text-slate-600'}`}>{t(`expenses.categories.${cat}`)}</div>
            <div className={`text-xs font-bold mt-0.5 ${catFilter === cat ? 'text-white/80' : 'text-slate-800'}`}>{formatCurrency(monthlyCatTotals[cat])}</div>
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)}
          className="px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
        <div className="flex-1" />
        <div className="text-sm text-slate-600 flex items-center">
          {t('common.total')}: <strong className="text-red-700 ms-1">{formatCurrency(monthTotal)}</strong>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#1B3A5C] text-white rounded-xl text-sm font-medium hover:bg-[#2E86AB] transition-colors whitespace-nowrap">
          <Plus size={16} /> {t('expenses.addExpense')}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
        <DataTable columns={columns} data={filtered} loading={loading} emptyMessage={t('expenses.noExpenses')} />
      </div>

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditTarget(null) }} title={editTarget ? t('expenses.editExpense') : t('expenses.addExpense')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('expenses.title')} *</label>
            <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder={t('expenses.titlePlaceholder')}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('expenses.category')}</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30">
                {CATEGORIES.map(c => <option key={c} value={c}>{CAT_ICONS[c]} {t(`expenses.categories.${c}`)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('expenses.amountAFN')}</label>
              <input required type="number" min="0.01" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.date')}</label>
            <input type="date" value={form.expense_date} onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.notes')}</label>
            <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
          </div>
          {!editTarget && (
            <label className="flex items-center gap-2 text-sm text-slate-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 cursor-pointer">
              <input type="checkbox" checked={fromStoreCash} onChange={e => setFromStoreCash(e.target.checked)} className="rounded text-red-600" />
              <span>{t('storeCash.fromStoreCash')}</span>
            </label>
          )}
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">{t('common.cancel')}</button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium bg-[#1B3A5C] text-white rounded-lg hover:bg-[#2E86AB] disabled:opacity-60">
              {saving ? t('common.saving') : editTarget ? t('common.saveChanges') : t('expenses.addExpense')}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          const id = deleteTarget?.id
          await deleteExpense(id)
          if (id) await removeByReference({ source: 'expense', reference_id: id })
        }}
        title={t('expenses.deleteTitle')}
        message={`${t('expenses.deleteMsg')} "${deleteTarget?.title}"`}
      />
    </div>
  )
}
