import { ArrowUpRight } from 'lucide-react'

// Reusable stat card. Clickable variants advertise their interactivity in
// three ways:
//   1. A persistent chevron in the top-inline-end corner (always visible, so
//      users see the affordance without needing to hover first).
//   2. On hover: a clear lift, a colored ring outline, deeper shadow, an
//      accent glow wash behind content, and the icon frame scales/rotates.
//   3. On active (mouse-down): a small press-in feedback so the click
//      feels tactile.
// Passive stat cards (no onClick) get none of the above and look identical
// to the pre-existing card, so nothing regresses visually.
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
          ? 'cursor-pointer hover:shadow-2xl hover:border-[#2E86AB] hover:ring-2 hover:ring-[#2E86AB]/25 hover:-translate-y-1 active:translate-y-0 active:shadow-md active:scale-[0.99]'
          : 'hover:shadow-md'
      }`}
    >
      {/* Accent-colored gradient wash — inert baseline, brightens on hover. */}
      {interactive && (
        <div className="absolute inset-0 bg-linear-to-br from-[#2E86AB]/0 via-[#2E86AB]/0 to-[#2E86AB]/12 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      )}

      {/* Diagonal shimmer that sweeps across the card on hover. */}
      {interactive && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
          <div className="absolute -inset-x-full top-0 h-full w-1/2 bg-linear-to-r from-transparent via-white/40 to-transparent -skew-x-12 opacity-0 group-hover:opacity-100 group-hover:animate-shimmer" />
        </div>
      )}

      {/* Persistent chevron — always visible so the click affordance never
          hides. Colours-in and translates on hover. */}
      {interactive && (
        <div className="absolute top-2.5 inset-e-2.5 z-10 text-slate-400 group-hover:text-[#2E86AB] transition-all duration-300 group-hover:translate-x-1 group-hover:-translate-y-1 rtl:group-hover:-translate-x-1">
          <div className="p-1 rounded-full bg-white shadow-sm border border-slate-100 group-hover:border-[#2E86AB]/40 group-hover:shadow-md transition-all">
            <ArrowUpRight size={12} strokeWidth={2.5} />
          </div>
        </div>
      )}

      <div className="relative flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{title}</p>
          <p className="text-2xl font-bold text-slate-800 truncate tabular-nums">{value}</p>
          {subtitle && (
            <p className={`text-xs mt-1 transition-colors ${interactive ? 'text-slate-400 group-hover:text-[#2E86AB] group-hover:font-semibold' : 'text-slate-400'}`}>
              {subtitle}
            </p>
          )}
        </div>
        {Icon && (
          <div className={`p-2.5 rounded-xl ${colors[color]} shrink-0 ms-3 transition-all duration-300 ${interactive ? 'group-hover:scale-125 group-hover:rotate-6 group-hover:shadow-md' : ''}`}>
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
