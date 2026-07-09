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
  const [balance, setBalance] = useState(0)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

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
    let sum = 0
    for (const t of rows) {
      const amt = parseFloat(t.amount) || 0
      if (t.type === 'in' || t.type === 'opening_balance' || t.type === 'adjustment_in') sum += amt
      else if (t.type === 'out' || t.type === 'adjustment_out') sum -= amt
    }
    setBalance(sum)
    setLoading(false)
  }, [])

  useEffect(() => { refetch() }, [refetch])

  // Cash flowing INTO the till (farm payment received, walk-in sale collected, etc.).
  async function recordIn({ amount, source, reference_id = null, note = null, date }) {
    const amt = parseFloat(amount) || 0
    if (amt <= 0) return true
    const { error } = await supabase.from('store_cash_transactions').insert([{
      amount: amt, type: 'in', source, reference_id, note, transaction_date: date || new Date().toISOString().slice(0, 10),
    }])
    if (error) { toast.error(error.message); return false }
    await refetch()
    return true
  }

  // Cash flowing OUT of the till (expense paid, supplier payment, etc.).
  async function recordOut({ amount, source, reference_id = null, note = null, date }) {
    const amt = parseFloat(amount) || 0
    if (amt <= 0) return true
    const { error } = await supabase.from('store_cash_transactions').insert([{
      amount: amt, type: 'out', source, reference_id, note, transaction_date: date || new Date().toISOString().slice(0, 10),
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
  async function setOpeningBalance({ amount, date, note }) {
    const amt = parseFloat(amount) || 0
    await supabase.from('store_cash_transactions').delete().eq('type', 'opening_balance')
    if (amt > 0) {
      const { error } = await supabase.from('store_cash_transactions').insert([{
        amount: amt, type: 'opening_balance', source: 'opening', note: note || 'Opening balance', transaction_date: date || new Date().toISOString().slice(0, 10),
      }])
      if (error) { toast.error(error.message); return false }
    }
    await refetch()
    return true
  }

  // Manual +/− correction. Never touches an originating transaction — pure
  // adjustment against the till. Positive = cash added, negative = cash removed.
  async function recordAdjustment({ amount, direction, note, date }) {
    const amt = parseFloat(amount) || 0
    if (amt <= 0) return true
    const type = direction === 'in' ? 'adjustment_in' : 'adjustment_out'
    const { error } = await supabase.from('store_cash_transactions').insert([{
      amount: amt, type, source: 'manual', note, transaction_date: date || new Date().toISOString().slice(0, 10),
    }])
    if (error) { toast.error(error.message); return false }
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
      balance, transactions, loading, refetch,
      recordIn, recordOut, removeByReference, setOpeningBalance, recordAdjustment, deleteRow,
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
