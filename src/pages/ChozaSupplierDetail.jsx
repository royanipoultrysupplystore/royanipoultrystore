import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CreditCard, Plus, Trash2, Edit2 } from 'lucide-react'
import { useChozaSupplierDetail } from '../hooks/useSuppliers'
import { useSuppliers } from '../hooks/useSuppliers'
import Modal from '../components/common/Modal'
import ConfirmDialog from '../components/common/ConfirmDialog'
import PhoneInput from '../components/common/PhoneInput'
import WhatsAppPromptDialog from '../components/common/WhatsAppPromptDialog'
import { formatCurrency } from '../utils/formatCurrency'
import { formatDate, todayStr } from '../utils/dateHelpers'
import { useLanguage } from '../contexts/LanguageContext'
import { useStoreCash } from '../contexts/StoreCashContext'
import { useStoreCashLock } from '../contexts/StoreCashLockContext'
import { lf } from '../utils/localizedField'

const CHOZA_TYPES = [
  { value: 'Tajaki',     labelKey: 'tajaki',     color: 'border-blue-500 bg-blue-50 text-blue-700',     badge: 'bg-blue-100 text-blue-700' },
  { value: 'Uzbeki',     labelKey: 'uzbeki',     color: 'border-cyan-500 bg-cyan-50 text-cyan-700',     badge: 'bg-cyan-100 text-cyan-700' },
  { value: 'Afghani',    labelKey: 'afghani',    color: 'border-green-500 bg-green-50 text-green-700',  badge: 'bg-green-100 text-green-700' },
  { value: 'Pakistani',  labelKey: 'pakistani',  color: 'border-emerald-500 bg-emerald-50 text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
  { value: 'Irani',      labelKey: 'irani',      color: 'border-rose-500 bg-rose-50 text-rose-700',     badge: 'bg-rose-100 text-rose-700' },
]

const CHOZA_DOT_COLORS = {
  Tajaki:    'border-blue-500 bg-blue-500',
  Uzbeki:    'border-cyan-500 bg-cyan-500',
  Afghani:   'border-green-500 bg-green-500',
  Pakistani: 'border-emerald-500 bg-emerald-500',
  Irani:     'border-rose-500 bg-rose-500',
}

function getChozaType(value) {
  return CHOZA_TYPES.find(t => t.value === value) || CHOZA_TYPES[0]
}

const emptyTx = {
  transaction_date: todayStr(),
  choza_type: '',
  afghani_subtype: '',
  price_per_choza: '',
  total_choza: '',
  total_amount: '',
  sale_price_per_choza: '',
  total_profit: '',
  notes: '',
}

const emptyPayment = { amount: '', payment_date: todayStr(), notes: '' }

export default function ChozaSupplierDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t, isRTL, lang } = useLanguage()
  const { deleteSupplier, updateSupplier } = useSuppliers()
  const {
    supplier, transactions, payments, loading,
    totalInvested, totalPaid, remaining, totalChoza, totalProfit,
    chozaSentToFarms, remainingChoza, chozaBatches,
    addTransaction, updateTransaction, deleteTransaction,
    recordPayment, updatePayment, deletePayment,
  } = useChozaSupplierDetail(id)

  const [txModal, setTxModal] = useState(false)
  const [editTx, setEditTx] = useState(null)
  const [txForm, setTxForm] = useState(emptyTx)
  const [paymentModal, setPaymentModal] = useState(false)
  const [payFromStoreCash, setPayFromStoreCash] = useState(true)
  const { recordOut, removeByReference } = useStoreCash()
  const { requestUncheck } = useStoreCashLock()
  const [editPayment, setEditPayment] = useState(null)
  const [paymentForm, setPaymentForm] = useState(emptyPayment)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [editModal, setEditModal] = useState(false)
  const [editForm, setEditForm] = useState({ company_name: '', owner_name: '', phone: '', notes: '' })
  const [waPrompt, setWaPrompt] = useState(null)

  const BackIcon = isRTL ? ArrowRight : ArrowLeft

  function computeTxAmounts(form) {
    const price = parseFloat(form.price_per_choza) || 0
    const qty = parseInt(form.total_choza) || 0
    const salePrice = parseFloat(form.sale_price_per_choza) || 0
    return {
      total_amount: price * qty,
      total_profit: (salePrice - price) * qty,
    }
  }

  function handleTxChange(field, value) {
    setTxForm(f => {
      const updated = { ...f, [field]: value }
      const computed = computeTxAmounts(updated)
      return { ...updated, total_amount: computed.total_amount, total_profit: computed.total_profit }
    })
  }

  function openNewTx() {
    setEditTx(null)
    setTxForm({ ...emptyTx, transaction_date: todayStr() })
    setTxModal(true)
  }

  function openEditTx(tx) {
    setEditTx(tx)
    setTxForm({
      transaction_date: tx.transaction_date,
      choza_type: tx.choza_type,
      afghani_subtype: tx.afghani_subtype || '',
      price_per_choza: tx.price_per_choza,
      total_choza: tx.total_choza,
      total_amount: tx.total_amount,
      sale_price_per_choza: tx.sale_price_per_choza,
      total_profit: tx.total_profit,
      notes: tx.notes || '',
    })
    setTxModal(true)
  }

  function openNewPayment() {
    setEditPayment(null)
    setPaymentForm({ ...emptyPayment, payment_date: todayStr() })
    setPaymentModal(true)
  }

  function openEditPayment(p) {
    setEditPayment(p)
    setPaymentForm({ amount: p.amount, payment_date: p.payment_date, notes: p.notes || '' })
    setPaymentModal(true)
  }

  function openEditSupplier() {
    setEditForm({
      company_name: supplier.company_name,
      owner_name: supplier.owner_name || '',
      phone: supplier.phone || '',
      notes: supplier.notes || '',
    })
    setEditModal(true)
  }

  async function handleTx(e) {
    e.preventDefault()
    setSaving(true)
    const ok = editTx
      ? await updateTransaction(editTx.id, txForm)
      : await addTransaction(txForm)
    setSaving(false)
    if (ok) { setTxModal(false); setTxForm(emptyTx); setEditTx(null) }
  }

  async function handlePayment(e) {
    e.preventDefault()
    setSaving(true)
    const isNew = !editPayment
    const ok = editPayment
      ? await updatePayment(editPayment.id, paymentForm)
      : await recordPayment(paymentForm)
    setSaving(false)
    if (ok) {
      const wasPaid = parseFloat(paymentForm.amount) || 0
      const dateUsed = paymentForm.payment_date
      if (isNew && payFromStoreCash && wasPaid > 0) {
        await recordOut({
          amount: wasPaid,
          source: 'supplier_payment',
          reference_id: ok?.id || null,
          note: supplier?.company_name || 'Choza supplier',
          date: dateUsed,
        })
      }
      setPaymentModal(false); setPaymentForm(emptyPayment); setEditPayment(null); setPayFromStoreCash(true)
      if (isNew && supplier) {
        setWaPrompt({
          templateKey: 'supplier_payment_made',
          variables: {
            name: supplier.company_name,
            amount: formatCurrency(wasPaid),
            date: dateUsed,
            balance: formatCurrency(Math.max(0, remaining - wasPaid)),
          },
          recipient: { name: supplier.company_name, phone: supplier.phone },
        })
      }
    }
  }

  async function handleEditSupplier(e) {
    e.preventDefault()
    setSaving(true)
    await updateSupplier(id, editForm)
    setSaving(false)
    setEditModal(false)
  }

  async function handleDeleteSupplier() {
    const ok = await deleteSupplier(id)
    if (ok) navigate('/suppliers?tab=choza')
  }

  if (loading) return <div className="text-center py-12 text-slate-400">{t('common.loading')}</div>
  if (!supplier) return null

  const priceVal = parseFloat(txForm.price_per_choza) || 0
  const qtyVal = parseInt(txForm.total_choza) || 0
  const salePriceVal = parseFloat(txForm.sale_price_per_choza) || 0
  const computedTotal = priceVal * qtyVal
  const computedProfit = (salePriceVal - priceVal) * qtyVal

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/suppliers?tab=choza" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
            <BackIcon size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">🐥</span>
              <h2 className="text-xl font-bold text-slate-800">{supplier.company_name}</h2>
            </div>
            <p className="text-sm text-slate-500">
              {supplier.owner_name && <span>{supplier.owner_name}</span>}
              {supplier.owner_name && supplier.phone && <span> · </span>}
              {supplier.phone && <span dir="ltr">{supplier.phone}</span>}
            </p>
            {supplier.notes && <p className="text-xs text-slate-400 mt-0.5">{supplier.notes}</p>}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={openEditSupplier} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">
            <Edit2 size={14} /> {t('common.edit')}
          </button>
          <button onClick={() => setDeleteTarget('supplier')} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100">
            <Trash2 size={14} /> {t('common.delete')}
          </button>
        </div>
      </div>

      {/* Stats Row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <div className="text-xs text-slate-500 mb-1">{t('suppliers.totalInvested')}</div>
          <div className="text-lg font-bold text-red-600">{formatCurrency(totalInvested)}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <div className="text-xs text-slate-500 mb-1">{t('suppliers.totalPaid')}</div>
          <div className="text-lg font-bold text-green-600">{formatCurrency(totalPaid)}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <div className="text-xs text-slate-500 mb-1">{t('suppliers.remaining')}</div>
          <div className={`text-lg font-bold ${remaining > 0 ? 'text-orange-600' : 'text-slate-600'}`}>{formatCurrency(remaining)}</div>
        </div>
      </div>

      {/* Choza balance */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">{t('suppliers.chozaBalance')}</div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="text-xs text-slate-500 mb-0.5">{t('suppliers.totalChozaBought')}</div>
            <div className="text-lg font-bold text-amber-600">{totalChoza}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-0.5">{t('suppliers.chozaSentToFarms')}</div>
            <div className="text-lg font-bold text-blue-600">{chozaSentToFarms}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-0.5">{t('suppliers.remainingChoza')}</div>
            <div className={`text-lg font-bold ${remainingChoza > 0 ? 'text-green-600' : remainingChoza < 0 ? 'text-red-600' : 'text-slate-600'}`}>{remainingChoza}</div>
          </div>
        </div>
      </div>

      {/* Choza sent to farms — breakdown of the "Sent to Farms" number */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-700 flex items-center gap-2">
            🐔 {t('suppliers.chozaSentToFarms')} ({chozaBatches.length})
          </h3>
        </div>
        {chozaBatches.length === 0 ? (
          <p className="text-center py-8 text-slate-400 text-sm">{t('suppliers.noChozaSent')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase">
                  <th className="text-start px-5 py-3 font-medium">{t('common.date')}</th>
                  <th className="text-start px-5 py-3 font-medium">{t('dispatches.farm')}</th>
                  <th className="text-start px-5 py-3 font-medium">{t('batches.batch')}</th>
                  <th className="text-end px-5 py-3 font-medium">🐥 {t('suppliers.totalChoza')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {chozaBatches.map(b => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium">{formatDate(b.start_date)}</td>
                    <td className="px-5 py-3">
                      <Link to={`/farms/${b.farm_id}`} className="text-blue-600 hover:underline font-medium">
                        {lf(b.farms, 'name', lang) || '—'}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-600">#{b.batch_number}</td>
                    <td className="px-5 py-3 text-end font-bold text-amber-600">{(b.initial_chicken_count || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50">
                  <td colSpan={3} className="px-5 py-3 text-sm font-semibold text-slate-600">{t('common.total')}</td>
                  <td className="px-5 py-3 text-end font-bold text-amber-700">{chozaSentToFarms.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Stats Row 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <div className="text-xs text-slate-500 mb-1">{t('suppliers.totalInvested')}</div>
          <div className="text-lg font-bold text-red-600">{formatCurrency(totalInvested)}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <div className="text-xs text-slate-500 mb-1">{t('suppliers.totalProfit')}</div>
          <div className={`text-lg font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(totalProfit)}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <div className="text-xs text-slate-500 mb-1">{t('suppliers.chozaTransactions')}</div>
          <div className="text-lg font-bold text-slate-700">{transactions.length}</div>
        </div>
      </div>

      {/* Transactions */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-700 flex items-center gap-2">
            🐥 {t('suppliers.chozaTransactions')}
          </h3>
          <button
            onClick={openNewTx}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1B3A5C] text-white rounded-lg text-sm font-medium hover:bg-[#2E86AB] transition-colors"
          >
            <Plus size={14} /> {t('suppliers.addTransaction')}
          </button>
        </div>

        {transactions.length === 0 ? (
          <p className="text-center py-8 text-slate-400 text-sm">{t('suppliers.noTransactions')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase">
                  <th className="text-start px-5 py-3 font-medium">{t('common.date')}</th>
                  <th className="text-start px-5 py-3 font-medium">{t('suppliers.chozaType')}</th>
                  <th className="text-start px-5 py-3 font-medium">{t('suppliers.totalChoza')}</th>
                  <th className="text-start px-5 py-3 font-medium">{t('suppliers.pricePerChoza')}</th>
                  <th className="text-start px-5 py-3 font-medium">{t('suppliers.salePricePerChoza')}</th>
                  <th className="text-start px-5 py-3 font-medium">{t('common.total')}</th>
                  <th className="text-start px-5 py-3 font-medium">{t('suppliers.totalProfit')}</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {transactions.map(tx => {
                  const cfg = getChozaType(tx.choza_type)
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium">{formatDate(tx.transaction_date)}</td>
                      <td className="px-5 py-3">
                        <div>
                          <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                            {t(`suppliers.${cfg.labelKey}`)}
                          </span>
                          {tx.afghani_subtype && (
                            <div className="text-xs text-slate-400 mt-0.5">{tx.afghani_subtype}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3 font-bold text-amber-600">{tx.total_choza}</td>
                      <td className="px-5 py-3">{formatCurrency(tx.price_per_choza)}</td>
                      <td className="px-5 py-3">{formatCurrency(tx.sale_price_per_choza)}</td>
                      <td className="px-5 py-3 font-medium text-red-600">{formatCurrency(tx.total_amount)}</td>
                      <td className="px-5 py-3 font-bold text-green-600">{formatCurrency(tx.total_profit)}</td>
                      <td className="px-5 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => openEditTx(tx)} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => setDeleteTarget({ type: 'tx', item: tx })} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payments Made */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-700 flex items-center gap-2">
            <CreditCard size={16} /> {t('suppliers.payments')}
          </h3>
          <button
            onClick={openNewPayment}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 transition-colors"
          >
            <Plus size={14} /> {t('suppliers.recordPayment')}
          </button>
        </div>

        {payments.length === 0 ? (
          <p className="text-center py-8 text-slate-400 text-sm">{t('suppliers.noPayments')}</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {payments.map(p => (
              <div key={p.id} className="px-5 py-3 flex items-center gap-3">
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 text-sm">
                  <div>
                    <div className="text-xs text-slate-400">{t('common.date')}</div>
                    <div className="font-medium">{formatDate(p.payment_date)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">{t('common.amount')}</div>
                    <div className="font-bold text-green-600">{formatCurrency(p.amount)}</div>
                  </div>
                  {p.notes && (
                    <div>
                      <div className="text-xs text-slate-400">{t('common.notes')}</div>
                      <div className="text-slate-600 text-xs">{p.notes}</div>
                    </div>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEditPayment(p)} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => setDeleteTarget({ type: 'payment', item: p })} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transaction Modal */}
      <Modal
        open={txModal}
        onClose={() => { setTxModal(false); setEditTx(null) }}
        title={editTx ? t('common.edit') + ' ' + t('suppliers.chozaTransactions') : t('suppliers.addTransaction')}
        size="lg"
      >
        <form onSubmit={handleTx} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-1 sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.date')}</label>
              <input type="date" value={txForm.transaction_date}
                onChange={e => setTxForm(f => ({ ...f, transaction_date: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-2">{t('suppliers.chozaType')} *</label>
              <div className="flex flex-wrap gap-2">
                {CHOZA_TYPES.map(opt => {
                  const selected = txForm.choza_type === opt.value
                  const dotCls = CHOZA_DOT_COLORS[opt.value]
                  return (
                    <label key={opt.value} className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer transition-all text-sm font-medium select-none
                      ${selected ? opt.color : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
                      <input
                        type="radio"
                        name="choza_type"
                        value={opt.value}
                        required
                        checked={selected}
                        onChange={e => handleTxChange('choza_type', e.target.value)}
                        className="sr-only"
                      />
                      <span className={`w-3 h-3 rounded-full border-2 flex items-center justify-center shrink-0 ${selected ? dotCls.split(' ')[0] : 'border-slate-300'}`}>
                        {selected && <span className={`w-1.5 h-1.5 rounded-full ${dotCls.split(' ')[1]}`} />}
                      </span>
                      {t(`suppliers.${opt.labelKey}`)}
                    </label>
                  )
                })}
              </div>
            </div>

            {txForm.choza_type === 'Afghani' && (
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('suppliers.afghaniSubtype')}</label>
                <input value={txForm.afghani_subtype}
                  onChange={e => setTxForm(f => ({ ...f, afghani_subtype: e.target.value }))}
                  placeholder="e.g. Kandahari, Ghazni..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('suppliers.pricePerChoza')} (AFN) *</label>
              <input required type="number" min="0" step="0.01" value={txForm.price_per_choza}
                onChange={e => handleTxChange('price_per_choza', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('suppliers.totalChoza')} *</label>
              <input required type="number" min="1" step="1" value={txForm.total_choza}
                onChange={e => handleTxChange('total_choza', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.total')} (AFN)</label>
              <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-red-600">
                {formatCurrency(computedTotal)}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('suppliers.salePricePerChoza')} (AFN)</label>
              <input type="number" min="0" step="0.01" value={txForm.sale_price_per_choza}
                onChange={e => handleTxChange('sale_price_per_choza', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('suppliers.totalProfit')} (AFN)</label>
              <div className={`px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold ${computedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(computedProfit)}
              </div>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.notes')}</label>
              <textarea rows={2} value={txForm.notes}
                onChange={e => setTxForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30 resize-none" />
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => { setTxModal(false); setEditTx(null) }}
              className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium bg-[#1B3A5C] text-white rounded-lg hover:bg-[#2E86AB] disabled:opacity-60">
              {saving ? t('common.saving') : editTx ? t('common.saveChanges') : t('suppliers.addTransaction')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Payment Modal */}
      <Modal
        open={paymentModal}
        onClose={() => { setPaymentModal(false); setEditPayment(null) }}
        title={editPayment ? t('suppliers.editPayment') : t('suppliers.recordPayment')}
      >
        <form onSubmit={handlePayment} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.amount')} (AFN) *</label>
            <input required type="number" min="0.01" step="0.01" value={paymentForm.amount}
              onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.date')}</label>
            <input type="date" value={paymentForm.payment_date}
              onChange={e => setPaymentForm(f => ({ ...f, payment_date: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.notes')}</label>
            <input value={paymentForm.notes}
              onChange={e => setPaymentForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
          </div>
          {!editPayment && (
            <label className="flex items-center gap-2 text-sm text-slate-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 cursor-pointer">
              <input type="checkbox" checked={payFromStoreCash} onChange={e => { if (e.target.checked) setPayFromStoreCash(true); else requestUncheck(() => setPayFromStoreCash(false)) }} className="rounded text-red-600" />
              <span>{t('storeCash.fromStoreCash')}</span>
            </label>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => { setPaymentModal(false); setEditPayment(null) }}
              className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium bg-green-700 text-white rounded-lg hover:bg-green-800 disabled:opacity-60">
              {saving ? t('common.saving') : editPayment ? t('common.saveChanges') : t('suppliers.recordPayment')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Supplier Modal */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title={t('suppliers.editSupplier')}>
        <form onSubmit={handleEditSupplier} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('suppliers.companyName')} *</label>
            <input required value={editForm.company_name}
              onChange={e => setEditForm(f => ({ ...f, company_name: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('suppliers.ownerName')}</label>
            <input value={editForm.owner_name}
              onChange={e => setEditForm(f => ({ ...f, owner_name: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('suppliers.phone')}</label>
            <PhoneInput value={editForm.phone} onChange={v => setEditForm(f => ({ ...f, phone: v }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.notes')}</label>
            <textarea rows={3} value={editForm.notes}
              onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30 resize-none" />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setEditModal(false)}
              className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium bg-[#1B3A5C] text-white rounded-lg hover:bg-[#2E86AB] disabled:opacity-60">
              {saving ? t('common.saving') : t('common.saveChanges')}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget === 'supplier') handleDeleteSupplier()
          else if (deleteTarget?.type === 'tx') deleteTransaction(deleteTarget.item.id)
          else if (deleteTarget?.type === 'payment') {
            const pid = deleteTarget.item.id
            deletePayment(pid)
            if (pid) removeByReference({ source: 'supplier_payment', reference_id: pid })
          }
        }}
        title={t('common.delete')}
        message={deleteTarget === 'supplier'
          ? t('suppliers.deleteConfirm')
          : deleteTarget?.type === 'tx'
            ? t('suppliers.deleted') + '?'
            : t('suppliers.paymentDeleted') + '?'
        }
      />

      <WhatsAppPromptDialog
        open={!!waPrompt}
        onClose={() => setWaPrompt(null)}
        templateKey={waPrompt?.templateKey}
        variables={waPrompt?.variables}
        recipient={waPrompt?.recipient}
      />
    </div>
  )
}
