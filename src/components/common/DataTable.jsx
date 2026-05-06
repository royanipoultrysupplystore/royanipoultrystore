import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'

export default function DataTable({ columns, data, loading, emptyMessage, pageSize = 20 }) {
  const { t } = useLanguage()
  const [page, setPage] = useState(1)
  const total = data.length
  const pages = Math.ceil(total / pageSize)
  const slice = data.slice((page - 1) * pageSize, page * pageSize)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <div className="w-6 h-6 border-2 border-[#2E86AB] border-t-transparent rounded-full animate-spin me-3" />
        {t('common.loading')}
      </div>
    )
  }

  if (!data.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <div className="text-4xl mb-3">📭</div>
        <p className="text-sm">{emptyMessage || t('common.noData')}</p>
      </div>
    )
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="text-start px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap"
                  style={col.width ? { width: col.width } : {}}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {slice.map((row, i) => (
              <tr key={row.id || i} className="hover:bg-slate-50 transition-colors">
                {columns.map((col) => (
                  <td key={col.key} className="px-3 py-3 text-slate-700 whitespace-nowrap">
                    {col.render ? col.render(row) : row[col.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between px-3 pt-3 border-t border-slate-100">
          <span className="text-xs text-slate-400">
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} {t('common.of')} {total}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setPage(p => Math.min(pages, p + 1))}
              disabled={page === pages}
              className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
