import { AlertTriangle } from 'lucide-react'
import { useLanguage } from '../../contexts/LanguageContext'

export default function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel, danger = true }) {
  const { t } = useLanguage()
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className={`p-3 rounded-full shrink-0 ${danger ? 'bg-red-100' : 'bg-orange-100'}`}>
            <AlertTriangle size={22} className={danger ? 'text-red-600' : 'text-orange-600'} />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800">{title || t('common.confirm')}</h3>
            <p className="text-sm text-slate-500 mt-0.5">{message || t('common.noData')}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={() => { onConfirm(); onClose() }}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors
              ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-500 hover:bg-orange-600'}`}
          >
            {confirmLabel || t('common.delete')}
          </button>
        </div>
      </div>
    </div>
  )
}
