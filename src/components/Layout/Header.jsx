import { Link } from 'react-router-dom'
import { Menu, Wallet } from 'lucide-react'
import { useLanguage } from '../../contexts/LanguageContext'
import { useBusinessInfo } from '../../contexts/SettingsContext'
import { useStoreCash } from '../../contexts/StoreCashContext'
import { useAuth } from '../../contexts/AuthContext'
import { formatCurrency } from '../../utils/formatCurrency'

const LANGUAGES = [
  { code: 'en', label: 'EN', full: 'English' },
  { code: 'fa', label: 'دری', full: 'Dari' },
  { code: 'ps', label: 'پښتو', full: 'Pashto' },
]

export default function Header({ onMenuClick, title }) {
  const { lang, t, setLanguage, isRTL } = useLanguage()
  const { businessName } = useBusinessInfo()
  const { balance, balanceUsd } = useStoreCash()
  const { isAdmin } = useAuth()
  const logoLetter = (businessName || '?').trim().charAt(0).toUpperCase()

  const afnNeg = balance < 0
  const usdNeg = balanceUsd < 0

  return (
    <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-4 shadow-sm">
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-600"
      >
        <Menu size={20} />
      </button>

      <div className="flex-1 min-w-0">
        <h1 className="text-lg font-semibold text-slate-800 truncate">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        {/* Persistent Store Cash chip — admin only. AFN always shown; USD
            appears alongside once there's any USD activity. Clickable →
            /store-cash. Negative balances turn red so the shop can see at
            a glance if the till dipped below zero. */}
        {isAdmin && (
          <Link
            to="/store-cash"
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-linear-to-br from-[#0F1E33] to-[#1B3A5C] text-white text-xs font-medium shadow-sm hover:shadow-md hover:from-[#1B3A5C] hover:to-[#2E86AB] transition-all"
            title="Store Cash · click for the full ledger"
          >
            <Wallet size={14} className="opacity-90" />
            <div className="flex items-baseline gap-2 leading-tight">
              <span className="text-[9px] font-semibold uppercase tracking-wider text-white/60">Cash</span>
              <span className={`font-bold tabular-nums ${afnNeg ? 'text-red-300' : 'text-white'}`}>
                {formatCurrency(balance)}
              </span>
              {balanceUsd !== 0 && (
                <>
                  <span className="text-white/30">·</span>
                  <span className={`font-bold tabular-nums ${usdNeg ? 'text-red-300' : 'text-emerald-300'}`}>
                    ${balanceUsd.toFixed(2)}
                  </span>
                </>
              )}
            </div>
          </Link>
        )}

        {/* Language selector */}
        <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden text-sm font-medium">
          {LANGUAGES.map(({ code, label }) => (
            <button
              key={code}
              onClick={() => setLanguage(code)}
              className={`px-3 py-1.5 transition-colors ${
                lang === code
                  ? 'bg-[#1B3A5C] text-white'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
              title={LANGUAGES.find(l => l.code === code)?.full}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Header brand — click to go home (Dashboard). */}
        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity" aria-label="Go to Dashboard">
          <div className="text-end hidden sm:block">
            <div className="text-xs font-medium text-slate-700">{businessName}</div>
            <div className="text-xs text-slate-400">{t('common.supplyStore')}</div>
          </div>
          <div className="w-8 h-8 rounded-full bg-[#1B3A5C] text-white flex items-center justify-center text-sm font-bold">
            {logoLetter}
          </div>
        </Link>
      </div>
    </header>
  )
}
