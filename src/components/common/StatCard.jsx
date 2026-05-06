export default function StatCard({ title, value, icon: Icon, color = 'blue', subtitle, trend, onClick }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    orange: 'bg-orange-50 text-orange-600',
    purple: 'bg-purple-50 text-purple-600',
    navy: 'bg-[#1B3A5C]/10 text-[#1B3A5C]',
  }

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow ${onClick ? 'cursor-pointer hover:border-[#2E86AB]/40' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{title}</p>
          <p className="text-2xl font-bold text-slate-800 truncate">{value}</p>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={`p-2.5 rounded-xl ${colors[color]} shrink-0 ml-3`}>
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
