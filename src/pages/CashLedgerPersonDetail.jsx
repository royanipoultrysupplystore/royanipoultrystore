import { useState, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, Plus, Edit2, Trash2, Phone, Banknote } from 'lucide-react'
import { useCashLedger } from '../hooks/useCashLedger'
import Modal from '../components/common/Modal'
import ConfirmDialog from '../components/common/ConfirmDialog'
import PhoneInput from '../components/common/PhoneInput'
import { formatCurrency } from '../utils/formatCurrency'
import { formatDate, todayStr } from '../utils/dateHelpers'
import { useLanguage } from '../contexts/LanguageContext'
import toast from 'react-hot-toast'

// Cash Ledger person profile. Each person is treated like a running bank/supplier
// account: a permanent profile that survives a zero balance. From here the user
// can open a new transaction in either direction:
//   - LENT (قرض ورکول): client gives money to the person → green (they owe us)
//   - BORROWED (قرض اخیستل): client takes money from the person → red (we owe them)
//
// The colors match the Pashto meaning: قرض ورکول = giving a loan (they owe us);
// قرض اخیستل = taking a loan (we owe them).
export default function CashLedgerPersonDetail() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { t } = useLanguage()
  const { persons, loading, addTransaction, updateTransaction, deleteTransaction } = useCashLedger()

  const person = useMemo(() => {
    if (!persons) return null
    const key = decodeURIComponent(slug || '').toLowerCase()
    return persons.find(p => p.name.toLowerCase() === key) || null
  }, [persons, slug])

  const [modal, setModal] = useState(false)
  const [editTx, setEditTx] = useState(null)
  const [form, setForm] = useState({ amount: '', type: 'lent', note: '', transaction_date: todayStr(), phone: '' })
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  function openAdd(type) {
    setEditTx(null)
    setForm({ amount: '', type, note: '', transaction_date: todayStr(), phone: person?.phone || '' })
    setModal(true)
  }

  function openEdit(tx) {
    setEditTx(tx)
    setForm({
      amount: String(tx.amount),
      type: tx.type,
      note: tx.note || '',
      transaction_date: tx.transaction_date,
      phone: tx.phone || person?.phone || '',
    })
    setModal(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!(parseFloat(form.amount) > 0)) { toast.error(t('cashLedger.amountRequired')); return }
    setSaving(true)
    const payload = {
      person_name: person.name,
      phone: form.phone,
      amount: form.amount,
      type: form.type,
      note: form.note,
      transaction_date: form.transaction_date,
    }
    const ok = editTx
      ? await updateTransaction(editTx.id, payload)
      : await addTransaction(payload)
    setSaving(false)
    if (ok) { setModal(false); setEditTx(null) }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400">
      <div className="w-8 h-8 border-2 border-[#2E86AB] border-t-transparent rounded-full animate-spin me-3" />
      {t('common.loading')}
    </div>
  )

  if (!person) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <Banknote size={40} className="mx-auto mb-3 text-slate-200" />
        <p className="text-sm text-slate-500 mb-3">{t('cashLedger.profileNotFound')}</p>
        <Link to="/cash-ledger" className="text-sm text-[#2E86AB] hover:underline">{t('cashLedger.backToList')}</Link>
      </div>
    )
  }

  const net = person.lent - person.borrowed
  const owesUs = net > 0
  const weOwe = net < 0
  const settled = net === 0

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Back */}
      <Link to="/cash-ledger" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={16} /> {t('cashLedger.backToList')}
      </Link>

      {/* Person header */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-[#1B3A5C]/10 text-[#1B3A5C] flex items-center justify-center font-bold text-lg shrink-0">
          {person.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-bold text-slate-800 truncate">{person.name}</p>
          {person.phone && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
              <Phone size={11} />
              <span dir="ltr">{person.phone}</span>
            </div>
          )}
        </div>
      </div>

      {/* Balance summary */}
      <div className={`rounded-2xl border p-5 ${owesUs ? 'bg-green-50 border-green-200' : weOwe ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
        <p className={`text-xs font-medium uppercase tracking-wide mb-1 ${owesUs ? 'text-green-700' : weOwe ? 'text-red-700' : 'text-slate-500'}`}>
          {owesUs ? t('cashLedger.owesUs') : weOwe ? t('cashLedger.weOwe') : t('cashLedger.settled')}
        </p>
        <p className={`text-3xl font-bold ${owesUs ? 'text-green-800' : weOwe ? 'text-red-800' : 'text-slate-500'}`}>
          {settled ? formatCurrency(0) : formatCurrency(Math.abs(net))}
        </p>
        <div className="flex gap-3 mt-4">
          <div className="flex-1 bg-white/60 rounded-lg px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-green-700">{t('cashLedger.totalLent')}</p>
            <p className="text-sm font-bold text-green-700">{formatCurrency(person.lent)}</p>
          </div>
          <div className="flex-1 bg-white/60 rounded-lg px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-red-700">{t('cashLedger.totalBorrowed')}</p>
            <p className="text-sm font-bold text-red-700">{formatCurrency(person.borrowed)}</p>
          </div>
        </div>
      </div>

      {/* Two big action buttons — bilingual labels so the user can act
          quickly without reading the description. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => openAdd('lent')}
          className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-green-600 text-white hover:bg-green-700 transition-colors shadow-sm"
        >
          <div className="p-2 rounded-lg bg-white/15">
            <ArrowDownLeft size={18} />
          </div>
          <div className="text-start">
            <p className="text-sm font-semibold">{t('cashLedger.lent')}</p>
            <p className="text-xs opacity-90" dir="rtl">قرض ورکول</p>
          </div>
        </button>
        <button
          onClick={() => openAdd('borrowed')}
          className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-red-600 text-white hover:bg-red-700 transition-colors shadow-sm"
        >
          <div className="p-2 rounded-lg bg-white/15">
            <ArrowUpRight size={18} />
          </div>
          <div className="text-start">
            <p className="text-sm font-semibold">{t('cashLedger.borrowed')}</p>
            <p className="text-xs opacity-90" dir="rtl">قرض اخیستل</p>
          </div>
        </button>
      </div>

      {/* Settle convenience buttons — only show when there IS an outstanding
          balance. They map to the same transaction types but use settlement
          labels (Make Payment / Receive Payment) so the user thinks in
          repayment terms. */}
      {!settled && (
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
            {t('cashLedger.settleBalance')}
          </p>
          {owesUs ? (
            <button
              onClick={() => openAdd('borrowed')}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-green-100 hover:bg-green-200 text-green-800 font-semibold text-sm"
            >
              <ArrowDownLeft size={15} />
              <span>{t('cashLedger.receivePayment')}</span>
              <span className="text-xs opacity-70" dir="rtl">· ترلاسه کول</span>
            </button>
          ) : (
            <button
              onClick={() => openAdd('lent')}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-100 hover:bg-red-200 text-red-800 font-semibold text-sm"
            >
              <ArrowUpRight size={15} />
              <span>{t('cashLedger.makePayment')}</span>
              <span className="text-xs opacity-70" dir="rtl">· ادایګي</span>
            </button>
          )}
        </div>
      )}

      {/* Running transaction history */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700">{t('cashLedger.history')}</h3>
          <span className="text-xs text-slate-400">{person.transactions.length} {person.transactions.length === 1 ? t('cashLedger.entry') : t('cashLedger.entries')}</span>
        </div>
        {person.transactions.length === 0 ? (
          <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl py-6 text-center text-sm text-slate-400">
            {t('cashLedger.noTransactions')}
          </div>
        ) : (
          <div className="space-y-2">
            {person.transactions.map(tx => (
              <div
                key={tx.id}
                className={`bg-white rounded-xl border px-4 py-3 flex items-start gap-3 ${tx.type === 'lent' ? 'border-green-100' : 'border-red-100'}`}
              >
                <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${tx.type === 'lent' ? 'bg-green-100' : 'bg-red-100'}`}>
                  {tx.type === 'lent'
                    ? <ArrowDownLeft size={14} className="text-green-600" />
                    : <ArrowUpRight size={14} className="text-red-600" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tx.type === 'lent' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {tx.type === 'lent' ? t('cashLedger.lent') : t('cashLedger.borrowed')}
                    </span>
                    <span className={`text-[10px] font-semibold ${tx.type === 'lent' ? 'text-green-700' : 'text-red-700'}`} dir="rtl">
                      {tx.type === 'lent' ? 'قرض ورکول' : 'قرض اخیستل'}
                    </span>
                    <span className="text-xs text-slate-400">{formatDate(tx.transaction_date)}</span>
                  </div>
                  {tx.note && <p className="text-sm text-slate-600 mt-1">{tx.note}</p>}
                </div>
                <div className="text-end shrink-0">
                  <p className={`text-base font-bold ${tx.type === 'lent' ? 'text-green-600' : 'text-red-600'}`}>
                    {tx.type === 'lent' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </p>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button onClick={() => openEdit(tx)} className="p-1.5 text-slate-400 hover:text-[#1B3A5C] hover:bg-slate-100 rounded-lg">
                    <Edit2 size={13} />
                  </button>
                  <button onClick={() => setDeleteTarget(tx)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit transaction modal */}
      <Modal
        open={modal}
        onClose={() => { setModal(false); setEditTx(null) }}
        title={editTx ? t('cashLedger.editTransaction') : (form.type === 'lent' ? t('cashLedger.lent') + ' · قرض ورکول' : t('cashLedger.borrowed') + ' · قرض اخیستل')}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 cursor-pointer transition-all text-sm font-medium select-none
              ${form.type === 'lent' ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
              <input type="radio" name="type" value="lent" className="sr-only"
                checked={form.type === 'lent'} onChange={() => setForm(f => ({ ...f, type: 'lent' }))} />
              <ArrowDownLeft size={15} className={form.type === 'lent' ? 'text-green-600' : 'text-slate-400'} />
              <div className="flex-1 min-w-0">
                <div className="truncate">{t('cashLedger.lent')}</div>
                <div className="text-[11px] font-normal opacity-70" dir="rtl">قرض ورکول</div>
              </div>
            </label>
            <label className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 cursor-pointer transition-all text-sm font-medium select-none
              ${form.type === 'borrowed' ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
              <input type="radio" name="type" value="borrowed" className="sr-only"
                checked={form.type === 'borrowed'} onChange={() => setForm(f => ({ ...f, type: 'borrowed' }))} />
              <ArrowUpRight size={15} className={form.type === 'borrowed' ? 'text-red-600' : 'text-slate-400'} />
              <div className="flex-1 min-w-0">
                <div className="truncate">{t('cashLedger.borrowed')}</div>
                <div className="text-[11px] font-normal opacity-70" dir="rtl">قرض اخیستل</div>
              </div>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.amount')} (AFN) *</label>
              <input
                required type="number" min="0.01" step="0.01"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.date')}</label>
              <input
                type="date" value={form.transaction_date}
                onChange={e => setForm(f => ({ ...f, transaction_date: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('cashLedger.phone')}</label>
              <PhoneInput value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.notes')}</label>
              <input
                value={form.note}
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                placeholder={t('cashLedger.notePlaceholder')}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={() => { setModal(false); setEditTx(null) }}
              className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={saving}
              className={`px-5 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-60 transition-colors
                ${form.type === 'lent' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
              {saving ? t('common.saving') : editTx ? t('common.saveChanges') : t('cashLedger.record')}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { deleteTransaction(deleteTarget.id); setDeleteTarget(null) }}
        title={t('cashLedger.deleteTitle')}
        message={t('cashLedger.deleteConfirm')}
      />
    </div>
  )
}
