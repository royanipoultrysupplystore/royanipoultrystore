import { useState, useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Trash2, Camera, ArrowLeft, CheckCircle } from 'lucide-react'
import { useDispatches } from '../hooks/useDispatches'
import { useFarms } from '../hooks/useFarms'
import { useInventory } from '../hooks/useInventory'
import { useMeelBills } from '../hooks/useMeelBills'
import { usePayments } from '../hooks/usePayments'
import { useBarcodeListener } from '../components/common/BarcodeScanner'
import BarcodeScannerModal from '../components/common/BarcodeScanner'
import WhatsAppPromptDialog from '../components/common/WhatsAppPromptDialog'
import { formatCurrency } from '../utils/formatCurrency'
import { todayStr } from '../utils/dateHelpers'
import { useLanguage } from '../contexts/LanguageContext'
import { lf } from '../utils/localizedField'
import toast from 'react-hot-toast'

// Same palette as SupplierDetail.jsx + FarmDetail.jsx so each Dana variety is
// recognisable by colour across the app.
const DANA_OPTIONS = [
  { value: '4_number',  labelKey: 'dana4Number',  color: 'bg-blue-100 text-blue-700' },
  { value: '6_number',  labelKey: 'dana6Number',  color: 'bg-cyan-100 text-cyan-700' },
  { value: '9_number',  labelKey: 'dana9Number',  color: 'bg-green-100 text-green-700' },
  { value: '12_number', labelKey: 'dana12Number', color: 'bg-purple-100 text-purple-700' },
  { value: 'other',     labelKey: 'danaOther',    color: 'bg-slate-100 text-slate-600' },
]

