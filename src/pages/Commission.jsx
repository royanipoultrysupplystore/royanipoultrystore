import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Truck, Users, Trash2, Edit2, ChevronRight, ChevronLeft, ChevronDown, ChevronUp, CheckCircle, RotateCcw, Receipt, Handshake, Calendar } from 'lucide-react'
import { useCommissionForDate, useCommissionCustomers, useCommissionDealers } from '../hooks/useCommission'
import { useCommissionRate } from '../contexts/SettingsContext'
import Modal from '../components/common/Modal'
import ConfirmDialog from '../components/common/ConfirmDialog'
import PhoneInput from '../components/common/PhoneInput'
import WhatsAppPromptDialog from '../components/common/WhatsAppPromptDialog'
import { formatCurrency } from '../utils/formatCurrency'
import { formatDate, todayStr } from '../utils/dateHelpers'
import { useLanguage } from '../contexts/LanguageContext'

const emptySale = {
  customer_id: '',
  sale_type: 'per_chicken',
  chicken_count: '',
  weight_kg: '',
  price_per_unit: '',
  notes: '',
}

const emptyCustomer = { name: '', phone: '', notes: '' }

export default function Commission() {
  const { t, isRTL } = useLanguage()
  const [tab, setTab] = useState('today')
  const [selectedDate, setSelectedDate] = useState(todayStr())

  const ChevronIcon = isRTL ? ChevronLeft : ChevronRight
  const isToday = selectedDate === todayStr()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Truck size={22} className="text-[#1B3A5C]" /> Commission
        </h2>
        {tab === 'today' && (
          <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 px-3 py-1.5">
            <Calendar size={14} className="text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value || todayStr())}
              max={todayStr()}
              className="text-sm border-none focus:outline-none bg-transparent"
            />
            {!isToday && (
              <button
                onClick={() => setSelectedDate(todayStr())}
                className="text-xs text-blue-600 hover:underline ms-1"
              >
                Today
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-1 bg-white rounded-xl p-1 border border-slate-100 shadow-sm w-fit flex-wrap">
        <button
          onClick={() => setTab('today')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'today' ? 'bg-[#1B3A5C] text-white shadow' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          🚛 {isToday ? "Today's Car" : `Cars · ${formatDate(selectedDate)}`}
        </button>
        <button
          onClick={() => setTab('customers')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'customers' ? 'bg-[#1B3A5C] text-white shadow' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          👥 Customers
        </button>
        <button
          onClick={() => setTab('dealers')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'dealers' ? 'bg-[#1B3A5C] text-white shadow' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          🤝 Dealers
        </button>
      </div>

      {tab === 'today' && <TodayCarSection date={selectedDate} />}
      {tab === 'customers' && <CustomersSection chevron={ChevronIcon} />}
      {tab === 'dealers' && <DealersSection chevron={ChevronIcon} />}
    </div>
  )
}

function TodayCarSection({ date }) {
  const {
    cars, salesByCarId, expensesByCarId, customers, dealers, loading,
    createCar, updateCar, deleteCar, addCustomer, addDealer, addSale, deleteSale,
    addExpense, deleteExpense, finishCar, reopenCar,
  } = useCommissionForDate(date)
  const { commissionRate } = useCommissionRate()

  const isViewingPast = date !== todayStr()
  const [carModal, setCarModal] = useState(false)
  const [carForm, setCarForm] = useState({ total_chickens: '500', notes: '', dealer_id: '', commission_rate: '' })
  const [editingCar, setEditingCar] = useState(null)
  const [quickDealerModal, setQuickDealerModal] = useState(false)
  const [quickDealerForm, setQuickDealerForm] = useState({ name: '', phone: '', notes: '' })
  const [saleModal, setSaleModal] = useState(false)
  const [saleCarId, setSaleCarId] = useState(null)
  const [saleForm, setSaleForm] = useState(emptySale)
  const [customerModal, setCustomerModal] = useState(false)
  const [customerForm, setCustomerForm] = useState(emptyCustomer)
  const [expenseModal, setExpenseModal] = useState(false)
  const [expenseCarId, setExpenseCarId] = useState(null)
  const [expenseForm, setExpenseForm] = useState({ description: '', amount: '' })
  const [finishCarTarget, setFinishCarTarget] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleteSaleTarget, setDeleteSaleTarget] = useState(null)
  const [deleteCarTarget, setDeleteCarTarget] = useState(null)
  const [deleteExpenseTarget, setDeleteExpenseTarget] = useState(null)
  const [waPrompt, setWaPrompt] = useState(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerDropOpen, setCustomerDropOpen] = useState(false)
  const customerDropRef = useRef(null)
  // Manual expand/collapse overrides per car. Default: active = expanded, closed = collapsed.
  const [expandOverrides, setExpandOverrides] = useState({})

  useEffect(() => {
    function handleClick(e) {
      if (customerDropRef.current && !customerDropRef.current.contains(e.target)) setCustomerDropOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])
  const isCarExpanded = (car) => car.id in expandOverrides ? expandOverrides[car.id] : !car.is_closed
  const toggleCarExpand = (car) => setExpandOverrides(prev => ({ ...prev, [car.id]: !isCarExpanded(car) }))

  function openAddCar() {
    setEditingCar(null)
    setCarForm({ total_chickens: '500', notes: '', dealer_id: '', commission_rate: String(commissionRate) })
    setCarModal(true)
  }

  function openEditCar(car) {
    setEditingCar(car)
    setCarForm({
      total_chickens: String(car.total_chickens),
      notes: car.notes || '',
      dealer_id: car.dealer_id || '',
      commission_rate: String(car.commission_rate_per_chicken ?? commissionRate),
    })
    setCarModal(true)
  }

  async function handleCarSubmit(e) {
    e.preventDefault()
    if (!carForm.dealer_id) { return }
    setSaving(true)
    if (editingCar) {
      await updateCar(editingCar.id, {
        totalChickens: carForm.total_chickens,
        notes: carForm.notes,
        dealerId: carForm.dealer_id,
        commissionRate: carForm.commission_rate,
      })
    } else {
      await createCar({
        totalChickens: carForm.total_chickens,
        notes: carForm.notes,
        dealerId: carForm.dealer_id,
        commissionRate: carForm.commission_rate || commissionRate,
      })
    }
    setSaving(false)
    setCarModal(false)
  }

  async function handleQuickDealer(e) {
    e.preventDefault()
    setSaving(true)
    const created = await addDealer(quickDealerForm)
    setSaving(false)
    if (created) {
      setCarForm(f => ({ ...f, dealer_id: created.id }))
      setQuickDealerForm({ name: '', phone: '', notes: '' })
      setQuickDealerModal(false)
    }
  }

  function openAddSale(carId) {
    setSaleCarId(carId)
    setSaleForm(emptySale)
    setCustomerSearch('')
    setCustomerDropOpen(false)
    setSaleModal(true)
  }

  async function handleSaleSubmit(e) {
    e.preventDefault()
    if (!saleForm.customer_id) { return }
    setSaving(true)
    const ok = await addSale(saleCarId, saleForm)
    setSaving(false)
    if (ok) {
      const customer = customers.find(c => c.id === saleForm.customer_id)
      const isPerKg = saleForm.sale_type === 'per_kg'
      const total = isPerKg
        ? (parseFloat(saleForm.weight_kg) || 0) * (parseFloat(saleForm.price_per_unit) || 0)
        : (parseInt(saleForm.chicken_count) || 0) * (parseFloat(saleForm.price_per_unit) || 0)
      setSaleModal(false)
      if (customer) {
        setWaPrompt({
          templateKey: 'commission_sale',
          variables: {
            name: customer.name,
            count: saleForm.chicken_count,
            weight: saleForm.weight_kg || 0,
            price: formatCurrency(saleForm.price_per_unit),
            unit: isPerKg ? 'kg' : 'chicken',
            amount: formatCurrency(total),
            date: todayStr(),
            balance: formatCurrency(total),
          },
          recipient: { name: customer.name, phone: customer.phone },
        })
      }
    }
  }

  async function handleNewCustomer(e) {
    e.preventDefault()
    setSaving(true)
    const created = await addCustomer(customerForm)
    setSaving(false)
    if (created) {
      setSaleForm(f => ({ ...f, customer_id: created.id }))
      setCustomerForm(emptyCustomer)
      setCustomerModal(false)
    }
  }

  function openAddExpense(carId) {
    setExpenseCarId(carId)
    setExpenseForm({ description: '', amount: '' })
    setExpenseModal(true)
  }

  async function handleExpenseSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const ok = await addExpense(expenseCarId, expenseForm)
    setSaving(false)
    if (ok) setExpenseModal(false)
  }

  const computedTotal = saleForm.sale_type === 'per_kg'
    ? (parseFloat(saleForm.weight_kg) || 0) * (parseFloat(saleForm.price_per_unit) || 0)
    : (parseInt(saleForm.chicken_count) || 0) * (parseFloat(saleForm.price_per_unit) || 0)

  if (loading) return <div className="text-center py-12 text-slate-400">Loading...</div>

  if (cars.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
        <Truck size={48} className="mx-auto text-slate-300 mb-4" />
        <h3 className="text-lg font-semibold text-slate-700 mb-2">
          {isViewingPast ? `No cars on ${formatDate(date)}` : 'No car set up for today'}
        </h3>
        {!isViewingPast && (
          <>
            <p className="text-sm text-slate-500 mb-6">Set up today's chicken delivery to start tracking sales.</p>
            <button
              onClick={openAddCar}
              className="px-6 py-2.5 bg-[#1B3A5C] text-white rounded-xl text-sm font-medium hover:bg-[#2E86AB] transition-colors"
            >
              + Set Up Today's Car
            </button>
          </>
        )}

        <CarFormModal
          open={carModal}
          onClose={() => setCarModal(false)}
          editingCar={editingCar}
          form={carForm}
          setForm={setCarForm}
          onSubmit={handleCarSubmit}
          saving={saving}
          dealers={dealers}
          onAddDealer={() => setQuickDealerModal(true)}
          commissionRate={commissionRate}
        />

        <QuickDealerModal
          open={quickDealerModal}
          onClose={() => setQuickDealerModal(false)}
          form={quickDealerForm}
          setForm={setQuickDealerForm}
          onSubmit={handleQuickDealer}
          saving={saving}
        />
      </div>
    )
  }

  // Day totals across all cars
  const allSales = Object.values(salesByCarId).flat()
  const allExpenses = Object.values(expensesByCarId).flat()
  const dayTotalSold = allSales.reduce((s, x) => s + (x.chicken_count || 0), 0)
  const dayTotalAmount = allSales.reduce((s, x) => s + (x.total_amount || 0), 0)
  const dayTotalWeight = allSales.reduce((s, x) => s + (x.weight_kg || 0), 0)
  const dayTotalExpenses = allExpenses.reduce((s, x) => s + (x.amount || 0), 0)
  const dayNetProfit = dayTotalAmount - dayTotalExpenses
  const dayTotalCapacity = cars.reduce((s, c) => s + (c.total_chickens || 0), 0)

  return (
    <div className="space-y-4">
      {/* Day summary */}
      <div className="bg-linear-to-r from-[#1B3A5C] to-[#2E86AB] rounded-2xl p-5 shadow-sm text-white">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-xs text-white/70 uppercase tracking-wide">Today's Total · {formatDate(cars[0]?.car_date)}</div>
            <div className="text-xs text-white/60 mt-0.5">{cars.length} car{cars.length > 1 ? 's' : ''} · {dayTotalCapacity} chickens capacity</div>
          </div>
          {!isViewingPast && (
            <button
              onClick={openAddCar}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={14} /> Add Another Car
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-4">
          <div>
            <div className="text-xs text-white/60">Earnings</div>
            <div className="text-lg font-bold">{formatCurrency(dayTotalAmount)}</div>
          </div>
          <div>
            <div className="text-xs text-white/60">Expenses</div>
            <div className="text-lg font-bold text-red-200">{formatCurrency(dayTotalExpenses)}</div>
          </div>
          <div>
            <div className="text-xs text-white/60">Net Profit</div>
            <div className={`text-lg font-bold ${dayNetProfit >= 0 ? 'text-green-300' : 'text-red-300'}`}>{formatCurrency(dayNetProfit)}</div>
          </div>
          <div>
            <div className="text-xs text-white/60">Chickens</div>
            <div className="text-lg font-bold">{dayTotalSold} <span className="text-sm text-white/50">/ {dayTotalCapacity}</span></div>
          </div>
          <div>
            <div className="text-xs text-white/60">Weight</div>
            <div className="text-lg font-bold">{dayTotalWeight.toFixed(1)} kg</div>
          </div>
        </div>
      </div>

      {/* Each car as its own block */}
      {cars.map((car, idx) => {
        const carSales = salesByCarId[car.id] || []
        const carExpenses = expensesByCarId[car.id] || []
        const totalSold = carSales.reduce((s, x) => s + (x.chicken_count || 0), 0)
        const totalAmount = carSales.reduce((s, x) => s + (x.total_amount || 0), 0)
        const totalWeight = carSales.reduce((s, x) => s + (x.weight_kg || 0), 0)
        const totalExpenses = carExpenses.reduce((s, x) => s + (x.amount || 0), 0)
        const netProfit = totalAmount - totalExpenses
        const carRate = car.commission_rate_per_chicken || 5
        const commissionFee = totalSold * carRate
        const dealerPayout = netProfit - commissionFee
        const remaining = Math.max(0, car.total_chickens - totalSold)
        const percentSold = car.total_chickens > 0 ? Math.min(100, (totalSold / car.total_chickens) * 100) : 0
        const isFull = totalSold >= car.total_chickens
        const isClosed = !!car.is_closed
        const dealerName = car.commission_dealers?.name || '— No dealer —'

        return (
          <div key={car.id} className={`rounded-2xl p-5 shadow-sm border ${isClosed ? 'bg-slate-50 border-slate-200' : isFull ? 'bg-red-50 border-red-200' : 'bg-white border-slate-100'}`}>
            <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Truck size={16} className="text-[#1B3A5C]" /> Car #{idx + 1}
                  {isClosed && <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-medium">✓ Closed</span>}
                  {!isClosed && isFull && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Sold Out</span>}
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-xs">
                  <Handshake size={12} className="text-slate-400" />
                  {car.dealer_id ? (
                    <Link to={`/commission/dealer/${car.dealer_id}`} className="font-medium text-blue-600 hover:underline">
                      {dealerName}
                    </Link>
                  ) : (
                    <span className="text-slate-400 italic">{dealerName}</span>
                  )}
                </div>
                {car.notes && <p className="text-xs text-slate-500 mt-1">{car.notes}</p>}
              </div>
              <div className="flex gap-1 flex-wrap">
                {!isClosed && (
                  <>
                    <button
                      onClick={() => openAddSale(car.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1B3A5C] text-white rounded-lg text-sm font-medium hover:bg-[#2E86AB] transition-colors"
                    >
                      <Plus size={14} /> Sale
                    </button>
                    <button
                      onClick={() => openAddExpense(car.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg text-sm font-medium hover:bg-orange-200 transition-colors"
                    >
                      <Receipt size={14} /> Expense
                    </button>
                    <button
                      onClick={() => setFinishCarTarget(car)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                    >
                      <CheckCircle size={14} /> Finish
                    </button>
                  </>
                )}
                {isClosed && (
                  <button
                    onClick={() => reopenCar(car.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-300"
                  >
                    <RotateCcw size={14} /> Reopen
                  </button>
                )}
                <button onClick={() => openEditCar(car)} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg">
                  <Edit2 size={14} />
                </button>
                <button onClick={() => setDeleteCarTarget(car)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg">
                  <Trash2 size={14} />
                </button>
                <button
                  onClick={() => toggleCarExpand(car)}
                  className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg"
                  title={isCarExpanded(car) ? 'Collapse details' : 'Show details'}
                >
                  {isCarExpanded(car) ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>
            </div>

            {/* Progress bar */}
            <div className="space-y-2">
              <div className="flex items-end justify-between text-sm">
                <div>
                  <div className="text-2xl font-bold text-slate-800">{totalSold}</div>
                  <div className="text-xs text-slate-500">sold of {car.total_chickens}</div>
                </div>
                <div className="text-end">
                  <div className={`text-xl font-bold ${remaining === 0 ? 'text-red-600' : 'text-blue-600'}`}>{remaining}</div>
                  <div className="text-xs text-slate-500">remaining</div>
                </div>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${isClosed ? 'bg-slate-400' : isFull ? 'bg-red-500' : percentSold > 75 ? 'bg-amber-500' : 'bg-green-500'}`}
                  style={{ width: `${percentSold}%` }}
                />
              </div>
            </div>

            {/* Per-car totals */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mt-4 pt-3 border-t border-slate-100 text-sm">
              <div>
                <div className="text-xs text-slate-500">Earnings</div>
                <div className="font-bold text-green-600">{formatCurrency(totalAmount)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Expenses</div>
                <div className="font-bold text-orange-600">{formatCurrency(totalExpenses)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Net Profit</div>
                <div className={`font-bold ${netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(netProfit)}</div>
              </div>
            </div>

            {/* Commission breakdown */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mt-3 text-sm">
              <div className="bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
                <div className="text-xs text-purple-600 font-medium">Commission Fee ({totalSold} × {carRate})</div>
                <div className="font-bold text-purple-700">{formatCurrency(commissionFee)}</div>
              </div>
              <div className={`rounded-lg px-3 py-2 border ${dealerPayout >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
                <div className="text-xs text-slate-500 font-medium">Dealer Payout</div>
                <div className={`font-bold ${dealerPayout >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{formatCurrency(dealerPayout)}</div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <div className="text-xs text-slate-500 font-medium">Weight · Sales</div>
                <div className="font-medium text-slate-700">{totalWeight.toFixed(1)} kg · {carSales.length}</div>
              </div>
            </div>

            {/* Collapsed-state hint when there are hidden details */}
            {!isCarExpanded(car) && (carExpenses.length > 0 || carSales.length > 0) && (
              <button
                onClick={() => toggleCarExpand(car)}
                className="mt-3 w-full text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg py-2 border border-dashed border-slate-200 flex items-center justify-center gap-1.5"
              >
                <ChevronDown size={12} />
                Show {carSales.length} sale{carSales.length !== 1 ? 's' : ''}
                {carExpenses.length > 0 && ` and ${carExpenses.length} expense${carExpenses.length !== 1 ? 's' : ''}`}
              </button>
            )}

            {/* Expenses list (only when expanded) */}
            {isCarExpanded(car) && carExpenses.length > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <div className="text-xs font-semibold text-orange-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Receipt size={12} /> Expenses
                </div>
                <div className="space-y-1.5">
                  {carExpenses.map(exp => (
                    <div key={exp.id} className="flex items-center justify-between bg-orange-50 rounded-lg px-3 py-1.5 text-sm">
                      <span className="text-slate-700">{exp.description}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-orange-700">{formatCurrency(exp.amount)}</span>
                        <button onClick={() => setDeleteExpenseTarget(exp)} className="p-1 text-red-400 hover:bg-red-50 rounded">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sales list for this car (only when expanded) */}
            {isCarExpanded(car) && carSales.length > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-slate-400 uppercase">
                        <th className="text-start py-2 font-medium">Customer</th>
                        <th className="text-start py-2 font-medium">Type</th>
                        <th className="text-start py-2 font-medium">Qty</th>
                        <th className="text-start py-2 font-medium">Weight</th>
                        <th className="text-start py-2 font-medium">Price</th>
                        <th className="text-start py-2 font-medium">Total</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {carSales.map(s => (
                        <tr key={s.id} className="hover:bg-slate-50">
                          <td className="py-2 font-medium text-slate-800">{s.commission_customers?.name || '—'}</td>
                          <td className="py-2">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.sale_type === 'per_kg' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                              {s.sale_type === 'per_kg' ? '⚖️' : '🐔'}
                            </span>
                          </td>
                          <td className="py-2 font-medium">{s.chicken_count}</td>
                          <td className="py-2">{s.weight_kg > 0 ? `${s.weight_kg} kg` : '—'}</td>
                          <td className="py-2">{formatCurrency(s.price_per_unit)}<span className="text-xs text-slate-400">/{s.sale_type === 'per_kg' ? 'kg' : 'pc'}</span></td>
                          <td className="py-2 font-bold text-green-600">{formatCurrency(s.total_amount)}</td>
                          <td className="py-2">
                            <button onClick={() => setDeleteSaleTarget(s)} className="p-1 text-red-400 hover:bg-red-50 rounded">
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Add/Edit car modal */}
      <CarFormModal
        open={carModal}
        onClose={() => setCarModal(false)}
        editingCar={editingCar}
        form={carForm}
        setForm={setCarForm}
        onSubmit={handleCarSubmit}
        saving={saving}
        dealers={dealers}
        onAddDealer={() => setQuickDealerModal(true)}
        commissionRate={commissionRate}
      />

      <QuickDealerModal
        open={quickDealerModal}
        onClose={() => setQuickDealerModal(false)}
        form={quickDealerForm}
        setForm={setQuickDealerForm}
        onSubmit={handleQuickDealer}
        saving={saving}
      />

      {/* Sale modal */}
      <Modal open={saleModal} onClose={() => setSaleModal(false)} title="Add Sale" size="lg">
        <form onSubmit={handleSaleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Customer *</label>
            <div className="flex gap-2">
              <div className="relative flex-1" ref={customerDropRef}>
                {(() => {
                  const selectedCustomer = customers.find(c => c.id === saleForm.customer_id)
                  const filteredCustomers = customers.filter(c =>
                    !customerSearch ||
                    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
                    (c.phone || '').includes(customerSearch)
                  )
                  return (
                    <>
                      <input
                        value={customerDropOpen
                          ? customerSearch
                          : (selectedCustomer ? `${selectedCustomer.name}${selectedCustomer.phone ? ` (${selectedCustomer.phone})` : ''}` : '')}
                        onChange={e => { setCustomerSearch(e.target.value); setCustomerDropOpen(true) }}
                        onFocus={() => { setCustomerSearch(''); setCustomerDropOpen(true) }}
                        placeholder="Search by name or phone..."
                        required={!saleForm.customer_id}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
                      />
                      {saleForm.customer_id && !customerDropOpen && (
                        <button
                          type="button"
                          onClick={() => { setSaleForm(f => ({ ...f, customer_id: '' })); setCustomerSearch(''); setCustomerDropOpen(true) }}
                          className="absolute inset-e-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                        >✕</button>
                      )}
                      {customerDropOpen && (
                        <div className="absolute top-full inset-x-0 z-20 bg-white border border-slate-200 rounded-xl shadow-lg mt-1 max-h-56 overflow-y-auto">
                          {filteredCustomers.length === 0 ? (
                            <div className="px-4 py-3 text-sm text-slate-400">No customers match "{customerSearch}"</div>
                          ) : filteredCustomers.map(c => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => { setSaleForm(f => ({ ...f, customer_id: c.id })); setCustomerDropOpen(false); setCustomerSearch('') }}
                              className="w-full text-start px-4 py-2.5 hover:bg-slate-50 text-sm border-b border-slate-50 last:border-0"
                            >
                              <div className="font-medium text-slate-700">{c.name}</div>
                              {c.phone && <div className="text-xs text-slate-400" dir="ltr">{c.phone}</div>}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>
              <button type="button" onClick={() => setCustomerModal(true)} className="px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 text-sm font-medium whitespace-nowrap">
                + New
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Pricing Type *</label>
            <div className="grid grid-cols-2 gap-2">
              <label className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border-2 cursor-pointer text-sm font-medium ${saleForm.sale_type === 'per_chicken' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                <input type="radio" name="sale_type" value="per_chicken" checked={saleForm.sale_type === 'per_chicken'} onChange={e => setSaleForm(f => ({ ...f, sale_type: e.target.value }))} className="sr-only" />
                🐔 Per Chicken
              </label>
              <label className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border-2 cursor-pointer text-sm font-medium ${saleForm.sale_type === 'per_kg' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                <input type="radio" name="sale_type" value="per_kg" checked={saleForm.sale_type === 'per_kg'} onChange={e => setSaleForm(f => ({ ...f, sale_type: e.target.value }))} className="sr-only" />
                ⚖️ Per KG
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Chicken count *</label>
              <input
                required type="number" min="1"
                value={saleForm.chicken_count}
                onChange={e => setSaleForm(f => ({ ...f, chicken_count: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
              />
            </div>
            {saleForm.sale_type === 'per_kg' ? (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Total Weight (kg) *</label>
                <input
                  required type="number" min="0.01" step="0.01"
                  value={saleForm.weight_kg}
                  onChange={e => setSaleForm(f => ({ ...f, weight_kg: e.target.value }))}
                  className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-300"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Weight (optional)</label>
                <input
                  type="number" min="0" step="0.01"
                  value={saleForm.weight_kg}
                  onChange={e => setSaleForm(f => ({ ...f, weight_kg: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Price per {saleForm.sale_type === 'per_kg' ? 'KG' : 'chicken'} (AFN) *
            </label>
            <input
              required type="number" min="0" step="0.01"
              value={saleForm.price_per_unit}
              onChange={e => setSaleForm(f => ({ ...f, price_per_unit: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
            />
          </div>

          {computedTotal > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-center justify-between">
              <span className="text-sm font-medium text-green-700">Total Amount</span>
              <span className="text-xl font-bold text-green-700">{formatCurrency(computedTotal)}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <input
              value={saleForm.notes}
              onChange={e => setSaleForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
            />
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setSaleModal(false)} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium bg-[#1B3A5C] text-white rounded-lg hover:bg-[#2E86AB] disabled:opacity-60">
              {saving ? 'Saving...' : 'Add Sale'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Quick add customer */}
      <Modal open={customerModal} onClose={() => setCustomerModal(false)} title="Add Customer">
        <form onSubmit={handleNewCustomer} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
            <input
              required value={customerForm.name}
              onChange={e => setCustomerForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
            <PhoneInput value={customerForm.phone} onChange={v => setCustomerForm(f => ({ ...f, phone: v }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <input
              value={customerForm.notes}
              onChange={e => setCustomerForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
            />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setCustomerModal(false)} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium bg-[#1B3A5C] text-white rounded-lg hover:bg-[#2E86AB] disabled:opacity-60">
              {saving ? 'Saving...' : 'Add Customer'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteSaleTarget}
        onClose={() => setDeleteSaleTarget(null)}
        onConfirm={() => deleteSale(deleteSaleTarget?.id)}
        title="Delete Sale"
        message="Remove this sale? This cannot be undone."
      />

      <ConfirmDialog
        open={!!deleteCarTarget}
        onClose={() => setDeleteCarTarget(null)}
        onConfirm={() => deleteCar(deleteCarTarget?.id)}
        title="Delete Car"
        message="Remove this car? All its sales and expenses will also be deleted. This cannot be undone."
      />

      <ConfirmDialog
        open={!!deleteExpenseTarget}
        onClose={() => setDeleteExpenseTarget(null)}
        onConfirm={() => deleteExpense(deleteExpenseTarget?.id)}
        title="Delete Expense"
        message="Remove this expense?"
      />

      <ConfirmDialog
        open={!!finishCarTarget}
        onClose={() => setFinishCarTarget(null)}
        onConfirm={() => { finishCar(finishCarTarget?.id); setFinishCarTarget(null) }}
        title="Finish Car"
        message="Close this car? You can still add expenses but no more sales. You can reopen it later if needed."
        confirmLabel="Finish Car"
        danger={false}
      />

      {/* Expense modal */}
      <Modal open={expenseModal} onClose={() => setExpenseModal(false)} title="Add Expense">
        <form onSubmit={handleExpenseSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description *</label>
            <input
              required
              value={expenseForm.description}
              onChange={e => setExpenseForm(f => ({ ...f, description: e.target.value }))}
              placeholder="e.g. Gas, loading workers, permits..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Amount (AFN) *</label>
            <input
              required type="number" min="0.01" step="0.01"
              value={expenseForm.amount}
              onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))}
              className="w-full px-3 py-2 border border-orange-200 bg-orange-50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
            />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setExpenseModal(false)} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-60">
              {saving ? 'Saving...' : 'Add Expense'}
            </button>
          </div>
        </form>
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

function CustomersSection({ chevron: ChevronIcon }) {
  const { customers, loading, addCustomer, updateCustomer, deleteCustomer } = useCommissionCustomers()
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(emptyCustomer)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [search, setSearch] = useState('')

  function openAdd() {
    setEditItem(null)
    setForm(emptyCustomer)
    setModalOpen(true)
  }

  function openEdit(c) {
    setEditItem(c)
    setForm({ name: c.name, phone: c.phone || '', notes: c.notes || '' })
    setModalOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    if (editItem) {
      await updateCustomer(editItem.id, form)
    } else {
      await addCustomer(form)
    }
    setSaving(false)
    setModalOpen(false)
  }

  const filtered = customers.filter(c =>
    !search ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || '').includes(search)
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or phone..."
          className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
        />
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 bg-[#1B3A5C] text-white rounded-xl text-sm font-medium hover:bg-[#2E86AB] transition-colors">
          <Plus size={16} /> Add Customer
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-12 text-center">
          <Users size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-400 text-sm">No customers yet</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(c => (
            <div key={c.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-semibold text-slate-800">{c.name}</div>
                  {c.phone && <div className="text-xs text-slate-500" dir="ltr">{c.phone}</div>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(c)} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => setDeleteTarget(c)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                <div className="bg-slate-50 rounded-lg p-2">
                  <div className="text-slate-400">Total Bought</div>
                  <div className="font-bold text-slate-700">{formatCurrency(c.total_purchased)}</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-2">
                  <div className="text-slate-400">Chickens</div>
                  <div className="font-bold text-blue-600">{c.total_chickens}</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-2">
                  <div className="text-slate-400">Paid</div>
                  <div className="font-bold text-green-600">{formatCurrency(c.total_paid)}</div>
                </div>
                <div className={`rounded-lg p-2 ${c.balance > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                  <div className="text-slate-400">Owes</div>
                  <div className={`font-bold ${c.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(c.balance)}</div>
                </div>
              </div>

              <Link
                to={`/commission/customer/${c.id}`}
                className="flex items-center justify-between w-full px-3 py-2 bg-slate-50 hover:bg-[#1B3A5C] hover:text-white rounded-lg text-sm font-medium text-slate-700 transition-colors"
              >
                <span>View Account</span>
                <ChevronIcon size={14} />
              </Link>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Edit Customer' : 'Add Customer'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
            <input
              required value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
            <PhoneInput value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea
              rows={3} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30 resize-none"
            />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium bg-[#1B3A5C] text-white rounded-lg hover:bg-[#2E86AB] disabled:opacity-60">
              {saving ? 'Saving...' : editItem ? 'Save Changes' : 'Add Customer'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteCustomer(deleteTarget?.id)}
        title="Delete Customer"
        message={`Delete "${deleteTarget?.name}"? All their sales and payments will also be deleted.`}
      />
    </div>
  )
}

// ============================================================
// Reusable: Add/Edit Car modal with dealer selector
// ============================================================
function CarFormModal({ open, onClose, editingCar, form, setForm, onSubmit, saving, dealers, onAddDealer, commissionRate }) {
  return (
    <Modal open={open} onClose={onClose} title={editingCar ? 'Edit Car' : 'Set Up Car'}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">🤝 Dealer *</label>
          <div className="flex gap-2">
            <select
              required
              value={form.dealer_id || ''}
              onChange={e => setForm(f => ({ ...f, dealer_id: e.target.value }))}
              className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
            >
              <option value="">— Select dealer —</option>
              {dealers.map(d => (
                <option key={d.id} value={d.id}>{d.name}{d.phone ? ` (${d.phone})` : ''}</option>
              ))}
            </select>
            <button type="button" onClick={onAddDealer} className="px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 text-sm font-medium whitespace-nowrap">
              + New
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Total chickens in car *</label>
          <input
            required type="number" min="1"
            value={form.total_chickens}
            onChange={e => setForm(f => ({ ...f, total_chickens: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
          <input
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Driver name, plate #, etc."
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            💰 Commission per chicken (AFN) *
          </label>
          <input
            required type="number" min="0" step="0.01"
            value={form.commission_rate}
            onChange={e => setForm(f => ({ ...f, commission_rate: e.target.value }))}
            placeholder={String(commissionRate)}
            className="w-full px-3 py-2 border border-purple-200 bg-purple-50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
          <p className="text-xs text-purple-600 mt-1">
            💡 Default is <strong>{commissionRate} AFN</strong> (from Settings). You can change it for this car.
          </p>
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
          <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium bg-[#1B3A5C] text-white rounded-lg hover:bg-[#2E86AB] disabled:opacity-60">
            {saving ? 'Saving...' : editingCar ? 'Save Changes' : 'Start Tracking'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ============================================================
// Reusable: Quick Add Dealer modal (used inline from car setup)
// ============================================================
function QuickDealerModal({ open, onClose, form, setForm, onSubmit, saving }) {
  return (
    <Modal open={open} onClose={onClose} title="Add Dealer">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
          <input
            required value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
          <PhoneInput value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
          <input
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
          />
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
          <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium bg-[#1B3A5C] text-white rounded-lg hover:bg-[#2E86AB] disabled:opacity-60">
            {saving ? 'Saving...' : 'Add Dealer'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ============================================================
// Dealers Tab Section
// ============================================================
function DealersSection({ chevron: ChevronIcon }) {
  const { dealers, loading, addDealer, updateDealer, deleteDealer } = useCommissionDealers()
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState({ name: '', phone: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [search, setSearch] = useState('')

  function openAdd() {
    setEditItem(null)
    setForm({ name: '', phone: '', notes: '' })
    setModalOpen(true)
  }

  function openEdit(d) {
    setEditItem(d)
    setForm({ name: d.name, phone: d.phone || '', notes: d.notes || '' })
    setModalOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    if (editItem) {
      await updateDealer(editItem.id, form)
    } else {
      await addDealer(form)
    }
    setSaving(false)
    setModalOpen(false)
  }

  const filtered = dealers.filter(d =>
    !search ||
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    (d.phone || '').includes(search)
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or phone..."
          className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
        />
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 bg-[#1B3A5C] text-white rounded-xl text-sm font-medium hover:bg-[#2E86AB] transition-colors">
          <Plus size={16} /> Add Dealer
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-12 text-center">
          <Handshake size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-400 text-sm">No dealers yet</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(d => (
            <div key={d.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <Handshake size={14} className="text-[#1B3A5C]" /> {d.name}
                  </div>
                  {d.phone && <div className="text-xs text-slate-500 mt-0.5" dir="ltr">{d.phone}</div>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(d)} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => setDeleteTarget(d)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                <div className="bg-slate-50 rounded-lg p-2">
                  <div className="text-slate-400">Cars</div>
                  <div className="font-bold text-slate-700">{d.total_cars}</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-2">
                  <div className="text-slate-400">Sold</div>
                  <div className="font-bold text-blue-600">{d.total_sold}</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-2">
                  <div className="text-slate-400">Paid</div>
                  <div className="font-bold text-green-600">{formatCurrency(d.total_paid)}</div>
                </div>
                <div className={`rounded-lg p-2 ${d.balance > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                  <div className="text-slate-400">Owed</div>
                  <div className={`font-bold ${d.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(d.balance)}</div>
                </div>
              </div>

              <Link
                to={`/commission/dealer/${d.id}`}
                className="flex items-center justify-between w-full px-3 py-2 bg-slate-50 hover:bg-[#1B3A5C] hover:text-white rounded-lg text-sm font-medium text-slate-700 transition-colors"
              >
                <span>View Account</span>
                <ChevronIcon size={14} />
              </Link>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Edit Dealer' : 'Add Dealer'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
            <input
              required value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
            <PhoneInput value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea
              rows={3} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30 resize-none"
            />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium bg-[#1B3A5C] text-white rounded-lg hover:bg-[#2E86AB] disabled:opacity-60">
              {saving ? 'Saving...' : editItem ? 'Save Changes' : 'Add Dealer'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteDealer(deleteTarget?.id)}
        title="Delete Dealer"
        message={`Delete "${deleteTarget?.name}"? Their cars will be unlinked but kept. Their payment history will be deleted.`}
      />
    </div>
  )
}
