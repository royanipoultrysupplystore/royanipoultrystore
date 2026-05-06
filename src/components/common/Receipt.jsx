import { useRef } from 'react'
import { Printer, X } from 'lucide-react'
import { formatCurrency } from '../../utils/formatCurrency'
import { formatDate } from '../../utils/dateHelpers'
import { useLanguage } from '../../contexts/LanguageContext'

export default function Receipt({ open, onClose, receipt }) {
  const { t, lang, isRTL } = useLanguage()
  const printRef = useRef()

  if (!open || !receipt) return null

  function handlePrint() {
    const content = printRef.current.innerHTML
    const win = window.open('', '_blank', 'width=400,height=600')
    const fontLink = isRTL
      ? '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;700&display=swap">'
      : ''
    const fontFamily = isRTL ? "'Vazirmatn', sans-serif" : "'Courier New', monospace"
    const dir = isRTL ? 'rtl' : 'ltr'
    win.document.write(`
      <!DOCTYPE html>
      <html dir="${dir}">
        <head>
          <title>${t('dispatches.invoice')} #${receipt.invoice_number}</title>
          ${fontLink}
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: ${fontFamily};
              font-size: 12px;
              color: #000;
              padding: 10px;
              width: 300px;
              direction: ${dir};
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .big { font-size: 15px; }
            .divider { border-top: 1px dashed #000; margin: 6px 0; }
            .row { display: flex; justify-content: space-between; margin: 3px 0; }
            .items-table { width: 100%; }
            .items-table th { text-align: start; border-bottom: 1px solid #000; padding: 2px 0; font-size: 11px; }
            .items-table td { padding: 3px 0; vertical-align: top; font-size: 11px; }
            .items-table .right { text-align: end; }
            .total-row { font-weight: bold; font-size: 13px; }
            .footer { text-align: center; margin-top: 10px; font-size: 11px; }
          </style>
        </head>
        <body>${content}</body>
      </html>
    `)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 300)
  }

  const businessName = localStorage.getItem('businessName') || 'Royani Poultry Supply Corporation'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col max-h-[90vh]">
        {/* Actions */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">{t('pos.receipt')}</h3>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-1.5 bg-[#1B3A5C] text-white rounded-lg text-sm font-medium hover:bg-[#2E86AB]"
            >
              <Printer size={15} /> {t('pos.printReceipt')}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Receipt content */}
        <div className="overflow-y-auto flex-1 p-4">
          <div
            ref={printRef}
            className="font-mono text-xs text-black bg-white"
            style={{ fontFamily: isRTL ? "'Vazirmatn', sans-serif" : "'Courier New', monospace" }}
          >
            {/* Header */}
            <div className="center bold big" style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '15px', marginBottom: '4px' }}>
              {businessName}
            </div>
            <div className="divider" style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

            {/* Invoice info */}
            <div className="row" style={{ display: 'flex', justifyContent: 'space-between', margin: '3px 0' }}>
              <span>{t('dispatches.invoice')} #:</span>
              <span style={{ fontWeight: 'bold' }}>{receipt.invoice_number}</span>
            </div>
            <div className="row" style={{ display: 'flex', justifyContent: 'space-between', margin: '3px 0' }}>
              <span>{t('common.date')}:</span>
              <span>{formatDate(receipt.sale_date)}</span>
            </div>
            {receipt.customer_name && (
              <div className="row" style={{ display: 'flex', justifyContent: 'space-between', margin: '3px 0' }}>
                <span>{t('common.name')}:</span>
                <span>{receipt.customer_name}</span>
              </div>
            )}
            {receipt.farm_name && (
              <div className="row" style={{ display: 'flex', justifyContent: 'space-between', margin: '3px 0' }}>
                <span>{t('nav.farms')}:</span>
                <span>{receipt.farm_name}</span>
              </div>
            )}

            <div className="divider" style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

            {/* Items */}
            <table className="items-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'start', borderBottom: '1px solid #000', padding: '2px 0', fontSize: '11px' }}>{t('dispatches.product')}</th>
                  <th style={{ textAlign: 'center', borderBottom: '1px solid #000', padding: '2px 0', fontSize: '11px', width: '30px' }}>{t('dispatches.quantity')}</th>
                  <th style={{ textAlign: 'end', borderBottom: '1px solid #000', padding: '2px 0', fontSize: '11px', width: '55px' }}>{t('pos.priceAFN')}</th>
                  <th style={{ textAlign: 'end', borderBottom: '1px solid #000', padding: '2px 0', fontSize: '11px', width: '60px' }}>{t('common.total')}</th>
                </tr>
              </thead>
              <tbody>
                {receipt.items.map((item, i) => (
                  <tr key={i}>
                    <td style={{ padding: '3px 0', fontSize: '11px', verticalAlign: 'top' }}>
                      {item.name}
                    </td>
                    <td style={{ textAlign: 'center', padding: '3px 0', fontSize: '11px', verticalAlign: 'top' }}>
                      {item.quantity}
                    </td>
                    <td style={{ textAlign: 'end', padding: '3px 0', fontSize: '11px', verticalAlign: 'top' }}>
                      {item.price.toLocaleString()}
                    </td>
                    <td style={{ textAlign: 'end', padding: '3px 0', fontSize: '11px', verticalAlign: 'top', fontWeight: 'bold' }}>
                      {(item.price * item.quantity).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="divider" style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

            {/* Totals */}
            <div className="row total-row" style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0', fontWeight: 'bold', fontSize: '14px' }}>
              <span>{t('common.total')}:</span>
              <span>AFN {receipt.total_amount.toLocaleString()}</span>
            </div>
            <div className="row" style={{ display: 'flex', justifyContent: 'space-between', margin: '3px 0' }}>
              <span>{t('pos.paid')}:</span>
              <span style={{ fontWeight: 'bold', color: '#166534' }}>AFN {(receipt.amount_paid || 0).toLocaleString()}</span>
            </div>
            <div className="row" style={{ display: 'flex', justifyContent: 'space-between', margin: '3px 0' }}>
              <span>{t('common.balance')}:</span>
              <span style={{ fontWeight: 'bold', color: receipt.remaining > 0 ? '#991b1b' : '#166534' }}>
                AFN {(receipt.remaining || 0).toLocaleString()}
              </span>
            </div>

            <div className="divider" style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

            <div className="footer" style={{ textAlign: 'center', marginTop: '8px', fontSize: '11px' }}>
              <div>{t('pos.thankYou')}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
