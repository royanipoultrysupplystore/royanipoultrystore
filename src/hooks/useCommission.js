import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../config/supabase'
import toast from 'react-hot-toast'
import { todayStr } from '../utils/dateHelpers'

// ============================================================
// Cars + sales + customers + dealers for a given date (defaults to today)
// ============================================================
export function useCommissionForDate(date) {
  const targetDate = date || todayStr()
  const [cars, setCars] = useState([])
  const [salesByCarId, setSalesByCarId] = useState({})
  const [expensesByCarId, setExpensesByCarId] = useState({})
  const [customers, setCustomers] = useState([])
  const [dealers, setDealers] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const [carRes, custRes, dealerRes] = await Promise.all([
      supabase.from('commission_cars')
        .select('*, commission_dealers(name, phone)')
        .eq('car_date', targetDate)
        .order('created_at', { ascending: true }),
      supabase.from('commission_customers').select('*').order('name'),
      supabase.from('commission_dealers').select('*').order('name'),
    ])

    const dayCars = carRes.data || []
    setCars(dayCars)
    setCustomers(custRes.data || [])
    setDealers(dealerRes.data || [])

    if (dayCars.length > 0) {
      const carIds = dayCars.map(c => c.id)
      const [salesRes, expRes] = await Promise.all([
        supabase.from('commission_sales')
          .select('*, commission_customers(name, phone)')
          .in('car_id', carIds)
          .order('created_at', { ascending: false }),
        supabase.from('commission_car_expenses')
          .select('*')
          .in('car_id', carIds)
          .order('created_at', { ascending: false }),
      ])
      const grouped = {}
      for (const s of (salesRes.data || [])) {
        if (!grouped[s.car_id]) grouped[s.car_id] = []
        grouped[s.car_id].push(s)
      }
      setSalesByCarId(grouped)

      const expGrouped = {}
      for (const e of (expRes.data || [])) {
        if (!expGrouped[e.car_id]) expGrouped[e.car_id] = []
        expGrouped[e.car_id].push(e)
      }
      setExpensesByCarId(expGrouped)
    } else {
      setSalesByCarId({})
      setExpensesByCarId({})
    }
    setLoading(false)
  }, [targetDate])

  useEffect(() => { fetch() }, [fetch])

  async function createCar({ totalChickens, notes, dealerId, commissionRate }) {
    const { data, error } = await supabase.from('commission_cars').insert([{
      car_date: targetDate,
      total_chickens: parseInt(totalChickens) || 0,
      notes: notes || null,
      dealer_id: dealerId || null,
      commission_rate_per_chicken: parseFloat(commissionRate) || 5,
    }]).select().single()
    if (error) { toast.error(error.message); return null }
    toast.success('Car added')
    await fetch()
    return data
  }

  async function updateCar(id, { totalChickens, notes, dealerId, commissionRate }) {
    const patch = {
      total_chickens: parseInt(totalChickens) || 0,
      notes: notes || null,
      dealer_id: dealerId || null,
    }
    if (commissionRate !== undefined && commissionRate !== '' && commissionRate !== null) {
      patch.commission_rate_per_chicken = parseFloat(commissionRate) || 0
    }
    const { error } = await supabase.from('commission_cars').update(patch).eq('id', id)
    if (error) { toast.error(error.message); return false }
    toast.success('Car updated')
    await fetch()
    return true
  }

  async function deleteCar(id) {
    const { error } = await supabase.from('commission_cars').delete().eq('id', id)
    if (error) { toast.error(error.message); return false }
    toast.success('Car removed')
    await fetch()
    return true
  }

  async function addCustomer(data) {
    const { data: created, error } = await supabase.from('commission_customers').insert([{
      name: data.name,
      phone: data.phone || null,
      notes: data.notes || null,
    }]).select().single()
    if (error) { toast.error(error.message); return null }
    toast.success('Customer added')
    await fetch()
    return created
  }

  async function addDealer(data) {
    const { data: created, error } = await supabase.from('commission_dealers').insert([{
      name: data.name,
      phone: data.phone || null,
      notes: data.notes || null,
    }]).select().single()
    if (error) { toast.error(error.message); return null }
    toast.success('Dealer added')
    await fetch()
    return created
  }

  async function addSale(carId, saleData) {
    if (!carId) { toast.error('Select a car first'); return false }
    const car = cars.find(c => c.id === carId)
    if (!car) { toast.error('Car not found'); return false }
    if (car.is_closed) { toast.error('Car is closed — reopen first'); return false }

    const chickenCount = parseInt(saleData.chicken_count) || 0
    const weightKg = parseFloat(saleData.weight_kg) || 0
    const pricePerUnit = parseFloat(saleData.price_per_unit) || 0
    const totalAmount = saleData.sale_type === 'per_kg'
      ? weightKg * pricePerUnit
      : chickenCount * pricePerUnit

    const { error } = await supabase.from('commission_sales').insert([{
      car_id: carId,
      customer_id: saleData.customer_id,
      sale_date: targetDate,
      sale_type: saleData.sale_type,
      chicken_count: chickenCount,
      weight_kg: weightKg,
      price_per_unit: pricePerUnit,
      total_amount: totalAmount,
      notes: saleData.notes || null,
    }])
    if (error) { toast.error(error.message); return false }

    const carSales = salesByCarId[carId] || []
    const prevSold = carSales.reduce((s, x) => s + (x.chicken_count || 0), 0)
    const totalSold = prevSold + chickenCount
    if (totalSold >= car.total_chickens && prevSold < car.total_chickens) {
      toast.success(`🎉 Car fully sold! ${totalSold}/${car.total_chickens} chickens`, { duration: 5000 })
    } else {
      toast.success('Sale recorded')
    }
    await fetch()
    return true
  }

  async function deleteSale(id) {
    const { error } = await supabase.from('commission_sales').delete().eq('id', id)
    if (error) { toast.error(error.message); return false }
    toast.success('Sale removed')
    await fetch()
    return true
  }

  async function addExpense(carId, expense) {
    const { error } = await supabase.from('commission_car_expenses').insert([{
      car_id: carId,
      description: expense.description,
      amount: parseFloat(expense.amount) || 0,
    }])
    if (error) { toast.error(error.message); return false }
    toast.success('Expense added')
    await fetch()
    return true
  }

  async function deleteExpense(id) {
    const { error } = await supabase.from('commission_car_expenses').delete().eq('id', id)
    if (error) { toast.error(error.message); return false }
    toast.success('Expense removed')
    await fetch()
    return true
  }

  async function finishCar(id) {
    const { error } = await supabase.from('commission_cars').update({
      is_closed: true,
      closed_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) { toast.error(error.message); return false }
    toast.success('Car closed')
    await fetch()
    return true
  }

  async function reopenCar(id) {
    const { error } = await supabase.from('commission_cars').update({
      is_closed: false,
      closed_at: null,
    }).eq('id', id)
    if (error) { toast.error(error.message); return false }
    toast.success('Car reopened')
    await fetch()
    return true
  }

  return {
    cars, salesByCarId, expensesByCarId, customers, dealers, loading,
    targetDate,
    createCar, updateCar, deleteCar,
    addCustomer, addDealer,
    addSale, deleteSale,
    addExpense, deleteExpense,
    finishCar, reopenCar,
    refetch: fetch,
  }
}

