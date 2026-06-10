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
    setItems(prev => [...prev, {
      product_id: product.id,
      name: product.name,
      unit: product.unit,
      batch_number: product.batch_number || '',
      purchase_price: product.purchase_price,
      sell_price: product.sell_price,
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

  // On the Feed (Dana) tab the user picks a SUPPLIER, not a specific bill.
  // We aggregate the meel bills by (product, supplier) so each card shows the
  // supplier's total available bags + the latest bill's prices; on Confirm
  // the quantity is auto-allocated FIFO across that supplier's bills.
  const feedSuppliers = useMemo(() => {
    const map = new Map()
    for (const b of meelBills) {
      if (!b.supplier_id || !b.product_id) continue
      const key = `${b.product_id}|${b.supplier_id}`
      if (!map.has(key)) {
        map.set(key, {
          product_id: b.product_id,
          product_name: b.product_name,
          supplier_id: b.supplier_id,
          supplier_name: b.supplier_name,
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
    (s.supplier_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  function addSupplierLine(s) {
    if (items.find(i => i.is_supplier && i.product_id === s.product_id && i.supplier_id === s.supplier_id)) {
      toast(t('inventory.productFound') + ': ' + s.product_name + ' (' + s.supplier_name + ')')
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

  const totalAmount = items.reduce((s, i) => s + (parseFloat(i.sell_price) || 0) * (parseFloat(i.quantity) || 0), 0)
  const totalProfit = items.reduce((s, i) => s + ((parseFloat(i.sell_price) || 0) - (parseFloat(i.purchase_price) || 0)) * (parseFloat(i.quantity) || 0), 0)
  const totalCost = items.reduce((s, i) => s + (parseFloat(i.purchase_price) || 0) * (parseFloat(i.quantity) || 0), 0)
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
          toast.error(`${t('pos.notEnoughStock')}: ${i.name} (${i.supplier_name})`)
          setSaving(false)
          return
        }
      } else {
        expandedItems.push({
          product_id: i.product_id,
          batch_number: i.batch_number || null,
          quantity: parseFloat(i.quantity),
          purchase_price: parseFloat(i.purchase_price),
          sell_price: sellPrice,
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
      setWaPrompt({
        templateKey: 'farm_dispatch',
        variables: {
          name: farmName,
          items_list: items.map(i => `${i.name} × ${i.quantity}`).join(', '),
          amount: formatCurrency(totalAmount),
          date: dispatchDate,
          balance: formatCurrency((selectedFarm.total_debt || 0) + totalAmount - paidAmount),
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
            <select value={farmId} onChange={e => setFarmId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30">
              <option value="">{t('dispatches.chooseFarm')}</option>
              {farms.filter(f => f.is_active).map(f => (
                <option key={f.id} value={f.id}>{lf(f, 'name', lang)} — {lf(f, 'owner_name', lang)}</option>
              ))}
            </select>
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
                {filteredFeedSuppliers.map(s => (
                  <button key={`${s.product_id}|${s.supplier_id}`} onClick={() => addSupplierLine(s)}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-amber-50 text-sm text-start border-b border-amber-100 last:border-0">
                    <div>
                      <span className="font-medium text-slate-700">{s.product_name}</span>
                      <span className="ms-2 text-xs text-amber-700 font-medium">{s.supplier_name}</span>
                    </div>
                    <div className="text-end shrink-0 ms-4">
                      <div className="text-xs font-semibold text-slate-600">{s.total_available} bag</div>
                      <div className="text-xs font-medium text-[#1B3A5C]">{formatCurrency(s.latest_sell_price)}</div>
                    </div>
                  </button>
                ))}
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
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {item.batch_number && (
                          <span className="text-xs font-mono bg-blue-100 text-blue-700 px-1 rounded">#{item.batch_number}</span>
                        )}
                        <span className="text-xs text-amber-600 truncate">{item.supplier_name}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                          item.unit === 'chick' ? 'bg-yellow-100 text-yellow-700' :
                          item.unit === 'bag' ? 'bg-amber-100 text-amber-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {item.unit === 'chick' ? '🐥' : item.unit === 'bag' ? '🌾' : '💊'} {item.unit}
                        </span>
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
                  <div className="col-span-2">
                    <input type="number" min="0" step="0.01" value={item.purchase_price}
                      onChange={e => updateItem(idx, 'purchase_price', e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
                  </div>
                  <div className="col-span-2">
                    <input type="number" min="0" step="0.01" value={item.sell_price}
                      onChange={e => updateItem(idx, 'sell_price', e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
                  </div>
                  <div className="col-span-1 text-xs font-semibold text-green-600">
                    {formatCurrency(((parseFloat(item.sell_price) || 0) - (parseFloat(item.purchase_price) || 0)) * (parseFloat(item.quantity) || 0))}
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
                <div className="text-slate-600">{t('common.total')}: <span className="font-bold text-[#1B3A5C]">{formatCurrency(totalAmount)}</span></div>
                <div className="text-green-600 text-xs">{t('common.profit')}: {formatCurrency(totalProfit)}</div>
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
