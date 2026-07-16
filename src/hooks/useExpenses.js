import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../config/supabase'
import toast from 'react-hot-toast'
import { useLanguage } from '../contexts/LanguageContext'

export function useExpenses() {
  const { t } = useLanguage()
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .order('expense_date', { ascending: false })
    if (error) toast.error(t('expenses.loadFailed'))
    else setExpenses(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  // Returns the inserted row (not a boolean) so callers can link the Store
  // Cash entry via reference_id. Without a real id on the till row,
  // deleting the expense later can't remove its linked till entry and the
  // amount stays deducted forever (orphan).
  async function addExpense(expense) {
    const { data: row, error } = await supabase.from('expenses').insert([expense]).select().single()
    if (error) { toast.error(error.message); return null }
    toast.success(t('expenses.added'))
    await fetch()
    return row
  }

  async function updateExpense(id, updates) {
    const { error } = await supabase.from('expenses').update(updates).eq('id', id)
    if (error) { toast.error(error.message); return false }
    toast.success(t('expenses.updated'))
    await fetch()
    return true
  }

  async function deleteExpense(id) {
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) { toast.error(error.message); return false }
    toast.success(t('expenses.deleted'))
    await fetch()
    return true
  }

  return { expenses, loading, addExpense, updateExpense, deleteExpense, refetch: fetch }
}