// ============================================================
// All customers with their balances (for the Customers tab)
// ============================================================
export function useCommissionCustomers() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const [custRes, salesRes, paysRes] = await Promise.all([
      supabase.from('commission_customers').select('*').order('name'),
      supabase.from('commission_sales').select('customer_id, total_amount, chicken_count'),
      supabase.from('commission_payments').select('customer_id, amount'),
    ])

    const salesMap = {}
    const countsMap = {}
    for (const s of (salesRes.data || [])) {
      salesMap[s.customer_id] = (salesMap[s.customer_id] || 0) + (s.total_amount || 0)
      countsMap[s.customer_id] = (countsMap[s.customer_id] || 0) + (s.chicken_count || 0)
    }
    const paysMap = {}
    for (const p of (paysRes.data || [])) {
      paysMap[p.customer_id] = (paysMap[p.customer_id] || 0) + (p.amount || 0)
    }

    const enriched = (custRes.data || []).map(c => ({
      ...c,
      total_purchased: salesMap[c.id] || 0,
      total_paid: paysMap[c.id] || 0,
      balance: (salesMap[c.id] || 0) - (paysMap[c.id] || 0),
      total_chickens: countsMap[c.id] || 0,
    }))
    setCustomers(enriched)
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  async function addCustomer(data) {
    const { data: created, error } = await supabase.from('commission_customers').insert([{
      name: data.name,
      phone: data.phone || null,
      notes: data.notes || null,
    }]).select().single()
    if (error) { toast.error(error.message); return null }
    toast.success('Customer added')
    await fetch()
    return created
  }

  async function updateCustomer(id, data) {
    const { error } = await supabase.from('commission_customers').update({
      name: data.name,
      phone: data.phone || null,
      notes: data.notes || null,
    }).eq('id', id)
    if (error) { toast.error(error.message); return false }
    toast.success('Customer updated')
    await fetch()
    return true
  }

  async function deleteCustomer(id) {
    const { error } = await supabase.from('commission_customers').delete().eq('id', id)
    if (error) { toast.error(error.message); return false }
    toast.success('Customer deleted')
    await fetch()
    return true
  }

  return { customers, loading, addCustomer, updateCustomer, deleteCustomer, refetch: fetch }
}

