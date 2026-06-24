import { Link } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { useLanguage } from '../../contexts/LanguageContext'
import { useBusinessInfo } from '../../contexts/SettingsContext'

const LANGUAGES = [
  { code: 'en', label: 'EN', full: 'English' },
  { code: 'fa', label: 'دری', full: 'Dari' },
  { code: 'ps', label: 'پښتو', full: 'Pashto' },
]

export default function Header({ onMenuClick, title }) {
  const { lang, t, setLanguage, isRTL } = useLanguage()
  const { businessName } = useBusinessInfo()
  const logoLetter = (businessName || '?').trim().charAt(0).toUpperCase()

  return (
    <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-4 shadow-sm">
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-600"
      >
        <Menu size={20} />
      </button>

      <div className="flex-1">
        <h1 className="text-lg font-semibold text-slate-800">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
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