export default function NewDispatch() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { t, lang } = useLanguage()
  const { farms } = useFarms()
  const { products } = useInventory()
  const { createDispatch } = useDispatches()
  const { meelBills } = useMeelBills()

  const [step, setStep] = useState(1)
  const [farmId, setFarmId] = useState(searchParams.get('farm') || '')
  const [farmSearch, setFarmSearch] = useState('')
  const [farmListOpen, setFarmListOpen] = useState(false)
  const [dispatchDate, setDispatchDate] = useState(todayStr())
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([])
  const [categoryTab, setCategoryTab] = useState('medicine')
  const [searchTerm, setSearchTerm] = useState('')
  const [meelSearch, setMeelSearch] = useState('')
  const [cameraOpen, setCameraOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [payNow, setPayNow] = useState(false)
  const [amountPaidNow, setAmountPaidNow] = useState('')
  const [waPrompt, setWaPrompt] = useState(null) // { templateKey, variables, recipient }

  const { recordPayment } = usePayments(farmId)
  const selectedFarm = farms.find(f => f.id === farmId)

  function addItem(product) {
    if (items.find(i => i.product_id === product.id && !i.meel_bill_id)) {
      toast(t('inventory.productFound') + ': ' + product.name)
      return
    }
    // Medicine products may carry a USD purchase/sell price so cashiers can
    // dispatch in either currency. Currency defaults to AFN; the row-level
    // AFN/$ chip flips it and swaps which price fields the Buy/Sell inputs
    // bind to. Non-medicine products stay AFN-only (chip not shown).
    setItems(prev => [...prev, {
      product_id: product.id,
      name: product.name,
      unit: product.unit,
      batch_number: product.batch_number || '',
      purchase_price: product.purchase_price,
      sell_price: product.sell_price,
      purchase_price_usd: product.purchase_price_usd || 0,
      sell_price_usd: product.sell_price_usd || 0,
      currency: 'AFN',
      is_medicine: product.type === 'medicine',
      quantity: 1,
      available: product.quantity,
      is_meel: false,
    }])
    setSearchTerm('')
  }

  function addMeel(m) {
    if (items.find(i => i.meel_bill_id === m.id)) {
      toast(t('inventory.productFound') + ': ' + m.product_name)
      return
    }
    setItems(prev => [...prev, {
      product_id: m.product_id,
      name: m.product_name,
      unit: 'bag',
      batch_number: m.bill_number,
      purchase_price: m.price_per_bag,
      sell_price: m.sell_price || m.price_per_bag,
      quantity: 1,
      available: m.available,
      meel_bill_id: m.id,
      supplier_name: m.supplier_name,
      is_meel: true,
    }])
    setMeelSearch('')
  }

  // On the Feed (Dana) tab the user picks a SUPPLIER + DANA TYPE, not a single
  // bill. Aggregating by (product, supplier, dana_type) gives one row per
  // (supplier × type) so the user can see e.g. how many 4 Number bags vs 9
  // Number bags they have from the same supplier, and pick the right one.
  // On Confirm the quantity is allocated FIFO across that supplier's bills of
  // the matching type, so per-bill remaining stock stays accurate.
  const feedSuppliers = useMemo(() => {
    const map = new Map()
    for (const b of meelBills) {
      if (!b.supplier_id || !b.product_id) continue
      const danaType = b.dana_type || 'other'
      const key = `${b.product_id}|${b.supplier_id}|${danaType}`
      if (!map.has(key)) {
        map.set(key, {
          product_id: b.product_id,
          product_name: b.product_name,
          supplier_id: b.supplier_id,
          supplier_name: b.supplier_name,
          dana_type: danaType,
          total_available: 0,
          latest_sell_price: 0,
          latest_buy_price: 0,
          latest_date: '',
          bills: [],
        })
      }
      const g = map.get(key)
      g.total_available += b.available
      g.bills.push(b)
      if (!g.latest_date || (b.dispatch_date || '') > g.latest_date) {
        g.latest_date = b.dispatch_date || ''
        g.latest_sell_price = b.sell_price
        g.latest_buy_price = b.price_per_bag
      }
    }
    // FIFO order — oldest bill first so allocation drains the oldest stock first.
    for (const g of map.values()) {
      g.bills.sort((a, b) => (a.dispatch_date || '').localeCompare(b.dispatch_date || ''))
    }
    return [...map.values()].filter(g => g.total_available > 0)
  }, [meelBills])

  const filteredFeedSuppliers = feedSuppliers.filter(s =>
    !searchTerm ||
    (s.product_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.supplier_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.dana_type || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  function addSupplierLine(s) {
    if (items.find(i => i.is_supplier && i.product_id === s.product_id && i.supplier_id === s.supplier_id && (i.dana_type || 'other') === (s.dana_type || 'other'))) {
      const danaOpt = DANA_OPTIONS.find(o => o.value === s.dana_type)
      const danaLabel = danaOpt ? t(`suppliers.${danaOpt.labelKey}`) : s.dana_type
      toast(t('inventory.productFound') + ': ' + s.product_name + ' (' + s.supplier_name + ' · ' + danaLabel + ')')
      return
    }
    setItems(prev => [...prev, {
      product_id: s.product_id,
      name: s.product_name,
      unit: 'bag',
      batch_number: '',
      purchase_price: s.latest_buy_price,
      sell_price: s.latest_sell_price || s.latest_buy_price,
      quantity: 1,
      available: s.total_available,
      is_meel: true,
      is_supplier: true,
      supplier_id: s.supplier_id,
      supplier_name: s.supplier_name,
      dana_type: s.dana_type,
      _bills: s.bills, // FIFO-ordered, used only on save for allocation
    }])
    setSearchTerm('')
  }

  function updateItem(idx, field, value) {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  function removeItem(idx) {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  const handleBarcodeScan = useCallback((barcode) => {
    const product = products.find(p => p.barcode === barcode)
    if (product) {
      addItem(product)
      toast.success(`${t('pos.productAdded')}: ${product.name}`)
    } else {
      toast.error(t('pos.productNotFound') + ': ' + barcode)
    }
  }, [products, items, t])

  useBarcodeListener(handleBarcodeScan)

  const categoryProducts = products
    .filter(p => {
      const matchesType = categoryTab === 'meel_bill' ? false : p.type === (categoryTab === 'feed' ? 'meel' : categoryTab)
      const matchesSearch = !searchTerm ||
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.barcode || '').includes(searchTerm)
      return matchesType && matchesSearch
    })

  const filteredProducts = searchTerm.length > 0 && !['medicine', 'feed', 'choza'].includes(categoryTab)
    ? products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.barcode || '').includes(searchTerm)
      ).slice(0, 8)
    : []

  const filteredMeel = categoryTab === 'meel_bill'
    ? meelBills.filter(m =>
        !meelSearch ||
        (m.product_name || '').toLowerCase().includes(meelSearch.toLowerCase()) ||
        (m.bill_number || '').toLowerCase().includes(meelSearch.toLowerCase()) ||
        (m.supplier_name || '').toLowerCase().includes(meelSearch.toLowerCase())
      )
    : []

  const totalAmount = items.reduce((s, i) => {
    if (i.currency === 'USD') return s
    return s + (parseFloat(i.sell_price) || 0) * (parseFloat(i.quantity) || 0)
  }, 0)
  const totalProfit = items.reduce((s, i) => {
    if (i.currency === 'USD') return s
    return s + ((parseFloat(i.sell_price) || 0) - (parseFloat(i.purchase_price) || 0)) * (parseFloat(i.quantity) || 0)
  }, 0)
  const totalCost = items.reduce((s, i) => {
    if (i.currency === 'USD') return s
    return s + (parseFloat(i.purchase_price) || 0) * (parseFloat(i.quantity) || 0)
  }, 0)
  const totalAmountUsd = items.reduce((s, i) => {
    if (i.currency !== 'USD') return s
    return s + (parseFloat(i.sell_price_usd) || 0) * (parseFloat(i.quantity) || 0)
  }, 0)
  const totalProfitUsd = items.reduce((s, i) => {
    if (i.currency !== 'USD') return s
    return s + ((parseFloat(i.sell_price_usd) || 0) - (parseFloat(i.purchase_price_usd) || 0)) * (parseFloat(i.quantity) || 0)
  }, 0)
  const paidAmount = parseFloat(amountPaidNow) || 0
  const remainingDebt = Math.max(0, totalAmount - paidAmount)

  async function handleSubmit() {
    if (!farmId) { toast.error(t('pos.selectFarmFirst')); return }
    if (items.length === 0) { toast.error(t('dispatches.atLeastOne')); return }
    for (const item of items) {
      if (parseFloat(item.quantity) <= 0) { toast.error(`${t('pos.invalidQty')}: ${item.name}`); return }
      if (parseFloat(item.quantity) > item.available) { toast.error(`${t('pos.notEnoughStock')}: ${item.name}`); return }
    }
    setSaving(true)
    // Expand supplier-level lines into per-bill items (FIFO allocation), so each
    // dispatched bag is attributed to a real meel bill with its own purchase price.
    const expandedItems = []
    for (const i of items) {
      const sellPrice = parseFloat(i.sell_price) || 0
      if (i.is_supplier) {
        let remaining = parseFloat(i.quantity) || 0
        for (const b of (i._bills || [])) {
          if (remaining <= 0) break
          const take = Math.min(remaining, b.available)
          if (take <= 0) continue
          expandedItems.push({
            product_id: i.product_id,
            batch_number: b.bill_number || null,
            quantity: take,
            purchase_price: b.price_per_bag,
            sell_price: sellPrice,
            supplier_dispatch_id: b.id,
          })
          remaining -= take
        }
        if (remaining > 0) {
          const danaOpt = DANA_OPTIONS.find(o => o.value === i.dana_type)
          const danaLabel = danaOpt ? t(`suppliers.${danaOpt.labelKey}`) : i.dana_type
          const tail = danaLabel ? ` · ${danaLabel}` : ''
          toast.error(`${t('pos.notEnoughStock')}: ${i.name} (${i.supplier_name}${tail})`)
          setSaving(false)
          return
        }
      } else {
        expandedItems.push({
          product_id: i.product_id,
          batch_number: i.batch_number || null,
          quantity: parseFloat(i.quantity),
          purchase_price: parseFloat(i.purchase_price) || 0,
          sell_price: sellPrice,
          purchase_price_usd: parseFloat(i.purchase_price_usd) || 0,
          sell_price_usd: parseFloat(i.sell_price_usd) || 0,
          currency: i.currency || 'AFN',
          supplier_dispatch_id: i.meel_bill_id || null,
        })
      }
    }
    const ok = await createDispatch(
      { farm_id: farmId, dispatch_date: dispatchDate, total_amount: totalAmount, notes },
      expandedItems
    )
    if (ok && payNow && paidAmount > 0) {
      await recordPayment({
        farm_id: farmId,
        amount: Math.min(paidAmount, totalAmount),
        payment_date: dispatchDate,
        notes: t('dispatches.paidAtDispatch'),
      })
    }
    setSaving(false)
    if (ok) {
      const farmName = lf(selectedFarm, 'name', lang) || selectedFarm.name
      // Build a currency-mixed amount string when the dispatch has both AFN
      // and USD lines. Same for the resulting balance line — otherwise a
      // USD-only dispatch reads "Total amount: AFN 0" in the message.
      const amountParts = []
      if (totalAmount > 0) amountParts.push(formatCurrency(totalAmount))
      if (totalAmountUsd > 0) amountParts.push(`$${totalAmountUsd.toFixed(2)}`)
      const amountStr = amountParts.length > 0 ? amountParts.join(' + ') : formatCurrency(0)

      const newAfnBal = Math.max(0, (selectedFarm.total_debt || 0) + totalAmount - paidAmount)
      const newUsdBal = (selectedFarm.total_debt_usd || 0) + totalAmountUsd
      const balanceParts = []
      if (newAfnBal > 0) balanceParts.push(formatCurrency(newAfnBal))
      if (newUsdBal > 0) balanceParts.push(`$${newUsdBal.toFixed(2)}`)
      const balanceStr = balanceParts.length > 0 ? balanceParts.join(' + ') : formatCurrency(0)

      setWaPrompt({
        templateKey: 'farm_dispatch',
        variables: {
          name: farmName,
          items_list: items.map(i => `${i.name} × ${i.quantity}`).join(', '),
          amount: amountStr,
          date: dispatchDate,
          balance: balanceStr,
        },
        recipient: { name: farmName, phone: selectedFarm.phone },
        next: () => navigate('/dispatches'),
      })
    }
  }

  const STEPS = [t('dispatches.step1'), t('dispatches.step2'), t('dispatches.step3')]

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <button onClick={() => navigate('/dispatches')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={16} /> {t('dispatches.backToDispatches')}
      </button>

      <h2 className="text-xl font-bold text-slate-800">{t('dispatches.newDispatch')}</h2>

      {/* Step indicators */}
      <div className="flex items-center gap-2 text-sm">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors
              ${step > i + 1 ? 'bg-green-500 text-white' : step === i + 1 ? 'bg-[#1B3A5C] text-white' : 'bg-slate-200 text-slate-500'}`}>
              {step > i + 1 ? '✓' : i + 1}
            </div>
            <span className={step === i + 1 ? 'text-[#1B3A5C] font-medium' : 'text-slate-400'}>{s}</span>
            {i < 2 && <div className="w-8 h-px bg-slate-200" />}
          </div>
        ))}
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 space-y-4">
          <h3 className="font-semibold text-slate-700">{t('dispatches.step1Title')}</h3>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('dispatches.farm')} *</label>
            {(() => {
              const activeFarms = farms.filter(f => f.is_active)
              const q = farmSearch.trim().toLowerCase()
              const filteredFarms = !q ? activeFarms : activeFarms.filter(f =>
                (f.name || '').toLowerCase().includes(q) ||
                (f.name_fa || '').toLowerCase().includes(q) ||
                (f.name_ps || '').toLowerCase().includes(q) ||
                (f.owner_name || '').toLowerCase().includes(q) ||
                (f.owner_name_fa || '').toLowerCase().includes(q) ||
                (f.owner_name_ps || '').toLowerCase().includes(q)
              )
              const displayText = farmId && !farmListOpen
                ? `${lf(selectedFarm, 'name', lang) || ''}${selectedFarm?.owner_name ? ' — ' + (lf(selectedFarm, 'owner_name', lang) || '') : ''}`
                : farmSearch
              return (
                <div className="relative">
                  <input
                    type="text"
                    value={displayText}
                    onChange={e => { setFarmSearch(e.target.value); if (farmId) setFarmId(''); setFarmListOpen(true) }}
                    onFocus={() => setFarmListOpen(true)}
                    onBlur={() => setTimeout(() => setFarmListOpen(false), 150)}
                    placeholder={t('dispatches.chooseFarm')}
                    className="w-full px-3 py-2 pe-9 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
                  />
                  {farmId && (
                    <button type="button"
                      onMouseDown={e => { e.preventDefault(); setFarmId(''); setFarmSearch(''); setFarmListOpen(true) }}
                      className="absolute top-1/2 -translate-y-1/2 end-2 p-1 text-slate-400 hover:text-slate-700 rounded">
                      ×
                    </button>
                  )}
                  {farmListOpen && (
                    <div className="absolute top-full inset-x-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto z-20">
                      {filteredFarms.length === 0 ? (
                        <p className="px-3 py-3 text-sm text-slate-400 text-center">No farm matching "{farmSearch}"</p>
                      ) : (
                        filteredFarms.map(f => (
                          <button type="button" key={f.id}
                            onMouseDown={e => { e.preventDefault(); setFarmId(f.id); setFarmSearch(''); setFarmListOpen(false) }}
                            className="w-full text-start px-3 py-2 hover:bg-slate-50 text-sm border-b border-slate-50 last:border-0">
                            <p className="font-medium text-slate-700">{lf(f, 'name', lang)}</p>
                            {f.owner_name && <p className="text-xs text-slate-500">{lf(f, 'owner_name', lang)}</p>}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
          {selectedFarm && (
            <div className="bg-slate-50 rounded-xl p-3 text-sm">
              <p className="text-slate-600">{t('dispatches.currentDebt')}: <span className="font-semibold text-red-600">{formatCurrency(selectedFarm.total_debt)}</span></p>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('dispatches.dispatchDate')} *</label>
            <input type="date" value={dispatchDate} onChange={e => setDispatchDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.notes')}</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('common.optional')}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
          </div>
          <button
            onClick={() => { if (!farmId) { toast.error(t('pos.selectFarmFirst')); return } setStep(2) }}
            className="w-full py-2.5 bg-[#1B3A5C] text-white rounded-xl text-sm font-medium hover:bg-[#2E86AB] transition-colors"
          >
            {t('common.next')}: {t('dispatches.step2')} →
          </button>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-700">{t('dispatches.step2Title')}</h3>
            <button onClick={() => setCameraOpen(true)} className="flex items-center gap-1.5 text-sm text-[#2E86AB] hover:underline">
              <Camera size={14} /> {t('dispatches.scanBarcode')}
            </button>
          </div>

          {/* Category Tabs */}
          <div className="flex gap-1.5 flex-wrap">
            {[
              { key: 'medicine', icon: '💊', label: 'Medicine', activeCls: 'bg-blue-600 text-white', inactiveCls: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
              { key: 'feed',     icon: '🌾', label: 'Feed (Dana)', activeCls: 'bg-amber-500 text-white', inactiveCls: 'bg-amber-50 text-amber-700 hover:bg-amber-100' },
              { key: 'choza',    icon: '🐥', label: 'Choza',  activeCls: 'bg-yellow-500 text-white', inactiveCls: 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100' },
              { key: 'meel_bill',icon: '📋', label: 'Feed Bills', activeCls: 'bg-slate-700 text-white', inactiveCls: 'bg-slate-100 text-slate-600 hover:bg-slate-200' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => { setCategoryTab(tab.key); setSearchTerm(''); setMeelSearch('') }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${categoryTab === tab.key ? tab.activeCls : tab.inactiveCls}`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* Search within selected category */}
          {categoryTab !== 'meel_bill' && (
            <input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder={`Search ${categoryTab === 'feed' ? 'feed / dana' : categoryTab}...`}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
            />
          )}

          {/* Feed (Dana) tab — supplier-level picker (one card per supplier; bags are
              auto-allocated FIFO across that supplier's bills on Confirm). */}
          {categoryTab === 'feed' && (
            filteredFeedSuppliers.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-sm border border-dashed border-slate-200 rounded-xl">
                {searchTerm ? `No supplier matching "${searchTerm}"` : 'No feed bills in stock — receive from a supplier first'}
              </div>
            ) : (
              <div className="border border-amber-200 rounded-xl overflow-hidden max-h-52 overflow-y-auto">
                {filteredFeedSuppliers.map(s => {
                  const danaOpt = DANA_OPTIONS.find(o => o.value === s.dana_type)
                  return (
                  <button key={`${s.product_id}|${s.supplier_id}|${s.dana_type}`} onClick={() => addSupplierLine(s)}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-amber-50 text-sm text-start border-b border-amber-100 last:border-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-700">{s.product_name}</span>
                      <span className="text-xs text-amber-700 font-medium">{s.supplier_name}</span>
                      {danaOpt ? (
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${danaOpt.color}`}>
                          {t(`suppliers.${danaOpt.labelKey}`)}
                        </span>
                      ) : s.dana_type ? (
                        <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{s.dana_type}</span>
                      ) : null}
                    </div>
                    <div className="text-end shrink-0 ms-4">
                      <div className="text-xs font-semibold text-slate-600">{s.total_available} bag</div>
                      <div className="text-xs font-medium text-[#1B3A5C]">{formatCurrency(s.latest_sell_price)}</div>
                    </div>
                  </button>
                  )
                })}
              </div>
            )
          )}

          {/* Generic category product list (Medicine / Choza) */}
          {categoryTab !== 'meel_bill' && categoryTab !== 'feed' && (
            categoryProducts.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-sm border border-dashed border-slate-200 rounded-xl">
                {searchTerm ? `No ${categoryTab} matching "${searchTerm}"` : `No ${categoryTab} in stock`}
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-52 overflow-y-auto">
                {categoryProducts.map(p => (
                  <button key={p.id} onClick={() => addItem(p)}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 text-sm text-start border-b border-slate-100 last:border-0">
                    <div>
                      <span className="font-medium text-slate-700">{p.name}</span>
                      {p.batch_number && <span className="ms-2 text-xs font-mono text-slate-400">{p.batch_number}</span>}
                    </div>
                    <div className="text-end shrink-0 ms-4">
                      <div className={`text-xs font-semibold ${p.quantity <= 0 ? 'text-red-500' : 'text-slate-600'}`}>
                        {p.quantity} {p.unit}
                      </div>
                      <div className="text-xs font-medium text-[#1B3A5C]">{formatCurrency(p.sell_price)}</div>
                    </div>
                  </button>
                ))}
              </div>
            )
          )}

          {/* Feed Bills list */}
          {categoryTab === 'meel_bill' && (
            <div className="space-y-2">
              <input
                value={meelSearch}
                onChange={e => setMeelSearch(e.target.value)}
                placeholder="Search by name, bill #, or supplier..."
                className="w-full px-4 py-2.5 border border-amber-200 bg-amber-50/40 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
              {filteredMeel.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-sm border border-dashed border-slate-200 rounded-xl">
                  No feed bills found
                </div>
              ) : (
                <div className="border border-amber-200 rounded-xl overflow-hidden max-h-52 overflow-y-auto">
                  {filteredMeel.map(m => (
                    <button key={m.id} onClick={() => addMeel(m)}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-amber-50 text-sm text-start border-b border-amber-100 last:border-0">
                      <div>
                        <span className="font-medium text-slate-700">{m.product_name}</span>
                        {m.bill_number && <span className="ms-2 text-xs font-mono bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Bill #{m.bill_number}</span>}
                        {m.dana_type && <span className="ms-2 text-xs font-medium bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">{m.dana_type}</span>}
                        <span className="ms-2 text-xs text-slate-400">{m.supplier_name}</span>
                      </div>
                      <div className="text-end shrink-0 ms-4">
                        <div className="text-xs font-medium text-amber-600">{formatCurrency(m.price_per_bag)}/bag</div>
                        <div className="text-xs text-slate-400">{m.available} bags</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {items.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
              {t('dispatches.noItems')}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wide px-2">
                <div className="col-span-3">{t('dispatches.product')}</div>
                <div className="col-span-2">{t('dispatches.batchNo')}</div>
                <div className="col-span-1">{t('dispatches.quantity')}</div>
                <div className="col-span-2">{t('dispatches.buyPrice')}</div>
                <div className="col-span-2">{t('dispatches.sellPriceAFN')}</div>
                <div className="col-span-1">{t('dispatches.profit')}</div>
                <div className="col-span-1"></div>
              </div>
              {items.map((item, idx) => (
                <div key={idx} className={`grid grid-cols-12 gap-2 items-center rounded-xl p-2 ${item.is_meel ? 'bg-amber-50 border border-amber-100' : 'bg-slate-50'}`}>
                  <div className="col-span-3">
                    <p className="text-sm font-medium text-slate-700 truncate">{item.name}</p>
                    {item.is_meel ? (
                      <div className="flex flex-wrap gap-1 mt-0.5 items-center">
                        {item.batch_number && (
                          <span className="text-xs font-mono bg-blue-100 text-blue-700 px-1 rounded">#{item.batch_number}</span>
                        )}
                        <span className="text-xs text-amber-600 truncate">{item.supplier_name}</span>
                        {item.dana_type && (() => {
                          const danaOpt = DANA_OPTIONS.find(o => o.value === item.dana_type)
                          return danaOpt ? (
                            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${danaOpt.color}`}>
                              {t(`suppliers.${danaOpt.labelKey}`)}
                            </span>
                          ) : (
                            <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{item.dana_type}</span>
                          )
                        })()}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                          item.unit === 'chick' ? 'bg-yellow-100 text-yellow-700' :
                          item.unit === 'bag' ? 'bg-amber-100 text-amber-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {item.unit === 'chick' ? '🐥' : item.unit === 'bag' ? '🌾' : '💊'} {item.unit}
                        </span>
                        {/* Currency toggle — medicine only. Click to flip AFN ⇄ USD. */}
                        {item.is_medicine && (
                          <button
                            type="button"
                            onClick={() => updateItem(idx, 'currency', item.currency === 'USD' ? 'AFN' : 'USD')}
                            className={`text-xs font-semibold px-1.5 py-0.5 rounded-full transition-colors ${
                              item.currency === 'USD'
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                            title="Click to switch currency"
                          >
                            {item.currency === 'USD' ? '$ USD' : '؋ AFN'} ⇅
                          </button>
                        )}
                        <span className="text-xs text-slate-400">{t('dispatches.available')}: {item.available}</span>
                      </div>
                    )}
                  </div>
                  <div className="col-span-2">
                    <input type="text" value={item.batch_number}
                      onChange={e => updateItem(idx, 'batch_number', e.target.value)}
                      placeholder={t('dispatches.batchNo')}
                      className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
                  </div>
                  <div className="col-span-1">
                    <input type="number" min="0.01" step="0.01" value={item.quantity}
                      onChange={e => updateItem(idx, 'quantity', e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
                  </div>
                  <div className="col-span-2 relative">
                    <input type="number" min="0" step="0.01"
                      value={item.currency === 'USD' ? item.purchase_price_usd : item.purchase_price}
                      onChange={e => updateItem(idx, item.currency === 'USD' ? 'purchase_price_usd' : 'purchase_price', e.target.value)}
                      className="w-full ps-6 pe-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
                    <span className="absolute inset-s-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
                      {item.currency === 'USD' ? '$' : '؋'}
                    </span>
                  </div>
                  <div className="col-span-2 relative">
                    <input type="number" min="0" step="0.01"
                      value={item.currency === 'USD' ? item.sell_price_usd : item.sell_price}
                      onChange={e => updateItem(idx, item.currency === 'USD' ? 'sell_price_usd' : 'sell_price', e.target.value)}
                      className="w-full ps-6 pe-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
                    <span className="absolute inset-s-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
                      {item.currency === 'USD' ? '$' : '؋'}
                    </span>
                  </div>
                  <div className="col-span-1 text-xs font-semibold text-green-600">
                    {item.currency === 'USD'
                      ? `$${(((parseFloat(item.sell_price_usd) || 0) - (parseFloat(item.purchase_price_usd) || 0)) * (parseFloat(item.quantity) || 0)).toFixed(2)}`
                      : formatCurrency(((parseFloat(item.sell_price) || 0) - (parseFloat(item.purchase_price) || 0)) * (parseFloat(item.quantity) || 0))}
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button onClick={() => removeItem(idx)} className="p-1 text-red-400 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {items.length > 0 && (
            <div className="border-t border-slate-100 pt-3 flex justify-between items-center text-sm">
              <span className="text-slate-600">{items.length} {t('dispatches.items')}</span>
              <div className="text-end">
                <div className="text-slate-600">
                  {t('common.total')}: <span className="font-bold text-[#1B3A5C]">{formatCurrency(totalAmount)}</span>
                  {totalAmountUsd > 0 && (
                    <span className="ms-2 font-bold text-emerald-700">+ ${totalAmountUsd.toFixed(2)}</span>
                  )}
                </div>
                <div className="text-green-600 text-xs">
                  {t('common.profit')}: {formatCurrency(totalProfit)}
                  {totalProfitUsd > 0 && <span className="ms-2">+ ${totalProfitUsd.toFixed(2)}</span>}
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200">
              ← {t('common.back')}
            </button>
            <button
              onClick={() => { if (items.length === 0) { toast.error(t('dispatches.atLeastOne')); return } setStep(3) }}
              className="flex-1 py-2.5 bg-[#1B3A5C] text-white rounded-xl text-sm font-medium hover:bg-[#2E86AB] transition-colors"
            >
              {t('dispatches.step3')} →
            </button>
          </div>
        </div>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 space-y-4">
          <h3 className="font-semibold text-slate-700 flex items-center gap-2">
            <CheckCircle size={18} className="text-green-600" /> {t('dispatches.step3Title')}
          </h3>

          <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-600">{t('dispatches.farm')}:</span><span className="font-medium">{lf(selectedFarm, 'name', lang)}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">{t('common.date')}:</span><span className="font-medium">{dispatchDate}</span></div>
            {notes && <div className="flex justify-between"><span className="text-slate-600">{t('common.notes')}:</span><span>{notes}</span></div>}
          </div>

          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm border-b border-slate-50 pb-2">
                <div>
                  <span className="font-medium text-slate-700">{item.name}</span>
                  {item.is_meel && item.batch_number && (
                    <span className="ms-2 text-xs font-mono bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Bill #{item.batch_number}</span>
                  )}
                  <span className="text-slate-400 ms-2 text-xs">× {item.quantity} {item.unit}</span>
                </div>
                <div className="text-end">
                  <div className="font-medium text-slate-800">{formatCurrency((parseFloat(item.sell_price) || 0) * (parseFloat(item.quantity) || 0))}</div>
                  <div className="text-xs text-green-600">+{formatCurrency(((parseFloat(item.sell_price) || 0) - (parseFloat(item.purchase_price) || 0)) * (parseFloat(item.quantity) || 0))}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-[#1B3A5C] rounded-xl p-4 text-white space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-white/70">{t('dispatches.totalAmount')}</span><span className="font-bold text-lg">{formatCurrency(totalAmount)}</span></div>
            <div className="flex justify-between"><span className="text-white/70">{t('dispatches.costOfGoods')}</span><span>{formatCurrency(totalCost)}</span></div>
            <div className="flex justify-between"><span className="text-white/70">{t('common.profit')}</span><span className="text-green-400 font-semibold">{formatCurrency(totalProfit)}</span></div>
          </div>

          {/* Pay Now option */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox" id="payNow"
                checked={payNow}
                onChange={e => { setPayNow(e.target.checked); setAmountPaidNow('') }}
                className="rounded"
              />
              <label htmlFor="payNow" className="text-sm font-medium text-slate-700 cursor-pointer">
                {t('dispatches.payNow')}
              </label>
            </div>
            {payNow && (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-600">{t('payments.amountAFN')}</label>
                <input
                  type="number" min="0" step="0.01"
                  value={amountPaidNow}
                  onChange={e => setAmountPaidNow(e.target.value)}
                  placeholder={String(totalAmount)}
                  className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
                />
                <button onClick={() => setAmountPaidNow(String(totalAmount))} className="text-xs text-green-600 hover:underline">
                  {t('pos.setFullAmount')}
                </button>
                {paidAmount > 0 && (
                  <div className={`text-sm font-medium rounded-lg px-3 py-2 ${remainingDebt === 0 ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                    {remainingDebt === 0
                      ? `✓ ${t('dispatches.fullyPaid')}`
                      : `${t('dispatches.remainingDebt')}: ${formatCurrency(remainingDebt)}`}
                  </div>
                )}
              </div>
            )}
            {!payNow && (
              <p className="text-xs text-slate-400">{t('dispatches.willAddDebt')} <strong>{formatCurrency(totalAmount)}</strong> {t('dispatches.toFarmDebt').replace('{farm}', lf(selectedFarm, 'name', lang) || '')}</p>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200">
              ← {t('common.back')}
            </button>
            <button onClick={handleSubmit} disabled={saving}
              className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-60 transition-colors">
              {saving ? t('common.saving') : `✓ ${t('dispatches.confirmDispatch')}`}
            </button>
          </div>
        </div>
      )}

      {cameraOpen && <BarcodeScannerModal onScan={(barcode) => { setCameraOpen(false); handleBarcodeScan(barcode) }} onClose={() => setCameraOpen(false)} />}

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
