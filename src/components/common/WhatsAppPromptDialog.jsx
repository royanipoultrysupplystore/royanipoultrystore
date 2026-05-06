import { useState, useEffect } from 'react'
import { X, Send, Edit3, Check } from 'lucide-react'
import { buildWhatsAppMessage } from '../../utils/whatsappTemplates'
import { buildWhatsAppUrl, canSendWhatsApp } from '../../utils/whatsappLink'

// Shows a preview of the WhatsApp message (English + Pashto stacked).
// Allows editing before sending. Opens wa.me in a new tab on send.
//
// Props:
//   open: boolean
//   onClose: () => void
//   templateKey: string (key in WA_TEMPLATES)
//   variables: object (values for placeholders)
//   recipient: { name, phone }
export default function WhatsAppPromptDialog({ open, onClose, templateKey, variables, recipient }) {
  const [editing, setEditing] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (open && templateKey) {
      setMessage(buildWhatsAppMessage(templateKey, variables || {}))
      setEditing(false)
    }
  }, [open, templateKey, variables])

  if (!open) return null

  const phoneOk = canSendWhatsApp(recipient?.phone)

  function handleSend() {
    const url = buildWhatsAppUrl(recipient.phone, message)
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer')
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white text-xl">
              💬
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Send WhatsApp Message?</h3>
              {recipient?.name && (
                <p className="text-xs text-slate-500">
                  To: <span className="font-medium">{recipient.name}</span>
                  {recipient.phone && <span className="ms-2 text-slate-400" dir="ltr">{recipient.phone}</span>}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!phoneOk && (
            <div className="mb-3 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-700">
              ⚠ This contact has no valid phone number. Please add one first.
            </div>
          )}

          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Message Preview</span>
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg"
              >
                <Edit3 size={12} /> Edit
              </button>
            ) : (
              <button
                onClick={() => setEditing(false)}
                className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-green-600 hover:bg-green-50 rounded-lg"
              >
                <Check size={12} /> Done editing
              </button>
            )}
          </div>

          {editing ? (
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={20}
              className="w-full px-4 py-3 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-300 whitespace-pre-wrap"
            />
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm whitespace-pre-wrap font-medium text-slate-700 leading-relaxed">
              {message}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 justify-end px-5 py-4 border-t border-slate-100 bg-slate-50">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-100"
          >
            Skip
          </button>
          <button
            onClick={handleSend}
            disabled={!phoneOk}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            <Send size={14} /> Send via WhatsApp
          </button>
        </div>
      </div>
    </div>
  )
}
