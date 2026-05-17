import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Phone, Store, Edit2, Plus, Trash2, CreditCard } from 'lucide-react'
import { useMarketSellers, useMarketSellerPayments } from '../hooks/useMarketSellers'
import { useMarketTransactions } from '../hooks/useMarketTransactions'
import { useFarms } from '../hooks/useFarms'
import Modal from '../components/common/Modal'
import ConfirmDialog from '../components/common/ConfirmDialog'
import PhoneInput from '../components/common/PhoneInput'
import WhatsAppPromptDialog from '../components/common/WhatsAppPromptDialog'
import { formatCurrency } from '../utils/formatCurrency'
import { formatDate, todayStr } from '../utils/dateHelpers'
import { useLanguage } from '../contexts/LanguageContext'
import { lf } from '../utils/localizedField'

const emptyTxForm = {
  bill_number: '',
  farm_id: '',
  chicken_count: '',
  price_per_chicken: '',
  total_amount: '',
  transaction_date: todayStr(),
  notes: '',
}

export default function MarketSellerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t, lang } = useLanguage()
  const { getSellerById, updateSeller, deleteSeller } = useMarketSellers()
  const { transactions, loading: txLoading, addTransaction, updateTransaction, deleteTransaction } = useMarketTransactions({ sellerId: id })
  const { payments: sellerPayments, loading: payLoading, totalPaid: totalPaidByseller, addPayment, updatePayment, deletePayment } = useMarketSellerPayments(id)
  const { farms } = useFarms()

  const [seller, setSeller] = useState(null)
  const [editModal, setEditModal] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [txModal, setTxModal] = useState(false)
  const [editTxItem, setEditTxItem] = useState(null)
  const [txForm, setTxForm] = useState(emptyTxForm)
  const [txDeleteTarget, setTxDeleteTarget] = useState(null)
  const [deleteSellerConfirm, setDeleteSellerConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [farmSearch, setFarmSearch] = useState('')
  const [farmDropOpen, setFarmDropOpen] = useState(false)
  const farmDropRef = useRef(null)
  const [paymentModal, setPaymentModal] = useState(false)
  const [editPaymentItem, setEditPaymentItem] = useState(null)
  const [paymentForm, setPaymentForm] = useState({ amount: '', payment_date: todayStr(), notes: '' })
  const [paymentDeleteTarget, setPaymentDeleteTarget] = useState(null)
  const [waPrompt, setWaPrompt] = useState(null)

  useEffect(() => {
    getSellerById(id).then(data => {
      if (!data) { navigate('/market'); return }
      setSeller(data)
      setEditForm(data)
    })
  }, [id])

  useEffect(() => {
    function handleClick(e) {
      if (farmDropRef.current && !farmDropRef.current.contains(e.target)) setFarmDropOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const totalChickens = transactions.reduce((s, tx) => s + (tx.chicken_count || 0), 0)
  const totalOwed = transactions.reduce((s, tx) => s + (tx.total_amount || 0), 0)
  const remainingFromSeller = totalOwed - totalPaidByseller

  const filteredFarms = farms.filter(f =>
    f.is_active && (!farmSearch ||
      f.name.toLowerCase().includes(farmSearch.toLowerCase()) ||
      (f.owner_name || '').toLowerCase().includes(farmSearch.toLowerCase()))
  )

  const selectedFarmName = txForm.farm_id
    ? lf(farms.find(f => f.id === txForm.farm_id), 'name', lang) || ''
    : ''

  function openAddTx() {
    setEditTxItem(null)
    setTxForm(emptyTxForm)
    setFarmSearch('')
    setTxModal(true)
  }

  function openEditTx(tx) {
    setEditTxItem(tx)
    setTxForm({
      bill_number: tx.bill_number || '',
      farm_id: tx.farm_id || '',
      chicken_count: String(tx.chicken_count || ''),
      price_per_chicken: String(tx.price_per_chicken || ''),
      total_amount: String(tx.total_amount || ''),
      transaction_date: tx.transaction_date,
      notes: tx.notes || '',
    })
    setFarmSearch('')
    setTxModal(true)
  }

  // Auto-fill total_amount from chickens × price (still editable). User-typed totals are preserved.
  function handleTxChange(field, value) {
    setTxForm(f => {
      const next = { ...f, [field]: value }
      if (field === 'chicken_count' || field === 'price_per_chicken') {
        const qty = parseInt(field === 'chicken_count' ? value : next.chicken_count) || 0
        const price = parseFloat(field === 'price_per_chicken' ? value : next.price_per_chicken) || 0
        if (qty > 0 && price > 0) next.total_amount = String(qty * price)
      }
      return next
    })
  }

  async function handleTxSubmit(e) {
    e.preventDefault()
    if (!txForm.farm_id) return
    setSaving(true)
    const payload = {
      seller_id: id,
      farm_id: txForm.farm_id,
      bill_number: txForm.bill_number || null,
      chicken_count: parseInt(txForm.chicken_count) || 0,
      price_per_chicken: parseFloat(txForm.price_per_chicken) || 0,
      total_amount: parseFloat(txForm.total_amount) || 0,
      transaction_date: txForm.transaction_date,
      notes: txForm.notes || null,
    }
    const ok = editTxItem
      ? await updateTransaction(editTxItem.id, editTxItem, payload)
      : await addTransaction(payload)
    setSaving(false)
    if (ok) {
      setTxModal(false)
      // On a new transaction, message the seller, then the farm owner.
      if (!editTxItem) {
        const farm = farms.find(f => f.id === payload.farm_id)
        const farmName = farm ? (lf(farm, 'name', lang) || farm.name) : '—'
        const count = payload.chicken_count
        const amountStr = formatCurrency(payload.total_amount)
        const billStr = payload.bill_number || '—'
        setWaPrompt({
          templateKey: 'market_chickens_sent',
          variables: { name: seller.name, count, farm_name: farmName, bill: billStr, amount: amountStr, date: payload.transaction_date },
          recipient: { name: seller.name, phone: seller.phone },
          next: farm ? () => {
            setWaPrompt({
              templateKey: 'farm_chickens_to_market',
              variables: { name: farmName, count, seller_name: seller.name, bill: billStr, amount: amountStr, date: payload.transaction_date },
              recipient: { name: farmName, phone: farm.phone },
            })
          } : null,
        })
      }
    }
  }

  function openAddPayment() {
    setEditPaymentItem(null)
    setPaymentForm({ amount: '', payment_date: todayStr(), notes: '' })
    setPaymentModal(true)
  }

  function openEditPayment(p) {
    setEditPaymentItem(p)
    setPaymentForm({
      amount: String(p.amount || ''),
      payment_date: p.payment_date,
      notes: p.notes || '',
    })
    setPaymentModal(true)
  }

  async function handlePaymentSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const ok = editPaymentItem
      ? await updatePayment(editPaymentItem.id, paymentForm)
      : await addPayment(paymentForm)
    setSaving(false)
    if (ok) { setPaymentModal(false); setEditPaymentItem(null) }
  }

  async function handleEditSave(e) {
    e.preventDefault()
    const ok = await updateSeller(id, { name: editForm.name, shop_number: editForm.shop_number, phone: editForm.phone, notes: editForm.notes })
    if (ok) { setSeller({ ...seller, ...editForm }); setEditModal(false) }
  }

  if (!seller) {
    return <div className="flex items-center justify-center h-64 text-slate-400">
      <div className="w-8 h-8 border-2 border-[#2E86AB] border-t-transparent rounded-full animate-spin me-3" />{t('common.loading')}
    </div>
  }

  return (
    <div className="space-y-4">
      <button onClick={() => navigate('/market')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={16} /> {t('common.back')}
      </button>

      {/* Header */}
      <div className="bg-[#1B3A5C] rounded-2xl p-5 text-white">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Store size={20} className="text-white/60" />
              <span className="text-xs text-white/50">{t('market.commissionWorker')}</span>
            </div>
            <h2 className="text-2xl font-bold">{seller.name}</h2>
            {seller.shop_number && <p className="text-white/70 mt-1">{t('market.shopNumber')}: {seller.shop_number}</p>}
            {seller.phone && (
              <div className="flex items-center gap-1.5 text-sm text-white/70 mt-2">
                <Phone size={14} />{seller.phone}
              </div>
            )}
            {seller.notes && <p className="text-sm text-white/50 mt-2">{seller.notes}</p>}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditModal(true)} className="p-2 rounded-lg bg-white/10 hover:bg-white/20">
              <Edit2 size={16} />
            </button>
            <button onClick={() => setDeleteSellerConfirm(true)} className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/40">
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Stats — Activity */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm text-center">
          <p className="text-2xl font-bold text-slate-800">{transactions.length}</p>
          <p className="text-xs font-medium text-slate-500 mt-1">{t('market.transactionDate')}</p>
        </div>
        <div className="bg-orange-50 rounded-xl p-4 border border-orange-100 text-center">
          <p className="text-2xl font-bold text-orange-700">{totalChickens.toLocaleString()}</p>
          <p className="text-xs font-medium text-orange-500 mt-1">🐔 {t('market.totalChickens')}</p>
        </div>
      </div>

      {/* Seller balance — Owed / Paid / Remaining */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">{t('market.sellerBalance')}</div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="text-xs text-slate-500 mb-0.5">{t('market.totalOwed')}</div>
            <div className="text-lg font-bold text-red-600">{formatCurrency(totalOwed)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-0.5">{t('market.totalPaidBySeller')}</div>
            <div className="text-lg font-bold text-green-600">{formatCurrency(totalPaidByseller)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-0.5">{t('market.remaining')}</div>
            <div className={`text-lg font-bold ${remainingFromSeller > 0 ? 'text-orange-600' : remainingFromSeller < 0 ? 'text-blue-600' : 'text-slate-600'}`}>
              {formatCurrency(remainingFromSeller)}
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap justify-end gap-2">
        <button onClick={openAddPayment} className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-colors">
          <CreditCard size={16} /> {t('market.recordPayment')}
        </button>
        <button onClick={openAddTx} className="flex items-center gap-2 px-4 py-2.5 bg-[#1B3A5C] text-white rounded-xl text-sm font-medium hover:bg-[#2E86AB] transition-colors">
          <Plus size={16} /> {t('market.addTransaction')}
        </button>
      </div>

      {/* Transactions List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {txLoading ? (
          <div className="py-16 text-center text-slate-400">{t('common.loading')}</div>
        ) : transactions.length === 0 ? (
          <div className="py-16 text-center">
            <Store size={40} className="mx-auto text-slate-200 mb-3" />
            <p className="text-slate-400">{t('market.noTransactions')}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-start px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('common.date')}</th>
                <th className="text-start px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('market.billNumber')}</th>
                <th className="text-start px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('market.fromFarm')}</th>
                <th className="text-end px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">🐔 {t('market.chickenCount')}</th>
                <th className="text-end px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('market.amountOwed')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {transactions.map(tx => (
                <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-600">{formatDate(tx.transaction_date)}</td>
                  <td className="px-4 py-3">
                    {tx.bill_number
                      ? <span className="font-mono text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">#{tx.bill_number}</span>
                      : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">{lf(tx.farms, 'name', lang) || '—'}</td>
                  <td className="px-4 py-3 text-end">
                    <span className="font-bold text-orange-700">{(tx.chicken_count || 0).toLocaleString()}</span>
                    {tx.price_per_chicken > 0 && (
                      <p className="text-xs text-slate-400">× {formatCurrency(tx.price_per_chicken)}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-end font-bold text-green-700">{formatCurrency(tx.total_amount)}</td>
                  <td className="px-4 py-3 text-end">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEditTx(tx)} className="p-1.5 text-slate-400 hover:text-[#1B3A5C] hover:bg-slate-100 rounded"><Edit2 size={15} /></button>
                      <button onClick={() => setTxDeleteTarget(tx)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50">
                <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-slate-600">{t('common.total')}</td>
                <td className="px-4 py-3 text-end font-bold text-orange-700">{totalChickens.toLocaleString()} 🐔</td>
                <td className="px-4 py-3 text-end font-bold text-red-700">{formatCurrency(totalOwed)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Seller Payments List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-700 flex items-center gap-2">
            <CreditCard size={16} /> {t('market.paymentsFromSeller')} ({sellerPayments.length})
          </h3>
          <button onClick={openAddPayment} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
            <Plus size={14} /> {t('market.recordPayment')}
          </button>
        </div>
        {payLoading ? (
          <div className="py-8 text-center text-slate-400 text-sm">{t('common.loading')}</div>
        ) : sellerPayments.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-sm">{t('market.noPaymentsFromSeller')}</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {sellerPayments.map(p => (
              <div key={p.id} className="px-4 py-3 flex items-center gap-3">
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
                  <button onClick={() => openEditPayment(p)} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg"><Edit2 size={14} /></button>
                  <button onClick={() => setPaymentDeleteTarget(p)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transaction Modal */}
      <Modal open={txModal} onClose={() => setTxModal(false)} title={editTxItem ? t('market.editTransaction') : t('market.addTransaction')}>
        <form onSubmit={handleTxSubmit} className="space-y-4">
          {/* Farm selector with search */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('dispatches.farm')} *</label>
            <div className="relative" ref={farmDropRef}>
              <input
                value={farmDropOpen ? farmSearch : selectedFarmName}
                onChange={e => { setFarmSearch(e.target.value); setFarmDropOpen(true) }}
                onFocus={() => { setFarmSearch(''); setFarmDropOpen(true) }}
                placeholder={t('market.searchFarm')}
                required={!txForm.farm_id}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
              />
              {txForm.farm_id && !farmDropOpen && (
                <button type="button" onClick={() => { setTxForm(f => ({ ...f, farm_id: '' })); setFarmSearch(''); setFarmDropOpen(true) }}
                  className="absolute inset-e-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600">✕</button>
              )}
              {farmDropOpen && (
                <div className="absolute top-full inset-x-0 z-20 bg-white border border-slate-200 rounded-xl shadow-lg mt-1 max-h-48 overflow-y-auto">
                  {filteredFarms.length === 0
                    ? <div className="px-4 py-3 text-sm text-slate-400">{t('common.noData')}</div>
                    : filteredFarms.map(f => (
                      <button key={f.id} type="button"
                        onClick={() => { setTxForm(prev => ({ ...prev, farm_id: f.id })); setFarmDropOpen(false); setFarmSearch('') }}
                        className="w-full text-start px-4 py-2.5 hover:bg-slate-50 text-sm border-b border-slate-50 last:border-0">
                        <span className="font-medium text-slate-700">{lf(f, 'name', lang)}</span>
                        {f.owner_name && <span className="text-slate-400 ms-2 text-xs">{lf(f, 'owner_name', lang)}</span>}
                      </button>
                    ))
                  }
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('market.billNumber')}</label>
              <input value={txForm.bill_number} onChange={e => setTxForm(f => ({ ...f, bill_number: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('market.transactionDate')}</label>
              <input type="date" value={txForm.transaction_date} onChange={e => setTxForm(f => ({ ...f, transaction_date: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">🐔 {t('market.chickenCount')} *</label>
              <input required type="number" min="1" value={txForm.chicken_count}
                onChange={e => handleTxChange('chicken_count', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('market.pricePerChicken')}</label>
              <input type="number" min="0" step="0.01" value={txForm.price_per_chicken}
                onChange={e => handleTxChange('price_per_chicken', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('market.amountOwed')} (AFN)</label>
            <input type="number" min="0" step="0.01" value={txForm.total_amount}
              onChange={e => setTxForm(f => ({ ...f, total_amount: e.target.value }))}
              placeholder="0"
              className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
            <p className="text-xs text-slate-400 mt-1">{t('market.amountOwedHint')}</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.notes')}</label>
            <textarea rows={2} value={txForm.notes} onChange={e => setTxForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30 resize-none" />
          </div>

          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setTxModal(false)} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">{t('common.cancel')}</button>
            <button type="submit" disabled={saving || !txForm.farm_id} className="px-5 py-2 text-sm font-medium bg-[#1B3A5C] text-white rounded-lg hover:bg-[#2E86AB] disabled:opacity-60">
              {saving ? t('common.saving') : editTxItem ? t('common.saveChanges') : t('market.addTransaction')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Seller Modal */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title={t('market.editSeller')}>
        <form onSubmit={handleEditSave} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.name')} *</label>
            <input required value={editForm.name || ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('market.shopNumber')}</label>
              <input value={editForm.shop_number || ''} onChange={e => setEditForm(f => ({ ...f, shop_number: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.phone')}</label>
              <PhoneInput value={editForm.phone || ''} onChange={v => setEditForm(f => ({ ...f, phone: v }))} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.notes')}</label>
            <textarea rows={2} value={editForm.notes || ''} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30 resize-none" />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setEditModal(false)} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">{t('common.cancel')}</button>
            <button type="submit" className="px-5 py-2 text-sm font-medium bg-[#1B3A5C] text-white rounded-lg hover:bg-[#2E86AB]">{t('common.saveChanges')}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!txDeleteTarget}
        onClose={() => setTxDeleteTarget(null)}
        onConfirm={() => { deleteTransaction(txDeleteTarget); setTxDeleteTarget(null) }}
        title={t('market.deleteTransaction')}
        message={t('market.deleteTransactionMsg')}
      />

      {/* Payment Modal */}
      <Modal open={paymentModal} onClose={() => { setPaymentModal(false); setEditPaymentItem(null) }}
        title={editPaymentItem ? t('market.editPayment') : t('market.recordPayment')}>
        <form onSubmit={handlePaymentSubmit} className="space-y-4">
          {remainingFromSeller > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm flex items-center justify-between">
              <span className="text-slate-600">{t('market.remaining')}:</span>
              <span className="font-bold text-orange-700">{formatCurrency(remainingFromSeller)}</span>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.amount')} (AFN) *</label>
              <input required type="number" min="0.01" step="0.01" value={paymentForm.amount}
                onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-300" />
              {remainingFromSeller > 0 && (
                <button type="button"
                  onClick={() => setPaymentForm(f => ({ ...f, amount: String(remainingFromSeller) }))}
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
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-300" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.notes')}</label>
            <input value={paymentForm.notes}
              onChange={e => setPaymentForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-300" />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => { setPaymentModal(false); setEditPaymentItem(null) }}
              className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60">
              {saving ? t('common.saving') : editPaymentItem ? t('common.saveChanges') : t('market.recordPayment')}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!paymentDeleteTarget}
        onClose={() => setPaymentDeleteTarget(null)}
        onConfirm={() => { deletePayment(paymentDeleteTarget.id); setPaymentDeleteTarget(null) }}
        title={t('market.deletePayment')}
        message={t('market.deletePaymentMsg')}
      />

      <ConfirmDialog
        open={deleteSellerConfirm}
        onClose={() => setDeleteSellerConfirm(false)}
        onConfirm={async () => { await deleteSeller(id); navigate('/market') }}
        title={t('market.deleteSeller')}
        message={t('market.deleteSellerMsg')}
      />

      <WhatsAppPromptDialog
        open={!!waPrompt}
        onClose={() => { const next = waPrompt?.next; setWaPrompt(null); next && next() }}
        templateKey={waPrompt?.templateKey}
        variables={waPrompt?.variables}
        recipient={waPrompt?.recipient}
      />
    </div>
  )
}
