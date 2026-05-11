import { useState, useCallback, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Upload, Edit2, Trash2, Camera, ExternalLink } from 'lucide-react'
import { useInventory, useMeelStock } from '../hooks/useInventory'
import { useExchangeRate } from '../contexts/SettingsContext'
import { useBarcodeListener } from '../components/common/BarcodeScanner'
import BarcodeScannerModal from '../components/common/BarcodeScanner'
import Modal from '../components/common/Modal'
import ConfirmDialog from '../components/common/ConfirmDialog'
import DataTable from '../components/common/DataTable'
import { formatCurrency } from '../utils/formatCurrency'
import { formatDate, isExpired, isExpiringSoon, todayStr } from '../utils/dateHelpers'
import { readExcelFile } from '../utils/exportExcel'
import { useLanguage } from '../contexts/LanguageContext'
import { lf } from '../utils/localizedField'
import { supabase } from '../config/supabase'
import toast from 'react-hot-toast'

const UNITS = {
  medicine: ['bottle', 'box', 'vial', 'piece', 'strip', 'pack'],
  meel: ['bag'],
}
const emptyForm = {
  name: '', type: 'medicine', barcode: '', batch_number: '', unit: 'bottle',
  purchase_price: '', purchase_price_usd: '', sell_price: '', sell_price_usd: '',
  quantity: '', expiry_date: '', low_stock_threshold: 10
}