// ============================================================
// One customer's full detail (unchanged from before)
// ============================================================
export function useCommissionCustomerDetail(customerId) {
  const [customer, setCustomer] = useState(null)
  const [sales, setSales] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!customerId) return
    setLoading(true)
    const [custRes, salesRes, paysRes] = await Promise.all([
      supabase.from('commission_customers').select('*').eq('id', customerId).single(),
      supabase.from('commission_sales').select('*').eq('customer_id', customerId).order('sale_date', { ascending: false }),
      supabase.from('commission_payments').select('*').eq('customer_id', customerId).order('payment_date', { ascending: false }),
    ])
    if (custRes.error) { toast.error('Failed to load customer'); setLoading(false); return }
    setCustomer(custRes.data)
    setSales(salesRes.data || [])
    setPayments(paysRes.data || [])
    setLoading(false)
  }, [customerId])

  useEffect(() => { fetch() }, [fetch])

  async function recordPayment(data) {
    const { error } = await supabase.from('commission_payments').insert([{
      customer_id: customerId,
      amount: parseFloat(data.amount) || 0,
      payment_date: data.payment_date,
      notes: data.notes || null,
    }])
    if (error) { toast.error(error.message); return false }
    toast.success('Payment recorded')
    await fetch()
    return true
  }

  async function updatePayment(id, data) {
    const { error } = await supabase.from('commission_payments').update({
      amount: parseFloat(data.amount) || 0,
      payment_date: data.payment_date,
      notes: data.notes || null,
    }).eq('id', id)
    if (error) { toast.error(error.message); return false }
    toast.success('Payment updated')
    await fetch()
    return true
  }

  async function deletePayment(id) {
    const { error } = await supabase.from('commission_payments').delete().eq('id', id)
    if (error) { toast.error(error.message); return false }
    toast.success('Payment deleted')
    await fetch()
    return true
  }

  async function deleteSale(id) {
    const { error } = await supabase.from('commission_sales').delete().eq('id', id)
    if (error) { toast.error(error.message); return false }
    toast.success('Sale removed')
    await fetch()
    return true
  }

  const totalPurchased = sales.reduce((s, x) => s + (x.total_amount || 0), 0)
  const totalChickens = sales.reduce((s, x) => s + (x.chicken_count || 0), 0)
  const totalPaid = payments.reduce((s, x) => s + (x.amount || 0), 0)
  const balance = totalPurchased - totalPaid

  return {
    customer, sales, payments, loading,
    totalPurchased, totalChickens, totalPaid, balance,
    recordPayment, updatePayment, deletePayment, deleteSale,
    refetch: fetch,
  }
}

