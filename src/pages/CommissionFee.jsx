import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Coins, Calendar, Filter, ChevronDown, ChevronUp, Truck, Handshake, Receipt, Plus, Edit2, Trash2 } from 'lucide-react'
import { useCommissionFee, useCommissionFeeExpenses } from '../hooks/useCommission'
import Modal from '../components/common/Modal'
import ConfirmDialog from '../components/common/ConfirmDialog'
import { formatCurrency } from '../utils/formatCurrency'
import { formatDate, todayStr } from '../utils/dateHelpers'

function firstOfMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export default function CommissionFee() {
  const [tab, setTab] = useState('commission')
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Coins size={22} className="text-amber-600" /> Commission Fee
        </h2>
      </div>

      <div className="flex gap-1 bg-white rounded-xl p-1 border border-slate-100 shadow-sm w-fit flex-wrap">
        <button
          onClick={() => setTab('commission')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'commission' ? 'bg-amber-500 text-white shadow' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          💰 Commission Earned
        </button>
        <button
          onClick={() => setTab('expenses')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'expenses' ? 'bg-orange-500 text-white shadow' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          🧾 Expenses & Profit
        </button>
      </div>

      {tab === 'commission' && <CommissionEarnedSection />}
      {tab === 'expenses' && <ExpensesSection />}
    </div>
  )
}

function CommissionEarnedSection() {
  const { carDetails, loading } = useCommissionFee()
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [dealerFilter, setDealerFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')  // 'all' | 'closed' | 'open'
  const [groupByDealer, setGroupByDealer] = useState(false)
  const [expandedDealers, setExpandedDealers] = useState({})

  // Available dealers from the data
  const dealers = useMemo(() => {
    const seen = new Map()
    for (const car of carDetails) {
      if (car.dealer_id && !seen.has(car.dealer_id)) {
        seen.set(car.dealer_id, car.dealer_name)
      }
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name }))
  }, [carDetails])

  const filtered = useMemo(() => {
    return carDetails.filter(car => {
      if (fromDate && car.car_date < fromDate) return false
      if (toDate && car.car_date > toDate) return false
      if (dealerFilter !== 'all' && car.dealer_id !== dealerFilter) return false
      if (statusFilter === 'closed' && !car.is_closed) return false
      if (statusFilter === 'open' && car.is_closed) return false
      return true
    })
  }, [carDetails, fromDate, toDate, dealerFilter, statusFilter])

  // Stat aggregates
  const today = todayStr()
  const monthStart = firstOfMonth()
  const todayTotal = carDetails.filter(c => c.car_date === today).reduce((s, c) => s + c.commission_fee, 0)
  const monthTotal = carDetails.filter(c => c.car_date >= monthStart).reduce((s, c) => s + c.commission_fee, 0)
  const allTimeTotal = carDetails.reduce((s, c) => s + c.commission_fee, 0)
  const filteredTotal = filtered.reduce((s, c) => s + c.commission_fee, 0)
  const filteredSold = filtered.reduce((s, c) => s + c.sold_chickens, 0)

  // Group by dealer if enabled
  const grouped = useMemo(() => {
    if (!groupByDealer) return null
    const map = new Map()
    for (const car of filtered) {
      const key = car.dealer_id || 'no_dealer'
      const name = car.dealer_name
      if (!map.has(key)) map.set(key, { id: key === 'no_dealer' ? null : key, name, cars: [], total: 0, sold: 0 })
      const g = map.get(key)
      g.cars.push(car)
      g.total += car.commission_fee
      g.sold += car.sold_chickens
    }
    return [...map.values()].sort((a, b) => b.total - a.total)
  }, [filtered, groupByDealer])

  function toggleDealer(id) {
    setExpandedDealers(s => ({ ...s, [id]: !s[id] }))
  }

  return (
    <div className="space-y-4">
      {/* Top stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-linear-to-br from-purple-500 to-purple-600 rounded-2xl p-5 text-white shadow-sm">
          <div className="text-xs text-white/70 uppercase tracking-wide">Today</div>
          <div className="text-2xl font-bold mt-1">{formatCurrency(todayTotal)}</div>
        </div>
        <div className="bg-linear-to-br from-blue-500 to-blue-600 rounded-2xl p-5 text-white shadow-sm">
          <div className="text-xs text-white/70 uppercase tracking-wide">This Month</div>
          <div className="text-2xl font-bold mt-1">{formatCurrency(monthTotal)}</div>
        </div>
        <div className="bg-linear-to-br from-amber-500 to-amber-600 rounded-2xl p-5 text-white shadow-sm">
          <div className="text-xs text-white/70 uppercase tracking-wide">All Time</div>
          <div className="text-2xl font-bold mt-1">{formatCurrency(allTimeTotal)}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Filter size={14} /> Filters
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">From</label>
            <div className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-2">
              <Calendar size={12} className="text-slate-400" />
              <input
                type="date" value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="flex-1 py-1.5 text-sm border-none focus:outline-none bg-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">To</label>
            <div className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-2">
              <Calendar size={12} className="text-slate-400" />
              <input
                type="date" value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="flex-1 py-1.5 text-sm border-none focus:outline-none bg-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Dealer</label>
            <select
              value={dealerFilter}
              onChange={e => setDealerFilter(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
            >
              <option value="all">All dealers</option>
              {dealers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
            >
              <option value="all">All</option>
              <option value="closed">Finished only</option>
              <option value="open">In progress only</option>
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-lg text-sm cursor-pointer hover:bg-slate-50 w-full">
              <input
                type="checkbox" checked={groupByDealer}
                onChange={e => setGroupByDealer(e.target.checked)}
                className="rounded"
              />
              Group by dealer
            </label>
          </div>
        </div>
        {(fromDate || toDate || dealerFilter !== 'all' || statusFilter !== 'all') && (
          <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-xs">
            <span className="text-slate-600">
              Showing <strong>{filtered.length}</strong> car{filtered.length !== 1 ? 's' : ''} ·  <strong>{filteredSold}</strong> sold chickens
            </span>
            <span className="font-bold text-purple-700">{formatCurrency(filteredTotal)}</span>
          </div>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-12 text-center">
          <Coins size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-400 text-sm">No commission earned in this range</p>
        </div>
      ) : groupByDealer ? (
        <div className="space-y-2">
          {grouped.map(g => (
            <div key={g.id || 'no_dealer'} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <button
                onClick={() => toggleDealer(g.id || 'no_dealer')}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50"
              >
                <div className="flex items-center gap-3">
                  <Handshake size={16} className="text-[#1B3A5C]" />
                  <div className="text-start">
                    <div className="font-semibold text-slate-800">{g.name}</div>
                    <div className="text-xs text-slate-500">{g.cars.length} car{g.cars.length !== 1 ? 's' : ''} · {g.sold} sold chickens</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-purple-700">{formatCurrency(g.total)}</span>
                  {expandedDealers[g.id || 'no_dealer'] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </button>
              {expandedDealers[g.id || 'no_dealer'] && (
                <div className="border-t border-slate-100 overflow-x-auto">
                  <CarRows cars={g.cars} />
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <CarRows cars={filtered} />
          </div>
        </div>
      )}
    </div>
  )
}

function CarRows({ cars }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase">
          <th className="text-start px-5 py-3 font-medium">Date</th>
          <th className="text-start px-5 py-3 font-medium">Dealer</th>
          <th className="text-start px-5 py-3 font-medium">Status</th>
          <th className="text-start px-5 py-3 font-medium">Sold / Total</th>
          <th className="text-start px-5 py-3 font-medium">Rate</th>
          <th className="text-start px-5 py-3 font-medium">Commission Earned</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50">
        {cars.map(car => (
          <tr key={car.id} className="hover:bg-slate-50">
            <td className="px-5 py-3 font-medium">{formatDate(car.car_date)}</td>
            <td className="px-5 py-3">
              {car.dealer_id ? (
                <Link to={`/commission/dealer/${car.dealer_id}`} className="text-blue-600 hover:underline font-medium">
                  {car.dealer_name}
                </Link>
              ) : (
                <span className="text-slate-400 italic">{car.dealer_name}</span>
              )}
            </td>
            <td className="px-5 py-3">
              {car.is_closed
                ? <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">✓ Closed</span>
                : <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Active</span>
              }
            </td>
            <td className="px-5 py-3 font-medium text-blue-600">{car.sold_chickens} / {car.total_chickens}</td>
            <td className="px-5 py-3 text-slate-600">{car.commission_rate_per_chicken || 5} AFN</td>
            <td className="px-5 py-3 font-bold text-purple-700">{formatCurrency(car.commission_fee)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ============================================================
// Expenses & Profit Section
// ============================================================
const emptyExpense = { title: '', amount: '', note: '', expense_date: todayStr() }

function ExpensesSection() {
  const { expenses, loading, addExpense, updateExpense, deleteExpense } = useCommissionFeeExpenses()
  const { carDetails } = useCommissionFee()
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(emptyExpense)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const today = todayStr()
  const monthStart = firstOfMonth()

  const filtered = useMemo(() => {
    return expenses.filter(e => {
      if (fromDate && e.expense_date < fromDate) return false
      if (toDate && e.expense_date > toDate) return false
      return true
    })
  }, [expenses, fromDate, toDate])

  const todayCommission = carDetails.filter(c => c.car_date === today).reduce((s, c) => s + c.commission_fee, 0)
  const monthCommission = carDetails.filter(c => c.car_date >= monthStart).reduce((s, c) => s + c.commission_fee, 0)
  const allCommission = carDetails.reduce((s, c) => s + c.commission_fee, 0)

  const todayExp = expenses.filter(e => e.expense_date === today).reduce((s, e) => s + (e.amount || 0), 0)
  const monthExp = expenses.filter(e => e.expense_date >= monthStart).reduce((s, e) => s + (e.amount || 0), 0)
  const allExp = expenses.reduce((s, e) => s + (e.amount || 0), 0)

  const todayProfit = todayCommission - todayExp
  const monthProfit = monthCommission - monthExp
  const allProfit = allCommission - allExp

  const filteredExp = filtered.reduce((s, e) => s + (e.amount || 0), 0)

  function openAdd() {
    setEditItem(null)
    setForm({ ...emptyExpense, expense_date: todayStr() })
    setModalOpen(true)
  }

  function openEdit(exp) {
    setEditItem(exp)
    setForm({
      title: exp.title,
      amount: String(exp.amount),
      note: exp.note || '',
      expense_date: exp.expense_date,
    })
    setModalOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const ok = editItem
      ? await updateExpense(editItem.id, form)
      : await addExpense(form)
    setSaving(false)
    if (ok) setModalOpen(false)
  }

  return (
    <div className="space-y-4">
      {/* Profit summary — Today / This Month / All Time */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <ProfitCard label="Today" commission={todayCommission} expenses={todayExp} profit={todayProfit} />
        <ProfitCard label="This Month" commission={monthCommission} expenses={monthExp} profit={monthProfit} />
        <ProfitCard label="All Time" commission={allCommission} expenses={allExp} profit={allProfit} />
      </div>

      {/* Filter row + add button */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
          <Filter size={14} /> Filter Expenses
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">From</label>
            <div className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-2">
              <Calendar size={12} className="text-slate-400" />
              <input
                type="date" value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="flex-1 py-1.5 text-sm border-none focus:outline-none bg-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">To</label>
            <div className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-2">
              <Calendar size={12} className="text-slate-400" />
              <input
                type="date" value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="flex-1 py-1.5 text-sm border-none focus:outline-none bg-transparent"
              />
            </div>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600"
          >
            <Plus size={16} /> Add Expense
          </button>
        </div>
        {(fromDate || toDate) && (
          <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-xs mt-3">
            <span className="text-slate-600">
              Showing <strong>{filtered.length}</strong> expense(s)
            </span>
            <span className="font-bold text-orange-700">{formatCurrency(filteredExp)}</span>
          </div>
        )}
      </div>

      {/* Expense list */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-12 text-center">
          <Receipt size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-400 text-sm">No expenses recorded yet</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase">
                  <th className="text-start px-5 py-3 font-medium">Date</th>
                  <th className="text-start px-5 py-3 font-medium">Title</th>
                  <th className="text-start px-5 py-3 font-medium">Amount</th>
                  <th className="text-start px-5 py-3 font-medium">Note</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(exp => (
                  <tr key={exp.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium">{formatDate(exp.expense_date)}</td>
                    <td className="px-5 py-3 font-medium text-slate-800">{exp.title}</td>
                    <td className="px-5 py-3 font-bold text-orange-700">{formatCurrency(exp.amount)}</td>
                    <td className="px-5 py-3 text-slate-500 text-xs">{exp.note || '—'}</td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => openEdit(exp)} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => setDeleteTarget(exp)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editItem ? 'Edit Expense' : 'Add Expense'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Title *</label>
            <input
              required value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Shop Rent, Internet, Electricity"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Amount (AFN) *</label>
            <input
              required type="number" min="0.01" step="0.01"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              className="w-full px-3 py-2 border border-orange-200 bg-orange-50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
            <input
              type="date" value={form.expense_date}
              onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Note</label>
            <textarea
              rows={2} value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              placeholder="Optional details"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30 resize-none"
            />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-60">
              {saving ? 'Saving…' : editItem ? 'Save Changes' : 'Add Expense'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteExpense(deleteTarget?.id)}
        title="Delete Expense"
        message={`Remove "${deleteTarget?.title}"?`}
        confirmLabel="Delete"
      />
    </div>
  )
}

function ProfitCard({ label, commission, expenses, profit }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-3">{label}</div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-600">Commission</span>
          <span className="font-semibold text-purple-700">{formatCurrency(commission)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">Expenses</span>
          <span className="font-semibold text-orange-600">−{formatCurrency(expenses)}</span>
        </div>
        <div className={`flex justify-between border-t border-slate-100 pt-2 mt-2 ${profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
          <span className="font-semibold">Profit</span>
          <span className="font-bold text-lg">{formatCurrency(profit)}</span>
        </div>
      </div>
    </div>
  )
}
