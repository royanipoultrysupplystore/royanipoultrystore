import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Phone, MapPin, Truck, CreditCard, Edit2, Plus, Trash2, Power } from 'lucide-react'
import { useFarms } from '../hooks/useFarms'
import { useDispatches } from '../hooks/useDispatches'
import { usePayments } from '../hooks/usePayments'
import { useSupplyPayments } from '../hooks/useSupplyPayments'
import { useChickenDeaths } from '../hooks/useChickenDeaths'
import { useMarketTransactions } from '../hooks/useMarketTransactions'
import { useFarmBatches } from '../hooks/useFarmBatches'
import { useSuppliers } from '../hooks/useSuppliers'
import { useStoreCash } from '../contexts/StoreCashContext'
import Modal from '../components/common/Modal'
import ConfirmDialog from '../components/common/ConfirmDialog'
import PhoneInput from '../components/common/PhoneInput'
import WhatsAppPromptDialog from '../components/common/WhatsAppPromptDialog'
import EditDispatchModal from '../components/common/EditDispatchModal'
import { formatCurrency } from '../utils/formatCurrency'
import { formatDate, todayStr } from '../utils/dateHelpers'
import { useLanguage } from '../contexts/LanguageContext'
import { lf } from '../utils/localizedField'
import toast from 'react-hot-toast'

const emptyDeathForm = { death_count: '', reason: '', death_date: todayStr(), notes: '' }
const SUPPLY_ITEMS = ['Sugar', 'Coal', 'Wood Flour', 'Other']
const emptySupplyForm = { supply_item: 'Sugar', other_item: '', amount: '', payment_date: todayStr(), notes: '' }

// Dana-type pill styling — must match SupplierDetail.jsx so each Dana variety
// is recognisable by colour across the app.
const DANA_OPTIONS = [
  { value: '4_number',  labelKey: 'dana4Number',  color: 'bg-blue-100 text-blue-700' },
  { value: '6_number',  labelKey: 'dana6Number',  color: 'bg-cyan-100 text-cyan-700' },
  { value: '9_number',  labelKey: 'dana9Number',  color: 'bg-green-100 text-green-700' },
  { value: '12_number', labelKey: 'dana12Number', color: 'bg-purple-100 text-purple-700' },
  { value: 'other',     labelKey: 'danaOther',    color: 'bg-slate-100 text-slate-600' },
]

