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

  async function addExpense(expense) {
    const { error } = await supabase.from('expenses').insert([expense])
    if (error) { toast.error(error.message); return false }
    toast.success(t('expenses.added'))
    await fetch()
    return true
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
