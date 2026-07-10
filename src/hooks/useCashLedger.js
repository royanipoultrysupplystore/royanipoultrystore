import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../config/supabase'
import toast from 'react-hot-toast'
import { useLanguage } from '../contexts/LanguageContext'

export function useCashLedger() {
  const { t } = useLanguage()
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('cash_ledger')
      .select('*')
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) toast.error(t('cashLedger.loadFailed'))
    else setTransactions(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  async function addTransaction(data) {
    const { data: created, error } = await supabase.from('cash_ledger').insert([{
      person_name: data.person_name.trim(),
      phone: data.phone?.trim() || null,
      amount: parseFloat(data.amount),
      type: data.type,
      note: data.note?.trim() || null,
      transaction_date: data.transaction_date,
    }]).select().single()
    if (error) { toast.error(error.message); return null }
    toast.success(t('cashLedger.added'))
    await fetch()
    return created
  }

  async function updateTransaction(id, data) {
    const { error } = await supabase.from('cash_ledger').update({
      person_name: data.person_name.trim(),
      phone: data.phone?.trim() || null,
      amount: parseFloat(data.amount),
      type: data.type,
      note: data.note?.trim() || null,
      transaction_date: data.transaction_date,
    }).eq('id', id)
    if (error) { toast.error(error.message); return false }
    toast.success(t('cashLedger.updated'))
    await fetch()
    return true
  }

  async function deleteTransaction(id) {
    const { error } = await supabase.from('cash_ledger').delete().eq('id', id)
    if (error) { toast.error(error.message); return false }
    toast.success(t('cashLedger.deleted'))
    await fetch()
    return true
  }

  // Group by person (case-insensitive)
  const personMap = {}
  for (const tx of transactions) {
    const key = tx.person_name.trim().toLowerCase()
    if (!personMap[key]) {
      personMap[key] = { name: tx.person_name.trim(), phone: tx.phone, lent: 0, borrowed: 0, transactions: [] }
    }
    if (tx.type === 'lent') personMap[key].lent += parseFloat(tx.amount) || 0
    else personMap[key].borrowed += parseFloat(tx.amount) || 0
    personMap[key].transactions.push(tx)
    if (tx.phone) personMap[key].phone = tx.phone
  }

  const persons = Object.values(personMap).sort((a, b) =>
    Math.abs(b.lent - b.borrowed) - Math.abs(a.lent - a.borrowed)
  )

  // Summary must sum PER-PERSON NET balances, not gross transactions.
  // Gross totals double-count settled amounts: e.g. a person we lent 100k
  // who later paid us back 50k (recorded as a "lent" repayment reducing
  // their debt) would have their card correctly show net 50k receivable,
  // but the old gross sum added 100k to "They Owe Us" AND another 100k
  // to "We Owe Them" for the borrow leg, wildly overstating both cards.
  // Net-first collapses each person to a single direction before summing.
  const totalLent     = persons.reduce((s, p) => s + Math.max(0,  (p.lent || 0) - (p.borrowed || 0)), 0)
  const totalBorrowed = persons.reduce((s, p) => s + Math.max(0,  (p.borrowed || 0) - (p.lent || 0)), 0)

  return { transactions, persons, loading, totalLent, totalBorrowed, addTransaction, updateTransaction, deleteTransaction, refetch: fetch }
}
