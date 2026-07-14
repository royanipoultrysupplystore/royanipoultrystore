import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, ShieldCheck, RefreshCw, ArrowLeftRight, Building2, Wheat, Users, Info, RotateCcw, Undo2, Zap } from 'lucide-react'
import { supabase } from '../config/supabase'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency } from '../utils/formatCurrency'
import { formatDate } from '../utils/dateHelpers'
import { lf } from '../utils/localizedField'
import toast from 'react-hot-toast'

// -----------------------------------------------------------------------------
// Data Reconcile — Phase 3.
//
// Fixes drifted stored aggregates by overwriting them with values computed live
// from the source-of-truth tables. Every write is snapshotted into
// integrity_backups first so any batch is undoable.
//
// Preview is default. To Apply a section the admin must type an exact
// confirmation phrase per section. Sections are independent — Farms fix does
// nothing to Customers, and so on.
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

const DIFF_THRESHOLD = 1

const CONFIRM_PHRASES = {
  farms: 'FIX FARM DEBT',
  customers: 'FIX CUSTOMER DEBT',
  products: 'FIX PRODUCT QUANTITY',
}

export default function DataReconcile() {
  const { lang } = useLanguage()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(null) // 'farms' | 'customers' | 'products' | null
  const [report, setReport] = useState(null)
  const [error, setError] = useState(null)
  const [confirmText, setConfirmText] = useState({ farms: '', customers: '', products: '' })
  const [history, setHistory] = useState([])
  const [undoing, setUndoing] = useState(null)
  const [recomputingFarms, setRecomputingFarms] = useState(false)
  const [recomputingCustomers, setRecomputingCustomers] = useState(false)

  async function runDiagnostics() {
    setLoading(true)
    setError(null)
    try {
      const [
        farms, customers, products,
        dispatches, dispatchItems, payments, supplyPayments, farmBatches,
        sales, supplierDispatches,
      ] = await Promise.all([
        fetchAllPaged('farms', 'id, name, name_fa, name_ps, total_debt, is_active'),
        fetchAllPaged('customers', 'id, name, total_debt'),
        fetchAllPaged('products', 'id, name, type, quantity'),
        fetchAllPaged('dispatches', 'farm_id, total_amount'),
        fetchAllPaged('dispatch_items', 'supplier_dispatch_id, product_id, quantity, dispatches(farm_id)'),
        fetchAllPaged('payments', 'farm_id, amount'),
        fetchAllPaged('supply_payments', 'farm_id, amount'),
        fetchAllPaged('farm_batches', 'farm_id, initial_chicken_count, price_per_chicken'),
        fetchAllPaged('sales', 'customer_id, remaining'),
        fetchAllPaged('supplier_dispatches', 'id, product_id, quantity'),
      ])

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
      const farmDebtDrift = []
      for (const f of farms) {
        const stored = f.total_debt || 0
        const computed = Math.max(0, (dispByFarm[f.id] || 0) + (supplyByFarm[f.id] || 0) + (chickenByFarm[f.id] || 0) - (paidByFarm[f.id] || 0))
        const diff = stored - computed
        if (Math.abs(diff) > DIFF_THRESHOLD) {
          farmDebtDrift.push({ id: f.id, name: lf(f, 'name', lang), stored, computed, diff, is_active: f.is_active })
        }
      }
      farmDebtDrift.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))

      const remainByCustomer = {}
      for (const s of sales) {
        if (!s.customer_id) continue
        remainByCustomer[s.customer_id] = (remainByCustomer[s.customer_id] || 0) + (s.remaining || 0)
      }
      const customerDebtDrift = []
      for (const c of customers) {
        const stored = c.total_debt || 0
        const computed = remainByCustomer[c.id] || 0
        const diff = stored - computed
        if (Math.abs(diff) > DIFF_THRESHOLD) {
          customerDebtDrift.push({ id: c.id, name: c.name, stored, computed, diff })
        }
      }
      customerDebtDrift.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))

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
        if (p.type !== 'meel') continue
        const stored = p.quantity || 0
        const computed = remainingByProduct[p.id] || 0
        const diff = stored - computed
        if (Math.abs(diff) > DIFF_THRESHOLD) {
          productQtyDrift.push({ id: p.id, name: p.name, stored, computed, diff })
        }
      }
      productQtyDrift.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))

      setReport({ farmDebtDrift, customerDebtDrift, productQtyDrift })
    } catch (err) {
      console.error(err)
      setError(err.message || 'Diagnostics failed')
    }
    setLoading(false)
  }

  async function loadHistory() {
    const { data } = await supabase
      .from('integrity_backups')
      .select('batch_id, section, reconciled_at, reconciled_by, undone_at')
      .order('reconciled_at', { ascending: false })
      .limit(500)
    if (!data) return
    const grouped = {}
    for (const row of data) {
      if (!grouped[row.batch_id]) {
        grouped[row.batch_id] = {
          batch_id: row.batch_id,
          section: row.section,
          reconciled_at: row.reconciled_at,
          reconciled_by: row.reconciled_by,
          undone_at: row.undone_at,
          count: 0,
        }
      }
      grouped[row.batch_id].count += 1
    }
    setHistory(Object.values(grouped).sort((a, b) => (b.reconciled_at || '').localeCompare(a.reconciled_at || '')))
  }

  useEffect(() => { runDiagnostics(); loadHistory() }, [])

  async function applySection(section) {
    if (confirmText[section] !== CONFIRM_PHRASES[section]) {
      toast.error(`Type "${CONFIRM_PHRASES[section]}" to confirm`)
      return
    }
    const rows =
      section === 'farms' ? report.farmDebtDrift :
      section === 'customers' ? report.customerDebtDrift :
      report.productQtyDrift
    if (rows.length === 0) return

    setApplying(section)
    const batchId = crypto.randomUUID()
    const rpc =
      section === 'farms' ? 'reconcile_farm_debt' :
      section === 'customers' ? 'reconcile_customer_debt' :
      'reconcile_product_quantity'
    const idParam =
      section === 'farms' ? 'p_farm_id' :
      section === 'customers' ? 'p_customer_id' :
      'p_product_id'
    const valueParam =
      section === 'products' ? 'p_new_qty' : 'p_new_debt'

    let success = 0
    let failed = 0
    for (const row of rows) {
      const { error: err } = await supabase.rpc(rpc, {
        [idParam]: row.id,
        [valueParam]: row.computed,
        p_batch_id: batchId,
        p_user_name: user?.name || user?.username || 'admin',
      })
      if (err) { failed += 1; console.error(err) }
      else success += 1
    }

    if (failed === 0) {
      toast.success(`Fixed ${success} row${success === 1 ? '' : 's'} in ${section}`)
    } else {
      toast.error(`${success} fixed, ${failed} failed. Batch ${batchId.slice(0, 8)} is undoable.`)
    }
    setConfirmText(c => ({ ...c, [section]: '' }))
    setApplying(null)
    await runDiagnostics()
    await loadHistory()
  }

  // Phase 4 — asks the DB to recompute every farm's total_debt + total_profit
  // from source tables via the recompute_all_farms() SQL function. Triggers
  // then keep them correct forever going forward. Only run this ONCE after
  // installing phase4_farm_triggers.sql.
  async function handleRecomputeAllFarms() {
    setRecomputingFarms(true)
    const { data, error: err } = await supabase.rpc('recompute_all_farms')
    if (err) {
      toast.error(err.message || 'Recompute failed. Did you run phase4_farm_triggers.sql?')
    } else {
      toast.success(`Recomputed ${data || 0} farm${data === 1 ? '' : 's'} — every farm's stored debt now matches truth.`)
    }
    setRecomputingFarms(false)
    await runDiagnostics()
  }

  // Phase 4 (part 2) — bulk-fixes historical drift for customers via the
  // recompute_all_customers() SQL function installed by
  // phase4_customer_triggers.sql. Triggers then keep them correct forever.
  async function handleRecomputeAllCustomers() {
    setRecomputingCustomers(true)
    const { data, error: err } = await supabase.rpc('recompute_all_customers')
    if (err) {
      toast.error(err.message || 'Recompute failed. Did you run phase4_customer_triggers.sql?')
    } else {
      toast.success(`Recomputed ${data || 0} customer${data === 1 ? '' : 's'} — every customer's stored debt now matches truth.`)
    }
    setRecomputingCustomers(false)
    await runDiagnostics()
  }

  async function handleUndo(batchId) {
    setUndoing(batchId)
    const { data, error: err } = await supabase.rpc('undo_reconcile_batch', { p_batch_id: batchId })
    if (err) toast.error(err.message)
    else toast.success(`Undone ${data || 0} row${data === 1 ? '' : 's'}`)
    setUndoing(null)
    await runDiagnostics()
    await loadHistory()
  }

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
        <p className="font-semibold">Failed</p>
        <p className="text-sm mt-1">{error}</p>
        <button onClick={runDiagnostics} className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
          Retry
        </button>
      </div>
    )
  }

  const r = report

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-linear-to-r from-[#1B3A5C] to-[#2E86AB] text-white rounded-2xl p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck size={20} />
              <h2 className="text-xl font-bold">Data Reconcile</h2>
              <span className="text-xs bg-amber-400/40 px-2 py-0.5 rounded-full font-semibold">WRITES ENABLED</span>
            </div>
            <p className="text-sm text-white/85">
              Fixes drifted stored values by overwriting them with live-computed truth. Every write is snapshotted first so it's undoable.
            </p>
          </div>
          <button onClick={runDiagnostics} disabled={loading || applying}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-sm font-medium disabled:opacity-50">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Re-scan
          </button>
        </div>
      </div>

      {/* Phase 4 recompute-all button — one-shot fix for every farm.
          After phase4_farm_triggers.sql is installed, this button forces
          the DB to recompute every farm's aggregates. Triggers then keep
          them correct forever. */}
      <div className="bg-linear-to-r from-emerald-500 to-teal-500 text-white rounded-2xl p-5 shadow-md">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Zap size={18} />
              <h3 className="font-bold">Phase 4 — Drift-proof farms</h3>
            </div>
            <p className="text-sm text-white/90 max-w-2xl">
              After you run <code className="bg-black/20 px-1.5 py-0.5 rounded text-xs">phase4_farm_triggers.sql</code> in Supabase, click below once. Every farm's stored total_debt + total_profit will be recomputed to match live truth, and DB triggers will keep them correct on every future dispatch, payment, supply payment, farm batch, and dispatch item — no application code required, no drift possible.
            </p>
          </div>
          <button
            onClick={handleRecomputeAllFarms}
            disabled={recomputingFarms}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-emerald-700 text-sm font-semibold hover:bg-emerald-50 disabled:opacity-60 whitespace-nowrap"
          >
            {recomputingFarms ? (
              <>
                <div className="w-4 h-4 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                Recomputing...
              </>
            ) : (
              <>
                <Zap size={14} /> Recompute all farms
              </>
            )}
          </button>
        </div>
      </div>

      {/* Phase 4 (part 2) — customer recompute-all button. */}
      <div className="bg-linear-to-r from-emerald-500 to-teal-500 text-white rounded-2xl p-5 shadow-md">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Zap size={18} />
              <h3 className="font-bold">Phase 4 — Drift-proof customers</h3>
            </div>
            <p className="text-sm text-white/90 max-w-2xl">
              After you run <code className="bg-black/20 px-1.5 py-0.5 rounded text-xs">phase4_customer_triggers.sql</code> in Supabase, click below once. Every walk-in customer's stored total_debt, total_debt_usd, and total_purchases will be recomputed from the raw sales rows, and DB triggers will keep them correct on every future sale, edit, and payment — AFN and USD both.
            </p>
          </div>
          <button
            onClick={handleRecomputeAllCustomers}
            disabled={recomputingCustomers}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-emerald-700 text-sm font-semibold hover:bg-emerald-50 disabled:opacity-60 whitespace-nowrap"
          >
            {recomputingCustomers ? (
              <>
                <div className="w-4 h-4 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                Recomputing...
              </>
            ) : (
              <>
                <Zap size={14} /> Recompute all customers
              </>
            )}
          </button>
        </div>
      </div>

      {/* Section: Farms — SAFE (still available as row-by-row fallback) */}
      <ReconcileSection
        icon={Building2}
        title="Farm Debt (per-row fallback)"
        safetyLabel="Safe"
        safetyColor="green"
        subtitle="Row-by-row alternative if you don't want to run the DB-wide recompute. Overwrites farms.total_debt with max(0, Σ dispatches + Σ supply + Σ farm_batches − Σ payments). This math is the source of truth — the stored column drifts when a dispatch or payment is edited/deleted."
        warning={null}
        rows={r.farmDebtDrift}
        columns={[
          { key: 'name', label: 'Farm', className: 'font-medium text-slate-700' },
          { key: 'stored', label: 'Stored (before)', format: formatCurrency, className: 'text-slate-400' },
          { key: 'arrow', label: '', format: () => '→', className: 'text-slate-400' },
          { key: 'computed', label: 'New (after)', format: formatCurrency, className: 'text-green-700 font-bold' },
          { key: 'diff', label: 'Change', format: v => (v > 0 ? '−' : '+') + formatCurrency(Math.abs(v)), className: v => v > 0 ? 'text-red-600' : 'text-green-600' },
        ]}
        phrase={CONFIRM_PHRASES.farms}
        confirmText={confirmText.farms}
        setConfirmText={t => setConfirmText(c => ({ ...c, farms: t }))}
        onApply={() => applySection('farms')}
        applying={applying === 'farms'}
        disabled={applying !== null}
      />

      {/* Section: Customers — CAUTION */}
      <ReconcileSection
        icon={Users}
        title="Walk-in Customer Debt"
        safetyLabel="Caution"
        safetyColor="amber"
        subtitle="Overwrites customers.total_debt with Σ sales.remaining for that customer."
        warning="If a customer already paid in cash but the sale was never marked as paid, this fix will make them look like they owe money when they don't. Confirm with Royani that these unpaid sales are actually unpaid before applying."
        rows={r.customerDebtDrift}
        columns={[
          { key: 'name', label: 'Customer', className: 'font-medium text-slate-700' },
          { key: 'stored', label: 'Stored (before)', format: formatCurrency, className: 'text-slate-400' },
          { key: 'arrow', label: '', format: () => '→', className: 'text-slate-400' },
          { key: 'computed', label: 'New (after)', format: formatCurrency, className: 'text-amber-700 font-bold' },
          { key: 'diff', label: 'Change', format: v => (v > 0 ? '−' : '+') + formatCurrency(Math.abs(v)), className: v => v > 0 ? 'text-red-600' : 'text-green-600' },
        ]}
        phrase={CONFIRM_PHRASES.customers}
        confirmText={confirmText.customers}
        setConfirmText={t => setConfirmText(c => ({ ...c, customers: t }))}
        onApply={() => applySection('customers')}
        applying={applying === 'customers'}
        disabled={applying !== null}
      />

      {/* Section: Products — CAUTION */}
      <ReconcileSection
        icon={Wheat}
        title="Meel Product Quantity"
        safetyLabel="Physical count first"
        safetyColor="amber"
        subtitle="Overwrites products.quantity with Σ (bill.quantity − dispatched) — the same math the Dashboard's Meel Stock Value card already uses."
        warning="This assumes every bag ever bought or dispatched was recorded correctly. If bags were lost, damaged, or dispatched outside the system, the physical count in the shop is the real truth — not this calculation. Recommendation: physically count the bags first, and only apply if the physical count matches the new value below."
        rows={r.productQtyDrift}
        columns={[
          { key: 'name', label: 'Product', className: 'font-medium text-slate-700' },
          { key: 'stored', label: 'Stored (before)', format: v => `${(v || 0).toLocaleString()} bags`, className: 'text-slate-400' },
          { key: 'arrow', label: '', format: () => '→', className: 'text-slate-400' },
          { key: 'computed', label: 'New (after)', format: v => `${(v || 0).toLocaleString()} bags`, className: 'text-amber-700 font-bold' },
          { key: 'diff', label: 'Change', format: v => (v > 0 ? '−' : '+') + `${Math.abs(v || 0).toLocaleString()} bags`, className: v => v > 0 ? 'text-red-600' : 'text-green-600' },
        ]}
        phrase={CONFIRM_PHRASES.products}
        confirmText={confirmText.products}
        setConfirmText={t => setConfirmText(c => ({ ...c, products: t }))}
        onApply={() => applySection('products')}
        applying={applying === 'products'}
        disabled={applying !== null}
      />

      {/* Batch history — with undo */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
          <RotateCcw size={16} className="text-slate-500" />
          <h3 className="font-semibold text-sm text-slate-700">Reconciliation history</h3>
          <span className="text-xs text-slate-400 ms-auto">Newest first — click Undo to restore snapshotted values.</span>
        </div>
        {history.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-slate-500">No reconciliation batches yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-start px-4 py-2 text-xs font-semibold text-slate-500 uppercase">When</th>
                  <th className="text-start px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Section</th>
                  <th className="text-start px-4 py-2 text-xs font-semibold text-slate-500 uppercase">By</th>
                  <th className="text-start px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Rows</th>
                  <th className="text-start px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Status</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map(h => (
                  <tr key={h.batch_id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-slate-500 text-xs">{new Date(h.reconciled_at).toLocaleString()}</td>
                    <td className="px-4 py-2">
                      <span className="text-xs font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">{h.section}</span>
                    </td>
                    <td className="px-4 py-2 text-slate-600">{h.reconciled_by || '—'}</td>
                    <td className="px-4 py-2 font-semibold text-slate-700">{h.count}</td>
                    <td className="px-4 py-2">
                      {h.undone_at
                        ? <span className="text-xs text-slate-500">Undone {new Date(h.undone_at).toLocaleString()}</span>
                        : <span className="text-xs text-green-700 font-medium">Applied</span>}
                    </td>
                    <td className="px-4 py-2 text-end">
                      {!h.undone_at && (
                        <button
                          onClick={() => handleUndo(h.batch_id)}
                          disabled={undoing === h.batch_id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200 disabled:opacity-50"
                        >
                          <Undo2 size={12} /> {undoing === h.batch_id ? 'Undoing...' : 'Undo'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function ReconcileSection({
  icon: Icon, title, safetyLabel, safetyColor, subtitle, warning,
  rows, columns, phrase, confirmText, setConfirmText, onApply, applying, disabled,
}) {
  const isEmpty = rows.length === 0
  const canApply = confirmText === phrase && !applying && !disabled
  const safetyColorMap = {
    green: 'bg-green-100 text-green-800',
    amber: 'bg-amber-100 text-amber-800',
    red:   'bg-red-100 text-red-800',
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className={`px-5 py-3 flex items-start gap-3 border-b ${isEmpty ? 'border-green-100 bg-green-50' : 'border-slate-100'}`}>
        <Icon size={18} className={isEmpty ? 'text-green-600 mt-0.5' : 'text-slate-500 mt-0.5'} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-slate-800">{title}</h3>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${safetyColorMap[safetyColor]}`}>
              {safetyLabel}
            </span>
            {isEmpty && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-800 inline-flex items-center gap-1">
                <CheckCircle2 size={10} /> nothing to fix
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
        </div>
      </div>

      {isEmpty ? (
        <p className="px-5 py-6 text-center text-sm text-slate-500">Every row is already in sync — no fix needed.</p>
      ) : (
        <>
          {warning && (
            <div className="mx-5 mt-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex gap-2 text-xs text-amber-800">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <p>{warning}</p>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {columns.map(c => (
                    <th key={c.key} className="text-start px-4 py-2 text-xs font-semibold text-slate-500 uppercase">{c.label}</th>
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
                      return <td key={c.key} className={`px-4 py-2 ${cls || ''}`}>{value}</td>
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Type <span className="font-mono bg-white border border-slate-300 px-1.5 py-0.5 rounded text-[11px]">{phrase}</span> to enable Apply
              </label>
              <input
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder={phrase}
                autoComplete="off"
                dir="ltr"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
              />
            </div>
            <button
              onClick={onApply}
              disabled={!canApply}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
                canApply
                  ? 'bg-[#1B3A5C] text-white hover:bg-[#2E86AB]'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              {applying ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <ArrowLeftRight size={14} />
                  Apply fix ({rows.length} row{rows.length === 1 ? '' : 's'})
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
