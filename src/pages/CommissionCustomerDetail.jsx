import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CreditCard, ShoppingBag, Plus, Trash2, Edit2 } from 'lucide-react'
import { useCommissionCustomerDetail } from '../hooks/useCommission'
import Modal from '../components/common/Modal'
import ConfirmDialog from '../components/common/ConfirmDialog'
import WhatsAppPromptDialog from '../components/common/WhatsAppPromptDialog'
import { formatCurrency } from '../utils/formatCurrency'
import { formatDate, todayStr } from '../utils/dateHelpers'
import { useLanguage } from '../contexts/LanguageContext'

const emptyPayment = { amount: '', payment_date: todayStr(), notes: '' }

export default function CommissionCustomerDetail() {
  const { id } = useParams()
  const { isRTL } = useLanguage()
  const {
    customer, sales, payments, loading,
    totalPurchased, totalChickens, totalPaid, balance,
    recordPayment, updatePayment, deletePayment, deleteSale,
  } = useCommissionCustomerDetail(id)

  const [paymentModal, setPaymentModal] = useState(false)
  const [editPayment, setEditPayment] = useState(null)
  const [paymentForm, setPaymentForm] = useState(emptyPayment)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
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
      if (isNew && customer) {
        setWaPrompt({
          templateKey: 'commission_payment_received',
          variables: {
            name: customer.name,
            amount: formatCurrency(wasPaid),
            date: dateUsed,
            balance: formatCurrency(Math.max(0, balance - wasPaid)),
          },
          recipient: { name: customer.name, phone: customer.phone },
        })
      }
    }
  }

  if (loading) return <div className="text-center py-12 text-slate-400">Loading...</div>
  if (!customer) return null

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/commission" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
            <BackIcon size={18} />
          </Link>
          <div>
            <h2 className="text-xl font-bold text-slate-800">{customer.name}</h2>
            <p className="text-sm text-slate-500">
              {customer.phone && <span dir="ltr">{customer.phone}</span>}
            </p>
            {customer.notes && <p className="text-xs text-slate-400 mt-0.5">{customer.notes}</p>}
          </div>
        </div>
        {balance > 0 && (
          <button
            onClick={() => setWaPrompt({
              templateKey: 'balance_reminder',
              variables: {
                name: customer.name,
                amount: formatCurrency(balance),
                date: todayStr(),
              },
              recipient: { name: customer.name, phone: customer.phone },
            })}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg text-sm font-medium hover:bg-orange-200"
          >
            💬 Send Reminder
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <div className="text-xs text-slate-500 mb-1">Total Bought</div>
          <div className="text-lg font-bold text-slate-700">{formatCurrency(totalPurchased)}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <div className="text-xs text-slate-500 mb-1">Chickens</div>
          <div className="text-lg font-bold text-blue-600">{totalChickens}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <div className="text-xs text-slate-500 mb-1">Total Paid</div>
          <div className="text-lg font-bold text-green-600">{formatCurrency(totalPaid)}</div>
        </div>
        <div className={`rounded-xl border shadow-sm p-4 ${balance > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
          <div className="text-xs text-slate-500 mb-1">Balance Owed</div>
          <div className={`text-lg font-bold ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(balance)}</div>
        </div>
      </div>

      {/* Sales History */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-700 flex items-center gap-2">
            <ShoppingBag size={16} /> Purchase History ({sales.length})
          </h3>
        </div>
        {sales.length === 0 ? (
          <p className="text-center py-8 text-slate-400 text-sm">No purchases yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase">
                  <th className="text-start px-5 py-3 font-medium">Date</th>
                  <th className="text-start px-5 py-3 font-medium">Type</th>
                  <th className="text-start px-5 py-3 font-medium">Chickens</th>
                  <th className="text-start px-5 py-3 font-medium">Weight</th>
                  <th className="text-start px-5 py-3 font-medium">Price</th>
                  <th className="text-start px-5 py-3 font-medium">Total</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sales.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium">{formatDate(s.sale_date)}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${s.sale_type === 'per_kg' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                        {s.sale_type === 'per_kg' ? '⚖️ Per KG' : '🐔 Per Chicken'}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-medium">{s.chicken_count}</td>
                    <td className="px-5 py-3">{s.weight_kg > 0 ? `${s.weight_kg} kg` : '—'}</td>
                    <td className="px-5 py-3">{formatCurrency(s.price_per_unit)}<span className="text-xs text-slate-400">/{s.sale_type === 'per_kg' ? 'kg' : 'pc'}</span></td>
                    <td className="px-5 py-3 font-bold text-slate-700">{formatCurrency(s.total_amount)}</td>
                    <td className="px-5 py-3">
                      <button onClick={() => setDeleteTarget({ type: 'sale', item: s })} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payments */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-700 flex items-center gap-2">
            <CreditCard size={16} /> Payments ({payments.length})
          </h3>
          <button
            onClick={openNewPayment}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800"
          >
            <Plus size={14} /> Record Payment
          </button>
        </div>

        {payments.length === 0 ? (
          <p className="text-center py-8 text-slate-400 text-sm">No payments yet</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {payments.map(p => (
              <div key={p.id} className="px-5 py-3 flex items-center gap-3">
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 text-sm">
                  <div>
                    <div className="text-xs text-slate-400">Date</div>
                    <div className="font-medium">{formatDate(p.payment_date)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">Amount</div>
                    <div className="font-bold text-green-600">{formatCurrency(p.amount)}</div>
                  </div>
                  {p.notes && (
                    <div>
                      <div className="text-xs text-slate-400">Notes</div>
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
        title={editPayment ? 'Edit Payment' : 'Record Payment'}
      >
        <form onSubmit={handlePayment} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Amount (AFN) *</label>
            <input
              required type="number" min="0.01" step="0.01"
              value={paymentForm.amount}
              onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
            <input
              type="date" value={paymentForm.payment_date}
              onChange={e => setPaymentForm(f => ({ ...f, payment_date: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <input
              value={paymentForm.notes}
              onChange={e => setPaymentForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
            />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => { setPaymentModal(false); setEditPayment(null) }} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium bg-green-700 text-white rounded-lg hover:bg-green-800 disabled:opacity-60">
              {saving ? 'Saving...' : editPayment ? 'Save Changes' : 'Record Payment'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget?.type === 'sale') deleteSale(deleteTarget.item.id)
          else if (deleteTarget?.type === 'payment') deletePayment(deleteTarget.item.id)
        }}
        title="Delete"
        message={deleteTarget?.type === 'sale' ? 'Remove this sale?' : 'Remove this payment?'}
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
