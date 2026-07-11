import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Wallet, Plus, Minus, Settings2, Trash2, ArrowDownLeft, ArrowUpRight, RotateCcw } from 'lucide-react'
import { useStoreCash } from '../contexts/StoreCashContext'
import Modal from '../components/common/Modal'
import ConfirmDialog from '../components/common/ConfirmDialog'
import { formatCurrency } from '../utils/formatCurrency'
import { formatDate, todayStr } from '../utils/dateHelpers'
import { useLanguage } from '../contexts/LanguageContext'

// Store Cash — one running balance for the physical till at the shop. Set an
// opening balance, then every downstream transaction (farm payment, expense,
// supplier payout, …) can flag itself as touching the till and its amount
// flows into this ledger automatically.
export default function StoreCash() {
  const { t } = useLanguage()
  const { balance, transactions, loading, setOpeningBalance, recordAdjustment, resetToCurrentBalance, deleteRow } = useStoreCash()

  const [openingModal, setOpeningModal] = useState(false)
  const [openingForm, setOpeningForm] = useState({ amount: '', date: todayStr(), note: '' })
  const [adjustModal, setAdjustModal] = useState(null) // 'in' | 'out' | null
  const [adjustForm, setAdjustForm] = useState({ amount: '', note: '', date: todayStr() })
  const [resetModal, setResetModal] = useState(false)
  const [resetForm, setResetForm] = useState({ amount: '', date: todayStr(), note: '' })
  const [resetConfirm, setResetConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [filter, setFilter] = useState('all') // 'all' | 'in' | 'out'

  const currentOpening = transactions.find(t => t.type === 'opening_balance')

  function openEditOpening() {
    setOpeningForm({
      amount: currentOpening ? String(currentOpening.amount) : '',
      date: currentOpening?.transaction_date || todayStr(),
      note: currentOpening?.note || '',
    })
    setOpeningModal(true)
  }

  async function handleSetOpening(e) {
    e.preventDefault()
    setSaving(true)
    const ok = await setOpeningBalance(openingForm)
    setSaving(false)
    if (ok) setOpeningModal(false)
  }

  function openAdjust(direction) {
    setAdjustForm({ amount: '', note: '', date: todayStr() })
    setAdjustModal(direction)
  }

  async function handleAdjust(e) {
    e.preventDefault()
    setSaving(true)
    const ok = await recordAdjustment({ ...adjustForm, direction: adjustModal })
    setSaving(false)
    if (ok) setAdjustModal(null)
  }

  function openReset() {
    setResetForm({ amount: '', date: todayStr(), note: '' })
    setResetModal(true)
  }

  function submitReset(e) {
    e.preventDefault()
    setResetConfirm(true)
  }

  async function doReset() {
    setSaving(true)
    const ok = await resetToCurrentBalance(resetForm)
    setSaving(false)
    setResetConfirm(false)
    if (ok) setResetModal(false)
  }

  const filtered = useMemo(() => {
    if (filter === 'all') return transactions
    if (filter === 'in') return transactions.filter(t => t.type === 'in' || t.type === 'opening_balance' || t.type === 'adjustment_in')
    return transactions.filter(t => t.type === 'out' || t.type === 'adjustment_out')
  }, [transactions, filter])

  const inCount = transactions.filter(t => t.type === 'in' || t.type === 'opening_balance' || t.type === 'adjustment_in').length
  const outCount = transactions.filter(t => t.type === 'out' || t.type === 'adjustment_out').length

  const totalIn = transactions
    .filter(t => t.type === 'in' || t.type === 'opening_balance' || t.type === 'adjustment_in')
    .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0)
  const totalOut = transactions
    .filter(t => t.type === 'out' || t.type === 'adjustment_out')
    .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0)

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400">
      <div className="w-8 h-8 border-2 border-[#2E86AB] border-t-transparent rounded-full animate-spin me-3" />
      {t('common.loading')}
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={16} /> {t('storeCash.backToDashboard')}
      </Link>

      {/* Balance hero */}
      <div className="bg-gradient-to-r from-[#1B3A5C] to-[#2E86AB] text-white rounded-2xl p-6 shadow-md">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <p className="text-xs font-medium text-white/70 uppercase tracking-wide">{t('storeCash.title')}</p>
              <span className="text-xs font-semibold text-white/90" dir="rtl">· د دوکان نغدې پیسې</span>
            </div>
            <p className="text-4xl font-bold truncate">{formatCurrency(balance)}</p>
            <p className="text-xs text-white/70 mt-1">
              {t('storeCash.balanceSub')}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-white/10 shrink-0">
            <Wallet size={26} />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => openAdjust('in')}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-700"
        >
          <Plus size={16} /> {t('storeCash.cashIn')}
        </button>
        <button
          onClick={() => openAdjust('out')}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700"
        >
          <Minus size={16} /> {t('storeCash.cashOut')}
        </button>
        <button
          onClick={openEditOpening}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200"
        >
          <Settings2 size={16} /> {currentOpening ? t('storeCash.editOpening') : t('storeCash.setOpening')}
        </button>
        <button
          onClick={openReset}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-100 text-amber-800 text-sm font-medium hover:bg-amber-200"
        >
          <RotateCcw size={16} /> {t('storeCash.setCurrentCash')}
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-green-50 border border-green-100 rounded-xl p-4">
          <p className="text-xs text-green-700 mb-0.5">{t('storeCash.totalIn')}</p>
          <p className="text-xl font-bold text-green-700">{formatCurrency(totalIn)}</p>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
          <p className="text-xs text-red-700 mb-0.5">{t('storeCash.totalOut')}</p>
          <p className="text-xl font-bold text-red-700">{formatCurrency(totalOut)}</p>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2">
        {[
          { key: 'all', label: t('common.all'), count: transactions.length },
          { key: 'in', label: t('storeCash.cashIn'), count: inCount },
          { key: 'out', label: t('storeCash.cashOut'), count: outCount },
        ].map(c => (
          <button
            key={c.key}
            onClick={() => setFilter(c.key)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
              filter === c.key
                ? 'bg-[#1B3A5C] text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {c.label} <span className="ms-1 opacity-70">({c.count})</span>
          </button>
        ))}
      </div>

      {/* History */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
        <div className="px-5 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">{t('storeCash.history')}</h3>
        </div>
        {filtered.length === 0 ? (
          <p className="text-center py-10 text-slate-400 text-sm">{t('storeCash.noTransactions')}</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map(tx => {
              const isIn = tx.type === 'in' || tx.type === 'opening_balance' || tx.type === 'adjustment_in'
              const sourceLabel = tx.type === 'opening_balance' ? t('storeCash.sourceOpening')
                : tx.source === 'payment' ? t('storeCash.sourceFarmPayment')
                : tx.source === 'expense' ? t('storeCash.sourceExpense')
                : tx.source === 'supplier_payment' ? t('storeCash.sourceSupplierPayment')
                : tx.source === 'walk_in_sale' ? t('storeCash.sourceWalkIn')
                : tx.source === 'cash_ledger' ? t('storeCash.sourceCashLedger')
                : tx.source === 'market_seller_payment' ? t('storeCash.sourceMarketSeller')
                : tx.source === 'manual' ? t('storeCash.sourceManual')
                : tx.source || '—'
              return (
                <div key={tx.id} className="px-5 py-3 flex items-center gap-3">
                  <div className={`p-1.5 rounded-lg shrink-0 ${isIn ? 'bg-green-100' : 'bg-red-100'}`}>
                    {isIn
                      ? <ArrowDownLeft size={15} className="text-green-600" />
                      : <ArrowUpRight size={15} className="text-red-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isIn ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {sourceLabel}
                      </span>
                      <span className="text-xs text-slate-400">{formatDate(tx.transaction_date)}</span>
                    </div>
                    {tx.note && <p className="text-sm text-slate-600 mt-0.5 truncate">{tx.note}</p>}
                  </div>
                  <p className={`text-base font-bold shrink-0 ${isIn ? 'text-green-600' : 'text-red-600'}`}>
                    {isIn ? '+' : '−'}{formatCurrency(tx.amount)}
                  </p>
                  {tx.source === 'manual' || tx.type === 'opening_balance' ? (
                    <button onClick={() => setDeleteTarget(tx)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg shrink-0">
                      <Trash2 size={14} />
                    </button>
                  ) : (
                    <div className="w-7 shrink-0" />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Opening balance modal */}
      <Modal open={openingModal} onClose={() => setOpeningModal(false)} title={currentOpening ? t('storeCash.editOpening') : t('storeCash.setOpening')}>
        <form onSubmit={handleSetOpening} className="space-y-4">
          <p className="text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {t('storeCash.openingNote')}
          </p>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.amount')} (AFN) *</label>
            <input required type="number" min="0" step="0.01"
              value={openingForm.amount}
              onChange={e => setOpeningForm(f => ({ ...f, amount: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.date')}</label>
            <input type="date" value={openingForm.date}
              onChange={e => setOpeningForm(f => ({ ...f, date: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.notes')}</label>
            <input value={openingForm.note}
              onChange={e => setOpeningForm(f => ({ ...f, note: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setOpeningModal(false)} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">{t('common.cancel')}</button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium bg-[#1B3A5C] text-white rounded-lg hover:bg-[#2E86AB] disabled:opacity-60">
              {saving ? t('common.saving') : t('common.saveChanges')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Adjust modal (in/out) */}
      <Modal open={!!adjustModal} onClose={() => setAdjustModal(null)} title={adjustModal === 'in' ? t('storeCash.cashIn') : t('storeCash.cashOut')}>
        <form onSubmit={handleAdjust} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.amount')} (AFN) *</label>
            <input required type="number" min="0.01" step="0.01"
              value={adjustForm.amount}
              onChange={e => setAdjustForm(f => ({ ...f, amount: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.date')}</label>
            <input type="date" value={adjustForm.date}
              onChange={e => setAdjustForm(f => ({ ...f, date: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.notes')}</label>
            <input value={adjustForm.note}
              onChange={e => setAdjustForm(f => ({ ...f, note: e.target.value }))}
              placeholder={t('storeCash.notePlaceholder')}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setAdjustModal(null)} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">{t('common.cancel')}</button>
            <button type="submit" disabled={saving}
              className={`px-5 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-60 ${adjustModal === 'in' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
              {saving ? t('common.saving') : t('storeCash.record')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Set current cash modal — wipes history and starts fresh */}
      <Modal open={resetModal} onClose={() => setResetModal(false)} title={t('storeCash.setCurrentCash')}>
        <form onSubmit={submitReset} className="space-y-4">
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {t('storeCash.resetNote')}
          </p>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('storeCash.currentCashInDrawer')} (AFN) *</label>
            <input required type="number" min="0" step="0.01"
              value={resetForm.amount}
              onChange={e => setResetForm(f => ({ ...f, amount: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.date')}</label>
            <input type="date" value={resetForm.date}
              onChange={e => setResetForm(f => ({ ...f, date: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.notes')}</label>
            <input value={resetForm.note}
              onChange={e => setResetForm(f => ({ ...f, note: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setResetModal(false)} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">{t('common.cancel')}</button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-60">
              {t('storeCash.resetContinue')}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={resetConfirm}
        onClose={() => setResetConfirm(false)}
        onConfirm={doReset}
        title={t('storeCash.resetConfirmTitle')}
        message={t('storeCash.resetConfirmMsg')}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { deleteRow(deleteTarget.id); setDeleteTarget(null) }}
        title={t('storeCash.deleteTitle')}
        message={t('storeCash.deleteConfirm')}
      />
    </div>
  )
}
