import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Package, Building2, Truck, CreditCard,
  Receipt, BarChart3, Settings, X, ChevronRight, ChevronLeft,
  ShoppingCart, Users, ShoppingBag, BookOpen, Factory, Banknote, Store, Bird, Coins,
  LogOut, UserCog, Shield, User as UserIcon
} from 'lucide-react'
import { useLanguage } from '../../contexts/LanguageContext'
import { useAuth } from '../../contexts/AuthContext'
import { useBusinessInfo } from '../../contexts/SettingsContext'

// Routes accessible to associate users
const ASSOCIATE_PATHS = new Set(['/commission', '/commission-fee'])

export default function Sidebar({ open, onClose }) {
  const { t, isRTL } = useLanguage()
  const { user, logout, isAdmin } = useAuth()
  const { businessName } = useBusinessInfo()
  const logoLetter = (businessName || '?').trim().charAt(0).toUpperCase()

  const allNav = [
    { to: '/', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
    { to: '/roznamcha', icon: BookOpen, labelKey: 'nav.roznamcha' },
    { to: '/pos', icon: ShoppingCart, labelKey: 'nav.pos', highlight: true },
    { to: '/inventory', icon: Package, labelKey: 'nav.inventory' },
    { to: '/farms', icon: Building2, labelKey: 'nav.farms' },
    { to: '/customers', icon: Users, labelKey: 'nav.customers' },
    { to: '/dispatches', icon: Truck, labelKey: 'nav.dispatches' },
    { to: '/suppliers', icon: Factory, labelKey: 'nav.suppliers' },
    { to: '/cash-ledger', icon: Banknote, labelKey: 'nav.cashLedger' },
    { to: '/supply-payments', icon: ShoppingBag, labelKey: 'nav.supplyPayments' },
    { to: '/market', icon: Store, labelKey: 'nav.market' },
    { to: '/commission', icon: Bird, labelKey: 'nav.commission' },
    { to: '/commission-fee', icon: Coins, labelKey: 'nav.commissionFee' },
    { to: '/payments', icon: CreditCard, labelKey: 'nav.payments' },
    { to: '/expenses', icon: Receipt, labelKey: 'nav.expenses' },
    { to: '/reports', icon: BarChart3, labelKey: 'nav.reports' },
    { to: '/users', icon: UserCog, labelKey: 'nav.users' },
    { to: '/settings', icon: Settings, labelKey: 'nav.settings' },
  ]

  // Associate users only see Commission + Commission Fee
  const nav = isAdmin ? allNav : allNav.filter(n => ASSOCIATE_PATHS.has(n.to))

  const ChevronIcon = isRTL ? ChevronLeft : ChevronRight

  const sideClass = isRTL
    ? `fixed top-0 right-0 h-full z-30 flex flex-col w-64 bg-[#1B3A5C] text-white transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'} lg:translate-x-0 lg:static lg:z-auto`
    : `fixed top-0 left-0 h-full z-30 flex flex-col w-64 bg-[#1B3A5C] text-white transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:z-auto`

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={onClose} />
      )}

      <aside className={sideClass}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#2E86AB] flex items-center justify-center text-white font-bold text-lg">
              {logoLetter}
            </div>
            <div>
              <div className="text-sm font-semibold leading-tight">{businessName}</div>
              <div className="text-xs text-white/50">{t('common.supplyStore')}</div>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden p-1 rounded hover:bg-white/10">
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto scrollbar-thin">
          {nav.map(({ to, icon: Icon, labelKey, highlight }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 mx-2 rounded-lg text-sm font-medium transition-all group
                ${isActive
                  ? 'bg-[#2E86AB] text-white shadow-lg'
                  : highlight
                    ? 'text-green-300 hover:bg-white/10 hover:text-white'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Icon size={18} />
              <span className="flex-1">{t(labelKey)}</span>
              {highlight && (
                <span className="text-xs bg-green-500 text-white px-1.5 py-0.5 rounded-full font-semibold">POS</span>
              )}
              <ChevronIcon size={14} className="opacity-0 group-hover:opacity-50 transition-opacity" />
            </NavLink>
          ))}
        </nav>

        {/* User card + Logout */}
        {user && (
          <div className="border-t border-white/10 px-3 py-3 space-y-2">
            <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-white/5">
              <div className="w-8 h-8 rounded-full bg-[#2E86AB] flex items-center justify-center text-white text-sm font-bold shrink-0">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">{user.name}</div>
                <div className="text-xs text-white/50 flex items-center gap-1">
                  {isAdmin ? <Shield size={10} /> : <UserIcon size={10} />}
                  {isAdmin ? 'Admin' : 'Associate'}
                </div>
              </div>
            </div>
            <button
              onClick={() => { logout(); onClose() }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/70 hover:bg-red-500/20 hover:text-red-300 transition-colors"
            >
              <LogOut size={14} /> Sign Out
            </button>
            <div className="text-[10px] text-white/30 text-center pt-1">{businessName} v1.0</div>
          </div>
        )}
      </aside>
    </>
  )
}
