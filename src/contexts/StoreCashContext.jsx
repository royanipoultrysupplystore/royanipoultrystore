import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../config/supabase'
import toast from 'react-hot-toast'

// Store Cash — a single running balance for the physical cash at the shop.
// Every AFN in/out that involves the till writes a row here so the client can
// always answer "how much cash is in the drawer right now?"
//
// Rows are always stored with a positive `amount` and a `type` flag that says
// which direction the cash moved. Balance = Σ(in + opening + adjustment_in)
// − Σ(out + adjustment_out).
const StoreCashContext = createContext(null)

export function StoreCashProvider({ children }) {
  const [balance, setBalance] = useState(0)          // AFN
  const [balanceUsd, setBalanceUsd] = useState(0)    // USD
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  // Balance is computed per-currency. Every row carries a `currency` flag
  // ('AFN' | 'USD') from the DB; rows without a currency default to AFN so
  // pre-migration data stays counted in the AFN column.
  const refetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('store_cash_transactions')
      .select('*')
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) { toast.error('Failed to load store cash'); setLoading(false); return }
    const rows = data || []
    setTransactions(rows)
    let sumAfn = 0, sumUsd = 0
    for (const t of rows) {
      const amt = parseFloat(t.amount) || 0
      const inRow = t.type === 'in' || t.type === 'opening_balance' || t.type === 'adjustment_in'
      const outRow = t.type === 'out' || t.type === 'adjustment_out'
      const signed = inRow ? amt : outRow ? -amt : 0
      if ((t.currency || 'AFN') === 'USD') sumUsd += signed
      else sumAfn += signed
    }
    setBalance(sumAfn)
    setBalanceUsd(sumUsd)
    setLoading(false)
  }, [])

  useEffect(() => { refetch() }, [refetch])

  // Cash flowing INTO the till (farm payment received, walk-in sale collected, etc.).
  // Accepts an optional currency ('AFN' by default) so callers can push USD
  // cash into a parallel USD balance.
  async function recordIn({ amount, source, reference_id = null, note = null, date, currency = 'AFN' }) {
    const amt = parseFloat(amount) || 0
    if (amt <= 0) return true
    const { error } = await supabase.from('store_cash_transactions').insert([{
      amount: amt, type: 'in', source, reference_id, note, currency,
      transaction_date: date || new Date().toISOString().slice(0, 10),
    }])
    if (error) { toast.error(error.message); return false }
    await refetch()
    return true
  }

  // Cash flowing OUT of the till (expense paid, supplier payment, etc.).
  async function recordOut({ amount, source, reference_id = null, note = null, date, currency = 'AFN' }) {
    const amt = parseFloat(amount) || 0
    if (amt <= 0) return true
    const { error } = await supabase.from('store_cash_transactions').insert([{
      amount: amt, type: 'out', source, reference_id, note, currency,
      transaction_date: date || new Date().toISOString().slice(0, 10),
    }])
    if (error) { toast.error(error.message); return false }
    await refetch()
    return true
  }

  // Remove any store-cash rows linked to an originating transaction (used when
  // that transaction is edited or deleted so the till stays in sync).
  async function removeByReference({ source, reference_id }) {
    if (!reference_id) return true
    const { error } = await supabase.from('store_cash_transactions')
      .delete()
      .eq('source', source)
      .eq('reference_id', reference_id)
    if (error) { toast.error(error.message); return false }
    await refetch()
    return true
  }

  // Set (or replace) the one-time opening balance. Idempotent — deletes any
  // existing opening_balance row first, so the client can correct it later
  // without stacking multiple opening entries.
  async function setOpeningBalance({ amount, date, note, currency = 'AFN' }) {
    const amt = parseFloat(amount) || 0
    // Only delete the opening row FOR THIS CURRENCY — the other currency's
    // opening balance stays untouched.
    await supabase.from('store_cash_transactions').delete()
      .eq('type', 'opening_balance').eq('currency', currency)
    if (amt > 0) {
      const { error } = await supabase.from('store_cash_transactions').insert([{
        amount: amt, type: 'opening_balance', source: 'opening', currency,
        note: note || 'Opening balance',
        transaction_date: date || new Date().toISOString().slice(0, 10),
      }])
      if (error) { toast.error(error.message); return false }
    }
    await refetch()
    return true
  }

  // Manual +/− correction. Never touches an originating transaction — pure
  // adjustment against the till. Positive = cash added, negative = cash removed.
  async function recordAdjustment({ amount, direction, note, date, currency = 'AFN' }) {
    const amt = parseFloat(amount) || 0
    if (amt <= 0) return true
    const type = direction === 'in' ? 'adjustment_in' : 'adjustment_out'
    const { error } = await supabase.from('store_cash_transactions').insert([{
      amount: amt, type, source: 'manual', note, currency,
      transaction_date: date || new Date().toISOString().slice(0, 10),
    }])
    if (error) { toast.error(error.message); return false }
    await refetch()
    return true
  }

  // Fresh-start reset — for shops that made data-entry mistakes and just want
  // to say "the drawer has X right now, start counting from here". Wipes ALL
  // store_cash rows and writes a single opening_balance row with the amount.
  // Doesn't touch any other table (payments, expenses, supplier_payments, …).
  async function resetToCurrentBalance({ amount, date, note, currency = 'AFN' }) {
    const amt = parseFloat(amount) || 0
    // Only wipe the currency being reset — the other currency's history stays.
    const { error: delErr } = await supabase.from('store_cash_transactions').delete().eq('currency', currency)
    if (delErr) { toast.error(delErr.message); return false }
    if (amt !== 0) {
      const { error } = await supabase.from('store_cash_transactions').insert([{
        amount: Math.abs(amt),
        type: amt >= 0 ? 'opening_balance' : 'adjustment_out',
        source: 'opening', currency,
        note: note || 'Reset — actual cash on hand',
        transaction_date: date || new Date().toISOString().slice(0, 10),
      }])
      if (error) { toast.error(error.message); return false }
    }
    await refetch()
    return true
  }

  async function deleteRow(id) {
    const { error } = await supabase.from('store_cash_transactions').delete().eq('id', id)
    if (error) { toast.error(error.message); return false }
    await refetch()
    return true
  }

  return (
    <StoreCashContext.Provider value={{
      balance, balanceUsd, transactions, loading, refetch,
      recordIn, recordOut, removeByReference, setOpeningBalance, recordAdjustment, resetToCurrentBalance, deleteRow,
    }}>
      {children}
    </StoreCashContext.Provider>
  )
}

export function useStoreCash() {
  const ctx = useContext(StoreCashContext)
  if (!ctx) throw new Error('useStoreCash must be used inside <StoreCashProvider>')
  return ctx
}
