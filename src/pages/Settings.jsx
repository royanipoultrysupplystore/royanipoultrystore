import { useState } from 'react'
import { Save, Download, Database, Building2, Trash2, AlertTriangle, DollarSign, Coins } from 'lucide-react'
import { supabase } from '../config/supabase'
import { exportMultiSheet } from '../utils/exportExcel'
import { formatDate } from '../utils/dateHelpers'
import toast from 'react-hot-toast'
import { useLanguage } from '../contexts/LanguageContext'
import { useExchangeRate, useCommissionRate } from '../contexts/SettingsContext'

export default function Settings() {
  const { t } = useLanguage()
  const { rate, saveRate } = useExchangeRate()
  const { commissionRate, saveCommissionRate } = useCommissionRate()
  const [rateInput, setRateInput] = useState('')
  const [rateSaving, setRateSaving] = useState(false)
  const [commissionInput, setCommissionInput] = useState('')
  const [commissionSaving, setCommissionSaving] = useState(false)
  const [businessName, setBusinessName] = useState(localStorage.getItem('businessName') || 'Royani Poultry Supply Store')
  const [businessPhone, setBusinessPhone] = useState(localStorage.getItem('businessPhone') || '')
  const [businessAddress, setBusinessAddress] = useState(localStorage.getItem('businessAddress') || '')
  const [lowStockDefault, setLowStockDefault] = useState(localStorage.getItem('lowStockDefault') || '10')
  const [exporting, setExporting] = useState(false)
  const [clearConfirm, setClearConfirm] = useState(null)
  const [confirmText, setConfirmText] = useState('')
  const [clearing, setClearing] = useState(false)
  const [recalculating, setRecalculating] = useState(false)

  function saveSettings(e) {
    e.preventDefault()
    localStorage.setItem('businessName', businessName)
    localStorage.setItem('businessPhone', businessPhone)
    localStorage.setItem('businessAddress', businessAddress)
    localStorage.setItem('lowStockDefault', lowStockDefault)
    toast.success(t('settings.saved'))
  }

  async function exportFullDatabase() {
    setExporting(true)
    try {
      const [products, farms, dispatches, dispatchItems, payments, expenses, stockPurchases] = await Promise.all([
        supabase.from('products').select('*'),
        supabase.from('farms').select('*'),
        supabase.from('dispatches').select('*'),
        supabase.from('dispatch_items').select('*'),
        supabase.from('payments').select('*'),
        supabase.from('expenses').select('*'),
        supabase.from('stock_purchases').select('*'),
      ])
      exportMultiSheet([
        { name: 'Products', data: products.data || [] },
        { name: 'Farms', data: farms.data || [] },
        { name: 'Dispatches', data: dispatches.data || [] },
        { name: 'Dispatch Items', data: dispatchItems.data || [] },
        { name: 'Payments', data: payments.data || [] },
        { name: 'Expenses', data: expenses.data || [] },
        { name: 'Stock Purchases', data: stockPurchases.data || [] },
      ], `royani-backup-${new Date().toISOString().split('T')[0]}`)
      toast.success(t('settings.exportSuccess'))
    } catch {
      toast.error(t('settings.exportFailed'))
    }
    setExporting(false)
  }

  async function clearTransactions() {
    setClearing(true)
    try {
      await supabase.from('dispatch_items').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('sale_items').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('dispatches').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('payments').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('sales').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('supply_payments').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('expenses').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('stock_purchases').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('cash_ledger').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('chicken_deaths').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('market_transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('supplier_dispatches').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('supplier_payments').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('choza_transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      // Commission module — transactional data
      await supabase.from('commission_sales').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('commission_payments').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('commission_car_expenses').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('commission_dealer_payments').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('commission_cars').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('commission_fee_expenses').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('farms').update({ total_debt: 0, advance_payment: 0, total_profit_generated: 0 }).neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('customers').update({ total_debt: 0, total_purchases: 0 }).neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('products').update({ quantity: 0 }).neq('id', '00000000-0000-0000-0000-000000000000')
      toast.success(t('settings.clearSuccess'))
    } catch {
      toast.error(t('settings.error'))
    }
    setClearing(false)
    setClearConfirm(null)
    setConfirmText('')
  }

  async function clearEverything() {
    setClearing(true)
    try {
      // Children before parents (foreign key order)
      await supabase.from('dispatch_items').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('sale_items').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('dispatches').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('payments').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('sales').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('supply_payments').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('expenses').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('stock_purchases').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('supplier_dispatches').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('supplier_payments').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('choza_transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('cash_ledger').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('chicken_deaths').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('market_transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('market_sellers').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      // Commission module — children first, then parents
      await supabase.from('commission_sales').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('commission_payments').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('commission_car_expenses').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('commission_dealer_payments').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('commission_cars').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('commission_fee_expenses').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('commission_customers').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('commission_dealers').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      // Master tables last
      await supabase.from('customers').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('farms').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('suppliers').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      toast.success(t('settings.clearSuccess'))
    } catch {
      toast.error(t('settings.error'))
    }
    setClearing(false)
    setClearConfirm(null)
    setConfirmText('')
  }

  async function recalculateFarmTotals() {
    setRecalculating(true)
    try {
      const { data: farms } = await supabase.from('farms').select('id')
      for (const farm of farms || []) {
        const [dRes, pRes, spRes] = await Promise.all([
          supabase.from('dispatches').select('total_amount, dispatch_items(total_profit)').eq('farm_id', farm.id),
          supabase.from('payments').select('amount').eq('farm_id', farm.id),
          supabase.from('supply_payments').select('amount').eq('farm_id', farm.id),
        ])
        const totalDispatched = (dRes.data || []).reduce((s, d) => s + (d.total_amount || 0), 0)
        const totalPaid = (pRes.data || []).reduce((s, p) => s + (p.amount || 0), 0)
        const totalSupply = (spRes.data || []).reduce((s, sp) => s + (sp.amount || 0), 0)
        const totalProfit = (dRes.data || []).flatMap(d => d.dispatch_items || []).reduce((s, i) => s + (i.total_profit || 0), 0)
        await supabase.from('farms').update({
          total_debt: Math.max(0, totalDispatched + totalSupply - totalPaid),
          total_profit_generated: Math.max(0, totalProfit),
        }).eq('id', farm.id)
      }
      toast.success(t('settings.recalcSuccess'))
    } catch {
      toast.error(t('settings.recalcFailed'))
    }
    setRecalculating(false)
  }

  async function handleSaveRate(e) {
    e.preventDefault()
    const val = parseFloat(rateInput)
    if (!val || val <= 0) return
    setRateSaving(true)
    const result = await saveRate(val)
    setRateSaving(false)
    if (result?.ok) { toast.success(t('settings.rateSaved')); setRateInput('') }
    else toast.error(result?.message || t('settings.error'))
  }

  async function handleSaveCommission(e) {
    e.preventDefault()
    const val = parseFloat(commissionInput)
    if (isNaN(val) || val < 0) return
    setCommissionSaving(true)
    const result = await saveCommissionRate(val)
    setCommissionSaving(false)
    if (result?.ok) { toast.success('Commission rate saved'); setCommissionInput('') }
    else toast.error(result?.message || t('settings.error'))
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Exchange Rate */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign size={18} className="text-amber-500" />
          <h3 className="font-semibold text-slate-700">{t('settings.exchangeRate')}</h3>
        </div>
        <div className="flex items-center gap-3 mb-4 p-3 bg-amber-50 rounded-xl border border-amber-100">
          <div className="text-sm text-slate-500">{t('settings.rateLabel')}:</div>
          <div className="text-xl font-bold text-amber-600">1 USD = {rate} AFN</div>
        </div>
        <form onSubmit={handleSaveRate} className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('settings.usdToAfn')}</label>
            <input
              type="number" min="1" step="0.01"
              value={rateInput}
              onChange={e => setRateInput(e.target.value)}
              placeholder={String(rate)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
          </div>
          <button type="submit" disabled={rateSaving || !rateInput}
            className="flex items-center gap-2 px-5 py-2 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 disabled:opacity-60 transition-colors">
            <Save size={15} /> {rateSaving ? t('common.saving') : t('common.save')}
          </button>
        </form>
        <p className="text-xs text-slate-400 mt-2">{t('settings.rateNote')}</p>
      </div>

      {/* Commission Rate */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
        <div className="flex items-center gap-2 mb-4">
          <Coins size={18} className="text-purple-500" />
          <h3 className="font-semibold text-slate-700">Commission Rate (per chicken)</h3>
        </div>
        <div className="flex items-center gap-3 mb-4 p-3 bg-purple-50 rounded-xl border border-purple-100">
          <div className="text-sm text-slate-500">Current rate:</div>
          <div className="text-xl font-bold text-purple-600">{commissionRate} AFN per sold chicken</div>
        </div>
        <form onSubmit={handleSaveCommission} className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">New rate (AFN per chicken)</label>
            <input
              type="number" min="0" step="0.01"
              value={commissionInput}
              onChange={e => setCommissionInput(e.target.value)}
              placeholder={String(commissionRate)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
          </div>
          <button type="submit" disabled={commissionSaving || !commissionInput}
            className="flex items-center gap-2 px-5 py-2 bg-purple-500 text-white rounded-xl text-sm font-medium hover:bg-purple-600 disabled:opacity-60 transition-colors">
            <Save size={15} /> {commissionSaving ? t('common.saving') : t('common.save')}
          </button>
        </form>
        <p className="text-xs text-slate-400 mt-2">
          ⚠ Changing this only affects <strong>new cars</strong>. Each car snapshots its rate when created, so historical commission stays accurate.
        </p>
      </div>

      {/* Business Info */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
        <div className="flex items-center gap-2 mb-4">
          <Building2 size={18} className="text-[#1B3A5C]" />
          <h3 className="font-semibold text-slate-700">{t('settings.businessInfo')}</h3>
        </div>
        <form onSubmit={saveSettings} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('settings.businessName')}</label>
            <input value={businessName} onChange={e => setBusinessName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('settings.phone')}</label>
              <input value={businessPhone} onChange={e => setBusinessPhone(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('settings.lowStockDefault')}</label>
              <input type="number" min="0" value={lowStockDefault} onChange={e => setLowStockDefault(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('settings.address')}</label>
            <textarea rows={2} value={businessAddress} onChange={e => setBusinessAddress(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30 resize-none" />
          </div>
          <button type="submit" className="flex items-center gap-2 px-5 py-2 bg-[#1B3A5C] text-white rounded-xl text-sm font-medium hover:bg-[#2E86AB] transition-colors">
            <Save size={15} /> {t('settings.saveSettings')}
          </button>
        </form>
      </div>

      {/* Data Export */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
        <div className="flex items-center gap-2 mb-4">
          <Database size={18} className="text-[#1B3A5C]" />
          <h3 className="font-semibold text-slate-700">{t('settings.dataBackup')}</h3>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={exportFullDatabase} disabled={exporting}
            className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-60 transition-colors">
            <Download size={15} /> {exporting ? t('settings.exporting') : t('settings.exportDb')}
          </button>
          <button onClick={recalculateFarmTotals} disabled={recalculating}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#2E86AB] text-white rounded-xl text-sm font-medium hover:bg-[#1B3A5C] disabled:opacity-60 transition-colors">
            <Database size={15} /> {recalculating ? t('settings.recalculating') : t('settings.recalculate')}
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-2">{t('settings.recalculateNote')}</p>
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-red-200">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle size={18} className="text-red-500" />
          <h3 className="font-semibold text-red-600">{t('settings.dangerZone')}</h3>
        </div>
        <p className="text-xs text-slate-400 mb-5">{t('settings.dangerNote')}</p>

        <div className="space-y-4">
          <div className="border border-slate-200 rounded-xl p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-700">{t('settings.clearTransactions')}</p>
                <p className="text-xs text-slate-400 mt-0.5">{t('settings.clearTransactionsDesc')}</p>
              </div>
              <button onClick={() => { setClearConfirm('transactions'); setConfirmText('') }}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50">
                <Trash2 size={14} /> {t('settings.clearBtn')}
              </button>
            </div>
          </div>

          <div className="border border-red-200 rounded-xl p-4 bg-red-50">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-red-700">{t('settings.clearEverything')}</p>
                <p className="text-xs text-red-500 mt-0.5">{t('settings.clearEverythingDesc')}</p>
              </div>
              <button onClick={() => { setClearConfirm('everything'); setConfirmText('') }}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700">
                <Trash2 size={14} /> {t('settings.wipeAll')}
              </button>
            </div>
          </div>
        </div>

        {clearConfirm && (
          <div className="mt-4 border-2 border-red-300 rounded-xl p-4 bg-red-50 space-y-3">
            <p className="text-sm font-semibold text-red-700">
              {clearConfirm === 'transactions' ? t('settings.clearTransactions') : t('settings.clearEverything')}
            </p>
            <p className="text-xs text-red-600">{t('settings.typeDelete')}</p>
            <input value={confirmText} onChange={e => setConfirmText(e.target.value)}
              placeholder={t('settings.typeDeletePlaceholder')}
              className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-300 bg-white" />
            <div className="flex gap-2">
              <button onClick={() => { setClearConfirm(null); setConfirmText('') }}
                className="px-4 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
                {t('common.cancel')}
              </button>
              <button disabled={confirmText !== 'DELETE' || clearing}
                onClick={clearConfirm === 'transactions' ? clearTransactions : clearEverything}
                className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed">
                {clearing ? t('settings.clearing') : t('settings.yesNow')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* System Info */}
      <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
        <h3 className="font-semibold text-slate-600 mb-3 text-sm">{t('settings.systemInfo')}</h3>
        <div className="space-y-2 text-sm text-slate-500">
          <div className="flex justify-between"><span>{t('settings.version')}</span><span className="font-medium text-slate-700">v1.0.0</span></div>
          <div className="flex justify-between"><span>{t('settings.database')}</span><span className="font-medium text-slate-700">Supabase PostgreSQL</span></div>
          <div className="flex justify-between"><span>{t('settings.currency')}</span><span className="font-medium text-slate-700">AFN (Afghan Afghani)</span></div>
          <div className="flex justify-between"><span>{t('settings.lastExport')}</span><span className="font-medium text-slate-700">{formatDate(new Date().toISOString())}</span></div>
        </div>
      </div>
    </div>
  )
}
