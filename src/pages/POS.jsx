import { useState, useCallback } from 'react'
import { Search, Trash2, Camera, UserPlus, ShoppingCart } from 'lucide-react'
import { useInventory } from '../hooks/useInventory'
import { useFarms } from '../hooks/useFarms'
import { useDispatches } from '../hooks/useDispatches'
import { useWalkInSales } from '../hooks/useWalkInSales'
import { useMeelBills } from '../hooks/useMeelBills'
import { useBarcodeListener } from '../components/common/BarcodeScanner'
import BarcodeScannerModal from '../components/common/BarcodeScanner'
import Receipt from '../components/common/Receipt'
import Modal from '../components/common/Modal'
import PhoneInput from '../components/common/PhoneInput'
import { formatCurrency } from '../utils/formatCurrency'
import { todayStr } from '../utils/dateHelpers'
import { useLanguage } from '../contexts/LanguageContext'
import { useExchangeRate } from '../contexts/SettingsContext'
import { useStoreCash } from '../contexts/StoreCashContext'
import { lf } from '../utils/localizedField'
import { supabase } from '../config/supabase'
import toast from 'react-hot-toast'

export default function POS() {
  const { t, lang } = useLanguage()
  const { rate } = useExchangeRate()
  const { products } = useInventory()
  const { farms } = useFarms()
  const { createDispatch } = useDispatches()
  const { customers, createWalkInSale, addCustomer } = useWalkInSales()
  const { meelBills } = useMeelBills()
  const { recordIn } = useStoreCash()

  const [customerType, setCustomerType] = useState('farm')
  const [farmId, setFarmId] = useState('')
  const [walkInCustomerId, setWalkInCustomerId] = useState('')
  const [walkInName, setWalkInName] = useState('')

  const [cart, setCart] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [meelSearch, setMeelSearch] = useState('')
  const [cameraOpen, setCameraOpen] = useState(false)

  const [saleDate, setSaleDate] = useState(todayStr())
  const [amountPaid, setAmountPaid] = useState('')
  const [paymentType, setPaymentType] = useState('cash')
  const [notes, setNotes] = useState('')
  const [toStoreCash, setToStoreCash] = useState(true)

  const [saving, setSaving] = useState(false)
  const [receipt, setReceipt] = useState(null)
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [newCustomerModal, setNewCustomerModal] = useState(false)
  const [newCustomerForm, setNewCustomerForm] = useState({ name: '', phone: '' })

  const totalAmount = cart.reduce((s, i) => s + (parseFloat(i.sell_price) || 0) * (parseFloat(i.quantity) || 0), 0)
  const totalProfit = cart.reduce((s, i) => s + ((parseFloat(i.sell_price) || 0) - (parseFloat(i.purchase_price) || 0)) * (parseFloat(i.quantity) || 0), 0)
  const paid = parseFloat(amountPaid) || 0
  const remaining = Math.max(0, totalAmount - paid)

  function addToCart(product) {
    setCart(prev => {
      const existing = prev.find(i => i.product_id === product.id)
      if (existing) {
        return prev.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, {
        product_id: product.id,
        name: product.name,
        unit: product.unit,
        sell_price: product.sell_price,
        purchase_price: product.purchase_price,
        batch_number: product.batch_number || '',
        quantity: 1,
        available: product.quantity,
      }]
    })
    setSearchTerm('')
  }

  function updateCart(idx, field, value) {
    setCart(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  function removeFromCart(idx) {
    setCart(prev => prev.filter((_, i) => i !== idx))
  }

  const handleScan = useCallback((barcode) => {
    const product = products.find(p => p.barcode === barcode)
    if (product) {
      addToCart(product)
      toast.success(`${t('pos.productAdded')}: ${product.name}`)
    } else {
      toast.error(t('pos.productNotFound') + ': ' + barcode)
    }
  }, [products, cart, t])

  useBarcodeListener(handleScan)

  const filteredProducts = searchTerm.length > 0
    ? products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.barcode || '').includes(searchTerm) ||
        (p.batch_number || '').includes(searchTerm)
      ).slice(0, 8)
    : []

  const filteredMeel = meelSearch.length > 0 && customerType === 'farm'
    ? meelBills.filter(m =>
        (m.product_name || '').toLowerCase().includes(meelSearch.toLowerCase()) ||
        (m.bill_number || '').toLowerCase().includes(meelSearch.toLowerCase()) ||
        (m.supplier_name || '').toLowerCase().includes(meelSearch.toLowerCase())
      ).slice(0, 6)
    : []

  function addMeel(m) {
    if (cart.find(i => i.meel_bill_id === m.id)) {
      toast(t('inventory.productFound') + ': ' + m.product_name)
      return
    }
    setCart(prev => [...prev, {
      product_id: m.product_id,
      name: m.product_name,
      unit: 'bag',
      sell_price: m.sell_price || m.price_per_bag,
      purchase_price: m.price_per_bag,
      batch_number: m.bill_number,
      quantity: 1,
      available: m.available,
      meel_bill_id: m.id,
      supplier_name: m.supplier_name,
      is_meel: true,
    }])
    setMeelSearch('')
  }

  function validateSale() {
    if (cart.length === 0) { toast.error(t('pos.cartEmpty')); return false }
    if (customerType === 'farm' && !farmId) { toast.error(t('pos.selectFarmFirst')); return false }
    for (const item of cart) {
      if (parseFloat(item.quantity) <= 0) { toast.error(`${t('pos.invalidQty')}: ${item.name}`); return false }
      if (parseFloat(item.quantity) > item.available) {
        toast.error(`${t('pos.notEnoughStock')}: ${item.name} (${item.available})`)
        return false
      }
    }
    return true
  }

  async function handleSale() {
    if (!validateSale()) return
    setSaving(true)
    try {
      if (customerType === 'farm') {
        const result = await createDispatch(
          { farm_id: farmId, dispatch_date: saleDate, total_amount: totalAmount, notes },
          cart.map(i => ({
            product_id: i.product_id,
            batch_number: i.batch_number,
            quantity: parseFloat(i.quantity),
            purchase_price: parseFloat(i.purchase_price),
            sell_price: parseFloat(i.sell_price),
            supplier_dispatch_id: i.meel_bill_id || null,
          }))
        )
        if (result) {
          if (paid > 0) {
            const payAmt = Math.min(paid, totalAmount)
            await supabase.from('payments').insert([{
              farm_id: farmId,
              amount: payAmt,
              payment_date: saleDate,
              notes: t('dispatches.paidAtDispatch'),
            }])
            const { data: farmRow } = await supabase.from('farms').select('total_debt').eq('id', farmId).single()
            if (farmRow) {
              await supabase.from('farms').update({
                total_debt: Math.max(0, (farmRow.total_debt || 0) - payAmt),
              }).eq('id', farmId)
            }
            if (toStoreCash) {
              const farm = farms.find(f => f.id === farmId)
              await recordIn({
                amount: payAmt,
                source: 'payment',
                note: `POS · ${lf(farm, 'name', lang) || 'Farm'}`,
                date: saleDate,
              })
            }
          }
          const farm = farms.find(f => f.id === farmId)
          setReceipt({
            invoice_number: result,
            farm_name: lf(farm, 'name', lang) || '',
            customer_name: null,
            sale_date: saleDate,
            items: cart.map(i => ({ name: i.name, quantity: parseFloat(i.quantity), price: parseFloat(i.sell_price) })),
            total_amount: totalAmount,
            amount_paid: paid,
            remaining: totalAmount - paid,
          })
          setReceiptOpen(true)
          resetForm()
        }
      } else {
        const customerName = walkInCustomerId
          ? customers.find(c => c.id === walkInCustomerId)?.name
          : (walkInName || t('customers.walkInDefault'))

        const sale = await createWalkInSale(
          {
            customer_id: walkInCustomerId || null,
            customer_name: customerName,
            sale_date: saleDate,
            total_amount: totalAmount,
            amount_paid: paid,
            payment_type: paymentType,
            notes,
          },
          cart.map(i => ({
            product_id: i.product_id,
            name: i.name,
            quantity: parseFloat(i.quantity),
            sell_price: parseFloat(i.sell_price),
            purchase_price: parseFloat(i.purchase_price),
          }))
        )
        if (sale) {
          if (toStoreCash && paid > 0) {
            await recordIn({
              amount: paid,
              source: 'walk_in_sale',
              reference_id: sale.id || null,
              note: `POS · ${customerName}`,
              date: saleDate,
            })
          }
          setReceipt({
            invoice_number: sale.invoice_number,
            farm_name: null,
            customer_name: customerName,
            sale_date: saleDate,
            items: cart.map(i => ({ name: i.name, quantity: parseFloat(i.quantity), price: parseFloat(i.sell_price) })),
            total_amount: totalAmount,
            amount_paid: paid,
            remaining: totalAmount - paid,
          })
          setReceiptOpen(true)
          resetForm()
        }
      }
    } finally {
      setSaving(false)
    }
  }

  function resetForm() {
    setCart([])
    setFarmId('')
    setWalkInCustomerId('')
    setWalkInName('')
    setAmountPaid('')
    setNotes('')
    setSaleDate(todayStr())
    setMeelSearch('')
  }

  async function handleAddCustomer(e) {
    e.preventDefault()
    const customer = await addCustomer(newCustomerForm)
    if (customer) {
      setWalkInCustomerId(customer.id)
      setNewCustomerModal(false)
      setNewCustomerForm({ name: '', phone: '' })
    }
  }

  const selectedFarm = farms.find(f => f.id === farmId)

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">
      {/* LEFT — Cart */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Customer type toggle */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit mb-4">
            <button
              onClick={() => { setCustomerType('farm'); setAmountPaid('') }}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${customerType === 'farm' ? 'bg-[#1B3A5C] text-white shadow' : 'text-slate-600 hover:text-slate-800'}`}
            >
              🏠 {t('pos.farmSale')}
            </button>
            <button
              onClick={() => { setCustomerType('walkin'); setAmountPaid('') }}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${customerType === 'walkin' ? 'bg-[#2E86AB] text-white shadow' : 'text-slate-600 hover:text-slate-800'}`}
            >
              🚶 {t('pos.walkIn')}
            </button>
          </div>

          {customerType === 'farm' ? (
            <div className="flex gap-3">
              <select
                value={farmId}
                onChange={e => setFarmId(e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
              >
                <option value="">{t('pos.selectFarm')}</option>
                {farms.filter(f => f.is_active).map(f => (
                  <option key={f.id} value={f.id}>{lf(f, 'name', lang)} — {lf(f, 'owner_name', lang)}</option>
                ))}
              </select>
              {selectedFarm && (
                <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-sm whitespace-nowrap">
                  {t('pos.debtLabel')} <span className="font-bold text-red-700">{formatCurrency(selectedFarm.total_debt)}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex gap-2">
              <select
                value={walkInCustomerId}
                onChange={e => setWalkInCustomerId(e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
              >
                <option value="">{t('pos.anonymous')}</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}{c.total_debt > 0 ? ` — ${t('common.debt')}: ${formatCurrency(c.total_debt)}` : ''}</option>
                ))}
              </select>
              {!walkInCustomerId && (
                <input
                  value={walkInName}
                  onChange={e => setWalkInName(e.target.value)}
                  placeholder={t('pos.customerNameOptional')}
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
                />
              )}
              <button
                onClick={() => setNewCustomerModal(true)}
                className="flex items-center gap-1 px-3 py-2 bg-slate-100 rounded-lg text-sm text-slate-700 hover:bg-slate-200 whitespace-nowrap"
              >
                <UserPlus size={14} /> {t('common.add')}
              </button>
            </div>
          )}
        </div>

        {/* Search / scan */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search size={15} className="absolute inset-s-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder={t('pos.searchProduct')}
                className="w-full ps-9 pe-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
                autoFocus
              />
              {filteredProducts.length > 0 && (
                <div className="absolute top-full inset-s-0 inset-e-0 z-10 bg-white border border-slate-200 rounded-xl shadow-lg mt-1 overflow-hidden">
                  {filteredProducts.map(p => (
                    <button
                      key={p.id}
                      onClick={() => addToCart(p)}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 text-sm text-start border-b border-slate-50 last:border-0"
                    >
                      <div>
                        <span className="font-medium text-slate-700">{p.name}</span>
                        {p.batch_number && <span className="text-xs text-slate-400 ms-2">{t('inventory.batchNo')}: {p.batch_number}</span>}
                        <span className={`text-xs ms-2 ${p.quantity <= 0 ? 'text-red-500' : 'text-slate-400'}`}>
                          {t('dispatches.available')}: {p.quantity} {p.unit}
                        </span>
                      </div>
                      <div className="text-end">
                        <div className="text-sm font-semibold text-[#1B3A5C]">{formatCurrency(p.sell_price)}</div>
                        {p.sell_price_usd > 0
                          ? <div className="text-xs text-slate-400">${p.sell_price_usd}</div>
                          : rate > 0 && <div className="text-xs text-slate-400">≈ ${(p.sell_price / rate).toFixed(2)}</div>
                        }
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => setCameraOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-200"
            >
              <Camera size={16} />
            </button>
          </div>

          {customerType === 'farm' && (
            <div className="relative">
              <input
                value={meelSearch}
                onChange={e => setMeelSearch(e.target.value)}
                placeholder={t('dispatches.searchMeel')}
                className="w-full px-4 py-2.5 text-sm border border-amber-200 bg-amber-50/40 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 placeholder:text-amber-600/60"
              />
              {filteredMeel.length > 0 && (
                <div className="absolute top-full inset-s-0 inset-e-0 z-10 bg-white border border-amber-200 rounded-xl shadow-lg mt-1 overflow-hidden">
                  {filteredMeel.map(m => (
                    <button key={m.id} onClick={() => addMeel(m)}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-amber-50 text-sm text-start border-b border-amber-50 last:border-0">
                      <div>
                        <span className="font-medium text-slate-700">{m.product_name}</span>
                        {m.bill_number && (
                          <span className="ms-2 text-xs font-mono bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Bill #{m.bill_number}</span>
                        )}
                        <span className="ms-2 text-xs text-slate-400">{m.supplier_name}</span>
                      </div>
                      <div className="text-end">
                        <div className="text-xs font-medium text-amber-600">{formatCurrency(m.price_per_bag)}/bag</div>
                        <div className="text-xs text-slate-400">{t('dispatches.available')}: {m.available} bags</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-300">
              <ShoppingCart size={40} className="mb-2" />
              <p className="text-sm">{t('pos.emptyCart')}</p>
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wide px-1 mb-1">
                <div className="col-span-4">{t('dispatches.product')}</div>
                <div className="col-span-2 text-center">{t('dispatches.quantity')}</div>
                <div className="col-span-3 text-end">{t('pos.priceAFN')}</div>
                <div className="col-span-2 text-end">{t('common.total')}</div>
                <div className="col-span-1"></div>
              </div>
              <div className="space-y-1.5">
                {cart.map((item, idx) => (
                  <div key={item.meel_bill_id || item.product_id} className={`grid grid-cols-12 gap-2 items-center rounded-xl px-3 py-2 ${item.is_meel ? 'bg-amber-50 border border-amber-100' : 'bg-slate-50'}`}>
                    <div className="col-span-4">
                      <p className="text-sm font-medium text-slate-700 truncate">{item.name}</p>
                      {item.is_meel ? (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {item.batch_number && <span className="text-xs font-mono bg-blue-100 text-blue-700 px-1 rounded">#{item.batch_number}</span>}
                          <span className="text-xs text-amber-600 truncate">{item.supplier_name}</span>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">{t('dispatches.available')}: {item.available} {item.unit}</p>
                      )}
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number" min="0.01" step="0.01"
                        value={item.quantity}
                        onChange={e => updateCart(idx, 'quantity', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm text-center border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
                      />
                    </div>
                    <div className="col-span-3">
                      <input
                        type="number" min="0" step="0.01"
                        value={item.sell_price}
                        onChange={e => updateCart(idx, 'sell_price', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm text-end border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
                      />
                      {rate > 0 && item.sell_price > 0 && (
                        <div className="text-xs text-slate-400 text-end mt-0.5">
                          ≈ ${(parseFloat(item.sell_price) / rate).toFixed(2)}
                        </div>
                      )}
                    </div>
                    <div className="col-span-2 text-end">
                      <div className="text-sm font-semibold text-slate-800">
                        {((parseFloat(item.sell_price) || 0) * (parseFloat(item.quantity) || 0)).toLocaleString()}
                      </div>
                      {rate > 0 && item.sell_price > 0 && (
                        <div className="text-xs text-slate-400">
                          ≈ ${((parseFloat(item.sell_price) / rate) * (parseFloat(item.quantity) || 0)).toFixed(2)}
                        </div>
                      )}
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <button onClick={() => removeFromCart(idx)} className="p-1 text-red-400 hover:text-red-600">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center text-sm">
                <span className="text-slate-500">{cart.length} {t('dispatches.items').toLowerCase()}</span>
                <span className="text-xs text-green-600 font-medium">{t('common.profit')}: {formatCurrency(totalProfit)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT — Payment panel */}
      <div className="lg:w-72 flex flex-col gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 space-y-4">
          <h3 className="font-semibold text-slate-700">{t('pos.payment')}</h3>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.date')}</label>
            <input type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
          </div>

          {customerType === 'walkin' && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('pos.paymentType')}</label>
              <div className="flex gap-2">
                {[
                  { key: 'cash', label: `💵 ${t('pos.cash')}` },
                  { key: 'credit', label: `📋 ${t('customers.credit')}` },
                ].map(pt => (
                  <button
                    key={pt.key}
                    onClick={() => {
                      setPaymentType(pt.key)
                      if (pt.key === 'cash') setAmountPaid(String(totalAmount))
                    }}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${paymentType === pt.key ? 'bg-[#1B3A5C] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    {pt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('pos.amountPaid')}</label>
            <input
              type="number" min="0" step="0.01"
              value={amountPaid}
              onChange={e => setAmountPaid(e.target.value)}
              placeholder={customerType === 'farm' ? t('pos.farmPaysLater') : t('pos.enterAmount')}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
            />
            <button onClick={() => setAmountPaid(String(totalAmount))} className="text-xs text-[#2E86AB] hover:underline mt-1">
              {t('pos.setFullAmount')}
            </button>
          </div>

          {(parseFloat(amountPaid) || 0) > 0 && (
            <label className="flex items-center gap-2 text-sm text-slate-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 cursor-pointer">
              <input type="checkbox" checked={toStoreCash} onChange={e => setToStoreCash(e.target.checked)} className="rounded text-green-600" />
              <span>{t('storeCash.toStoreCash')}</span>
            </label>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.notes')}</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('common.optional')}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
          </div>

          <div className="bg-[#1B3A5C] rounded-xl p-4 text-white space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-white/70">{t('pos.grandTotal')}</span>
              <div className="text-end">
                <div className="font-bold text-lg">{formatCurrency(totalAmount)}</div>
                {rate > 0 && totalAmount > 0 && (
                  <div className="text-xs text-white/50">≈ ${(totalAmount / rate).toFixed(2)}</div>
                )}
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/70">{t('pos.paid')}</span>
              <div className="text-end">
                <div className="text-green-400 font-semibold">{formatCurrency(paid)}</div>
                {rate > 0 && paid > 0 && (
                  <div className="text-xs text-green-400/60">≈ ${(paid / rate).toFixed(2)}</div>
                )}
              </div>
            </div>
            <div className="flex justify-between text-sm border-t border-white/20 pt-2">
              <span className="text-white/70">{t('pos.remaining')}</span>
              <div className="text-end">
                <div className={`font-bold ${remaining > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {formatCurrency(remaining)}
                </div>
                {rate > 0 && remaining > 0 && (
                  <div className="text-xs text-red-400/60">≈ ${(remaining / rate).toFixed(2)}</div>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={handleSale}
            disabled={saving || cart.length === 0}
            className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? t('pos.processing') : `✓ ${t('pos.completeSale')}`}
          </button>

          {cart.length > 0 && (
            <button
              onClick={resetForm}
              className="w-full py-2 bg-slate-100 text-slate-600 rounded-xl text-sm hover:bg-slate-200 transition-colors"
            >
              {t('pos.clearCart')}
            </button>
          )}
        </div>
      </div>

      <Receipt open={receiptOpen} onClose={() => setReceiptOpen(false)} receipt={receipt} />

      <Modal open={newCustomerModal} onClose={() => setNewCustomerModal(false)} title={t('pos.newCustomer')}>
        <form onSubmit={handleAddCustomer} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.name')} *</label>
            <input required value={newCustomerForm.name}
              onChange={e => setNewCustomerForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.phone')}</label>
            <PhoneInput value={newCustomerForm.phone} onChange={v => setNewCustomerForm(f => ({ ...f, phone: v }))} />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setNewCustomerModal(false)} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">{t('common.cancel')}</button>
            <button type="submit" className="px-5 py-2 text-sm font-medium bg-[#1B3A5C] text-white rounded-lg hover:bg-[#2E86AB]">{t('pos.addCustomer')}</button>
          </div>
        </form>
      </Modal>

      {cameraOpen && (
        <BarcodeScannerModal
          onScan={barcode => { setCameraOpen(false); handleScan(barcode) }}
          onClose={() => setCameraOpen(false)}
        />
      )}
    </div>
  )
}