export default function FarmDetail() {
  const { t, lang } = useLanguage()
  const { id } = useParams()
  const navigate = useNavigate()
  const { getFarmById, updateFarm } = useFarms()
  const { dispatches, loading: dLoading, createDispatch, updateDispatch, deleteDispatch } = useDispatches(id)
  const { payments, loading: pLoading, recordPayment } = usePayments(id)
  const { supplyPayments, loading: spLoading, addSupplyPayment, updateSupplyPayment, deleteSupplyPayment } = useSupplyPayments(id)
  const { batches, currentBatch, totalChickenValue, createBatch, updateBatch, closeBatch, reopenBatch, deleteBatch, getSupplierChozaBalance } = useFarmBatches(id)
  const [selectedBatchId, setSelectedBatchId] = useState(null)
  const { deaths, loading: deathLoading, addDeath, updateDeath, deleteDeath } = useChickenDeaths(id, selectedBatchId)
  const { transactions: marketTransactions, loading: mtLoading } = useMarketTransactions({ farmId: id })
  const { suppliers: allSuppliers } = useSuppliers()
  const chozaSuppliers = allSuppliers.filter(s => s.type === 'choza')

  const [farm, setFarm] = useState(null)
  const [tab, setTab] = useState('dispatches')
  const [batchModal, setBatchModal] = useState(false)
  const [editBatchItem, setEditBatchItem] = useState(null)
  const [batchForm, setBatchForm] = useState({ supplier_id: '', initial_chicken_count: '', price_per_chicken: '', start_date: todayStr(), notes: '' })
  const [batchDeleteTarget, setBatchDeleteTarget] = useState(null)
  const [supplierChoza, setSupplierChoza] = useState(null) // { bought, sent, remaining } for the batch form's selected supplier
  const [paymentModal, setPaymentModal] = useState(false)
  const [payForm, setPayForm] = useState({ amount: '', payment_date: todayStr(), notes: '' })
  const [payToStoreCash, setPayToStoreCash] = useState(true)
  const { recordIn } = useStoreCash()
  const [advanceModal, setAdvanceModal] = useState(false)
  const [advanceForm, setAdvanceForm] = useState({ amount: '', payment_date: todayStr(), notes: '' })
  const [advanceToStoreCash, setAdvanceToStoreCash] = useState(true)
  const [supplyModal, setSupplyModal] = useState(false)
  const [supplyForm, setSupplyForm] = useState(emptySupplyForm)
  // Edit/delete state for dispatches + supply payments shown inside the farm tabs.
  const [editDispatchTarget, setEditDispatchTarget] = useState(null)
  const [deleteDispatchTarget, setDeleteDispatchTarget] = useState(null)
  const [editSupplyTarget, setEditSupplyTarget] = useState(null) // { id, supply_item, other_item, amount, payment_date, notes }
  const [deleteSupplyTarget, setDeleteSupplyTarget] = useState(null)
  const [subsidy, setSubsidy] = useState('')
  const [editModal, setEditModal] = useState(false)
  const [statusConfirm, setStatusConfirm] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [deathModal, setDeathModal] = useState(false)
  const [deathForm, setDeathForm] = useState(emptyDeathForm)
  const [editDeathItem, setEditDeathItem] = useState(null)
  const [deathDeleteTarget, setDeathDeleteTarget] = useState(null)
  const [waPrompt, setWaPrompt] = useState(null)

  useEffect(() => {
    getFarmById(id).then(data => {
      if (!data) { navigate('/farms'); return }
      setFarm(data)
      setEditForm(data)
    })
  }, [id])

  // Default the Chickens tab to the newest batch once batches load.
  useEffect(() => {
    if (!selectedBatchId && currentBatch) setSelectedBatchId(currentBatch.id)
  }, [currentBatch, selectedBatchId])

  const selectedBatch = batches.find(b => b.id === selectedBatchId) || currentBatch || null

  function openNewBatch() {
    setEditBatchItem(null)
    setBatchForm({ supplier_id: '', initial_chicken_count: '', price_per_chicken: '', start_date: todayStr(), notes: '' })
    setBatchModal(true)
  }

  function openEditBatch(b) {
    setEditBatchItem(b)
    setBatchForm({
      supplier_id: b.supplier_id || '',
      initial_chicken_count: String(b.initial_chicken_count || ''),
      price_per_chicken: String(b.price_per_chicken || ''),
      start_date: b.start_date,
      notes: b.notes || '',
    })
    setBatchModal(true)
  }

  // Fetch the selected supplier's choza balance whenever it changes in the batch form.
  useEffect(() => {
    if (!batchModal || !batchForm.supplier_id) { setSupplierChoza(null); return }
    let cancelled = false
    getSupplierChozaBalance(batchForm.supplier_id, editBatchItem?.id || null)
      .then(b => { if (!cancelled) setSupplierChoza(b) })
    return () => { cancelled = true }
  }, [batchModal, batchForm.supplier_id, editBatchItem])

  async function handleBatchSubmit(e) {
    e.preventDefault()
    const count = parseInt(batchForm.initial_chicken_count) || 0
    // Hard block: can't pull more choza than the supplier still has.
    if (batchForm.supplier_id) {
      const bal = await getSupplierChozaBalance(batchForm.supplier_id, editBatchItem?.id || null)
      if (count > bal.remaining) {
        toast.error(t('batches.notEnoughChoza').replace('{n}', String(bal.remaining)))
        return
      }
    }
    if (editBatchItem) {
      const ok = await updateBatch(editBatchItem.id, batchForm)
      if (ok) setBatchModal(false)
    } else {
      const created = await createBatch(batchForm)
      if (created) { setSelectedBatchId(created.id); setBatchModal(false) }
    }
  }

  async function handlePayment(e) {
    e.preventDefault()
    const paid = parseFloat(payForm.amount) || 0
    const ok = await recordPayment({
      farm_id: id,
      amount: paid,
      payment_date: payForm.payment_date,
      notes: payForm.notes,
    })
    if (ok) {
      if (payToStoreCash && paid > 0) {
        await recordIn({
          amount: paid,
          source: 'payment',
          reference_id: ok.id || null,
          note: farm?.name || 'Farm',
          date: payForm.payment_date,
        })
      }
      setPaymentModal(false)
      const dateUsed = payForm.payment_date
      setPayForm({ amount: '', payment_date: todayStr(), notes: '' })
      setPayToStoreCash(true)
      const updated = await getFarmById(id)
      setFarm(updated)
      setWaPrompt({
        templateKey: 'farm_payment_received',
        variables: {
          name: updated.name,
          amount: formatCurrency(paid),
          date: dateUsed,
          balance: formatCurrency(updated.total_debt || 0),
        },
        recipient: { name: updated.name, phone: updated.phone },
      })
    }
  }

  async function handleAdvancePayment(e) {
    e.preventDefault()
    const advAmt = parseFloat(advanceForm.amount) || 0
    const newBalance = (farm.advance_payment || 0) + advAmt
    const ok = await updateFarm(id, { advance_payment: newBalance })
    if (ok) {
      if (advanceToStoreCash && advAmt > 0) {
        await recordIn({
          amount: advAmt,
          source: 'payment',
          note: `Advance · ${farm?.name || 'Farm'}`,
          date: advanceForm.payment_date,
        })
      }
      setAdvanceModal(false)
      setAdvanceForm({ amount: '', payment_date: todayStr(), notes: '' })
      setAdvanceToStoreCash(true)
      const updated = await getFarmById(id)
      setFarm(updated)
    }
  }

  async function handleSupplySubmit(e) {
    e.preventDefault()
    const supplyItem = supplyForm.supply_item === 'Other' ? supplyForm.other_item.trim() : supplyForm.supply_item
    if (!supplyItem) { toast.error('Supply item is required'); return }
    const amount = parseFloat(supplyForm.amount) || 0
    if (amount <= 0) { toast.error('Amount must be > 0'); return }
    const ok = await addSupplyPayment({
      farm_id: id,
      supply_item: supplyItem,
      amount,
      payment_date: supplyForm.payment_date,
      notes: supplyForm.notes || null,
    })
    if (ok) {
      setSupplyModal(false)
      setSupplyForm({ ...emptySupplyForm, payment_date: todayStr() })
      const updated = await getFarmById(id)
      setFarm(updated)
    }
  }

  async function handleEditSave(e) {
    e.preventDefault()
    await updateFarm(id, editForm)
    setFarm({ ...farm, ...editForm })
    setEditModal(false)
  }

  async function toggleActiveStatus() {
    const next = !farm.is_active
    await updateFarm(id, { is_active: next })
    setFarm({ ...farm, is_active: next })
    setStatusConfirm(false)
  }

  function openAddDeath() {
    setEditDeathItem(null)
    setDeathForm(emptyDeathForm)
    setDeathModal(true)
  }

  function openEditDeath(d) {
    setEditDeathItem(d)
    setDeathForm({ death_count: d.death_count, reason: d.reason || '', death_date: d.death_date, notes: d.notes || '' })
    setDeathModal(true)
  }

  async function handleDeathSubmit(e) {
    e.preventDefault()
    const payload = { ...deathForm, death_count: parseInt(deathForm.death_count) || 0 }
    const ok = editDeathItem
      ? await updateDeath(editDeathItem.id, payload)
      : await addDeath(payload)
    if (ok) setDeathModal(false)
  }

  if (!farm) {
    return <div className="flex items-center justify-center h-64 text-slate-400">
      <div className="w-8 h-8 border-2 border-[#2E86AB] border-t-transparent rounded-full animate-spin me-3" />{t('common.loading')}
    </div>
  }

  const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0)
  const totalDispatched = dispatches.reduce((s, d) => s + (d.total_amount || 0), 0)
  const totalSupplyOut = supplyPayments.reduce((s, p) => s + (p.amount || 0), 0)
  // Per-selected-batch chicken stats
  const totalDeaths = deaths.reduce((s, d) => s + (d.death_count || 0), 0)
  const batchMarketTx = marketTransactions.filter(tx => !selectedBatchId || tx.batch_id === selectedBatchId)
  const totalSentToMarket = batchMarketTx.reduce((s, t) => s + (t.chicken_count || 0), 0)
  const totalFromMarket = batchMarketTx.reduce((s, t) => s + (t.total_amount || 0), 0)
  const initialCount = selectedBatch?.initial_chicken_count || 0
  const remaining = Math.max(0, initialCount - totalDeaths - totalSentToMarket)
  const pricePerChicken = selectedBatch?.price_per_chicken || 0
  // Chicken debt is cumulative across every batch of this farm
  const chickenDebt = totalChickenValue
  const currentDebt = Math.max(0, totalDispatched + totalSupplyOut + chickenDebt - totalPaid)
  const totalProfit = dispatches.flatMap(d => d.dispatch_items || []).reduce((s, i) => s + (i.total_profit || 0), 0)
  const netProfit = totalProfit - parseFloat(subsidy || 0)

  const TABS = [
    { key: 'dispatches', label: `📦 ${t('farmDetail.dispatches')}` },
    { key: 'payments', label: `💳 ${t('farmDetail.payments')}` },
    { key: 'supply', label: `🛍️ ${t('farmDetail.supplyPayments')}` },
    { key: 'profit', label: `📈 ${t('common.profit')}` },
    { key: 'subsidy', label: `🎁 ${t('farmDetail.subsidy')}` },
    { key: 'chickens', label: `🐔 ${t('chickens.tab')}` },
    { key: 'market', label: `🏪 ${t('nav.market')}` },
  ]

  return (
    <div className="space-y-4">
      <button onClick={() => navigate('/farms')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={16} /> {t('common.back')}
      </button>

      <div className={`rounded-2xl p-5 text-white ${farm.is_active ? 'bg-[#1B3A5C]' : 'bg-slate-500'}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl font-bold">{lf(farm, 'name', lang)}</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${farm.is_active ? 'bg-green-400/25 text-green-100' : 'bg-white/25 text-white'}`}>
                {farm.is_active ? t('common.active') : t('common.inactive')}
              </span>
            </div>
            <p className="text-white/70 mt-1">{lf(farm, 'owner_name', lang)}</p>
            <div className="flex flex-wrap gap-4 mt-3">
              {farm.phone && <span className="flex items-center gap-1.5 text-sm text-white/70"><Phone size={14} />{farm.phone}</span>}
              {farm.location && <span className="flex items-center gap-1.5 text-sm text-white/70"><MapPin size={14} />{farm.location}</span>}
              {initialCount > 0 && (
                <span className="flex items-center gap-1.5 text-sm text-white/70">
                  🐔 {t('chickens.initialCount')}: <span className="font-semibold text-white">{initialCount.toLocaleString()}</span>
                  &nbsp;→ {t('chickens.remaining')}: <span className={`font-semibold ${remaining < initialCount * 0.5 ? 'text-red-300' : 'text-green-300'}`}>{remaining.toLocaleString()}</span>
                </span>
              )}
            </div>
            {farm.notes && <p className="text-sm text-white/50 mt-2">{farm.notes}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setStatusConfirm(true)}
              title={farm.is_active ? t('farmDetail.disableFarm') : t('farmDetail.enableFarm')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium ${farm.is_active ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-green-500/25 hover:bg-green-500/40 text-green-100'}`}
            >
              <Power size={14} />
              <span className="hidden sm:inline">{farm.is_active ? t('farmDetail.disableFarm') : t('farmDetail.enableFarm')}</span>
            </button>
            <button onClick={() => setEditModal(true)} className="p-2 rounded-lg bg-white/10 hover:bg-white/20">
              <Edit2 size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className={`rounded-xl p-4 ${currentDebt > 0 ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
          <p className="text-xs font-medium text-slate-500 mb-1">{t('farms.currentDebt')}</p>
          <p className={`text-2xl font-bold ${currentDebt > 0 ? 'text-red-700' : 'text-green-700'}`}>{formatCurrency(currentDebt)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <p className="text-xs font-medium text-slate-500 mb-1">{t('farmDetail.totalDispatched')}</p>
          <p className="text-2xl font-bold text-slate-800">{formatCurrency(totalDispatched)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <p className="text-xs font-medium text-slate-500 mb-1">{t('farmDetail.totalPaid')}</p>
          <p className="text-2xl font-bold text-green-700">{formatCurrency(totalPaid)}</p>
        </div>
        <div
          className={`rounded-xl p-4 border shadow-sm cursor-pointer hover:shadow-md transition-shadow ${(farm.advance_payment || 0) > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-100'}`}
          onClick={() => setAdvanceModal(true)}
        >
          <p className="text-xs font-medium text-slate-500 mb-1">{t('farmDetail.advancePayment')}</p>
          <p className={`text-2xl font-bold ${(farm.advance_payment || 0) > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
            {formatCurrency(farm.advance_payment || 0)}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
          <p className="text-xs font-medium text-slate-500 mb-1">{t('farmDetail.totalProfit')}</p>
          <p className="text-2xl font-bold text-[#1B3A5C]">{formatCurrency(totalProfit)}</p>
        </div>
        <div className={`rounded-xl p-4 border ${chickenDebt > 0 ? 'bg-orange-50 border-orange-200' : 'bg-white border-slate-100 shadow-sm'}`}>
          <p className="text-xs font-medium text-slate-500 mb-1">🐔 {t('farms.chickenDebt')}</p>
          <p className={`text-2xl font-bold ${chickenDebt > 0 ? 'text-orange-700' : 'text-slate-400'}`}>{formatCurrency(chickenDebt)}</p>
          {batches.length > 0 && (
            <p className="text-xs text-slate-400 mt-0.5">{batches.length} {batches.length === 1 ? t('batches.batch') : t('batches.batches')}</p>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={() => navigate(`/dispatches/new?farm=${id}`)} className="flex items-center gap-2 px-4 py-2.5 bg-[#1B3A5C] text-white rounded-xl text-sm font-medium hover:bg-[#2E86AB] transition-colors">
          <Truck size={16} /> {t('dispatches.newDispatch')}
        </button>
        <button onClick={() => setPaymentModal(true)} className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-colors">
          <CreditCard size={16} /> {t('farmDetail.addPayment')}
        </button>
        <button onClick={() => setAdvanceModal(true)} className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 transition-colors">
          <CreditCard size={16} /> {t('farmDetail.advancePayment')}
        </button>
        {currentDebt > 0 && (
          <button
            onClick={() => setWaPrompt({
              templateKey: 'balance_reminder',
              variables: {
                name: farm.name,
                amount: formatCurrency(currentDebt),
                date: todayStr(),
              },
              recipient: { name: farm.name, phone: farm.phone },
            })}
            className="flex items-center gap-2 px-4 py-2.5 bg-orange-100 text-orange-700 rounded-xl text-sm font-medium hover:bg-orange-200 transition-colors"
          >
            💬 <span>Balance Reminder</span>
            <span className="text-xs opacity-80" dir="rtl">· د حساب یادونه</span>
          </button>
        )}
      </div>

      <div className="flex gap-1 bg-white rounded-xl p-1 border border-slate-100 shadow-sm w-fit flex-wrap">
        {TABS.map(tabItem => (
          <button key={tabItem.key} onClick={() => setTab(tabItem.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === tabItem.key ? 'bg-[#1B3A5C] text-white shadow' : 'text-slate-600 hover:bg-slate-100'}`}>
            {tabItem.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
        {tab === 'dispatches' && (
          dLoading ? <div className="py-8 text-center text-slate-400">{t('common.loading')}</div> :
          dispatches.length === 0 ? <div className="py-12 text-center text-slate-400">{t('farmDetail.noDispatches')}</div> :
          <div className="space-y-3">
            {dispatches.map(d => (
              <div key={d.id} className="border border-slate-100 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-800">{formatDate(d.dispatch_date)}</p>
                      {d.invoice_number && (
                        <span className="text-xs font-mono font-semibold bg-[#1B3A5C]/10 text-[#1B3A5C] px-2 py-0.5 rounded">
                          #{d.invoice_number}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">{d.dispatch_items?.length || 0} {t('dispatches.items').toLowerCase()}</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="text-end">
                      <p className="font-bold text-[#1B3A5C]">{formatCurrency(d.total_amount)}</p>
                      {d.notes && <p className="text-xs text-slate-400">{d.notes}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => setEditDispatchTarget(d)} className="p-1.5 text-slate-400 hover:text-[#1B3A5C] hover:bg-slate-100 rounded" title={t('common.edit')}>
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => setDeleteDispatchTarget(d)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded" title={t('common.delete')}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
                {d.dispatch_items?.length > 0 && (
                  <div className="border-t border-slate-50 pt-3 space-y-1.5">
                    {d.dispatch_items.map(item => (
                      <div key={item.id} className="flex items-start justify-between text-sm gap-3">
                        <div className="min-w-0">
                          <p className="text-slate-700">{item.products?.name || '—'}</p>
                          {item.supplier_dispatches && (() => {
                            const danaOpt = DANA_OPTIONS.find(o => o.value === item.supplier_dispatches.dana_type)
                            return (
                              <p className="text-xs text-amber-700 mt-0.5">
                                ← {item.supplier_dispatches.suppliers?.company_name || 'meel'}
                                {item.supplier_dispatches.bill_number && (
                                  <span className="ms-2 font-mono bg-blue-100 text-blue-700 px-1 rounded">Bill #{item.supplier_dispatches.bill_number}</span>
                                )}
                                {danaOpt && (
                                  <span className={`ms-2 font-semibold px-1.5 py-0.5 rounded ${danaOpt.color}`}>
                                    {t(`suppliers.${danaOpt.labelKey}`)}
                                  </span>
                                )}
                              </p>
                            )
                          })()}
                        </div>
                        <span className="text-slate-500 shrink-0">{item.quantity} × {formatCurrency(item.sell_price_at_time)} = <span className="font-medium text-slate-700">{formatCurrency(item.total_amount)}</span></span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'payments' && (
          pLoading ? <div className="py-8 text-center text-slate-400">{t('common.loading')}</div> :
          payments.length === 0 ? <div className="py-12 text-center text-slate-400">{t('farmDetail.noPayments')}</div> :
          <div className="divide-y divide-slate-100">
            {payments.map(p => (
              <div key={p.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium text-slate-700">{formatDate(p.payment_date)}</p>
                  {p.notes && <p className="text-xs text-slate-400">{p.notes}</p>}
                </div>
                <span className="font-bold text-green-700">{formatCurrency(p.amount)}</span>
              </div>
            ))}
          </div>
        )}

        {tab === 'supply' && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button
                onClick={() => { setSupplyForm({ ...emptySupplyForm, payment_date: todayStr() }); setSupplyModal(true) }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1B3A5C] text-white rounded-lg text-sm font-medium hover:bg-[#2E86AB] transition-colors"
              >
                <Plus size={14} /> {t('supply.recordPayment')}
              </button>
            </div>
            {spLoading ? <div className="py-8 text-center text-slate-400">{t('common.loading')}</div> :
            supplyPayments.length === 0
              ? <div className="py-12 text-center text-slate-400">{t('farmDetail.noSupply')}</div>
              : (
                <div>
                  <div className="divide-y divide-slate-100">
                    {supplyPayments.map(p => (
                      <div key={p.id} className="flex items-center justify-between py-3 gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">{p.supply_item}</span>
                            <p className="text-sm text-slate-500">{formatDate(p.payment_date)}</p>
                          </div>
                          {p.notes && <p className="text-xs text-slate-400 mt-0.5 truncate">{p.notes}</p>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="font-bold text-[#1B3A5C]">{formatCurrency(p.amount)}</span>
                          <button
                            onClick={() => {
                              const isCustom = !SUPPLY_ITEMS.slice(0, -1).includes(p.supply_item)
                              setEditSupplyTarget({
                                id: p.id,
                                supply_item: isCustom ? 'Other' : p.supply_item,
                                other_item: isCustom ? p.supply_item : '',
                                amount: String(p.amount ?? ''),
                                payment_date: p.payment_date,
                                notes: p.notes || '',
                                _original: p,
                              })
                            }}
                            className="p-1.5 text-slate-400 hover:text-[#1B3A5C] hover:bg-slate-100 rounded ms-2"
                            title={t('common.edit')}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => setDeleteSupplyTarget(p)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded" title={t('common.delete')}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between pt-3 border-t border-slate-200 font-semibold">
                    <span className="text-slate-700">{t('farmDetail.totalSupplyOut')}</span>
                    <span className="text-[#1B3A5C]">{formatCurrency(supplyPayments.reduce((s, p) => s + (p.amount || 0), 0))}</span>
                  </div>
                </div>
              )}
          </div>
        )}

        {tab === 'profit' && (
          <div className="space-y-3">
            {dispatches.flatMap(d => d.dispatch_items || []).length === 0
              ? <div className="py-12 text-center text-slate-400">{t('farmDetail.noProfit')}</div>
              : dispatches.map(d => (
                d.dispatch_items?.map(item => (
                  <div key={item.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-slate-700">{item.products?.name || '—'}</p>
                      <p className="text-xs text-slate-400">{formatDate(d.dispatch_date)} — {t('dispatches.quantity').toLowerCase()}: {item.quantity}</p>
                    </div>
                    <div className="text-end">
                      <p className="text-sm font-semibold text-green-700">{formatCurrency(item.total_profit)}</p>
                      <p className="text-xs text-slate-400">{formatCurrency(item.profit_per_item)}/unit</p>
                    </div>
                  </div>
                ))
              ))
            }
            <div className="flex justify-between pt-3 border-t border-slate-200 font-semibold">
              <span className="text-slate-700">{t('farmDetail.totalProfit')}</span>
              <span className="text-green-700">{formatCurrency(totalProfit)}</span>
            </div>
          </div>
        )}

        {tab === 'subsidy' && (
          <div className="max-w-md space-y-5">
            <div className="bg-slate-50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">{t('farmDetail.totalProfit')}</span>
                <span className="font-semibold text-slate-800">{formatCurrency(totalProfit)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">{t('farmDetail.subsidyGiven')}</span>
                <span className="font-semibold text-orange-600">{formatCurrency(parseFloat(subsidy) || 0)}</span>
              </div>
              <div className="flex justify-between font-semibold border-t border-slate-200 pt-2">
                <span className="text-slate-700">{t('farmDetail.netAfterSubsidy')}</span>
                <span className={netProfit >= 0 ? 'text-green-700' : 'text-red-700'}>{formatCurrency(netProfit)}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('farmDetail.enterSubsidy')}</label>
              <input
                type="number" min="0" value={subsidy}
                onChange={e => setSubsidy(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
              />
              <p className="text-xs text-slate-400 mt-1">{t('farmDetail.subsidyNote')}</p>
            </div>
          </div>
        )}

        {tab === 'chickens' && (
          <div className="space-y-4">
            {/* Batch pills + New Batch */}
            <div className="flex items-center gap-2 flex-wrap">
              {batches.map(b => (
                <button
                  key={b.id}
                  onClick={() => setSelectedBatchId(b.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-colors ${
                    b.id === selectedBatchId
                      ? 'border-[#1B3A5C] bg-[#1B3A5C] text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  🐤 {t('batches.batch')} #{b.batch_number}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    b.is_active
                      ? (b.id === selectedBatchId ? 'bg-green-400/30 text-green-100' : 'bg-green-100 text-green-700')
                      : (b.id === selectedBatchId ? 'bg-white/20 text-white/80' : 'bg-slate-100 text-slate-500')
                  }`}>
                    {b.is_active ? t('batches.activeStatus') : t('batches.closedStatus')}
                  </span>
                </button>
              ))}
              <button onClick={openNewBatch} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-[#2E86AB] text-white hover:bg-[#1B3A5C]">
                <Plus size={14} /> {t('batches.startNew')}
              </button>
            </div>

            {!selectedBatch ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                {t('batches.startFirstHint')}
              </div>
            ) : (
              <>
                {/* Selected batch header */}
                <div className={`rounded-xl border p-4 ${selectedBatch.is_active ? 'bg-[#1B3A5C] border-[#1B3A5C] text-white' : 'bg-slate-100 border-slate-200'}`}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg">{t('batches.batch')} #{selectedBatch.batch_number}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${selectedBatch.is_active ? 'bg-green-400/25 text-green-100' : 'bg-slate-200 text-slate-600'}`}>
                          {selectedBatch.is_active ? t('batches.activeStatus') : t('batches.closedStatus')}
                        </span>
                      </div>
                      <div className={`text-sm mt-1 ${selectedBatch.is_active ? 'text-white/70' : 'text-slate-500'}`}>
                        🐥 {selectedBatch.suppliers?.company_name || t('batches.noSupplier')}
                        {' · '}{formatDate(selectedBatch.start_date)}
                        {selectedBatch.end_date && ` → ${formatDate(selectedBatch.end_date)}`}
                      </div>
                      {selectedBatch.notes && (
                        <div className={`text-xs mt-1 ${selectedBatch.is_active ? 'text-white/50' : 'text-slate-400'}`}>{selectedBatch.notes}</div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openEditBatch(selectedBatch)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${selectedBatch.is_active ? 'bg-white/15 hover:bg-white/25' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
                        <Edit2 size={14} /> {t('batches.editBatch')}
                      </button>
                      {selectedBatch.is_active ? (
                        <button onClick={() => closeBatch(selectedBatch.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-amber-500 text-white hover:bg-amber-600">
                          {t('batches.closeBatch')}
                        </button>
                      ) : (
                        <button onClick={() => reopenBatch(selectedBatch.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700">
                          {t('batches.reopenBatch')}
                        </button>
                      )}
                      <button onClick={() => setBatchDeleteTarget(selectedBatch)}
                        title={t('batches.deleteBatch')}
                        className={`flex items-center px-2.5 py-1.5 rounded-lg ${selectedBatch.is_active ? 'bg-red-500/20 text-red-100 hover:bg-red-500/40' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                    <p className="text-xs font-medium text-blue-600 mb-1">{t('chickens.initialCount')}</p>
                    <p className="text-3xl font-bold text-blue-700">{initialCount.toLocaleString()}</p>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                    <p className="text-xs font-medium text-red-600 mb-1">{t('chickens.totalDied')}</p>
                    <p className="text-3xl font-bold text-red-700">{totalDeaths.toLocaleString()}</p>
                  </div>
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
                    <p className="text-xs font-medium text-orange-600 mb-1">🏪 {t('market.marketChickens')}</p>
                    <p className="text-3xl font-bold text-orange-700">{totalSentToMarket.toLocaleString()}</p>
                  </div>
                  <div className={`rounded-xl p-4 text-center border ${remaining < initialCount * 0.5 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                    <p className={`text-xs font-medium mb-1 ${remaining < initialCount * 0.5 ? 'text-red-600' : 'text-green-600'}`}>{t('chickens.remaining')}</p>
                    <p className={`text-3xl font-bold ${remaining < initialCount * 0.5 ? 'text-red-700' : 'text-green-700'}`}>{remaining.toLocaleString()}</p>
                  </div>
                </div>
              </>
            )}

            {selectedBatch && (
              <div className="flex justify-end">
                <button onClick={openAddDeath} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-colors">
                  <Plus size={15} /> {t('chickens.addDeath')}
                </button>
              </div>
            )}

            {selectedBatch && (
              deathLoading ? (
                <div className="py-8 text-center text-slate-400">{t('common.loading')}</div>
              ) : deaths.length === 0 ? (
                <div className="py-12 text-center text-slate-400">{t('chickens.noDying')}</div>
              ) : (
                <div className="space-y-2">
                  {deaths.map(d => (
                    <div key={d.id} className="flex items-center justify-between p-4 border border-red-100 rounded-xl bg-red-50/40">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center font-bold text-red-700 text-sm shrink-0">
                          -{d.death_count}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{formatDate(d.death_date)}</p>
                          {d.reason && <p className="text-sm text-slate-600">{d.reason}</p>}
                          {d.notes && <p className="text-xs text-slate-400">{d.notes}</p>}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => openEditDeath(d)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => setDeathDeleteTarget(d)} className="p-1.5 rounded-lg hover:bg-red-100 text-slate-400 hover:text-red-500">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        )}
      </div>

      {tab === 'market' && (
          <div className="space-y-4">
            {totalSentToMarket === 0 && !mtLoading ? (
              <div className="py-12 text-center text-slate-400">{t('market.noMarketActivity')}</div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-slate-50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-slate-700">{marketTransactions.length}</p>
                    <p className="text-xs text-slate-500 mt-1">Transactions</p>
                  </div>
                  <div className="bg-orange-50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-orange-700">{totalSentToMarket.toLocaleString()}</p>
                    <p className="text-xs text-orange-500 mt-1">🐔 {t('market.marketChickens')}</p>
                  </div>
                  <div className="bg-green-50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-green-700">{formatCurrency(totalFromMarket)}</p>
                    <p className="text-xs text-green-500 mt-1">{t('market.amountFromMarket')}</p>
                  </div>
                </div>
                {mtLoading ? <div className="py-8 text-center text-slate-400">{t('common.loading')}</div> : (
                  <div className="space-y-2">
                    {marketTransactions.map(tx => (
                      <div key={tx.id} className="flex items-center justify-between p-4 border border-orange-100 rounded-xl bg-orange-50/30">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-slate-800">{formatDate(tx.transaction_date)}</p>
                            {tx.bill_number && (
                              <span className="text-xs font-mono bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">#{tx.bill_number}</span>
                            )}
                          </div>
                          <p className="text-sm text-slate-500 mt-0.5">
                            🏪 {tx.market_sellers?.name || '—'}
                            {tx.market_sellers?.shop_number && ` — ${t('market.shopNumber')} ${tx.market_sellers.shop_number}`}
                          </p>
                        </div>
                        <div className="text-end">
                          <p className="font-bold text-orange-700">🐔 {(tx.chicken_count || 0).toLocaleString()}</p>
                          {tx.total_amount > 0 && <p className="text-sm text-green-700 font-medium">{formatCurrency(tx.total_amount)}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

      {/* Payment Modal */}
      <Modal open={paymentModal} onClose={() => setPaymentModal(false)} title={t('farmDetail.addPayment')}>
        <form onSubmit={handlePayment} className="space-y-4">
          <div>
            <p className="text-sm text-slate-500 mb-3">{t('farms.currentDebt')}: <span className="font-semibold text-red-600">{formatCurrency(currentDebt)}</span></p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('payments.amountAFN')}</label>
            <input required type="number" min="0.01" step="0.01" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.date')}</label>
            <input type="date" value={payForm.payment_date} onChange={e => setPayForm(f => ({ ...f, payment_date: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.notes')}</label>
            <input value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 cursor-pointer">
            <input type="checkbox" checked={payToStoreCash} onChange={e => setPayToStoreCash(e.target.checked)} className="rounded text-green-600" />
            <span>{t('storeCash.toStoreCash')}</span>
          </label>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setPaymentModal(false)} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">{t('common.cancel')}</button>
            <button type="submit" className="px-5 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700">{t('common.recordPayment')}</button>
          </div>
        </form>
      </Modal>

      {/* Advance Payment Modal */}
      <Modal open={advanceModal} onClose={() => setAdvanceModal(false)} title={t('farmDetail.addAdvance')}>
        <form onSubmit={handleAdvancePayment} className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
            {t('farmDetail.advanceNote')} {t('common.balance')}: <span className="font-bold">{formatCurrency(farm.advance_payment || 0)}</span>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('payments.amountAFN')}</label>
            <input required type="number" min="0.01" step="0.01" value={advanceForm.amount}
              onChange={e => setAdvanceForm(f => ({ ...f, amount: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.date')}</label>
            <input type="date" value={advanceForm.payment_date}
              onChange={e => setAdvanceForm(f => ({ ...f, payment_date: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.notes')}</label>
            <input value={advanceForm.notes} onChange={e => setAdvanceForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 cursor-pointer">
            <input type="checkbox" checked={advanceToStoreCash} onChange={e => setAdvanceToStoreCash(e.target.checked)} className="rounded text-green-600" />
            <span>{t('storeCash.toStoreCash')}</span>
          </label>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setAdvanceModal(false)} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">{t('common.cancel')}</button>
            <button type="submit" className="px-5 py-2 text-sm font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600">{t('farmDetail.addAdvance')}</button>
          </div>
        </form>
      </Modal>

      {/* Supply Payment Modal */}
      <Modal open={supplyModal} onClose={() => setSupplyModal(false)} title={t('supply.recordPayment')}>
        <form onSubmit={handleSupplySubmit} className="space-y-4">
          <p className="text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {t('supply.debtNote')}
          </p>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('supply.supplyItem')} *</label>
            <select value={supplyForm.supply_item} onChange={e => setSupplyForm(f => ({ ...f, supply_item: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30">
              {SUPPLY_ITEMS.map(item => <option key={item} value={item}>{t(`supply.items.${item}`)}</option>)}
            </select>
          </div>
          {supplyForm.supply_item === 'Other' && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('supply.specifyItem')} *</label>
              <input required value={supplyForm.other_item} onChange={e => setSupplyForm(f => ({ ...f, other_item: e.target.value }))}
                placeholder={t('supply.specifyPlaceholder')}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('payments.amountAFN')} *</label>
              <input required type="number" min="0.01" step="0.01" value={supplyForm.amount}
                onChange={e => setSupplyForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.date')}</label>
              <input type="date" value={supplyForm.payment_date}
                onChange={e => setSupplyForm(f => ({ ...f, payment_date: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.notes')}</label>
            <input value={supplyForm.notes} onChange={e => setSupplyForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setSupplyModal(false)} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">{t('common.cancel')}</button>
            <button type="submit" className="px-5 py-2 text-sm font-medium bg-[#1B3A5C] text-white rounded-lg hover:bg-[#2E86AB]">{t('supply.recordPayment')}</button>
          </div>
        </form>
      </Modal>

      {/* Edit dispatch (shared modal with the Dispatches page) */}
      <EditDispatchModal
        dispatch={editDispatchTarget}
        onClose={() => setEditDispatchTarget(null)}
        updateDispatch={updateDispatch}
      />

      <ConfirmDialog
        open={!!deleteDispatchTarget}
        onClose={() => setDeleteDispatchTarget(null)}
        onConfirm={async () => {
          await deleteDispatch(deleteDispatchTarget.id)
          const updated = await getFarmById(id)
          setFarm(updated)
          setDeleteDispatchTarget(null)
        }}
        title={t('dispatches.deleteTitle')}
        message={t('dispatches.deleteMsg')}
      />

      {/* Edit supply payment */}
      <Modal open={!!editSupplyTarget} onClose={() => setEditSupplyTarget(null)} title={t('supply.editPayment')}>
        {editSupplyTarget && (
          <form
            onSubmit={async e => {
              e.preventDefault()
              const supplyItem = editSupplyTarget.supply_item === 'Other' ? editSupplyTarget.other_item.trim() : editSupplyTarget.supply_item
              if (!supplyItem) { toast.error('Supply item is required'); return }
              const amount = parseFloat(editSupplyTarget.amount) || 0
              if (amount <= 0) { toast.error('Amount must be > 0'); return }
              const ok = await updateSupplyPayment(editSupplyTarget.id, editSupplyTarget._original, {
                farm_id: id,
                supply_item: supplyItem,
                amount,
                payment_date: editSupplyTarget.payment_date,
                notes: editSupplyTarget.notes || null,
              })
              if (ok) {
                const updated = await getFarmById(id)
                setFarm(updated)
                setEditSupplyTarget(null)
              }
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('supply.supplyItem')} *</label>
              <select value={editSupplyTarget.supply_item} onChange={e => setEditSupplyTarget(s => ({ ...s, supply_item: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30">
                {SUPPLY_ITEMS.map(item => <option key={item} value={item}>{t(`supply.items.${item}`)}</option>)}
              </select>
            </div>
            {editSupplyTarget.supply_item === 'Other' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('supply.specifyItem')} *</label>
                <input required value={editSupplyTarget.other_item} onChange={e => setEditSupplyTarget(s => ({ ...s, other_item: e.target.value }))}
                  placeholder={t('supply.specifyPlaceholder')}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('payments.amountAFN')} *</label>
                <input required type="number" min="0.01" step="0.01" value={editSupplyTarget.amount}
                  onChange={e => setEditSupplyTarget(s => ({ ...s, amount: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.date')}</label>
                <input type="date" value={editSupplyTarget.payment_date}
                  onChange={e => setEditSupplyTarget(s => ({ ...s, payment_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.notes')}</label>
              <input value={editSupplyTarget.notes} onChange={e => setEditSupplyTarget(s => ({ ...s, notes: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button type="button" onClick={() => setEditSupplyTarget(null)} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">{t('common.cancel')}</button>
              <button type="submit" className="px-5 py-2 text-sm font-medium bg-[#1B3A5C] text-white rounded-lg hover:bg-[#2E86AB]">{t('common.saveChanges')}</button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteSupplyTarget}
        onClose={() => setDeleteSupplyTarget(null)}
        onConfirm={async () => {
          await deleteSupplyPayment(deleteSupplyTarget.id, deleteSupplyTarget.farm_id, deleteSupplyTarget.amount)
          const updated = await getFarmById(id)
          setFarm(updated)
          setDeleteSupplyTarget(null)
        }}
        title={t('supply.deleteTitle')}
        message={t('supply.deleteMsg') !== 'supply.deleteMsg' ? t('supply.deleteMsg') : 'Delete this supply payment? It will be removed and the farm debt adjusted.'}
      />

      {/* Edit Farm Modal */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title={t('farmDetail.editFarm')}>
        <form onSubmit={handleEditSave} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('farms.farmName')} *</label>
            <input required value={editForm.name || ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('farms.ownerName')}</label>
            <input value={editForm.owner_name || ''} onChange={e => setEditForm(f => ({ ...f, owner_name: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.phone')}</label>
              <PhoneInput value={editForm.phone || ''} onChange={v => setEditForm(f => ({ ...f, phone: v }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.location')}</label>
              <input value={editForm.location || ''} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('farms.initialChickenCount')}</label>
              <input
                type="number" min="0"
                value={editForm.initial_chicken_count || 0}
                onChange={e => setEditForm(f => ({ ...f, initial_chicken_count: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('farms.pricePerChicken')}</label>
              <input
                type="number" min="0" step="0.01"
                value={editForm.price_per_chicken || 0}
                onChange={e => setEditForm(f => ({ ...f, price_per_chicken: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.notes')}</label>
            <textarea rows={3} value={editForm.notes || ''} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30 resize-none" />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setEditModal(false)} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">{t('common.cancel')}</button>
            <button type="submit" className="px-5 py-2 text-sm font-medium bg-[#1B3A5C] text-white rounded-lg hover:bg-[#2E86AB]">{t('common.saveChanges')}</button>
          </div>
        </form>
      </Modal>

      {/* Death Entry Modal */}
      <Modal open={deathModal} onClose={() => setDeathModal(false)} title={editDeathItem ? t('chickens.editDeath') : t('chickens.addDeath')}>
        <form onSubmit={handleDeathSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('chickens.deathCount')} *</label>
              <input
                required type="number" min="1"
                value={deathForm.death_count}
                onChange={e => setDeathForm(f => ({ ...f, death_count: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.date')}</label>
              <input
                type="date"
                value={deathForm.death_date}
                onChange={e => setDeathForm(f => ({ ...f, death_date: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('chickens.reason')}</label>
            <input
              value={deathForm.reason}
              onChange={e => setDeathForm(f => ({ ...f, reason: e.target.value }))}
              placeholder={t('chickens.reasonPlaceholder')}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.notes')}</label>
            <textarea
              rows={2}
              value={deathForm.notes}
              onChange={e => setDeathForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setDeathModal(false)} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">{t('common.cancel')}</button>
            <button type="submit" className="px-5 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700">
              {editDeathItem ? t('common.saveChanges') : t('chickens.record')}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deathDeleteTarget}
        onClose={() => setDeathDeleteTarget(null)}
        onConfirm={() => { deleteDeath(deathDeleteTarget?.id); setDeathDeleteTarget(null) }}
        title={t('chickens.deleteTitle')}
        message={t('chickens.deleteConfirm')}
      />

      <ConfirmDialog
        open={!!batchDeleteTarget}
        onClose={() => setBatchDeleteTarget(null)}
        onConfirm={() => {
          deleteBatch(batchDeleteTarget.id)
          setSelectedBatchId(null)
          setBatchDeleteTarget(null)
        }}
        title={`${t('batches.deleteBatch')} #${batchDeleteTarget?.batch_number || ''}`}
        message={t('batches.deleteConfirm')}
      />

      <ConfirmDialog
        open={statusConfirm}
        onClose={() => setStatusConfirm(false)}
        onConfirm={toggleActiveStatus}
        title={farm.is_active ? t('farmDetail.disableFarm') : t('farmDetail.enableFarm')}
        message={farm.is_active ? t('farmDetail.disableConfirm') : t('farmDetail.enableConfirm')}
      />

      <WhatsAppPromptDialog
        open={!!waPrompt}
        onClose={() => setWaPrompt(null)}
        templateKey={waPrompt?.templateKey}
        variables={waPrompt?.variables}
        recipient={waPrompt?.recipient}
      />

      {/* Batch (Season) Modal */}
      <Modal
        open={batchModal}
        onClose={() => setBatchModal(false)}
        title={editBatchItem ? `${t('batches.editBatch')} #${editBatchItem.batch_number}` : t('batches.startNew')}
      >
        <form onSubmit={handleBatchSubmit} className="space-y-4">
          {!editBatchItem && (
            <p className="text-xs text-slate-500 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              {t('batches.startNewHint')}
            </p>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">🐥 {t('batches.chozaSupplier')}</label>
            <select
              value={batchForm.supplier_id}
              onChange={e => setBatchForm(f => ({ ...f, supplier_id: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
            >
              <option value="">— {t('common.optional')} —</option>
              {chozaSuppliers.map(s => (
                <option key={s.id} value={s.id}>{s.company_name}</option>
              ))}
            </select>
            {batchForm.supplier_id && supplierChoza && (
              <p className={`text-xs mt-1 px-2 py-1.5 rounded-lg ${supplierChoza.remaining > 0 ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {t('batches.availableFromSupplier')}: <strong>{supplierChoza.remaining}</strong> {t('batches.chozaUnit')}
                {' '}<span className="opacity-70">({t('suppliers.totalChozaBought')}: {supplierChoza.bought} · {t('suppliers.chozaSentToFarms')}: {supplierChoza.sent})</span>
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('farms.initialChickenCount')} *</label>
              <input
                required type="number" min="0"
                value={batchForm.initial_chicken_count}
                onChange={e => setBatchForm(f => ({ ...f, initial_chicken_count: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('farms.pricePerChicken')}</label>
              <input
                type="number" min="0" step="0.01"
                value={batchForm.price_per_chicken}
                onChange={e => setBatchForm(f => ({ ...f, price_per_chicken: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('batches.startDate')}</label>
            <input
              type="date"
              value={batchForm.start_date}
              onChange={e => setBatchForm(f => ({ ...f, start_date: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.notes')}</label>
            <input
              value={batchForm.notes}
              onChange={e => setBatchForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
            />
          </div>
          {batchForm.initial_chicken_count && batchForm.price_per_chicken && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-sm">
              <span className="text-slate-600">{t('farms.chickenDebt')} ({t('batches.thisBatch')}):</span>
              <span className="font-bold text-orange-700 ms-2">
                {formatCurrency((parseInt(batchForm.initial_chicken_count) || 0) * (parseFloat(batchForm.price_per_chicken) || 0))}
              </span>
            </div>
          )}
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setBatchModal(false)} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">{t('common.cancel')}</button>
            <button type="submit" className="px-5 py-2 text-sm font-medium bg-[#1B3A5C] text-white rounded-lg hover:bg-[#2E86AB]">
              {editBatchItem ? t('common.saveChanges') : t('batches.startNew')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
