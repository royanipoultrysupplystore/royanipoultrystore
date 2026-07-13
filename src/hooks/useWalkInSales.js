import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../config/supabase'
import toast from 'react-hot-toast'
import { useLanguage } from '../contexts/LanguageContext'

export function useWalkInSales() {
  const { t } = useLanguage()
  const [sales, setSales] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchSales = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('sales')
      .select('*, customers(name), sale_items(*, products(name))')
      .order('sale_date', { ascending: false })
    if (error) toast.error(t('customers.loadFailed'))
    else setSales(data || [])
    setLoading(false)
  }, [])

  const fetchCustomers = useCallback(async () => {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .order('name')
    setCustomers(data || [])
  }, [])

  useEffect(() => {
    fetchSales()
    fetchCustomers()
  }, [])

  async function getNextInvoiceNumber() {
    const [dispRes, saleRes] = await Promise.all([
      supabase.from('dispatches').select('invoice_number').order('invoice_number', { ascending: false }).limit(1),
      supabase.from('sales').select('invoice_number').order('invoice_number', { ascending: false }).limit(1),
    ])
    const maxDispatch = dispRes.data?.[0]?.invoice_number || 0
    const maxSale = saleRes.data?.[0]?.invoice_number || 0
    return Math.max(maxDispatch, maxSale) + 1
  }

  async function createWalkInSale(saleData, items) {
    const invoiceNumber = await getNextInvoiceNumber()

    // Auto find-or-create a customer when a real name was typed but no customer selected
    let customerId = saleData.customer_id || null
    const defaultName = t('customers.walkInDefault')
    if (!customerId && saleData.customer_name && saleData.customer_name !== defaultName) {
      const { data: existing } = await supabase
        .from('customers').select('id').ilike('name', saleData.customer_name).limit(1)
      if (existing && existing.length > 0) {
        customerId = existing[0].id
      } else {
        const { data: newCust } = await supabase
          .from('customers').insert([{ name: saleData.customer_name }]).select().single()
        if (newCust) customerId = newCust.id
      }
    }

    // Split incoming items by currency. AFN sales still work exactly like
    // before; USD medicine lines fill a separate set of columns and roll up
    // into total_amount_usd/remaining_usd. Payments today are AFN-only, so
    // amount_paid_usd stays 0 and remaining_usd = total_amount_usd.
    const totalAmountAFN = items.reduce((s, i) => {
      if (i.currency === 'USD') return s
      return s + (parseFloat(i.sell_price) || 0) * i.quantity
    }, 0)
    const totalAmountUSD = items.reduce((s, i) => {
      if (i.currency !== 'USD') return s
      return s + (parseFloat(i.sell_price_usd) || 0) * i.quantity
    }, 0)
    const amountPaidAFN = parseFloat(saleData.amount_paid) || 0
    const remainingAFN = Math.max(0, totalAmountAFN - amountPaidAFN)
    const remainingUSD = totalAmountUSD // no USD payment path yet

    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert([{
        invoice_number: invoiceNumber,
        customer_id: customerId,
        customer_name: saleData.customer_name || defaultName,
        sale_date: saleData.sale_date,
        total_amount: totalAmountAFN,
        amount_paid: amountPaidAFN,
        remaining: remainingAFN,
        total_amount_usd: totalAmountUSD,
        amount_paid_usd: 0,
        remaining_usd: remainingUSD,
        payment_type: saleData.payment_type,
        notes: saleData.notes || null,
      }])
      .select()
      .single()

    if (saleError) { toast.error(saleError.message); return null }

    const saleItems = items.map(item => {
      const isUSD = item.currency === 'USD'
      const afnSell = isUSD ? 0 : (parseFloat(item.sell_price) || 0)
      const afnBuy = isUSD ? 0 : (parseFloat(item.purchase_price) || 0)
      const usdSell = isUSD ? (parseFloat(item.sell_price_usd) || 0) : 0
      const usdBuy = isUSD ? (parseFloat(item.purchase_price_usd) || 0) : 0
      return {
        sale_id: sale.id,
        product_id: item.product_id,
        product_name: item.name,
        quantity: item.quantity,
        currency: isUSD ? 'USD' : 'AFN',
        sell_price_at_time: afnSell,
        purchase_price_at_time: afnBuy,
        total_amount: afnSell * item.quantity,
        total_profit: (afnSell - afnBuy) * item.quantity,
        purchase_price_usd_at_time: isUSD ? usdBuy : null,
        sell_price_usd_at_time: isUSD ? usdSell : null,
        total_amount_usd: usdSell * item.quantity,
        total_profit_usd: (usdSell - usdBuy) * item.quantity,
      }
    })

    const { error: itemsError } = await supabase.from('sale_items').insert(saleItems)
    if (itemsError) { toast.error(itemsError.message); return null }

    for (const item of items) {
      const { data: product } = await supabase.from('products').select('quantity').eq('id', item.product_id).single()
      if (product) {
        await supabase.from('products').update({
          quantity: Math.max(0, product.quantity - item.quantity)
        }).eq('id', item.product_id)
      }
    }

    if (customerId) {
      const { data: customer } = await supabase.from('customers')
        .select('total_debt, total_debt_usd, total_purchases')
        .eq('id', customerId).single()
      if (customer) {
        await supabase.from('customers').update({
          total_debt: (customer.total_debt || 0) + remainingAFN,
          total_debt_usd: (customer.total_debt_usd || 0) + remainingUSD,
          total_purchases: (customer.total_purchases || 0) + totalAmountAFN,
        }).eq('id', customerId)
      }
    }

    await fetchSales()
    await fetchCustomers()
    return { ...sale, invoice_number: invoiceNumber }
  }

  async function updateSale(id, oldSale, newData) {
    const newRemaining = Math.max(0, (oldSale.total_amount || 0) - parseFloat(newData.amount_paid || 0))
    const { error } = await supabase.from('sales').update({
      sale_date: newData.sale_date,
      customer_name: newData.customer_name,
      amount_paid: parseFloat(newData.amount_paid),
      remaining: newRemaining,
      payment_type: newData.payment_type,
      notes: newData.notes || null,
    }).eq('id', id)
    if (error) { toast.error(error.message); return false }
    if (oldSale.customer_id) {
      const debtDelta = newRemaining - (oldSale.remaining || 0)
      if (debtDelta !== 0) {
        const { data: customer } = await supabase.from('customers').select('total_debt').eq('id', oldSale.customer_id).single()
        if (customer) {
          await supabase.from('customers').update({
            total_debt: Math.max(0, (customer.total_debt || 0) + debtDelta)
          }).eq('id', oldSale.customer_id)
        }
      }
    }
    toast.success(t('customers.saleUpdated'))
    await fetchSales()
    await fetchCustomers()
    return true
  }

  async function deleteCustomer(id) {
    const { error } = await supabase.from('customers').delete().eq('id', id)
    if (error) { toast.error(error.message); return false }
    toast.success(t('customers.deleted'))
    await fetchCustomers()
    await fetchSales()
    return true
  }

  async function addCustomer(customer) {
    const { data, error } = await supabase.from('customers').insert([customer]).select().single()
    if (error) { toast.error(error.message); return null }
    toast.success(t('customers.added'))
    await fetchCustomers()
    return data
  }

  // AFN payment reduces total_debt, USD payment reduces total_debt_usd.
  // Currency defaults to AFN so old callers continue to work unchanged.
  async function recordCustomerPayment(customerId, amount, currency = 'AFN') {
    const { data: customer } = await supabase.from('customers')
      .select('total_debt, total_debt_usd').eq('id', customerId).single()
    if (!customer) return false
    const patch = currency === 'USD'
      ? { total_debt_usd: Math.max(0, (customer.total_debt_usd || 0) - amount) }
      : { total_debt:     Math.max(0, (customer.total_debt     || 0) - amount) }
    await supabase.from('customers').update(patch).eq('id', customerId)
    toast.success(t('customers.paymentRecorded'))
    await fetchCustomers()
    return true
  }

  return {
    sales, customers, loading,
    createWalkInSale, updateSale, addCustomer, deleteCustomer, recordCustomerPayment,
    refetch: fetchSales
  }
}
