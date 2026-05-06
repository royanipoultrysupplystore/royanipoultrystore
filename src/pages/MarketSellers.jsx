import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Phone, Store, Edit2, Trash2, ChevronRight } from 'lucide-react'
import { useMarketSellers } from '../hooks/useMarketSellers'
import Modal from '../components/common/Modal'
import ConfirmDialog from '../components/common/ConfirmDialog'
import PhoneInput from '../components/common/PhoneInput'
import { formatCurrency } from '../utils/formatCurrency'
import { useLanguage } from '../contexts/LanguageContext'

const emptyForm = { name: '', shop_number: '', phone: '', notes: '' }

export default function MarketSellers() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const { sellers, loading, addSeller, updateSeller, deleteSeller } = useMarketSellers()
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  function openAdd() { setEditItem(null); setForm(emptyForm); setModalOpen(true) }
  function openEdit(e, s) {
    e.stopPropagation()
    setEditItem(s)
    setForm({ name: s.name, shop_number: s.shop_number || '', phone: s.phone || '', notes: s.notes || '' })
    setModalOpen(true)
  }

  async function handleSubmit(ev) {
    ev.preventDefault()
    setSaving(true)
    const ok = editItem ? await updateSeller(editItem.id, form) : await addSeller(form)
    setSaving(false)
    if (ok) setModalOpen(false)
  }

  const filtered = sellers.filter(s =>
    !search ||
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.shop_number || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.phone || '').includes(search)
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder={t('market.searchSellers')}
          className="flex-1 px-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
        />
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 bg-[#1B3A5C] text-white rounded-xl text-sm font-medium hover:bg-[#2E86AB] transition-colors">
          <Plus size={16} /> {t('market.addSeller')}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-slate-400">
          <div className="w-8 h-8 border-2 border-[#2E86AB] border-t-transparent rounded-full animate-spin me-3" />{t('common.loading')}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Store size={48} className="mb-4 opacity-30" />
          <p className="text-sm">{t('market.noSellers')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(seller => {
            const totalChickens = (seller.market_transactions || []).reduce((s, t) => s + (t.chicken_count || 0), 0)
            const totalAmount = (seller.market_transactions || []).reduce((s, t) => s + (t.total_amount || 0), 0)
            const txCount = (seller.market_transactions || []).length
            return (
              <div
                key={seller.id}
                onClick={() => navigate(`/market/${seller.id}`)}
                className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 hover:shadow-md hover:border-[#2E86AB]/30 transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-slate-800 group-hover:text-[#1B3A5C] transition-colors">{seller.name}</h3>
                    {seller.shop_number && (
                      <p className="text-sm text-slate-500">{t('market.shopNumber')}: {seller.shop_number}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={e => openEdit(e, seller)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); setDeleteTarget(seller) }} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                    <ChevronRight size={16} className="text-slate-300 group-hover:text-[#2E86AB] transition-colors" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                  <div className="bg-blue-50 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-blue-700">{txCount}</p>
                    <p className="text-xs text-blue-500">Txns</p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-orange-700">{totalChickens.toLocaleString()}</p>
                    <p className="text-xs text-orange-500">🐔</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-2 text-center">
                    <p className="text-sm font-bold text-green-700">{formatCurrency(totalAmount)}</p>
                    <p className="text-xs text-green-500">Paid</p>
                  </div>
                </div>

                {seller.phone && (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Phone size={13} /> {seller.phone}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { deleteSeller(deleteTarget?.id); setDeleteTarget(null) }}
        title={t('market.deleteSeller')}
        message={t('market.deleteSellerMsg')}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('market.editSeller') : t('market.addSeller')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.name')} *</label>
            <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('market.shopNumber')}</label>
              <input value={form.shop_number} onChange={e => setForm(f => ({ ...f, shop_number: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.phone')}</label>
              <PhoneInput value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.notes')}</label>
            <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30 resize-none" />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">{t('common.cancel')}</button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium bg-[#1B3A5C] text-white rounded-lg hover:bg-[#2E86AB] disabled:opacity-60">
              {saving ? t('common.saving') : editItem ? t('common.saveChanges') : t('market.addSeller')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