// ============================================================
// Dealers list with totals (Dealers tab)
// ============================================================
export function useCommissionDealers() {
  const [dealers, setDealers] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const [dealerRes, carsRes, salesRes, expRes, paysRes] = await Promise.all([
      supabase.from('commission_dealers').select('*').order('name'),
      supabase.from('commission_cars').select('id, dealer_id, commission_rate_per_chicken, is_closed'),
      supabase.from('commission_sales').select('car_id, total_amount, chicken_count'),
      supabase.from('commission_car_expenses').select('car_id, amount'),
      supabase.from('commission_dealer_payments').select('dealer_id, amount'),
    ])

    // Build a per-car aggregate first
    const carSales = {}
    const carCounts = {}
    for (const s of (salesRes.data || [])) {
      carSales[s.car_id] = (carSales[s.car_id] || 0) + (s.total_amount || 0)
      carCounts[s.car_id] = (carCounts[s.car_id] || 0) + (s.chicken_count || 0)
    }
    const carExpenses = {}
    for (const e of (expRes.data || [])) {
      carExpenses[e.car_id] = (carExpenses[e.car_id] || 0) + (e.amount || 0)
    }

    // Aggregate per dealer (only finished cars are "owed" to dealer)
    const dealerOwed = {}
    const dealerCommission = {}
    const dealerCarCount = {}
    const dealerSold = {}
    for (const car of (carsRes.data || [])) {
      if (!car.dealer_id) continue
      dealerCarCount[car.dealer_id] = (dealerCarCount[car.dealer_id] || 0) + 1
      const sold = carCounts[car.id] || 0
      dealerSold[car.dealer_id] = (dealerSold[car.dealer_id] || 0) + sold
      const earnings = carSales[car.id] || 0
      const expenses = carExpenses[car.id] || 0
      const commissionFee = sold * (car.commission_rate_per_chicken || 5)
      const dealerPayout = earnings - expenses - commissionFee
      dealerCommission[car.dealer_id] = (dealerCommission[car.dealer_id] || 0) + commissionFee
      // Only finished cars count toward what we owe the dealer
      if (car.is_closed) {
        dealerOwed[car.dealer_id] = (dealerOwed[car.dealer_id] || 0) + dealerPayout
      }
    }

    const dealerPaid = {}
    for (const p of (paysRes.data || [])) {
      dealerPaid[p.dealer_id] = (dealerPaid[p.dealer_id] || 0) + (p.amount || 0)
    }

    const enriched = (dealerRes.data || []).map(d => ({
      ...d,
      total_cars: dealerCarCount[d.id] || 0,
      total_sold: dealerSold[d.id] || 0,
      total_owed: dealerOwed[d.id] || 0,
      total_paid: dealerPaid[d.id] || 0,
      balance: (dealerOwed[d.id] || 0) - (dealerPaid[d.id] || 0),
      total_commission: dealerCommission[d.id] || 0,
    }))
    setDealers(enriched)
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  async function addDealer(data) {
    const { data: created, error } = await supabase.from('commission_dealers').insert([{
      name: data.name,
      phone: data.phone || null,
      notes: data.notes || null,
    }]).select().single()
    if (error) { toast.error(error.message); return null }
    toast.success('Dealer added')
    await fetch()
    return created
  }

  async function updateDealer(id, data) {
    const { error } = await supabase.from('commission_dealers').update({
      name: data.name,
      phone: data.phone || null,
      notes: data.notes || null,
    }).eq('id', id)
    if (error) { toast.error(error.message); return false }
    toast.success('Dealer updated')
    await fetch()
    return true
  }

  async function deleteDealer(id) {
    const { error } = await supabase.from('commission_dealers').delete().eq('id', id)
    if (error) { toast.error(error.message); return false }
    toast.success('Dealer deleted')
    await fetch()
    return true
  }

  return { dealers, loading, addDealer, updateDealer, deleteDealer, refetch: fetch }
}

