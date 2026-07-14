import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Activity, RefreshCw, FileWarning, Building2, Wheat, Users, Package } from 'lucide-react'
import { supabase } from '../config/supabase'
import { useLanguage } from '../contexts/LanguageContext'
import { formatCurrency } from '../utils/formatCurrency'
import { lf } from '../utils/localizedField'

// -----------------------------------------------------------------------------
// Data Health — Phase 1 diagnostics.
//
// READ-ONLY. This page issues nothing but SELECT queries. It never writes,
// updates, or deletes. It exists to *show* Royani exactly which stored
// aggregate values disagree with what the raw transaction tables say they
// should be, so we can decide what (if anything) needs reconciling.
//
// Every formula matches the "live" math used on the Dashboard and Farms list.
// -----------------------------------------------------------------------------

async function fetchAllPaged(table, columns) {
  const out = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + pageSize - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    if (!data || data.length === 0) break
    out.push(...data)
    if (data.length < pageSize) break
  }
  return out
}

const DIFF_THRESHOLD = 1 // ignore rounding noise below 1 AFN

export default function DataHealth() {
  const { t, lang } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [runningAt, setRunningAt] = useState(null)
  const [report, setReport] = useState(null)
  const [error, setError] = useState(null)

  async function runDiagnostics() {
    setLoading(true)
    setError(null)
    try {
      // All the raw tables we need for the live math. Paginated so nothing
      // gets truncated at 1000 rows.
      const [
        farms, customers, products,
        dispatches, dispatchItems, payments, supplyPayments, farmBatches,
        sales, supplierDispatches,
      ] = await Promise.all([
        fetchAllPaged('farms', 'id, name, name_fa, name_ps, total_debt, total_debt_usd, total_profit_generated, total_profit_generated_usd, advance_payment, is_active'),
        fetchAllPaged('customers', 'id, name, total_debt, total_debt_usd'),
        fetchAllPaged('products', 'id, name, type, quantity, low_stock_threshold'),
        fetchAllPaged('dispatches', 'farm_id, total_amount, total_amount_usd'),
        fetchAllPaged('dispatch_items', 'supplier_dispatch_id, product_id, quantity, total_profit, total_profit_usd, dispatches(farm_id)'),
        fetchAllPaged('payments', 'farm_id, amount, amount_usd, currency'),
        fetchAllPaged('supply_payments', 'farm_id, amount'),
        fetchAllPaged('farm_batches', 'farm_id, initial_chicken_count, price_per_chicken'),
        fetchAllPaged('sales', 'customer_id, remaining, remaining_usd'),
        fetchAllPaged('supplier_dispatches', 'id, product_id, quantity, price_per_bag'),
      ])

      // -----------------------------------------------------------------
      // 1) Farm debt drift
      //    live_debt = max(0, Σ dispatches + Σ supply + Σ chicken_batches − Σ payments)
      // -----------------------------------------------------------------
      const dispByFarm = {}
      for (const d of dispatches) dispByFarm[d.farm_id] = (dispByFarm[d.farm_id] || 0) + (d.total_amount || 0)
      const paidByFarm = {}
      for (const p of payments) paidByFarm[p.farm_id] = (paidByFarm[p.farm_id] || 0) + (p.amount || 0)
      const supplyByFarm = {}
      for (const s of supplyPayments) supplyByFarm[s.farm_id] = (supplyByFarm[s.farm_id] || 0) + (s.amount || 0)
      const chickenByFarm = {}
      for (const b of farmBatches) {
        chickenByFarm[b.farm_id] = (chickenByFarm[b.farm_id] || 0) + (b.initial_chicken_count || 0) * (b.price_per_chicken || 0)
      }
      // 2) Farm profit drift — sum dispatch_items.total_profit per farm via the
      //    dispatches(farm_id) join we asked for above.
      const profitByFarm = {}
      for (const it of dispatchItems) {
        const fid = it.dispatches?.farm_id
        if (!fid) continue
        profitByFarm[fid] = (profitByFarm[fid] || 0) + (it.total_profit || 0)
      }
      // USD-side sums parallel to AFN — dispatches contribute total_amount_usd,
      // payments contribute amount_usd only when currency='USD'.
      const dispUsdByFarm = {}
      for (const d of dispatches) dispUsdByFarm[d.farm_id] = (dispUsdByFarm[d.farm_id] || 0) + (d.total_amount_usd || 0)
      const paidUsdByFarm = {}
      for (const p of payments) {
        if (p.currency === 'USD') paidUsdByFarm[p.farm_id] = (paidUsdByFarm[p.farm_id] || 0) + (p.amount_usd || 0)
      }
      const profitUsdByFarm = {}
      for (const it of dispatchItems) {
        const fid = it.dispatches?.farm_id
        if (!fid) continue
        profitUsdByFarm[fid] = (profitUsdByFarm[fid] || 0) + (it.total_profit_usd || 0)
      }

      const farmDebtDrift = []
      const farmProfitDrift = []
      const farmDebtDriftUsd = []
      const farmProfitDriftUsd = []
      for (const f of farms) {
        const stored = f.total_debt || 0
        const computed = Math.max(0, (dispByFarm[f.id] || 0) + (supplyByFarm[f.id] || 0) + (chickenByFarm[f.id] || 0) - (paidByFarm[f.id] || 0))
        const diff = stored - computed
        if (Math.abs(diff) > DIFF_THRESHOLD) {
          farmDebtDrift.push({ id: f.id, name: lf(f, 'name', lang), stored, computed, diff, is_active: f.is_active })
        }
        const storedProfit = f.total_profit_generated || 0
        const computedProfit = profitByFarm[f.id] || 0
        const pDiff = storedProfit - computedProfit
        if (Math.abs(pDiff) > DIFF_THRESHOLD) {
          farmProfitDrift.push({ id: f.id, name: lf(f, 'name', lang), stored: storedProfit, computed: computedProfit, diff: pDiff, is_active: f.is_active })
        }
        const storedUsd = f.total_debt_usd || 0
        const computedUsd = Math.max(0, (dispUsdByFarm[f.id] || 0) - (paidUsdByFarm[f.id] || 0))
        const diffUsd = storedUsd - computedUsd
        if (Math.abs(diffUsd) > DIFF_THRESHOLD) {
          farmDebtDriftUsd.push({ id: f.id, name: lf(f, 'name', lang), stored: storedUsd, computed: computedUsd, diff: diffUsd, is_active: f.is_active })
        }
        const storedProfitUsd = f.total_profit_generated_usd || 0
        const computedProfitUsd = profitUsdByFarm[f.id] || 0
        const pDiffUsd = storedProfitUsd - computedProfitUsd
        if (Math.abs(pDiffUsd) > DIFF_THRESHOLD) {
          farmProfitDriftUsd.push({ id: f.id, name: lf(f, 'name', lang), stored: storedProfitUsd, computed: computedProfitUsd, diff: pDiffUsd, is_active: f.is_active })
        }
      }
      farmDebtDrift.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
      farmProfitDrift.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
      farmDebtDriftUsd.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
      farmProfitDriftUsd.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))

      // -----------------------------------------------------------------
      // 3) Customer debt drift — AFN and USD
      //    live_debt = Σ sales.remaining, live_debt_usd = Σ sales.remaining_usd
      // -----------------------------------------------------------------
      const remainByCustomer = {}
      const remainUsdByCustomer = {}
      for (const s of sales) {
        if (!s.customer_id) continue
        remainByCustomer[s.customer_id] = (remainByCustomer[s.customer_id] || 0) + (s.remaining || 0)
        remainUsdByCustomer[s.customer_id] = (remainUsdByCustomer[s.customer_id] || 0) + (s.remaining_usd || 0)
      }
      const customerDebtDrift = []
      const customerDebtDriftUsd = []
      for (const c of customers) {
        const stored = c.total_debt || 0
        const computed = remainByCustomer[c.id] || 0
        const diff = stored - computed
        if (Math.abs(diff) > DIFF_THRESHOLD) {
          customerDebtDrift.push({ id: c.id, name: c.name, stored, computed, diff })
        }
        const storedUsd = c.total_debt_usd || 0
        const computedUsd = remainUsdByCustomer[c.id] || 0
        const diffUsd = storedUsd - computedUsd
        if (Math.abs(diffUsd) > DIFF_THRESHOLD) {
          customerDebtDriftUsd.push({ id: c.id, name: c.name, stored: storedUsd, computed: computedUsd, diff: diffUsd })
        }
      }
      customerDebtDrift.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
      customerDebtDriftUsd.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))

      // -----------------------------------------------------------------
      // 4) Meel product quantity drift
      //    real_qty = Σ (bill.quantity − consumed) for every bill of that product
      // -----------------------------------------------------------------
      const consumedByBill = {}
      for (const it of dispatchItems) {
        if (!it.supplier_dispatch_id) continue
        consumedByBill[it.supplier_dispatch_id] = (consumedByBill[it.supplier_dispatch_id] || 0) + (it.quantity || 0)
      }
      const remainingByProduct = {}
      for (const bill of supplierDispatches) {
        const remaining = Math.max(0, (bill.quantity || 0) - (consumedByBill[bill.id] || 0))
        remainingByProduct[bill.product_id] = (remainingByProduct[bill.product_id] || 0) + remaining
      }
      const productQtyDrift = []
      for (const p of products) {
        if (p.type !== 'meel') continue // meel is the drift-prone one
        const stored = p.quantity || 0
        const computed = remainingByProduct[p.id] || 0
        const diff = stored - computed
        if (Math.abs(diff) > DIFF_THRESHOLD) {
          productQtyDrift.push({ id: p.id, name: p.name, stored, computed, diff })
        }
      }
      productQtyDrift.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))

      // -----------------------------------------------------------------
      // 5) Over-dispatched supplier bills — impossible in a healthy system
      // -----------------------------------------------------------------
      const overDispatched = []
      const productNameById = Object.fromEntries(products.map(p => [p.id, p.name]))
      for (const bill of supplierDispatches) {
        const bought = bill.quantity || 0
        const dispatched = consumedByBill[bill.id] || 0
        if (dispatched > bought + DIFF_THRESHOLD) {
          overDispatched.push({
            id: bill.id,
            product: productNameById[bill.product_id] || '—',
            bought,
            dispatched,
            over: dispatched - bought,
          })
        }
      }
      overDispatched.sort((a, b) => b.over - a.over)

      setReport({
        farmDebtDrift,
        farmProfitDrift,
        farmDebtDriftUsd,
        farmProfitDriftUsd,
        customerDebtDrift,
        customerDebtDriftUsd,
        productQtyDrift,
        overDispatched,
        counts: {
          farms: farms.length,
          customers: customers.length,
          products: products.length,
          supplierBills: supplierDispatches.length,
          dispatches: dispatches.length,
          payments: payments.length,
        },
      })
      setRunningAt(new Date())
    } catch (err) {
      console.error(err)
      setError(err.message || 'Unknown error')
    }
    setLoading(false)
  }

  useEffect(() => { runDiagnostics() }, [])

  if (loading && !report) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <div className="w-8 h-8 border-2 border-[#2E86AB] border-t-transparent rounded-full animate-spin me-3" />
        Running diagnostics...
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-700">
        <p className="font-semibold">Diagnostic run failed</p>
        <p className="text-sm mt-1">{error}</p>
        <button onClick={runDiagnostics} className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
          Retry
        </button>
      </div>
    )
  }

  const r = report
  const totalIssues =
    r.farmDebtDrift.length + r.farmProfitDrift.length +
    r.farmDebtDriftUsd.length + r.farmProfitDriftUsd.length +
    r.customerDebtDrift.length + r.customerDebtDriftUsd.length +
    r.productQtyDrift.length + r.overDispatched.length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className={`rounded-2xl p-5 text-white ${totalIssues === 0 ? 'bg-gradient-to-r from-green-600 to-emerald-500' : 'bg-gradient-to-r from-[#1B3A5C] to-[#2E86AB]'}`}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Activity size={20} />
              <h2 className="text-xl font-bold">Data Health</h2>
              <span className="text-xs bg-white/25 px-2 py-0.5 rounded-full font-semibold">READ-ONLY</span>
            </div>
            <p className="text-sm text-white/80">
              {totalIssues === 0
                ? 'Every stored value matches its live calculation. Nothing to reconcile.'
                : `${totalIssues} discrepancies found. Nothing has been changed — this page only reports.`}
            </p>
            {runningAt && (
              <p className="text-xs text-white/60 mt-1">
                Last run: {runningAt.toLocaleString()}
              </p>
            )}
          </div>
          <button onClick={runDiagnostics} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-sm font-medium disabled:opacity-50">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Re-run
          </button>
        </div>
      </div>

      {/* Counts row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Farms',           count: r.counts.farms,          color: 'blue' },
          { label: 'Customers',       count: r.counts.customers,      color: 'purple' },
          { label: 'Products',        count: r.counts.products,       color: 'amber' },
          { label: 'Supplier Bills',  count: r.counts.supplierBills,  color: 'teal' },
          { label: 'Dispatches',      count: r.counts.dispatches,     color: 'orange' },
          { label: 'Payments',        count: r.counts.payments,       color: 'green' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl px-4 py-3 shadow-sm border border-slate-100">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">{c.label}</p>
            <p className="text-lg font-bold text-slate-700">{(c.count || 0).toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Section 1: Farm debt drift */}
      <Section
        icon={Building2}
        title="Farm Debt Drift"
        subtitle="stored farms.total_debt vs live-computed debt (dispatches + supply + chicken batches − payments)"
        emptyText="Every farm's stored debt matches its live-computed debt."
        rows={r.farmDebtDrift}
        columns={[
          { key: 'name', label: 'Farm', className: 'font-medium text-slate-700' },
          { key: 'stored', label: 'Stored', format: formatCurrency, className: 'text-slate-500' },
          { key: 'computed', label: 'Computed', format: formatCurrency, className: 'text-slate-700 font-semibold' },
          { key: 'diff', label: 'Difference', format: v => (v > 0 ? '+' : '') + formatCurrency(v), className: v => v > 0 ? 'text-red-600 font-bold' : 'text-amber-700 font-bold' },
          { key: 'is_active', label: 'Status', format: v => v ? 'Active' : 'Disabled', className: v => v ? 'text-green-600 text-xs' : 'text-slate-400 text-xs' },
        ]}
      />

      {/* Section 2: Farm profit drift */}
      <Section
        icon={Building2}
        title="Farm Profit Drift"
        subtitle="stored farms.total_profit_generated vs Σ dispatch_items.total_profit for that farm"
        emptyText="Every farm's stored profit matches its live-computed profit."
        rows={r.farmProfitDrift}
        columns={[
          { key: 'name', label: 'Farm', className: 'font-medium text-slate-700' },
          { key: 'stored', label: 'Stored', format: formatCurrency, className: 'text-slate-500' },
          { key: 'computed', label: 'Computed', format: formatCurrency, className: 'text-slate-700 font-semibold' },
          { key: 'diff', label: 'Difference', format: v => (v > 0 ? '+' : '') + formatCurrency(v), className: v => v > 0 ? 'text-red-600 font-bold' : 'text-amber-700 font-bold' },
        ]}
      />

      {/* Section 2a: Farm USD debt drift */}
      <Section
        icon={Building2}
        title="Farm Debt Drift (USD)"
        subtitle="stored farms.total_debt_usd vs Σ dispatches.total_amount_usd − Σ payments.amount_usd (currency='USD')"
        emptyText="Every farm's stored USD debt matches its live-computed USD debt."
        rows={r.farmDebtDriftUsd}
        columns={[
          { key: 'name', label: 'Farm', className: 'font-medium text-slate-700' },
          { key: 'stored', label: 'Stored', format: v => `$${(v || 0).toFixed(2)}`, className: 'text-slate-500' },
          { key: 'computed', label: 'Computed', format: v => `$${(v || 0).toFixed(2)}`, className: 'text-slate-700 font-semibold' },
          { key: 'diff', label: 'Difference', format: v => `${v > 0 ? '+' : ''}$${v.toFixed(2)}`, className: v => v > 0 ? 'text-red-600 font-bold' : 'text-amber-700 font-bold' },
          { key: 'is_active', label: 'Status', format: v => v ? 'Active' : 'Disabled', className: v => v ? 'text-green-600 text-xs' : 'text-slate-400 text-xs' },
        ]}
      />

      {/* Section 2b: Farm USD profit drift */}
      <Section
        icon={Building2}
        title="Farm Profit Drift (USD)"
        subtitle="stored farms.total_profit_generated_usd vs Σ dispatch_items.total_profit_usd for that farm"
        emptyText="Every farm's stored USD profit matches its live-computed USD profit."
        rows={r.farmProfitDriftUsd}
        columns={[
          { key: 'name', label: 'Farm', className: 'font-medium text-slate-700' },
          { key: 'stored', label: 'Stored', format: v => `$${(v || 0).toFixed(2)}`, className: 'text-slate-500' },
          { key: 'computed', label: 'Computed', format: v => `$${(v || 0).toFixed(2)}`, className: 'text-slate-700 font-semibold' },
          { key: 'diff', label: 'Difference', format: v => `${v > 0 ? '+' : ''}$${v.toFixed(2)}`, className: v => v > 0 ? 'text-red-600 font-bold' : 'text-amber-700 font-bold' },
        ]}
      />

      {/* Section 3: Customer debt drift */}
      <Section
        icon={Users}
        title="Walk-in Customer Debt Drift"
        subtitle="stored customers.total_debt vs Σ sales.remaining for that customer"
        emptyText="Every customer's stored debt matches its live-computed debt."
        rows={r.customerDebtDrift}
        columns={[
          { key: 'name', label: 'Customer', className: 'font-medium text-slate-700' },
          { key: 'stored', label: 'Stored', format: formatCurrency, className: 'text-slate-500' },
          { key: 'computed', label: 'Computed', format: formatCurrency, className: 'text-slate-700 font-semibold' },
          { key: 'diff', label: 'Difference', format: v => (v > 0 ? '+' : '') + formatCurrency(v), className: v => v > 0 ? 'text-red-600 font-bold' : 'text-amber-700 font-bold' },
        ]}
      />

      {/* Section 3a: Customer USD debt drift */}
      <Section
        icon={Users}
        title="Walk-in Customer Debt Drift (USD)"
        subtitle="stored customers.total_debt_usd vs Σ sales.remaining_usd for that customer"
        emptyText="Every customer's stored USD debt matches its live-computed USD debt."
        rows={r.customerDebtDriftUsd}
        columns={[
          { key: 'name', label: 'Customer', className: 'font-medium text-slate-700' },
          { key: 'stored', label: 'Stored', format: v => `$${(v || 0).toFixed(2)}`, className: 'text-slate-500' },
          { key: 'computed', label: 'Computed', format: v => `$${(v || 0).toFixed(2)}`, className: 'text-slate-700 font-semibold' },
          { key: 'diff', label: 'Difference', format: v => `${v > 0 ? '+' : ''}$${v.toFixed(2)}`, className: v => v > 0 ? 'text-red-600 font-bold' : 'text-amber-700 font-bold' },
        ]}
      />

      {/* Section 4: Meel product quantity drift */}
      <Section
        icon={Wheat}
        title="Meel Product Quantity Drift"
        subtitle="stored products.quantity vs Σ (bill.quantity − dispatched) for that product"
        emptyText="Every meel product's stored bag count matches the bills-minus-dispatched calculation."
        rows={r.productQtyDrift}
        columns={[
          { key: 'name', label: 'Product', className: 'font-medium text-slate-700' },
          { key: 'stored', label: 'Stored (bags)', format: v => (v || 0).toLocaleString(), className: 'text-slate-500' },
          { key: 'computed', label: 'Real (bags)', format: v => (v || 0).toLocaleString(), className: 'text-slate-700 font-semibold' },
          { key: 'diff', label: 'Difference', format: v => (v > 0 ? '+' : '') + (v || 0).toLocaleString(), className: v => v > 0 ? 'text-red-600 font-bold' : 'text-amber-700 font-bold' },
        ]}
      />

      {/* Section 5: Over-dispatched supplier bills */}
      <Section
        icon={FileWarning}
        title="Over-Dispatched Supplier Bills"
        subtitle="bills where more bags were dispatched than were originally on the bill (should be zero rows)"
        emptyText="No over-dispatched bills. Every supplier bill has dispatched ≤ bought."
        rows={r.overDispatched}
        columns={[
          { key: 'id', label: 'Bill ID', className: 'text-xs font-mono text-slate-500 truncate max-w-[180px]' },
          { key: 'product', label: 'Product', className: 'font-medium text-slate-700' },
          { key: 'bought', label: 'Bought (bags)', format: v => (v || 0).toLocaleString(), className: 'text-slate-500' },
          { key: 'dispatched', label: 'Dispatched (bags)', format: v => (v || 0).toLocaleString(), className: 'text-red-600 font-semibold' },
          { key: 'over', label: 'Over', format: v => `+${(v || 0).toLocaleString()}`, className: 'text-red-700 font-bold' },
        ]}
      />

      {/* Footer note */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 space-y-1">
        <p className="font-semibold text-slate-700 flex items-center gap-2">
          <Package size={13} /> What this page can and cannot do
        </p>
        <p>✅ Reads every row from farms, customers, products, dispatches, payments, supply payments, farm batches, sales, supplier bills, and dispatch items.</p>
        <p>✅ Computes the "correct" value for each stored aggregate using the same formulas the Dashboard and Farms list already use.</p>
        <p>✅ Shows any row where the stored value disagrees with the computed one by more than {DIFF_THRESHOLD} AFN.</p>
        <p className="text-slate-500 pt-1">❌ Writes nothing. Deletes nothing. Updates nothing. Reconciliation (Phase 3) is a separate step and requires your explicit approval per problem area, plus a fresh backup.</p>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Section component — table with a title, subtitle, empty state, and colored
// per-cell formatting. The `columns[].className` can be a string or a function
// (value) => string, so cells can conditionally colour red/amber based on value.
// -----------------------------------------------------------------------------
function Section({ icon: Icon, title, subtitle, emptyText, rows, columns }) {
  const isEmpty = rows.length === 0
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className={`px-5 py-3 flex items-center gap-2 border-b ${isEmpty ? 'border-green-100 bg-green-50' : 'border-red-100 bg-red-50'}`}>
        {isEmpty ? <CheckCircle2 size={16} className="text-green-600" /> : <AlertTriangle size={16} className="text-red-600" />}
        <div className="flex-1 min-w-0">
          <h3 className={`font-semibold text-sm ${isEmpty ? 'text-green-800' : 'text-red-800'}`}>{title}</h3>
          <p className={`text-xs mt-0.5 ${isEmpty ? 'text-green-700/70' : 'text-red-700/70'}`}>{subtitle}</p>
        </div>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isEmpty ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {isEmpty ? 'OK' : `${rows.length} row${rows.length === 1 ? '' : 's'}`}
        </span>
      </div>

      {isEmpty ? (
        <p className="px-5 py-6 text-center text-sm text-slate-500">{emptyText}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {columns.map(c => (
                  <th key={c.key} className="text-start px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, i) => (
                <tr key={row.id || i} className="hover:bg-slate-50">
                  {columns.map(c => {
                    const raw = row[c.key]
                    const value = c.format ? c.format(raw) : raw
                    const cls = typeof c.className === 'function' ? c.className(raw) : c.className
                    return (
                      <td key={c.key} className={`px-4 py-2 ${cls || ''}`}>{value}</td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
