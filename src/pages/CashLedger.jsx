import { useState } from 'react'
import { Banknote, Plus, ChevronDown, ChevronUp, Edit2, Trash2, ArrowUpRight, ArrowDownLeft, Phone } from 'lucide-react'
import { useCashLedger } from '../hooks/useCashLedger'
import Modal from '../components/common/Modal'
import ConfirmDialog from '../components/common/ConfirmDialog'
import PhoneInput from '../components/common/PhoneInput'
import WhatsAppPromptDialog from '../components/common/WhatsAppPromptDialog'
import { formatCurrency, formatNumber } from '../utils/formatCurrency'
import { formatDate, todayStr } from '../utils/dateHelpers'
import { useLanguage } from '../contexts/LanguageContext'
import toast from 'react-hot-toast'

const emptyForm = { person_name: '', phone: '', amount: '', type: 'lent', note: '', transaction_date: todayStr() }

export default function CashLedger() {
  const { t } = useLanguage()
  const { persons, loading, totalLent, totalBorrowed, addTransaction, updateTransaction, deleteTransaction } = useCashLedger()

  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [editTx, setEditTx] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [settleTarget, setSettleTarget] = useState(null)
  const [settleForm, setSettleForm] = useState({ amount: '', transaction_date: todayStr(), note: '' })
  const [waPrompt, setWaPrompt] = useState(null)

  // Build the WhatsApp prompt for a cash ledger entry.
  function cashWaPrompt({ name, phone, type, amount, date, net }) {
    return {
      templateKey: type === 'lent' ? 'cash_given' : 'cash_received',
      variables: {
        name,
        amount: formatNumber(amount),
        date,
        balance: formatNumber(Math.abs(net)),
      },
      recipient: { name, phone },
    }
  }

  const filtered = search
    ? persons.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || (p.phone || '').includes(search))
    : persons

  function openAdd() {
    setEditTx(null)
    setForm({ ...emptyForm, transaction_date: todayStr() })
    setModal(true)
  }

  function openEdit(tx) {
    setEditTx(tx)
    setForm({
      person_name: tx.person_name,
      phone: tx.phone || '',
      amount: String(tx.amount),
      type: tx.type,
      note: tx.note || '',
      transaction_date: tx.transaction_date,
    })
    setModal(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.person_name.trim()) { toast.error(t('cashLedger.nameRequired')); return }
    if (!parseFloat(form.amount) > 0) { toast.error(t('cashLedger.amountRequired')); return }
    setSaving(true)
    const ok = editTx
      ? await updateTransaction(editTx.id, form)
      : await addTransaction(form)
    setSaving(false)
    if (ok) {
      if (!editTx) {
        const amt = parseFloat(form.amount) || 0
        const existing = persons.find(p => p.name.trim().toLowerCase() === form.person_name.trim().toLowerCase())
        const newLent = (existing?.lent || 0) + (form.type === 'lent' ? amt : 0)
        const newBorrowed = (existing?.borrowed || 0) + (form.type === 'borrowed' ? amt : 0)
        setWaPrompt(cashWaPrompt({
          name: form.person_name.trim(),
          phone: form.phone,
          type: form.type,
          amount: amt,
          date: form.transaction_date,
          net: newLent - newBorrowed,
        }))
      }
      setModal(false); setEditTx(null); setForm(emptyForm)
    }
  }

  function openSettle(person) {
    const net = person.lent - person.borrowed
    const isReceiving = net > 0
    setSettleTarget({ ...person, isReceiving, outstanding: Math.abs(net) })
    setSettleForm({
      amount: '',
      transaction_date: todayStr(),
      note: isReceiving ? t('cashLedger.receivedRepayment') : t('cashLedger.madeRepayment'),
    })
  }

  async function handleSettle(e) {
    e.preventDefault()
    if (!(parseFloat(settleForm.amount) > 0)) { toast.error(t('cashLedger.amountRequired')); return }
    setSaving(true)
    const type = settleTarget.isReceiving ? 'borrowed' : 'lent'
    const ok = await addTransaction({
      person_name: settleTarget.name,
      phone: settleTarget.phone || '',
      amount: settleForm.amount,
      type,
      note: settleForm.note,
      transaction_date: settleForm.transaction_date,
    })
    setSaving(false)
    if (ok) {
      const amt = parseFloat(settleForm.amount) || 0
      const newLent = (settleTarget.lent || 0) + (type === 'lent' ? amt : 0)
      const newBorrowed = (settleTarget.borrowed || 0) + (type === 'borrowed' ? amt : 0)
      setWaPrompt(cashWaPrompt({
        name: settleTarget.name,
        phone: settleTarget.phone,
        type,
        amount: amt,
        date: settleForm.transaction_date,
        net: newLent - newBorrowed,
      }))
      setSettleTarget(null)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400">
      <div className="w-8 h-8 border-2 border-[#2E86AB] border-t-transparent rounded-full animate-spin me-3" />
      {t('common.loading')}
    </div>
  )

  return (
    <div className="space-y-5 max-w-2xl mx-auto">

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-green-200 rounded-lg">
              <ArrowDownLeft size={16} className="text-green-700" />
            </div>
            <p className="text-sm font-medium text-green-700">{t('cashLedger.theyOweUs')}</p>
          </div>
          <p className="text-2xl font-bold text-green-800">{formatCurrency(totalLent)}</p>
          <p className="text-xs text-green-600 mt-1">{t('cashLedger.moneyWeGave')}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-red-200 rounded-lg">
              <ArrowUpRight size={16} className="text-red-700" />
            </div>
            <p className="text-sm font-medium text-red-700">{t('cashLedger.weOweThem')}</p>
          </div>
          <p className="text-2xl font-bold text-red-800">{formatCurrency(totalBorrowed)}</p>
          <p className="text-xs text-red-600 mt-1">{t('cashLedger.moneyWeReceived')}</p>
        </div>
      </div>

      {/* Search + Add */}
      <div className="flex gap-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('cashLedger.searchPerson')}
          className="flex-1 px-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
        />
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#1B3A5C] text-white rounded-xl text-sm font-medium hover:bg-[#2E86AB] transition-colors whitespace-nowrap"
        >
          <Plus size={16} /> {t('cashLedger.addTransaction')}
        </button>
      </div>

      {/* Person Cards */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Banknote size={40} className="mb-3 text-slate-200" />
          <p className="text-sm font-medium">{t('cashLedger.noTransactions')}</p>
          <button onClick={openAdd} className="mt-3 text-sm text-[#2E86AB] hover:underline">
            {t('cashLedger.recordFirst')}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(person => {
            const net = person.lent - person.borrowed
            const isExpanded = expanded === person.name.toLowerCase()
            return (
              <div key={person.name} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {/* Person Header */}
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : person.name.toLowerCase())}
                >
                  <div className="w-10 h-10 rounded-full bg-[#1B3A5C]/10 text-[#1B3A5C] flex items-center justify-center font-bold text-sm shrink-0">
                    {person.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{person.name}</p>
                    {person.phone && (
                      <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                        <Phone size={10} />
                        <span dir="ltr">{person.phone}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-end shrink-0 me-2">
                    {net > 0 ? (
                      <>
                        <p className="text-xs text-slate-400">{t('cashLedger.owesUs')}</p>
                        <p className="text-base font-bold text-green-600">{formatCurrency(net)}</p>
                      </>
                    ) : net < 0 ? (
                      <>
                        <p className="text-xs text-slate-400">{t('cashLedger.weOwe')}</p>
                        <p className="text-base font-bold text-red-600">{formatCurrency(Math.abs(net))}</p>
                      </>
                    ) : (
                      <p className="text-sm font-semibold text-slate-400">{t('cashLedger.settled')}</p>
                    )}
                  </div>
                  {net !== 0 && (
                    <button
                      onClick={e => { e.stopPropagation(); openSettle(person) }}
                      className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium me-2 ${
                        net > 0
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : 'bg-red-600 text-white hover:bg-red-700'
                      }`}
                    >
                      {net > 0
                        ? <><ArrowDownLeft size={13} /> <span className="hidden sm:inline">{t('cashLedger.receivePayment')}</span></>
                        : <><ArrowUpRight size={13} /> <span className="hidden sm:inline">{t('cashLedger.makePayment')}</span></>}
                    </button>
                  )}
                  <div className="text-slate-400 shrink-0">
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </div>

                {/* Transactions */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 space-y-2">
                    {/* Mini summary for this person */}
                    <div className="flex gap-3 mb-3">
                      <div className="flex-1 bg-green-50 border border-green-100 rounded-lg px-3 py-2 text-center">
                        <p className="text-xs text-green-600">{t('cashLedger.lent')}</p>
                        <p className="text-sm font-bold text-green-700">{formatCurrency(person.lent)}</p>
                      </div>
                      <div className="flex-1 bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-center">
                        <p className="text-xs text-red-600">{t('cashLedger.borrowed')}</p>
                        <p className="text-sm font-bold text-red-700">{formatCurrency(person.borrowed)}</p>
                      </div>
                    </div>

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
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tx.type === 'lent' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {tx.type === 'lent' ? t('cashLedger.lent') : t('cashLedger.borrowed')}
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
            )
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        open={modal}
        onClose={() => { setModal(false); setEditTx(null) }}
        title={editTx ? t('cashLedger.editTransaction') : t('cashLedger.addTransaction')}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type selector */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">{t('cashLedger.transactionType')} *</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all text-sm font-medium select-none
                ${form.type === 'lent' ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
                <input type="radio" name="type" value="lent" className="sr-only"
                  checked={form.type === 'lent'} onChange={() => setForm(f => ({ ...f, type: 'lent' }))} />
                <ArrowDownLeft size={16} className={form.type === 'lent' ? 'text-green-600' : 'text-slate-400'} />
                <div>
                  <div>{t('cashLedger.lent')}</div>
                  <div className="text-xs font-normal opacity-70">{t('cashLedger.lentDesc')}</div>
                </div>
              </label>
              <label className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all text-sm font-medium select-none
                ${form.type === 'borrowed' ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
                <input type="radio" name="type" value="borrowed" className="sr-only"
                  checked={form.type === 'borrowed'} onChange={() => setForm(f => ({ ...f, type: 'borrowed' }))} />
                <ArrowUpRight size={16} className={form.type === 'borrowed' ? 'text-red-600' : 'text-slate-400'} />
                <div>
                  <div>{t('cashLedger.borrowed')}</div>
                  <div className="text-xs font-normal opacity-70">{t('cashLedger.borrowedDesc')}</div>
                </div>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('cashLedger.personName')} *</label>
              <input
                required
                value={form.person_name}
                onChange={e => setForm(f => ({ ...f, person_name: e.target.value }))}
                placeholder={t('cashLedger.personNamePlaceholder')}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('cashLedger.phone')}</label>
              <PhoneInput value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.amount')} (AFN) *</label>
              <input
                required type="number" min="1" step="0.01"
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
            <div className="col-span-2">
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

      <WhatsAppPromptDialog
        open={!!waPrompt}
        onClose={() => setWaPrompt(null)}
        templateKey={waPrompt?.templateKey}
        variables={waPrompt?.variables}
        recipient={waPrompt?.recipient}
      />

      {/* Settle / Repayment Modal */}
      <Modal
        open={!!settleTarget}
        onClose={() => setSettleTarget(null)}
        title={settleTarget?.isReceiving ? t('cashLedger.receivePayment') : t('cashLedger.makePayment')}
      >
        {settleTarget && (
          <form onSubmit={handleSettle} className="space-y-4">
            <div className={`rounded-xl p-3 text-sm border ${settleTarget.isReceiving ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <p className="font-semibold text-slate-800">{settleTarget.name}</p>
              <p className={`text-xs mt-1 ${settleTarget.isReceiving ? 'text-green-700' : 'text-red-700'}`}>
                {settleTarget.isReceiving ? t('cashLedger.owesUs') : t('cashLedger.weOwe')}:{' '}
                <span className="font-bold">{formatCurrency(settleTarget.outstanding)}</span>
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.amount')} (AFN) *</label>
                <input
                  required type="number" min="0.01" step="0.01"
                  value={settleForm.amount}
                  onChange={e => setSettleForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
                />
                <button
                  type="button"
                  onClick={() => setSettleForm(f => ({ ...f, amount: String(settleTarget.outstanding) }))}
                  className="text-xs text-[#2E86AB] hover:underline mt-1"
                >
                  {t('pos.setFullAmount')}
                </button>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.date')}</label>
                <input
                  type="date"
                  value={settleForm.transaction_date}
                  onChange={e => setSettleForm(f => ({ ...f, transaction_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.notes')}</label>
              <input
                value={settleForm.note}
                onChange={e => setSettleForm(f => ({ ...f, note: e.target.value }))}
                placeholder={t('cashLedger.notePlaceholder')}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
              />
            </div>
            <div className="flex gap-3 justify-end pt-1">
              <button type="button" onClick={() => setSettleTarget(null)}
                className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">
                {t('common.cancel')}
              </button>
              <button type="submit" disabled={saving}
                className={`px-5 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-60 transition-colors ${
                  settleTarget.isReceiving ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                }`}>
                {saving ? t('common.saving') : t('cashLedger.record')}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