// ============================================================
// One dealer's full detail page (cars + payments)
// ============================================================
export function useCommissionDealerDetail(dealerId) {
  const [dealer, setDealer] = useState(null)
  const [cars, setCars] = useState([]) // each car enriched with sold, earnings, expenses, commission, payout
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!dealerId) return
    setLoading(true)
    const [dealerRes, carsRes, paysRes] = await Promise.all([
      supabase.from('commission_dealers').select('*').eq('id', dealerId).single(),
      supabase.from('commission_cars').select('*').eq('dealer_id', dealerId).order('car_date', { ascending: false }),
      supabase.from('commission_dealer_payments').select('*').eq('dealer_id', dealerId).order('payment_date', { ascending: false }),
    ])
    if (dealerRes.error) { toast.error('Failed to load dealer'); setLoading(false); return }
    setDealer(dealerRes.data)
    setPayments(paysRes.data || [])

    const dayCars = carsRes.data || []
    if (dayCars.length === 0) {
      setCars([])
      setLoading(false)
      return
    }

    const carIds = dayCars.map(c => c.id)
    const [salesRes, expRes] = await Promise.all([
      supabase.from('commission_sales').select('car_id, total_amount, chicken_count').in('car_id', carIds),
      supabase.from('commission_car_expenses').select('*').in('car_id', carIds).order('created_at', { ascending: true }),
    ])

    const sales = {}
    const counts = {}
    for (const s of (salesRes.data || [])) {
      sales[s.car_id] = (sales[s.car_id] || 0) + (s.total_amount || 0)
      counts[s.car_id] = (counts[s.car_id] || 0) + (s.chicken_count || 0)
    }
    const exp = {}
    const expItems = {}
    for (const e of (expRes.data || [])) {
      exp[e.car_id] = (exp[e.car_id] || 0) + (e.amount || 0)
      if (!expItems[e.car_id]) expItems[e.car_id] = []
      expItems[e.car_id].push(e)
    }

    const enriched = dayCars.map(car => {
      const sold = counts[car.id] || 0
      const earnings = sales[car.id] || 0
      const expenses = exp[car.id] || 0
      const commissionFee = sold * (car.commission_rate_per_chicken || 5)
      const dealerPayout = earnings - expenses - commissionFee
      return {
        ...car,
        sold_chickens: sold,
        earnings,
        expenses,
        expense_items: expItems[car.id] || [],
        commission_fee: commissionFee,
        dealer_payout: dealerPayout,
      }
    })
    setCars(enriched)
    setLoading(false)
  }, [dealerId])

  useEffect(() => { fetch() }, [fetch])

  async function recordPayment(data) {
    const { error } = await supabase.from('commission_dealer_payments').insert([{
      dealer_id: dealerId,
      amount: parseFloat(data.amount) || 0,
      payment_date: data.payment_date,
      notes: data.notes || null,
    }])
    if (error) { toast.error(error.message); return false }
    toast.success('Payment recorded')
    await fetch()
    return true
  }

  async function updatePayment(id, data) {
    const { error } = await supabase.from('commission_dealer_payments').update({
      amount: parseFloat(data.amount) || 0,
      payment_date: data.payment_date,
      notes: data.notes || null,
    }).eq('id', id)
    if (error) { toast.error(error.message); return false }
    toast.success('Payment updated')
    await fetch()
    return true
  }

  async function deletePayment(id) {
    const { error } = await supabase.from('commission_dealer_payments').delete().eq('id', id)
    if (error) { toast.error(error.message); return false }
    toast.success('Payment deleted')
    await fetch()
    return true
  }

  // All cars count toward what we owe the dealer (running total)
  const totalOwed = cars.reduce((s, c) => s + c.dealer_payout, 0)
  const totalEarnings = cars.reduce((s, c) => s + c.earnings, 0)
  const totalExpenses = cars.reduce((s, c) => s + c.expenses, 0)
  const totalCommissionEarned = cars.reduce((s, c) => s + c.commission_fee, 0)
  const totalSold = cars.reduce((s, c) => s + c.sold_chickens, 0)
  const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0)
  const balance = totalOwed - totalPaid
  // Pending payout = active cars (not yet finished — number can still change)
  const pendingPayout = cars.filter(c => !c.is_closed).reduce((s, c) => s + c.dealer_payout, 0)

  return {
    dealer, cars, payments, loading,
    totalOwed, totalPaid, balance, totalCommissionEarned, totalSold,
    totalEarnings, totalExpenses, pendingPayout,
    recordPayment, updatePayment, deletePayment,
    refetch: fetch,
  }
}

