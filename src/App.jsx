import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { SettingsProvider } from './contexts/SettingsContext'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { normalizeDigits } from './utils/digits'
import Layout from './components/Layout/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import POS from './pages/POS'
import Inventory from './pages/Inventory'
import Farms from './pages/Farms'
import FarmDetail from './pages/FarmDetail'
import WalkInCustomers from './pages/WalkInCustomers'
import Dispatches from './pages/Dispatches'
import NewDispatch from './pages/NewDispatch'
import Payments from './pages/Payments'
import Expenses from './pages/Expenses'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import SupplyPayments from './pages/SupplyPayments'
import Roznamcha from './pages/Roznamcha'
import Suppliers from './pages/Suppliers'
import SupplierDetail from './pages/SupplierDetail'
import MedicineSupplierDetail from './pages/MedicineSupplierDetail'
import ChozaSupplierDetail from './pages/ChozaSupplierDetail'
import CashLedger from './pages/CashLedger'
import CashLedgerPersonDetail from './pages/CashLedgerPersonDetail'
import StoreCash from './pages/StoreCash'
import MarketSellers from './pages/MarketSellers'
import MarketSellerDetail from './pages/MarketSellerDetail'
import Commission from './pages/Commission'
import CommissionCustomerDetail from './pages/CommissionCustomerDetail'
import CommissionDealerDetail from './pages/CommissionDealerDetail'
import CommissionFee from './pages/CommissionFee'
import Users from './pages/Users'

function AdminOnly({ children }) {
  const { isAdmin } = useAuth()
  return isAdmin ? children : <Navigate to="/commission" replace />
}

function AppShell() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-400">Loading…</div>
      </div>
    )
  }

  if (!user) return <Login />

  // Associate users get redirected to /commission as their default landing
  const homePath = user.role === 'associate' ? '/commission' : '/'

  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Routes accessible to ALL authenticated users */}
        <Route path="/commission" element={<Commission />} />
        <Route path="/commission/customer/:id" element={<CommissionCustomerDetail />} />
        <Route path="/commission/dealer/:id" element={<CommissionDealerDetail />} />
        <Route path="/commission-fee" element={<CommissionFee />} />

        {/* Admin-only routes */}
        <Route path="/" element={<AdminOnly><Dashboard /></AdminOnly>} />
        <Route path="/pos" element={<AdminOnly><POS /></AdminOnly>} />
        <Route path="/inventory" element={<AdminOnly><Inventory /></AdminOnly>} />
        <Route path="/farms" element={<AdminOnly><Farms /></AdminOnly>} />
        <Route path="/farms/:id" element={<AdminOnly><FarmDetail /></AdminOnly>} />
        <Route path="/customers" element={<AdminOnly><WalkInCustomers /></AdminOnly>} />
        <Route path="/dispatches" element={<AdminOnly><Dispatches /></AdminOnly>} />
        <Route path="/dispatches/new" element={<AdminOnly><NewDispatch /></AdminOnly>} />
        <Route path="/payments" element={<AdminOnly><Payments /></AdminOnly>} />
        <Route path="/expenses" element={<AdminOnly><Expenses /></AdminOnly>} />
        <Route path="/reports" element={<AdminOnly><Reports /></AdminOnly>} />
        <Route path="/supply-payments" element={<AdminOnly><SupplyPayments /></AdminOnly>} />
        <Route path="/roznamcha" element={<AdminOnly><Roznamcha /></AdminOnly>} />
        <Route path="/settings" element={<AdminOnly><Settings /></AdminOnly>} />
        <Route path="/suppliers" element={<AdminOnly><Suppliers /></AdminOnly>} />
        <Route path="/suppliers/medicine/:id" element={<AdminOnly><MedicineSupplierDetail /></AdminOnly>} />
        <Route path="/suppliers/choza/:id" element={<AdminOnly><ChozaSupplierDetail /></AdminOnly>} />
        <Route path="/suppliers/:id" element={<AdminOnly><SupplierDetail /></AdminOnly>} />
        <Route path="/cash-ledger" element={<AdminOnly><CashLedger /></AdminOnly>} />
        <Route path="/cash-ledger/:slug" element={<AdminOnly><CashLedgerPersonDetail /></AdminOnly>} />
        <Route path="/store-cash" element={<AdminOnly><StoreCash /></AdminOnly>} />
        <Route path="/market" element={<AdminOnly><MarketSellers /></AdminOnly>} />
        <Route path="/market/:id" element={<AdminOnly><MarketSellerDetail /></AdminOnly>} />
        <Route path="/users" element={<AdminOnly><Users /></AdminOnly>} />

        <Route path="*" element={<Navigate to={homePath} />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  // Global digit normalizer: any Arabic/Persian digit typed into an input or textarea
  // is auto-converted to Western digits before React's onChange runs.
  useEffect(() => {
    function handleInput(e) {
      const target = e.target
      if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)) return
      const original = target.value
      if (!original) return
      const normalized = normalizeDigits(original)
      if (original === normalized) return
      const proto = target instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set
      setter.call(target, normalized)
    }
    document.addEventListener('input', handleInput, true)
    return () => document.removeEventListener('input', handleInput, true)
  }, [])

  return (
    <AuthProvider>
      <SettingsProvider>
        <BrowserRouter>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3500,
              style: { fontSize: '14px', borderRadius: '12px', padding: '12px 16px' },
              success: { iconTheme: { primary: '#16a34a', secondary: '#fff' } },
              error: { iconTheme: { primary: '#dc2626', secondary: '#fff' } },
            }}
          />
          <AppShell />
        </BrowserRouter>
      </SettingsProvider>
    </AuthProvider>
  )
}