export default function Inventory() {
  const { t, lang } = useLanguage()
  const { products, loading, addProduct, updateProduct, deleteProduct, getByBarcode, addStockPurchase } = useInventory()
  const { stock: meelStock, loading: meelLoading } = useMeelStock()
  const { rate, saveRate } = useExchangeRate()
  const [modalRate, setModalRate] = useState('')
  const [tab, setTab] = useState('medicine')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [stockModal, setStockModal] = useState(null)
  const [stockForm, setStockForm] = useState({
    quantity: '', purchase_price: '', purchase_price_usd: '', usd_to_afn_rate: '',
    batch_number: '', purchase_date: todayStr(), supplier: '', notes: ''
  })
  const [medicineSuppliers, setMedicineSuppliers] = useState([])
  const [selectedSupplierId, setSelectedSupplierId] = useState('')
  const [addProductSupplierId, setAddProductSupplierId] = useState('')

  useEffect(() => {
    supabase.from('suppliers').select('id, company_name').eq('type', 'medicine').order('company_name')
      .then(({ data }) => setMedicineSuppliers(data || []))
  }, [])

  const handleBarcodeScan = useCallback(async (barcode) => {
    if (!modalOpen) return
    const existing = await getByBarcode(barcode)
    if (existing) {
      setForm({ ...existing, expiry_date: existing.expiry_date || '', purchase_price_usd: existing.purchase_price_usd || '' })
      toast.success(t('inventory.productFound') + ': ' + existing.name)
    } else {
      setForm(f => ({ ...f, barcode }))
      toast(t('inventory.newBarcode'))
    }
  }, [modalOpen, getByBarcode, t])

  useBarcodeListener(handleBarcodeScan)

  function openAdd() {
    setEditItem(null)
    setForm({ ...emptyForm, type: tab })
    setAddProductSupplierId('')
    setModalRate(String(rate))
    setModalOpen(true)
  }

  function openEdit(item) {
    setEditItem(item)
    setForm({
      ...item,
      expiry_date: item.expiry_date || '',
      purchase_price_usd: item.purchase_price_usd || '',
      sell_price_usd: item.sell_price_usd || '',
      batch_number: item.batch_number || '',
    })
    setAddProductSupplierId('')
    setModalRate(String(rate))
    setModalOpen(true)
  }

  async function handleCameraScan(barcode) {
    setCameraOpen(false)
    const existing = await getByBarcode(barcode)
    if (existing) {
      setForm({ ...existing, expiry_date: existing.expiry_date || '', purchase_price_usd: existing.purchase_price_usd || '' })
      setModalOpen(true)
      toast.success(t('inventory.productFound') + ': ' + existing.name)
    } else {
      setForm(f => ({ ...f, barcode, type: tab }))
      setModalOpen(true)
      toast(t('inventory.newBarcode'))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const afnPrice = parseFloat(form.purchase_price) || 0
    const usdPrice = parseFloat(form.purchase_price_usd) || 0
    const sellAfn = parseFloat(form.sell_price) || 0
    const sellUsd = parseFloat(form.sell_price_usd) || 0
    if (form.type !== 'meel' && afnPrice <= 0 && usdPrice <= 0) {
      toast.error('Enter a purchase price in AFN or USD')
      return
    }
    if (form.type !== 'meel' && sellAfn <= 0 && sellUsd <= 0) {
      toast.error('Enter a sell price in AFN or USD')
      return
    }
    setSaving(true)
    const newRate = parseFloat(modalRate)
    if (newRate && newRate > 0 && newRate !== rate) await saveRate(newRate)
    const purchasePrice = afnPrice
    const qty = parseFloat(form.quantity) || 0
    const payload = {
      ...form,
      purchase_price: purchasePrice,
      purchase_price_usd: parseFloat(form.purchase_price_usd) || 0,
      sell_price: parseFloat(form.sell_price) || 0,
      sell_price_usd: parseFloat(form.sell_price_usd) || 0,
      quantity: qty,
      low_stock_threshold: parseFloat(form.low_stock_threshold) || 10,
      expiry_date: form.expiry_date || null,
      batch_number: form.batch_number || null,
      barcode: form.barcode?.trim() || null,
    }
    if (editItem) {
      await updateProduct(editItem.id, payload)
    } else {
      const created = await addProduct(payload)
      if (created && addProductSupplierId && form.type === 'medicine' && qty > 0) {
        await supabase.from('stock_purchases').insert([{
          product_id: created.id,
          batch_number: payload.batch_number,
          quantity: qty,
          purchase_price: purchasePrice,
          purchase_price_usd: parseFloat(form.purchase_price_usd) || 0,
          usd_to_afn_rate: 0,
          total_cost: qty * purchasePrice,
          purchase_date: todayStr(),
          supplier_id: addProductSupplierId,
          notes: null,
        }])
      }
    }
    setSaving(false)
    setAddProductSupplierId('')
    setModalOpen(false)
  }

  async function handleImportExcel(e) {
    const file = e.target.files[0]
    if (!file) return
    try {
      const rows = await readExcelFile(file)
      let count = 0
      for (const row of rows) {
        await addProduct({
          name: row.name || row.Name || row['Medicine Name'] || '',
          type: row.type || row.Type || 'medicine',
          barcode: row.barcode || row.Barcode || null,
          batch_number: row.batch_number || row['Batch No'] || row['Batch Number'] || null,
          unit: row.unit || row.Unit || 'bottle',
          purchase_price: parseFloat(row.purchase_price || row['My price'] || row['My Price'] || 0),
          purchase_price_usd: parseFloat(row.purchase_price_usd || row['USD Price'] || 0),
          sell_price: parseFloat(row.sell_price || row['Sale Price'] || row['Sell Price'] || 0),
          quantity: parseFloat(row.quantity || row.Quantity || 0),
          expiry_date: row.expiry_date || row['Expiry Date'] || null,
          low_stock_threshold: parseFloat(row.low_stock_threshold || 10),
        })
        count++
      }
      toast.success(t('inventory.importSuccess') + ` (${count})`)
    } catch {
      toast.error(t('inventory.importFailed'))
    }
    e.target.value = ''
  }

  const filtered = products.filter(p => p.type === tab && (
    !search ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.barcode || '').includes(search) ||
    (p.batch_number || '').includes(search)
  ))

  function getStatus(p) {
    if (isExpired(p.expiry_date)) return { label: t('inventory.expired'), cls: 'bg-red-100 text-red-700' }
    if ((p.quantity || 0) <= (p.low_stock_threshold || 10)) return { label: t('inventory.lowStock'), cls: 'bg-orange-100 text-orange-700' }
    return { label: t('inventory.inStock'), cls: 'bg-green-100 text-green-700' }
  }

  const columns = tab === 'meel' ? [
    { key: 'name', label: t('common.name'), render: r => <span className="font-medium">{lf(r, 'name', lang)}</span> },
    { key: 'purchase_price', label: t('suppliers.pricePerBag'), render: r => formatCurrency(r.purchase_price) },
    { key: 'sell_price', label: t('inventory.sellPrice'), render: r => formatCurrency(r.sell_price) },
    { key: 'quantity', label: t('suppliers.bags'), render: r => (
      <span className={r.quantity <= r.low_stock_threshold ? 'text-orange-600 font-semibold' : 'text-blue-700 font-semibold'}>
        {r.quantity} {t('suppliers.bags').toLowerCase()}
      </span>
    )},
    {
      key: 'status', label: t('inventory.status'),
      render: r => { const s = getStatus(r); return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span> }
    },
    {
      key: 'actions', label: '',
      render: r => (
        <div className="flex gap-1">
          <button onClick={() => openEdit(r)} className="p-1.5 text-slate-600 hover:bg-slate-100 rounded">
            <Edit2 size={15} />
          </button>
          <button onClick={() => setDeleteTarget(r)} className="p-1.5 text-red-600 hover:bg-red-50 rounded">
            <Trash2 size={15} />
          </button>
        </div>
      )
    },
  ] : [
    { key: 'name', label: t('common.name'), render: r => <span className="font-medium">{lf(r, 'name', lang)}</span> },
    { key: 'batch_number', label: t('inventory.batchNo'), render: r => r.batch_number || '—' },
    { key: 'barcode', label: t('inventory.barcode'), render: r => r.barcode || '—' },
    { key: 'unit', label: t('inventory.unit') },
    {
      key: 'cost', label: t('inventory.cost'),
      render: r => (
        <div className="leading-tight">
          {r.purchase_price_usd > 0
            ? <div className="font-semibold text-slate-800">${r.purchase_price_usd}</div>
            : <div className="font-semibold text-slate-800">{formatCurrency(r.purchase_price)}</div>
          }
          {r.purchase_price_usd > 0 && (
            <div className="text-xs text-slate-400">{formatCurrency(r.purchase_price)}</div>
          )}
        </div>
      )
    },
    {
      key: 'sell', label: t('inventory.sellPrice'),
      render: r => (
        <div className="leading-tight">
          <div className="font-semibold text-green-700">{formatCurrency(r.sell_price)}</div>
          {r.sell_price_usd > 0
            ? <div className="text-xs text-slate-400">${r.sell_price_usd}</div>
            : rate > 0 && <div className="text-xs text-slate-400">≈ ${(r.sell_price / rate).toFixed(2)}</div>
          }
        </div>
      )
    },
    {
      key: 'today_price',
      label: <span>{t('inventory.todayPrice')}<span className="block text-[10px] font-normal text-amber-500">@ {rate} AFN/$</span></span>,
      render: r => r.purchase_price_usd > 0
        ? <span className="font-semibold text-amber-600">{formatCurrency(r.purchase_price_usd * rate)}</span>
        : <span className="text-slate-300">—</span>
    },
    { key: 'quantity', label: t('dispatches.quantity'), render: r => (
      <span className={r.quantity <= r.low_stock_threshold ? 'text-orange-600 font-semibold' : ''}>
        {r.quantity} {r.unit}
      </span>
    )},
    {
      key: 'expiry_date', label: t('inventory.expiryDate'),
      render: r => (
        <span className={isExpired(r.expiry_date) ? 'text-red-600 font-medium' : isExpiringSoon(r.expiry_date) ? 'text-orange-600' : ''}>
          {formatDate(r.expiry_date)}
        </span>
      )
    },
    {
      key: 'status', label: t('inventory.status'),
      render: r => { const s = getStatus(r); return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span> }
    },
    {
      key: 'actions', label: '',
      render: r => (
        <div className="flex gap-1">
          <button
            onClick={() => {
              setStockModal(r)
              setSelectedSupplierId('')
              setStockForm({ quantity: '', purchase_price: r.purchase_price, purchase_price_usd: '', usd_to_afn_rate: '', batch_number: r.batch_number || '', purchase_date: todayStr(), supplier: '', notes: '' })
            }}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded text-xs font-medium"
          >
            +{t('inventory.addStock')}
          </button>
          <button onClick={() => openEdit(r)} className="p-1.5 text-slate-600 hover:bg-slate-100 rounded">
            <Edit2 size={15} />
          </button>
          <button onClick={() => setDeleteTarget(r)} className="p-1.5 text-red-600 hover:bg-red-50 rounded">
            <Trash2 size={15} />
          </button>
        </div>
      )
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute inset-s-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('inventory.searchPlaceholder')}
            className="w-full ps-9 pe-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
          />
        </div>
        {tab === 'medicine' && (<>
          <button onClick={() => setCameraOpen(true)} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50">
            <Camera size={16} /> {t('inventory.scan')}
          </button>
          <label className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer">
            <Upload size={16} /> {t('inventory.importExcel')}
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportExcel} />
          </label>
        </>)}
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 bg-[#1B3A5C] text-white rounded-xl text-sm font-medium hover:bg-[#2E86AB] transition-colors">
          <Plus size={16} /> {t('inventory.addProduct')}
        </button>
      </div>

      <div className="flex gap-1 bg-white rounded-xl p-1 border border-slate-100 shadow-sm w-fit">
        <button
          onClick={() => setTab('medicine')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'medicine' ? 'bg-[#1B3A5C] text-white shadow' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          💊 {t('inventory.medicines')}
        </button>
        <button
          onClick={() => setTab('meel')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'meel' ? 'bg-[#1B3A5C] text-white shadow' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          🌾 {t('inventory.meel')}
        </button>
      </div>

      {tab === 'meel' ? (
        meelLoading ? (
          <div className="text-center py-12 text-slate-400">{t('common.loading')}</div>
        ) : meelStock.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-12 text-center text-slate-400 text-sm">
            {t('suppliers.noDispatches')}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {meelStock.filter(s =>
              !search || s.company_name.toLowerCase().includes(search.toLowerCase())
            ).map(s => (
              <div key={s.supplier_id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-slate-800">{s.company_name}</div>
                    {s.owner_name && <div className="text-xs text-slate-500">{s.owner_name}</div>}
                    {s.phone && <div className="text-xs text-slate-400" dir="ltr">{s.phone}</div>}
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${s.remaining_bags <= 0 ? 'text-red-500' : 'text-blue-600'}`}>{s.remaining_bags}</div>
                    <div className="text-xs text-slate-400">{t('suppliers.bags').toLowerCase()} {t('common.remaining') || 'remaining'}</div>
                  </div>
                </div>
                <div className="border-t border-slate-50 pt-2 space-y-1">
                  {Object.entries(s.products).map(([name, p]) => (
                    <div key={name} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">{name}</span>
                      <div className="text-right">
                        <span className={`font-semibold ${p.remaining <= 0 ? 'text-red-500' : 'text-blue-700'}`}>{p.remaining} {t('suppliers.bags').toLowerCase()}</span>
                        <span className="text-xs text-slate-400 ms-1">/ {p.received} {t('common.received') || 'rcvd'}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  {s.last_dispatch && (
                    <div className="text-xs text-slate-400">{t('common.date')}: {formatDate(s.last_dispatch)}</div>
                  )}
                  <Link
                    to={`/suppliers/${s.supplier_id}`}
                    className="flex items-center gap-1 text-xs text-[#2E86AB] hover:underline ms-auto"
                  >
                    <ExternalLink size={11} /> {t('suppliers.viewProfile')}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
          <DataTable columns={columns} data={filtered} loading={loading} emptyMessage={t('inventory.noProducts')} />
        </div>
      )}

      {/* Add/Edit Product Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('inventory.editProduct') : t('inventory.addProduct')} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('inventory.productName')} *</label>
              <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                dir="ltr"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
            </div>

            {form.type !== 'meel' && (<>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('inventory.type')}</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value, unit: UNITS[e.target.value]?.[0] || 'bottle' }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30">
                  <option value="medicine">{t('inventory.medicines')}</option>
                  <option value="meel">{t('inventory.meel')}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('inventory.unit')}</label>
                <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30">
                  {(UNITS[form.type] || []).map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('inventory.barcode')}</label>
                <div className="flex gap-2">
                  <input value={form.barcode} onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))}
                    placeholder={t('inventory.barcode')}
                    dir="ltr"
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
                  <button type="button" onClick={() => setCameraOpen(true)} className="px-3 py-2 bg-slate-100 rounded-lg hover:bg-slate-200 text-slate-600">
                    <Camera size={16} />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('inventory.batchNumber')}</label>
                <input value={form.batch_number} onChange={e => setForm(f => ({ ...f, batch_number: e.target.value }))}
                  placeholder="e.g. 25087bo1"
                  dir="ltr"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
              </div>

              {form.type === 'medicine' && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{t('inventory.expiryDate')}</label>
                  <input type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
                </div>
              )}
            </>)}

            <div className="col-span-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('inventory.pricing')}</p>
                {form.type !== 'meel' && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-500">1 USD =</span>
                    <input
                      type="number" min="1" step="0.01"
                      value={modalRate}
                      onChange={e => {
                        const r = e.target.value
                        setModalRate(r)
                        const rVal = parseFloat(r)
                        if (!rVal) return
                        setForm(f => ({
                          ...f,
                          purchase_price: f.purchase_price_usd ? (parseFloat(f.purchase_price_usd) * rVal).toFixed(0) : f.purchase_price,
                          sell_price: f.sell_price_usd ? (parseFloat(f.sell_price_usd) * rVal).toFixed(0) : f.sell_price,
                        }))
                      }}
                      className="w-20 px-2 py-1 border border-amber-300 rounded-lg text-xs text-center font-semibold text-amber-700 bg-amber-50 focus:outline-none focus:ring-1 focus:ring-amber-400"
                    />
                    <span className="text-xs text-slate-500">AFN</span>
                    <span className="text-xs text-amber-600 font-medium">(will save)</span>
                  </div>
                )}
              </div>

              {form.type === 'meel' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{t('suppliers.pricePerBag')} *</label>
                    <input required type="number" min="0" step="0.01" value={form.purchase_price}
                      onChange={e => setForm(f => ({ ...f, purchase_price: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{t('inventory.sellPriceAFN')} *</label>
                    <input required type="number" min="0" step="0.01" value={form.sell_price}
                      onChange={e => setForm(f => ({ ...f, sell_price: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Buy price row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        {t('inventory.purchasePriceUSD')}
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 inset-s-3 flex items-center text-slate-400 text-sm font-medium">$</span>
                        <input
                          type="number" min="0" step="0.01"
                          value={form.purchase_price_usd}
                          onChange={e => {
                            const usd = e.target.value
                            const r = parseFloat(modalRate) || rate
                            const afn = usd && r ? (parseFloat(usd) * r).toFixed(0) : form.purchase_price
                            setForm(f => ({ ...f, purchase_price_usd: usd, purchase_price: afn }))
                          }}
                          className="w-full ps-7 pe-3 py-2 border border-amber-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-amber-50"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        {t('inventory.costPriceAFN')}
                      </label>
                      <input type="number" min="0" step="0.01" value={form.purchase_price}
                        onChange={e => setForm(f => ({ ...f, purchase_price: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
                    </div>
                  </div>

                  {/* Sell price row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Sell Price (USD)</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 inset-s-3 flex items-center text-slate-400 text-sm font-medium">$</span>
                        <input
                          type="number" min="0" step="0.01"
                          value={form.sell_price_usd}
                          onChange={e => {
                            const usd = e.target.value
                            const r = parseFloat(modalRate) || rate
                            const afn = usd && r ? (parseFloat(usd) * r).toFixed(0) : form.sell_price
                            setForm(f => ({ ...f, sell_price_usd: usd, sell_price: afn }))
                          }}
                          className="w-full ps-7 pe-3 py-2 border border-green-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-300 bg-green-50"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        {t('inventory.sellPriceAFN')}
                      </label>
                      <input type="number" min="0" step="0.01" value={form.sell_price}
                        onChange={e => setForm(f => ({ ...f, sell_price: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {form.type === 'meel' ? t('suppliers.bags') : t('inventory.currentQty')}
              </label>
              <input type="number" min="0" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('inventory.lowStockAt')}</label>
              <input type="number" min="0" value={form.low_stock_threshold} onChange={e => setForm(f => ({ ...f, low_stock_threshold: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
            </div>

            {form.type === 'medicine' && parseFloat(form.purchase_price_usd) > 0 && parseFloat(form.quantity) > 0 && (
              <div className="col-span-2">
                <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
                  <span className="text-xs font-medium text-amber-700">Total USD Cost</span>
                  <span className="text-base font-bold text-amber-700">
                    ${(parseFloat(form.purchase_price_usd) * parseFloat(form.quantity)).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {!editItem && form.type === 'medicine' && medicineSuppliers.length > 0 && (
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  💊 {t('suppliers.medicineSupplierOptional')}
                </label>
                <select
                  value={addProductSupplierId}
                  onChange={e => setAddProductSupplierId(e.target.value)}
                  className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-blue-50"
                >
                  <option value="">— {t('common.optional')} —</option>
                  {medicineSuppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.company_name}</option>
                  ))}
                </select>
                {addProductSupplierId && (
                  <p className="text-xs text-blue-600 mt-1">✓ Purchase will be linked to this supplier's account</p>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">{t('common.cancel')}</button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium bg-[#1B3A5C] text-white rounded-lg hover:bg-[#2E86AB] disabled:opacity-60">
              {saving ? t('common.saving') : editItem ? t('inventory.update') : t('inventory.addProduct')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Stock Purchase Modal */}
      <Modal open={!!stockModal} onClose={() => { setStockModal(null); setSelectedSupplierId('') }} title={`${t('inventory.addStock')} — ${stockModal?.name}`} size="lg">
        <form onSubmit={async (e) => {
          e.preventDefault()
          const usdPrice = parseFloat(stockForm.purchase_price_usd) || 0
          const rate = parseFloat(stockForm.usd_to_afn_rate) || 0
          const afnPrice = usdPrice > 0 && rate > 0
            ? usdPrice * rate
            : parseFloat(stockForm.purchase_price) || 0

          await addStockPurchase({
            product_id: stockModal.id,
            batch_number: stockForm.batch_number || null,
            quantity: parseFloat(stockForm.quantity),
            purchase_price: afnPrice,
            purchase_price_usd: usdPrice,
            usd_to_afn_rate: rate,
            total_cost: parseFloat(stockForm.quantity) * afnPrice,
            purchase_date: stockForm.purchase_date,
            supplier: stockForm.supplier,
            notes: stockForm.notes,
          }, selectedSupplierId || null)
          setStockModal(null)
          setSelectedSupplierId('')
        }} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('inventory.quantity')} *</label>
              <input required type="number" min="0.01" step="0.01" value={stockForm.quantity}
                onChange={e => setStockForm(f => ({ ...f, quantity: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('inventory.batchNumber')}</label>
              <input value={stockForm.batch_number} onChange={e => setStockForm(f => ({ ...f, batch_number: e.target.value }))}
                dir="ltr"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
            </div>

            <div className="col-span-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{t('inventory.purchasePrice')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{t('inventory.priceAFN')}</label>
                  <input type="number" min="0" step="0.01" value={stockForm.purchase_price}
                    onChange={e => setStockForm(f => ({ ...f, purchase_price: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{t('inventory.priceUSD')}</label>
                  <input type="number" min="0" step="0.01" value={stockForm.purchase_price_usd}
                    onChange={e => setStockForm(f => ({ ...f, purchase_price_usd: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{t('inventory.usdRate')}</label>
                  <input type="number" min="0" step="0.01" value={stockForm.usd_to_afn_rate}
                    onChange={e => setStockForm(f => ({ ...f, usd_to_afn_rate: e.target.value }))}
                    placeholder="e.g. 72"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
                </div>
              </div>
              {parseFloat(stockForm.purchase_price_usd) > 0 && parseFloat(stockForm.usd_to_afn_rate) > 0 && (
                <p className="text-xs text-green-700 mt-1 font-medium">
                  → {formatCurrency(parseFloat(stockForm.purchase_price_usd) * parseFloat(stockForm.usd_to_afn_rate))}
                  {stockForm.quantity && ` — ${t('common.total')}: ${formatCurrency(parseFloat(stockForm.quantity) * parseFloat(stockForm.purchase_price_usd) * parseFloat(stockForm.usd_to_afn_rate))}`}
                </p>
              )}
              {parseFloat(stockForm.purchase_price_usd) > 0 && parseFloat(stockForm.quantity) > 0 && (
                <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 mt-2">
                  <span className="text-xs font-medium text-amber-700">Total USD Cost</span>
                  <span className="text-sm font-bold text-amber-700">
                    ${(parseFloat(stockForm.purchase_price_usd) * parseFloat(stockForm.quantity)).toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('inventory.purchaseDate')}</label>
              <input type="date" value={stockForm.purchase_date} onChange={e => setStockForm(f => ({ ...f, purchase_date: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('inventory.supplierCompany')}</label>
              <input value={stockForm.supplier} onChange={e => setStockForm(f => ({ ...f, supplier: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
            </div>
            {stockModal?.type === 'medicine' && (
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('suppliers.medicineSupplierOptional')}</label>
                <select value={selectedSupplierId} onChange={e => setSelectedSupplierId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30">
                  <option value="">{t('common.optional')} — {t('suppliers.medicineSuppliers')}</option>
                  {medicineSuppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.company_name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.notes')}</label>
              <input value={stockForm.notes} onChange={e => setStockForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setStockModal(null)} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">{t('common.cancel')}</button>
            <button type="submit" className="px-5 py-2 text-sm font-medium bg-[#1B3A5C] text-white rounded-lg hover:bg-[#2E86AB]">{t('inventory.addStock')}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteProduct(deleteTarget?.id)}
        title={t('inventory.deleteTitle')}
        message={`${t('inventory.deleteMsg').replace('this product', `"${deleteTarget?.name}"`)}`}
      />

      {cameraOpen && <BarcodeScannerModal onScan={handleCameraScan} onClose={() => setCameraOpen(false)} />}
    </div>
  )
}
