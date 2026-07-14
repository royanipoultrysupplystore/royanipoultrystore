import { ArrowUpRight } from 'lucide-react'

// Reusable stat card. Clickable variants get a subtle lift on hover, a coloured
// border-glow, and a chevron in the corner that slides out — clear signal that
// the card leads somewhere. Passive (no onClick) stat cards look identical to
// before so nothing regresses visually.
export default function StatCard({ title, value, icon: Icon, color = 'blue', subtitle, trend, onClick }) {
  const colors = {
    blue:   'bg-blue-50 text-blue-600',
    green:  'bg-green-50 text-green-600',
    red:    'bg-red-50 text-red-600',
    orange: 'bg-orange-50 text-orange-600',
    purple: 'bg-purple-50 text-purple-600',
    teal:   'bg-teal-50 text-teal-600',
    navy:   'bg-[#1B3A5C]/10 text-[#1B3A5C]',
  }

  const interactive = !!onClick

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden bg-white rounded-xl p-5 shadow-sm border border-slate-100 transition-all duration-300 group ${
        interactive
          ? 'cursor-pointer hover:shadow-lg hover:border-[#2E86AB]/50 hover:-translate-y-0.5 active:translate-y-0 active:shadow-sm'
          : 'hover:shadow-md'
      }`}
    >
      {/* Soft glow on hover for interactive cards — sits behind content and
          only fades in on group-hover, so passive cards never see it. */}
      {interactive && (
        <div className="absolute inset-0 bg-linear-to-br from-[#2E86AB]/0 via-[#2E86AB]/0 to-[#2E86AB]/4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      )}

      {/* Corner chevron — slides diagonally out on hover, obvious "click me"
          affordance. Only appears when the card is clickable. */}
      {interactive && (
        <div className="absolute top-2 inset-e-2 text-slate-300 group-hover:text-[#2E86AB] transition-all duration-300 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 rtl:group-hover:-translate-x-0.5">
          <ArrowUpRight size={14} />
        </div>
      )}

      <div className="relative flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{title}</p>
          <p className="text-2xl font-bold text-slate-800 truncate tabular-nums">{value}</p>
          {subtitle && (
            <p className={`text-xs mt-1 transition-colors ${interactive ? 'text-slate-400 group-hover:text-[#2E86AB]' : 'text-slate-400'}`}>
              {subtitle}
            </p>
          )}
        </div>
        {Icon && (
          <div className={`p-2.5 rounded-xl ${colors[color]} shrink-0 ms-3 transition-transform duration-300 ${interactive ? 'group-hover:scale-110' : ''}`}>
            <Icon size={22} />
          </div>
        )}
      </div>
      {trend !== undefined && (
        <div className={`mt-3 text-xs font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}% vs last month
        </div>
      )}
    </div>
  )
}
