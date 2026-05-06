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

const emptyPayment = { amount: '', payment_date: todayStr(), notes: '' }

export default function MedicineSupplierDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t, isRTL } = useLanguage()
  const { deleteSupplier, updateSupplier } = useSuppliers()
  const {
    supplier, purchases, payments, loading,
    totalOwed, totalOwedUSD, totalPaid, remaining, totalUnits,
    recordPayment, updatePayment, deletePayment,
  } = useMedicineSupplierDetail(id)

  const [paymentModal, setPaymentModal] = useState(false)
  const [editPayment, setEditPayment] = useState(null)
  const [paymentForm, setPaymentForm] = useState(emptyPayment)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [editModal, setEditModal] = useState(false)
  const [editForm, setEditForm] = useState({ company_name: '', owner_name: '', phone: '', notes: '' })
  const [waPrompt, setWaPrompt] = useState(null)

  const BackIcon = isRTL ? ArrowRight : ArrowLeft

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
      setPaymentModal(false); setPaymentForm(emptyPayment); setEditPayment(null)
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
    if (ok) navigate('/suppliers')
  }

  if (loading) return <div className="text-center py-12 text-slate-400">{t('common.loading')}</div>
  if (!supplier) return null

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/suppliers" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
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

      {/* Stats Row 1 - Financial */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <div className="text-xs text-slate-500 mb-1">{t('suppliers.totalOwed')} (AFN)</div>
          <div className="text-lg font-bold text-red-600">{formatCurrency(totalOwed)}</div>
          {totalOwedUSD > 0 && (
            <div className="text-xs text-amber-600 font-semibold mt-0.5">${totalOwedUSD.toFixed(2)} USD</div>
          )}
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <div className="text-xs text-slate-500 mb-1">{t('suppliers.totalPaid')} (AFN)</div>
          <div className="text-lg font-bold text-green-600">{formatCurrency(totalPaid)}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <div className="text-xs text-slate-500 mb-1">{t('suppliers.remaining')} (AFN)</div>
          <div className={`text-lg font-bold ${remaining > 0 ? 'text-orange-600' : 'text-slate-600'}`}>{formatCurrency(remaining)}</div>
        </div>
        {totalOwedUSD > 0 && (
          <div className="bg-amber-50 rounded-xl border border-amber-200 shadow-sm p-4">
            <div className="text-xs text-amber-600 font-medium mb-1">Total Owed (USD)</div>
            <div className="text-lg font-bold text-amber-700">${totalOwedUSD.toFixed(2)}</div>
            <div className="text-xs text-amber-500 mt-0.5">USD purchases only</div>
          </div>
        )}
      </div>

      {/* Stats Row 2 */}
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
          else if (deleteTarget?.type === 'payment') deletePayment(deleteTarget.item.id)
        }}
        title={t('common.delete')}
        message={deleteTarget === 'supplier'
          ? t('suppliers.deleteConfirm')
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
