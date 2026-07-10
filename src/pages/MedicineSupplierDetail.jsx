import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ShoppingBag, CreditCard, Plus, Trash2, Edit2, Info } from 'lucide-react'
import { useMedicineSupplierDetail } from '../hooks/useSuppliers'
import { useSuppliers } from '../hooks/useSuppliers'
import Modal from '../components/common/Modal'
import ConfirmDialog from '../components/common/ConfirmDialog'
import PhoneInput from '../components/common/PhoneInput'
import WhatsAppPromptDialog from '../components/common/WhatsAppPromptDialog'
import { formatCurrency } from '../utils/formatCurrency'
import { formatDate, todayStr } from '../utils/dateHelpers'
import { useLanguage } from '../contexts/LanguageContext'
import { useStoreCash } from '../contexts/StoreCashContext'

const emptyPayment = { currency: 'AFN', amount: '', payment_date: todayStr(), notes: '' }

export default function MedicineSupplierDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t, isRTL } = useLanguage()
  const { suppliers: allSuppliers, deleteSupplier, updateSupplier } = useSuppliers()
  const medicineSuppliers = allSuppliers.filter(s => s.type === 'medicine')
  const {
    supplier, purchases, payments, loading,
    totalOwedAFN, totalOwedUSD, totalPaidAFN, totalPaidUSD, remainingAFN, remainingUSD,
    totalUnits,
    recordPayment, updatePayment, deletePayment,
    updatePurchase, deletePurchase,
  } = useMedicineSupplierDetail(id)

  const hasAFN = totalOwedAFN > 0 || totalPaidAFN > 0
  const hasUSD = totalOwedUSD > 0 || totalPaidUSD > 0

  const [paymentModal, setPaymentModal] = useState(false)
  const [payFromStoreCash, setPayFromStoreCash] = useState(true)
  const { recordOut, removeByReference } = useStoreCash()
  const [editPayment, setEditPayment] = useState(null)
  const [paymentForm, setPaymentForm] = useState(emptyPayment)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [editModal, setEditModal] = useState(false)
  const [editForm, setEditForm] = useState({ company_name: '', owner_name: '', phone: '', notes: '' })
  const [editPurchaseItem, setEditPurchaseItem] = useState(null)
  const [purchaseForm, setPurchaseForm] = useState({
    supplier_id: '',
    quantity: '', batch_number: '', purchase_date: todayStr(),
    purchase_price: '', purchase_price_usd: '', usd_to_afn_rate: '', notes: '',
  })
  const [waPrompt, setWaPrompt] = useState(null)

  const BackIcon = isRTL ? ArrowRight : ArrowLeft

  function openNewPayment() {
    setEditPayment(null)
    // Default currency: USD if only USD has outstanding, otherwise AFN
    const defaultCurrency = (remainingUSD > 0 && remainingAFN <= 0) ? 'USD' : 'AFN'
    setPaymentForm({ ...emptyPayment, currency: defaultCurrency, payment_date: todayStr() })
    setPaymentModal(true)
  }

  function openEditPayment(p) {
    setEditPayment(p)
    const currency = (p.amount_usd || 0) > 0 ? 'USD' : 'AFN'
    const amount = currency === 'USD' ? p.amount_usd : p.amount
    setPaymentForm({
      currency,
      amount: String(amount || ''),
      payment_date: p.payment_date,
      notes: p.notes || '',
    })
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
      const currency = paymentForm.currency
      // Store Cash tracks AFN only. USD medicine payments intentionally
      // don't touch the till (client asked to keep the till AFN-only).
      if (isNew && currency === 'AFN' && payFromStoreCash && wasPaid > 0) {
        await recordOut({
          amount: wasPaid,
          source: 'supplier_payment',
          reference_id: ok?.id || null,
          note: supplier?.company_name || 'Medicine supplier',
          date: dateUsed,
        })
      }
      setPaymentModal(false); setPaymentForm(emptyPayment); setEditPayment(null); setPayFromStoreCash(true)
      if (isNew && supplier) {
        const amountStr = currency === 'USD' ? `$${wasPaid.toFixed(2)}` : formatCurrency(wasPaid)
        const remBefore = currency === 'USD' ? remainingUSD : remainingAFN
        const remAfter = Math.max(0, remBefore - wasPaid)
        const balanceStr = currency === 'USD' ? `$${remAfter.toFixed(2)}` : formatCurrency(remAfter)
        setWaPrompt({
          templateKey: 'supplier_payment_made',
          variables: {
            name: supplier.company_name,
            amount: amountStr,
            date: dateUsed,
            balance: balanceStr,
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

  function openEditPurchase(p) {
    setEditPurchaseItem(p)
    setPurchaseForm({
      supplier_id: p.supplier_id || id,
      quantity: String(p.quantity || ''),
      batch_number: p.batch_number || '',
      purchase_date: p.purchase_date,
      purchase_price: String(p.purchase_price || ''),
      purchase_price_usd: p.purchase_price_usd ? String(p.purchase_price_usd) : '',
      usd_to_afn_rate: p.usd_to_afn_rate ? String(p.usd_to_afn_rate) : '',
      notes: p.notes || '',
    })
  }

  async function handlePurchaseUpdate(e) {
    e.preventDefault()
    setSaving(true)
    const movedToOtherSupplier = purchaseForm.supplier_id && purchaseForm.supplier_id !== id
    const ok = await updatePurchase(editPurchaseItem.id, purchaseForm)
    setSaving(false)
    if (ok) {
      setEditPurchaseItem(null)
      if (movedToOtherSupplier) {
        const target = medicineSuppliers.find(s => s.id === purchaseForm.supplier_id)
        if (target) navigate(`/suppliers/medicine/${target.id}`)
      }
    }
  }

  async function handleDeleteSupplier() {
    const ok = await deleteSupplier(id)
    if (ok) navigate('/suppliers?tab=medicine')
  }

  if (loading) return <div className="text-center py-12 text-slate-400">{t('common.loading')}</div>
  if (!supplier) return null

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/suppliers?tab=medicine" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
            <BackIcon size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">💊</span>
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

      {/* AFN Balance — only if any AFN activity */}
      {hasAFN && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">{t('suppliers.afnBalance')}</div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="text-xs text-slate-500 mb-0.5">{t('suppliers.totalOwed')}</div>
              <div className="text-lg font-bold text-red-600">{formatCurrency(totalOwedAFN)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-0.5">{t('suppliers.totalPaid')}</div>
              <div className="text-lg font-bold text-green-600">{formatCurrency(totalPaidAFN)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-0.5">{t('suppliers.remaining')}</div>
              <div className={`text-lg font-bold ${remainingAFN > 0 ? 'text-orange-600' : 'text-slate-600'}`}>{formatCurrency(remainingAFN)}</div>
            </div>
          </div>
        </div>
      )}

      {/* USD Balance — only if any USD activity */}
      {hasUSD && (
        <div className="bg-amber-50 rounded-2xl border border-amber-200 shadow-sm p-5">
          <div className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-3">{t('suppliers.usdBalance')}</div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="text-xs text-amber-600 mb-0.5">{t('suppliers.totalOwed')}</div>
              <div className="text-lg font-bold text-red-700">${totalOwedUSD.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-xs text-amber-600 mb-0.5">{t('suppliers.totalPaid')}</div>
              <div className="text-lg font-bold text-green-700">${totalPaidUSD.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-xs text-amber-600 mb-0.5">{t('suppliers.remaining')}</div>
              <div className={`text-lg font-bold ${remainingUSD > 0 ? 'text-orange-700' : 'text-slate-600'}`}>${remainingUSD.toFixed(2)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Empty state — no purchases yet */}
      {!hasAFN && !hasUSD && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-center text-sm text-slate-500">
          {t('suppliers.noDispatches')}
        </div>
      )}

      {/* Stats Row — counts */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <div className="text-xs text-slate-500 mb-1">{t('suppliers.totalUnits')}</div>
          <div className="text-lg font-bold text-blue-600">{totalUnits}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <div className="text-xs text-slate-500 mb-1">{t('suppliers.medicinePurchases')}</div>
          <div className="text-lg font-bold text-slate-700">{purchases.length}</div>
        </div>
      </div>

      {/* Medicine Purchases */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-700 flex items-center gap-2">
            <ShoppingBag size={16} /> {t('suppliers.medicinePurchases')}
          </h3>
        </div>

        {/* Hint banner */}
        <div className="mx-5 mt-4 mb-2 flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-xs text-blue-700">
          <Info size={14} className="shrink-0 mt-0.5" />
          <span>{t('suppliers.addMedicinePurchaseHint')}</span>
        </div>

        {purchases.length === 0 ? (
          <p className="text-center py-8 text-slate-400 text-sm">{t('suppliers.noDispatches')}</p>
        ) : (
          <div className="divide-y divide-slate-50 mt-2">
            {purchases.map(p => (
              <div key={p.id} className="px-5 py-3 flex items-start gap-3">
                <div className="flex-1 grid grid-cols-2 sm:grid-cols-6 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-slate-400">{t('common.date')}</div>
                    <div className="font-medium">{formatDate(p.purchase_date)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">{t('common.name')}</div>
                    <div className="font-medium text-slate-800">{p.products?.name || '—'}</div>
                    {p.products?.unit && <div className="text-xs text-slate-400">{p.products.unit}</div>}
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">{t('inventory.batchNo')}</div>
                    <div className="font-medium">{p.batch_number || '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">{t('inventory.quantity')}</div>
                    <div className="font-bold text-blue-600">{p.quantity}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">{t('inventory.purchasePrice')}</div>
                    {p.purchase_price_usd > 0
                      ? <div className="font-semibold text-amber-700">${p.purchase_price_usd}</div>
                      : <div className="font-medium">{formatCurrency(p.purchase_price)}</div>
                    }
                    {p.purchase_price_usd > 0 && (
                      <div className="text-xs text-slate-400">{formatCurrency(p.purchase_price)}</div>
                    )}
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">{t('common.total')}</div>
                    {p.purchase_price_usd > 0
                      ? <div className="font-bold text-amber-700">${(p.purchase_price_usd * p.quantity).toFixed(2)}</div>
                      : <div className="font-bold text-red-600">{formatCurrency(p.total_cost)}</div>
                    }
                    {p.purchase_price_usd > 0 && (
                      <div className="text-xs text-slate-400">{formatCurrency(p.total_cost)}</div>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEditPurchase(p)} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => setDeleteTarget({ type: 'purchase', item: p })} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
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
            {payments.map(p => {
              const isUSD = (p.amount_usd || 0) > 0
              const value = isUSD ? p.amount_usd : p.amount
              return (
                <div key={p.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 text-sm">
                    <div>
                      <div className="text-xs text-slate-400">{t('common.date')}</div>
                      <div className="font-medium">{formatDate(p.payment_date)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">{t('common.amount')}</div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-green-600">
                          {isUSD ? `$${(value || 0).toFixed(2)}` : formatCurrency(value)}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isUSD ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                          {isUSD ? 'USD' : 'AFN'}
                        </span>
                      </div>
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
              )
            })}
          </div>
        )}
      </div>

      {/* Payment Modal */}
      <Modal
        open={paymentModal}
        onClose={() => { setPaymentModal(false); setEditPayment(null) }}
        title={editPayment ? t('suppliers.editPayment') : t('suppliers.recordPayment')}
      >
        <form onSubmit={handlePayment} className="space-y-4">
          {/* Currency toggle */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">{t('suppliers.currency')} *</label>
            <div className="grid grid-cols-2 gap-2">
              <label className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border-2 cursor-pointer text-sm font-medium transition-colors ${paymentForm.currency === 'AFN' ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                <input type="radio" name="currency" value="AFN" checked={paymentForm.currency === 'AFN'}
                  onChange={e => setPaymentForm(f => ({ ...f, currency: e.target.value }))} className="sr-only" />
                AFN
              </label>
              <label className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border-2 cursor-pointer text-sm font-medium transition-colors ${paymentForm.currency === 'USD' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                <input type="radio" name="currency" value="USD" checked={paymentForm.currency === 'USD'}
                  onChange={e => setPaymentForm(f => ({ ...f, currency: e.target.value }))} className="sr-only" />
                USD ($)
              </label>
            </div>
          </div>

          {/* Outstanding for selected currency */}
          {((paymentForm.currency === 'AFN' && remainingAFN > 0) || (paymentForm.currency === 'USD' && remainingUSD > 0)) && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm flex items-center justify-between">
              <span className="text-slate-600">{t('suppliers.remaining')}:</span>
              <span className={`font-bold ${paymentForm.currency === 'USD' ? 'text-amber-700' : 'text-orange-700'}`}>
                {paymentForm.currency === 'USD' ? `$${remainingUSD.toFixed(2)}` : formatCurrency(remainingAFN)}
              </span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {t('common.amount')} ({paymentForm.currency}) *
            </label>
            <input required type="number" min="0.01" step="0.01" value={paymentForm.amount}
              onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
            {((paymentForm.currency === 'AFN' && remainingAFN > 0) || (paymentForm.currency === 'USD' && remainingUSD > 0)) && (
              <button type="button"
                onClick={() => setPaymentForm(f => ({ ...f, amount: String(f.currency === 'USD' ? remainingUSD : remainingAFN) }))}
                className="text-xs text-[#2E86AB] hover:underline mt-1"
              >
                {t('pos.setFullAmount')}
              </button>
            )}
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
          {!editPayment && paymentForm.currency === 'AFN' && (
            <label className="flex items-center gap-2 text-sm text-slate-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 cursor-pointer">
              <input type="checkbox" checked={payFromStoreCash} onChange={e => setPayFromStoreCash(e.target.checked)} className="rounded text-red-600" />
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
          else if (deleteTarget?.type === 'payment') {
            const pid = deleteTarget.item.id
            deletePayment(pid)
            if (pid) removeByReference({ source: 'supplier_payment', reference_id: pid })
          }
          else if (deleteTarget?.type === 'purchase') deletePurchase(deleteTarget.item)
        }}
        title={t('common.delete')}
        message={deleteTarget === 'supplier'
          ? t('suppliers.deleteConfirm')
          : deleteTarget?.type === 'purchase'
            ? t('inventory.deleteMsg')
            : t('suppliers.paymentDeleted') + '?'
        }
      />

      {/* Edit Purchase Modal */}
      <Modal
        open={!!editPurchaseItem}
        onClose={() => setEditPurchaseItem(null)}
        title={`${t('common.edit')} — ${editPurchaseItem?.products?.name || ''}`}
        size="lg"
      >
        <form onSubmit={handlePurchaseUpdate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-1 sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('suppliers.companyName')} *</label>
              <select
                required
                value={purchaseForm.supplier_id}
                onChange={e => setPurchaseForm(f => ({ ...f, supplier_id: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
              >
                {medicineSuppliers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.company_name}{s.owner_name ? ` — ${s.owner_name}` : ''}
                  </option>
                ))}
              </select>
              {purchaseForm.supplier_id && purchaseForm.supplier_id !== id && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 mt-1.5">
                  ⚠ This purchase will move to <strong>{medicineSuppliers.find(s => s.id === purchaseForm.supplier_id)?.company_name}</strong>. Their balance will increase by this amount; the current supplier's will decrease.
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('inventory.quantity')} *</label>
              <input required type="number" min="0.01" step="0.01" value={purchaseForm.quantity}
                onChange={e => setPurchaseForm(f => ({ ...f, quantity: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('inventory.batchNumber')}</label>
              <input value={purchaseForm.batch_number}
                onChange={e => setPurchaseForm(f => ({ ...f, batch_number: e.target.value }))}
                dir="ltr"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
            </div>
            <div className="col-span-1 sm:col-span-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{t('inventory.purchasePrice')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{t('inventory.priceAFN')}</label>
                  <input type="number" min="0" step="0.01" value={purchaseForm.purchase_price}
                    onChange={e => setPurchaseForm(f => ({ ...f, purchase_price: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{t('inventory.priceUSD')}</label>
                  <input type="number" min="0" step="0.01" value={purchaseForm.purchase_price_usd}
                    onChange={e => setPurchaseForm(f => ({ ...f, purchase_price_usd: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{t('inventory.usdRate')}</label>
                  <input type="number" min="0" step="0.01" value={purchaseForm.usd_to_afn_rate}
                    onChange={e => setPurchaseForm(f => ({ ...f, usd_to_afn_rate: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
                </div>
              </div>
              {parseFloat(purchaseForm.purchase_price_usd) > 0 && parseFloat(purchaseForm.usd_to_afn_rate) > 0 && (
                <p className="text-xs text-green-700 mt-1 font-medium">
                  → {formatCurrency(parseFloat(purchaseForm.purchase_price_usd) * parseFloat(purchaseForm.usd_to_afn_rate))}
                  {purchaseForm.quantity && ` — ${t('common.total')}: ${formatCurrency(parseFloat(purchaseForm.quantity) * parseFloat(purchaseForm.purchase_price_usd) * parseFloat(purchaseForm.usd_to_afn_rate))}`}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('inventory.purchaseDate')}</label>
              <input type="date" value={purchaseForm.purchase_date}
                onChange={e => setPurchaseForm(f => ({ ...f, purchase_date: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.notes')}</label>
              <input value={purchaseForm.notes}
                onChange={e => setPurchaseForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setEditPurchaseItem(null)}
              className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium bg-[#1B3A5C] text-white rounded-lg hover:bg-[#2E86AB] disabled:opacity-60">
              {saving ? t('common.saving') : t('common.saveChanges')}
            </button>
          </div>
        </form>
      </Modal>

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
