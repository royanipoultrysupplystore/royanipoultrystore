import { useState, Fragment } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Truck, CreditCard, Plus, Trash2, Edit2, Handshake, Receipt, ChevronDown, ChevronUp } from 'lucide-react'
import { useCommissionDealerDetail } from '../hooks/useCommission'
import Modal from '../components/common/Modal'
import ConfirmDialog from '../components/common/ConfirmDialog'
import WhatsAppPromptDialog from '../components/common/WhatsAppPromptDialog'
import { formatCurrency } from '../utils/formatCurrency'
import { formatDate, todayStr } from '../utils/dateHelpers'
import { useLanguage } from '../contexts/LanguageContext'

const emptyPayment = { amount: '', payment_date: todayStr(), notes: '' }

export default function CommissionDealerDetail() {
  const { id } = useParams()
  const { isRTL } = useLanguage()
  const {
    dealer, cars, payments, loading,
    totalOwed, totalPaid, balance, totalCommissionEarned, totalSold,
    totalEarnings, totalExpenses, pendingPayout,
    recordPayment, updatePayment, deletePayment,
  } = useCommissionDealerDetail(id)

  const [paymentModal, setPaymentModal] = useState(false)
  const [editPayment, setEditPayment] = useState(null)
  const [paymentForm, setPaymentForm] = useState(emptyPayment)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [waPrompt, setWaPrompt] = useState(null)
  const [expandedCar, setExpandedCar] = useState(null)

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
      if (isNew && dealer) {
        setWaPrompt({
          templateKey: 'supplier_payment_made',
          variables: {
            name: dealer.name,
            amount: formatCurrency(wasPaid),
            date: dateUsed,
            balance: formatCurrency(Math.max(0, balance - wasPaid)),
          },
          recipient: { name: dealer.name, phone: dealer.phone },
        })
      }
    }
  }

  if (loading) return <div className="text-center py-12 text-slate-400">Loading...</div>
  if (!dealer) return null

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/commission" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
            <BackIcon size={18} />
          </Link>
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Handshake size={20} className="text-[#1B3A5C]" /> {dealer.name}
            </h2>
            <p className="text-sm text-slate-500">
              {dealer.phone && <span dir="ltr">{dealer.phone}</span>}
            </p>
            {dealer.notes && <p className="text-xs text-slate-400 mt-0.5">{dealer.notes}</p>}
          </div>
        </div>
        {balance > 0 && (
          <button
            onClick={() => setWaPrompt({
              templateKey: 'balance_reminder',
              variables: {
                name: dealer.name,
                amount: formatCurrency(balance),
                date: todayStr(),
              },
              recipient: { name: dealer.name, phone: dealer.phone },
            })}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg text-sm font-medium hover:bg-orange-200"
          >
            💬 Send Reminder
          </button>
        )}
      </div>

      {/* Stats — Activity */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <div className="text-xs text-slate-500 mb-1">Total Cars</div>
          <div className="text-lg font-bold text-slate-700">{cars.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <div className="text-xs text-slate-500 mb-1">Total Sold</div>
          <div className="text-lg font-bold text-blue-600">{totalSold}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <div className="text-xs text-slate-500 mb-1">Total Earnings</div>
          <div className="text-lg font-bold text-green-600">{formatCurrency(totalEarnings)}</div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl shadow-sm p-4">
          <div className="text-xs text-orange-600 mb-1 flex items-center gap-1">
            <Receipt size={11} /> Total Expenses
          </div>
          <div className="text-lg font-bold text-orange-700">{formatCurrency(totalExpenses)}</div>
        </div>
      </div>

      {/* Stats — Money */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <div className="text-xs text-slate-500 mb-1">Total Owed (after expenses + commission)</div>
          <div className="text-lg font-bold text-red-600">{formatCurrency(totalOwed)}</div>
          {pendingPayout > 0 && pendingPayout !== totalOwed && (
            <div className="text-xs text-amber-600 mt-1">⚠ Includes {formatCurrency(pendingPayout)} from active (unfinished) cars</div>
          )}
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <div className="text-xs text-slate-500 mb-1">Total Paid to Dealer</div>
          <div className="text-lg font-bold text-green-600">{formatCurrency(totalPaid)}</div>
        </div>
        <div className={`rounded-xl border shadow-sm p-4 ${balance > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
          <div className="text-xs text-slate-500 mb-1">Balance Owed</div>
          <div className={`text-lg font-bold ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(balance)}</div>
        </div>
      </div>

      {/* Commission earned banner */}
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-center justify-between">
        <div>
          <div className="text-xs text-purple-600 font-medium uppercase tracking-wide">Total Commission Earned (from this dealer's cars)</div>
          <div className="text-xl font-bold text-purple-700 mt-1">{formatCurrency(totalCommissionEarned)}</div>
        </div>
        <div className="text-right text-xs text-purple-600">
          {totalSold} sold chickens
        </div>
      </div>

      {/* Cars table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-700 flex items-center gap-2">
            <Truck size={16} /> Cars ({cars.length})
          </h3>
          <span className="text-xs text-slate-400">Click a row to see expense details</span>
        </div>
        {cars.length === 0 ? (
          <p className="text-center py-8 text-slate-400 text-sm">No cars yet for this dealer</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase">
                  <th className="text-start px-5 py-3 font-medium w-8"></th>
                  <th className="text-start px-5 py-3 font-medium">Date</th>
                  <th className="text-start px-5 py-3 font-medium">Status</th>
                  <th className="text-start px-5 py-3 font-medium">Sold / Total</th>
                  <th className="text-start px-5 py-3 font-medium">Earnings</th>
                  <th className="text-start px-5 py-3 font-medium">Expenses</th>
                  <th className="text-start px-5 py-3 font-medium">Commission</th>
                  <th className="text-start px-5 py-3 font-medium">Dealer Payout</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {cars.map(car => {
                  const isExpanded = expandedCar === car.id
                  const hasExpenses = (car.expense_items || []).length > 0
                  return (
                    <Fragment key={car.id}>
                      <tr
                        onClick={() => setExpandedCar(isExpanded ? null : car.id)}
                        className="hover:bg-slate-50 cursor-pointer"
                      >
                        <td className="px-5 py-3 text-slate-400">
                          {hasExpenses ? (isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : ''}
                        </td>
                        <td className="px-5 py-3 font-medium">{formatDate(car.car_date)}</td>
                        <td className="px-5 py-3">
                          {car.is_closed
                            ? <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">✓ Closed</span>
                            : <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Active</span>
                          }
                        </td>
                        <td className="px-5 py-3 font-bold text-blue-600">{car.sold_chickens} / {car.total_chickens}</td>
                        <td className="px-5 py-3 text-green-600 font-medium">{formatCurrency(car.earnings)}</td>
                        <td className="px-5 py-3 text-orange-600 font-medium">
                          {formatCurrency(car.expenses)}
                          {hasExpenses && <span className="text-xs text-slate-400 ms-1">({car.expense_items.length})</span>}
                        </td>
                        <td className="px-5 py-3 text-purple-700 font-medium">{formatCurrency(car.commission_fee)}</td>
                        <td className={`px-5 py-3 font-bold ${car.dealer_payout >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
                          {formatCurrency(car.dealer_payout)}
                        </td>
                      </tr>
                      {isExpanded && hasExpenses && (
                        <tr className="bg-orange-50/50">
                          <td colSpan={8} className="px-5 py-3">
                            <div className="text-xs font-semibold text-orange-700 mb-2 flex items-center gap-1.5">
                              <Receipt size={12} /> Expense Breakdown ({car.expense_items.length})
                            </div>
                            <div className="grid gap-1.5">
                              {car.expense_items.map(exp => (
                                <div key={exp.id} className="flex items-center justify-between bg-white border border-orange-200 rounded-lg px-3 py-1.5 text-sm">
                                  <span className="text-slate-700">{exp.description}</span>
                                  <span className="font-bold text-orange-700">{formatCurrency(exp.amount)}</span>
                                </div>
                              ))}
                              <div className="flex items-center justify-between border-t border-orange-200 pt-2 mt-1 text-sm">
                                <span className="font-semibold text-slate-700">Total Expenses</span>
                                <span className="font-bold text-orange-700">{formatCurrency(car.expenses)}</span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                      {isExpanded && !hasExpenses && (
                        <tr className="bg-slate-50/50">
                          <td colSpan={8} className="px-5 py-3 text-xs text-slate-400 text-center italic">
                            No expenses recorded for this car
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payments */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-700 flex items-center gap-2">
            <CreditCard size={16} /> Payments to Dealer ({payments.length})
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
                  <button onClick={() => setDeleteTarget(p)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={paymentModal}
        onClose={() => { setPaymentModal(false); setEditPayment(null) }}
        title={editPayment ? 'Edit Payment' : 'Record Payment to Dealer'}
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
        onConfirm={() => deletePayment(deleteTarget?.id)}
        title="Delete Payment"
        message="Remove this payment?"
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