// ============================================================
// Commission Fee Expenses (shop overhead — rent, utilities, etc.)
// Independent from per-car expenses; subtracted from commission earned to compute profit.
// ============================================================
export function useCommissionFeeExpenses() {
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('commission_fee_expenses')
      .select('*')
      .order('expense_date', { ascending: false })
    if (error) toast.error(error.message)
    else setExpenses(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  async function addExpense(data) {
    const { error } = await supabase.from('commission_fee_expenses').insert([{
      title: data.title,
      amount: parseFloat(data.amount) || 0,
      note: data.note || null,
      expense_date: data.expense_date,
    }])
    if (error) { toast.error(error.message); return false }
    toast.success('Expense added')
    await fetch()
    return true
  }

  async function updateExpense(id, data) {
    const { error } = await supabase.from('commission_fee_expenses').update({
      title: data.title,
      amount: parseFloat(data.amount) || 0,
      note: data.note || null,
      expense_date: data.expense_date,
    }).eq('id', id)
    if (error) { toast.error(error.message); return false }
    toast.success('Expense updated')
    await fetch()
    return true
  }

  async function deleteExpense(id) {
    const { error } = await supabase.from('commission_fee_expenses').delete().eq('id', id)
    if (error) { toast.error(error.message); return false }
    toast.success('Expense deleted')
    await fetch()
    return true
  }

  return { expenses, loading, addExpense, updateExpense, deleteExpense, refetch: fetch }
}

// ============================================================
// Commission Fee summary (for the new sidebar tab)
// ============================================================
export function useCommissionFee() {
  const [carDetails, setCarDetails] = useState([]) // every car with full breakdown
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    const [carsRes, salesRes, expRes] = await Promise.all([
      supabase.from('commission_cars').select('*, commission_dealers(name, phone)').order('car_date', { ascending: false }),
      supabase.from('commission_sales').select('car_id, total_amount, chicken_count'),
      supabase.from('commission_car_expenses').select('car_id, amount'),
    ])

    const sales = {}
    const counts = {}
    for (const s of (salesRes.data || [])) {
      sales[s.car_id] = (sales[s.car_id] || 0) + (s.total_amount || 0)
      counts[s.car_id] = (counts[s.car_id] || 0) + (s.chicken_count || 0)
    }
    const exp = {}
    for (const e of (expRes.data || [])) {
      exp[e.car_id] = (exp[e.car_id] || 0) + (e.amount || 0)
    }

    const enriched = (carsRes.data || []).map(car => {
      const sold = counts[car.id] || 0
      const earnings = sales[car.id] || 0
      const expenses = exp[car.id] || 0
      const commissionFee = sold * (car.commission_rate_per_chicken || 5)
      return {
        ...car,
        dealer_name: car.commission_dealers?.name || '— No dealer —',
        sold_chickens: sold,
        earnings,
        expenses,
        commission_fee: commissionFee,
        dealer_payout: earnings - expenses - commissionFee,
      }
    })
    setCarDetails(enriched)
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { carDetails, loading, refetch: fetch }
}
