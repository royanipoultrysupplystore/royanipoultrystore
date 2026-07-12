import { useState } from 'react'
import { Plus, CreditCard, ChevronDown, ChevronUp, Edit2, Trash2 } from 'lucide-react'
import { useWalkInSales } from '../hooks/useWalkInSales'
import Modal from '../components/common/Modal'
import ConfirmDialog from '../components/common/ConfirmDialog'
import PhoneInput from '../components/common/PhoneInput'
import WhatsAppPromptDialog from '../components/common/WhatsAppPromptDialog'
import { formatCurrency } from '../utils/formatCurrency'
import { formatDate, todayStr } from '../utils/dateHelpers'
import { supabase } from '../config/supabase'
import { useLanguage } from '../contexts/LanguageContext'
import { lf } from '../utils/localizedField'
import toast from 'react-hot-toast'

export default function WalkInCustomers() {
  const { t, lang } = useLanguage()
  const { customers, sales, loading, addCustomer, deleteCustomer, updateSale, recordCustomerPayment } = useWalkInSales()
  const [search, setSearch] = useState('')
  const [addModal, setAddModal] = useState(false)
  const [payModal, setPayModal] = useState(null)
  const [editSale, setEditSale] = useState(null)
  const [editSaleForm, setEditSaleForm] = useState({})
  const [savingSale, setSavingSale] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [addForm, setAddForm] = useState({ name: '', phone: '', notes: '' })
  const [payAmount, setPayAmount] = useState('')
  const [payDate, setPayDate] = useState(todayStr())
  const [expanded, setExpanded] = useState(null)
  const [waPrompt, setWaPrompt] = useState(null)

  const filtered = customers.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone || '').includes(search)
  )

  async function handleAddCustomer(e) {
    e.preventDefault()
    await addCustomer(addForm)
    setAddModal(false)
    setAddForm({ name: '', phone: '', notes: '' })
  }

  function openEditSale(sale) {
    setEditSale(sale)
    setEditSaleForm({
      sale_date: sale.sale_date,
      customer_name: sale.customer_name || '',
      amount_paid: String(sale.amount_paid),
      payment_type: sale.payment_type || 'cash',
      notes: sale.notes || '',
    })
  }

  async function handleEditSale(e) {
    e.preventDefault()
    setSavingSale(true)
    await updateSale(editSale.id, editSale, editSaleForm)
    setSavingSale(false)
    setEditSale(null)
  }

  async function handlePayment(e) {
    e.preventDefault()
    if (!payAmount || parseFloat(payAmount) <= 0) { toast.error(t('customers.invalidAmount')); return }
    await supabase.from('sales').insert([{
      customer_id: payModal.id,
      customer_name: payModal.name,
      sale_date: payDate,
      total_amount: 0,
      amount_paid: parseFloat(payAmount),
      remaining: 0,
      payment_type: 'cash',
      notes: t('customers.paymentNote'),
      invoice_number: null,
    }])
    const paid = parseFloat(payAmount)
    const recipient = { name: payModal.name, phone: payModal.phone }
    const newBalance = Math.max(0, (payModal.balance || 0) - paid)
    const dateUsed = payDate
    await recordCustomerPayment(payModal.id, paid)
    setPayModal(null)
    setPayAmount('')
    setWaPrompt({
      templateKey: 'walkin_payment_received',
      variables: {
        name: recipient.name,
        amount: formatCurrency(paid),
        date: dateUsed,
        balance: formatCurrency(newBalance),
      },
      recipient,
    })
  }

  const customerSales = (customerId) =>
    sales.filter(s => s.customer_id === customerId && s.total_amount > 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <div className="w-8 h-8 border-2 border-[#2E86AB] border-t-transparent rounded-full animate-spin me-3" />
        {t('common.loading')}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder={t('customers.searchPlaceholder')}
          className="flex-1 px-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
        />
        <button onClick={() => setAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#1B3A5C] text-white rounded-xl text-sm font-medium hover:bg-[#2E86AB] transition-colors">
          <Plus size={16} /> {t('customers.addCustomer')}
        </button>
      </div>

      {customers.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 text-center">
            <p className="text-xs text-slate-500 mb-1">{t('customers.totalCustomers')}</p>
            <p className="text-2xl font-bold text-slate-800">{customers.length}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 text-center">
            <p className="text-xs text-slate-500 mb-1">{t('customers.totalSales')}</p>
            <p className="text-xl font-bold text-[#1B3A5C]">{formatCurrency(customers.reduce((s, c) => s + (c.total_purchases || 0), 0))}</p>
          </div>
          <div className="bg-red-50 rounded-xl p-4 border border-red-100 text-center">
            <p className="text-xs text-slate-500 mb-1">{t('customers.totalDebt')}</p>
            <p className="text-xl font-bold text-red-700">{formatCurrency(customers.reduce((s, c) => s + (c.total_debt || 0), 0))}</p>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <p className="text-sm">{t('customers.noCustomers')}</p>
          <button onClick={() => setAddModal(true)} className="mt-3 text-sm text-[#2E86AB] hover:underline">{t('customers.addFirst')}</button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(customer => (
            <div key={customer.id} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="flex items-center justify-between p-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#1B3A5C]/10 text-[#1B3A5C] flex items-center justify-center font-bold text-sm">
                      {customer.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{lf(customer, 'name', lang)}</p>
                      {customer.phone && <p className="text-xs text-slate-400">{customer.phone}</p>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-end">
                    <p className="text-xs text-slate-500">{t('customers.totalPurchases')}</p>
                    <p className="text-sm font-semibold text-slate-700">{formatCurrency(customer.total_purchases)}</p>
                  </div>
                  <div className={`text-end px-3 py-1 rounded-lg ${customer.total_debt > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                    <p className="text-xs text-slate-500">{t('common.debt')}</p>
                    <p className={`text-sm font-bold ${customer.total_debt > 0 ? 'text-red-700' : 'text-green-700'}`}>
                      {formatCurrency(customer.total_debt)}
                    </p>
                  </div>
                  {(customer.total_debt_usd || 0) > 0 && (
                    <div className="text-end px-3 py-1 rounded-lg bg-red-50">
                      <p className="text-xs text-slate-500">$ Debt (USD)</p>
                      <p className="text-sm font-bold text-red-700">${(customer.total_debt_usd || 0).toFixed(2)}</p>
                    </div>
                  )}
                  {customer.total_debt > 0 && (
                    <button
                      onClick={() => { setPayModal(customer); setPayAmount('') }}
                      className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700"
                    >
                      <CreditCard size={13} /> {t('customers.pay')}
                    </button>
                  )}
                  <button onClick={() => setDeleteTarget(customer)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                    <Trash2 size={15} />
                  </button>
                  <button onClick={() => setExpanded(expanded === customer.id ? null : customer.id)} className="p-1.5 text-slate-400 hover:text-slate-600">
                    {expanded === customer.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                </div>
              </div>

              {expanded === customer.id && (
                <div className="border-t border-slate-100 px-4 py-3 bg-slate-50">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{t('customers.saleHistory')}</p>
                  {customerSales(customer.id).length === 0 ? (
                    <p className="text-sm text-slate-400">{t('customers.noSales')}</p>
                  ) : (
                    <div className="space-y-2">
                      {customerSales(customer.id).map(sale => (
                        <div key={sale.id} className="flex items-center justify-between text-sm bg-white rounded-lg px-3 py-2">
                          <div>
                            <span className="font-mono text-xs text-slate-500 me-2">#{sale.invoice_number}</span>
                            <span className="text-slate-600">{formatDate(sale.sale_date)}</span>
                            <span className="text-xs text-slate-400 ms-2">{sale.sale_items?.length || 0} {t('dispatches.items').toLowerCase()}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-end">
                              <span className="font-semibold text-slate-800">{formatCurrency(sale.total_amount)}</span>
                              {sale.remaining > 0 && (
                                <span className="text-xs text-red-600 ms-2">{t('common.balance')}: {formatCurrency(sale.remaining)}</span>
                              )}
                            </div>
                            <button onClick={() => openEditSale(sale)} className="p-1.5 text-slate-400 hover:text-[#1B3A5C] hover:bg-slate-100 rounded">
                              <Edit2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Customer Modal */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title={t('customers.addCustomer')}>
        <form onSubmit={handleAddCustomer} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.name')} *</label>
            <input required value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.phone')}</label>
            <PhoneInput value={addForm.phone} onChange={v => setAddForm(f => ({ ...f, phone: v }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.notes')}</label>
            <input value={addForm.notes} onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setAddModal(false)} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">{t('common.cancel')}</button>
            <button type="submit" className="px-5 py-2 text-sm font-medium bg-[#1B3A5C] text-white rounded-lg hover:bg-[#2E86AB]">{t('customers.addCustomer')}</button>
          </div>
        </form>
      </Modal>

      {/* Record Payment Modal */}
      <Modal open={!!payModal} onClose={() => setPayModal(null)} title={`${t('customers.recordPayment')} — ${payModal?.name}`}>
        <form onSubmit={handlePayment} className="space-y-4">
          <div className="bg-slate-50 rounded-xl p-3 text-sm">
            {t('customers.totalDebt')}: <span className="font-bold text-red-600">{formatCurrency(payModal?.total_debt)}</span>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('payments.amountAFN')}</label>
            <input required type="number" min="0.01" step="0.01" value={payAmount}
              onChange={e => setPayAmount(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.date')}</label>
            <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setPayModal(null)} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">{t('common.cancel')}</button>
            <button type="submit" className="px-5 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700">{t('customers.recordPayment')}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { deleteCustomer(deleteTarget?.id); setDeleteTarget(null) }}
        title={t('customers.deleteCustomer')}
        message={t('customers.deleteConfirm')}
      />

      {/* Edit Sale Modal */}
      <Modal open={!!editSale} onClose={() => setEditSale(null)} title={`${t('customers.editSale')} ${editSale?.invoice_number ? `#${editSale.invoice_number}` : ''}`}>
        {editSale && (
          <form onSubmit={handleEditSale} className="space-y-4">
            <div className="bg-slate-50 rounded-xl p-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-slate-500">{t('dispatches.totalAmount')}</span><span className="font-semibold">{formatCurrency(editSale.total_amount)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">{t('dispatches.items')}</span><span>{editSale.sale_items?.length || 0}</span></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.date')}</label>
                <input type="date" value={editSaleForm.sale_date} onChange={e => setEditSaleForm(f => ({ ...f, sale_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('customers.paymentType')}</label>
                <select value={editSaleForm.payment_type} onChange={e => setEditSaleForm(f => ({ ...f, payment_type: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30">
                  <option value="cash">{t('customers.cash')}</option>
                  <option value="credit">{t('customers.credit')}</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('customers.amountPaid')}</label>
              <input type="number" min="0" step="0.01" max={editSale.total_amount} value={editSaleForm.amount_paid}
                onChange={e => setEditSaleForm(f => ({ ...f, amount_paid: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
              <p className="text-xs text-slate-400 mt-1">
                {t('customers.remainingAfter')} <span className="font-semibold text-red-600">{formatCurrency(Math.max(0, editSale.total_amount - parseFloat(editSaleForm.amount_paid || 0)))}</span>
                {' '}— {t('customers.debtAutoUpdate')}
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('customers.customerName')}</label>
              <input value={editSaleForm.customer_name} onChange={e => setEditSaleForm(f => ({ ...f, customer_name: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.notes')}</label>
              <input value={editSaleForm.notes} onChange={e => setEditSaleForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setEditSale(null)} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">{t('common.cancel')}</button>
              <button type="submit" disabled={savingSale} className="px-5 py-2 text-sm font-medium bg-[#1B3A5C] text-white rounded-lg hover:bg-[#2E86AB] disabled:opacity-60">
                {savingSale ? t('common.saving') : t('common.saveChanges')}
              </button>
            </div>
          </form>
        )}
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
