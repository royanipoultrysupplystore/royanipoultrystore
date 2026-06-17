import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Phone, MapPin, Edit2, ChevronRight, Building2, Trash2 } from 'lucide-react'
import { useFarms } from '../hooks/useFarms'
import Modal from '../components/common/Modal'
import ConfirmDialog from '../components/common/ConfirmDialog'
import PhoneInput from '../components/common/PhoneInput'
import { formatCurrency } from '../utils/formatCurrency'
import { useLanguage } from '../contexts/LanguageContext'
import { lf } from '../utils/localizedField'

const emptyForm = { name: '', owner_name: '', phone: '', location: '', notes: '', is_active: true, initial_chicken_count: 0, price_per_chicken: 0 }

export default function Farms() {
  const navigate = useNavigate()
  const { t, lang } = useLanguage()
  const { farms, loading, addFarm, updateFarm, deleteFarm } = useFarms()
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  function openAdd() { setEditItem(null); setForm(emptyForm); setModalOpen(true) }
  function openEdit(e, farm) { e.stopPropagation(); setEditItem(farm); setForm({ ...farm }); setModalOpen(true) }

  async function handleSubmit(ev) {
    ev.preventDefault()
    setSaving(true)
    if (editItem) await updateFarm(editItem.id, form)
    else await addFarm(form)
    setSaving(false)
    setModalOpen(false)
  }

  const filtered = farms
    .filter(f => !search || f.name.toLowerCase().includes(search.toLowerCase()) || (f.owner_name || '').toLowerCase().includes(search.toLowerCase()))
    // Highest debt first so the farms that actually need attention are at the top;
    // farms with zero balance sink to the bottom.
    .sort((a, b) => (b.current_debt || 0) - (a.current_debt || 0))

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-400">
      <div className="w-8 h-8 border-2 border-[#2E86AB] border-t-transparent rounded-full animate-spin me-3" />{t('common.loading')}
    </div>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder={t('farms.searchFarms')}
          className="flex-1 px-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
        />
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 bg-[#1B3A5C] text-white rounded-xl text-sm font-medium hover:bg-[#2E86AB] transition-colors">
          <Plus size={16} /> {t('farms.addFarm')}
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Building2 size={48} className="mb-4 opacity-30" />
          <p className="text-sm">{t('farms.noFarms')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(farm => (
            <div
              key={farm.id}
              onClick={() => navigate(`/farms/${farm.id}`)}
              className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 hover:shadow-md hover:border-[#2E86AB]/30 transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-slate-800 group-hover:text-[#1B3A5C] transition-colors">{lf(farm, 'name', lang)}</h3>
                  <p className="text-sm text-slate-500">{lf(farm, 'owner_name', lang) || t('farms.noOwner')}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={(e) => openEdit(e, farm)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(farm) }} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                  <ChevronRight size={16} className="text-slate-300 group-hover:text-[#2E86AB] transition-colors" />
                </div>
              </div>

              <div className={`rounded-xl p-3 mb-4 ${farm.current_debt > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                <p className={`text-xs font-medium mb-0.5 ${farm.current_debt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {farm.current_debt > 0 ? t('farms.currentDebt') : t('common.balance')}
                </p>
                <p className={`text-xl font-bold ${farm.current_debt > 0 ? 'text-red-700' : 'text-green-700'}`}>
                  {formatCurrency(farm.current_debt)}
                </p>
              </div>

              <div className="space-y-1.5">
                {farm.phone && (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Phone size={13} /> {farm.phone}
                  </div>
                )}
                {farm.location && (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <MapPin size={13} /> {farm.location}
                  </div>
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${farm.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                  {farm.is_active ? t('common.active') : t('common.inactive')}
                </span>
                <span className="text-xs text-slate-400">{t('farms.totalProfit')}: {formatCurrency(farm.total_profit_generated)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { deleteFarm(deleteTarget?.id); setDeleteTarget(null) }}
        title={t('farms.deleteFarm')}
        message={`${t('common.delete')} "${deleteTarget?.name}"? ${t('farms.deleteConfirm')}`}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('farms.editFarm') : t('farms.addFarm')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('farms.farmName')} *</label>
            <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('farms.ownerName')}</label>
            <input value={form.owner_name} onChange={e => setForm(f => ({ ...f, owner_name: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.phone')}</label>
              <PhoneInput value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.location')}</label>
              <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('farms.initialChickenCount')}</label>
              <input
                type="number" min="0"
                value={form.initial_chicken_count || 0}
                onChange={e => setForm(f => ({ ...f, initial_chicken_count: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('farms.pricePerChicken')}</label>
              <input
                type="number" min="0" step="0.01"
                value={form.price_per_chicken || 0}
                onChange={e => setForm(f => ({ ...f, price_per_chicken: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.notes')}</label>
            <textarea rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30 resize-none" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="active" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded" />
            <label htmlFor="active" className="text-sm text-slate-600">{t('farms.activeFarm')}</label>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">{t('common.cancel')}</button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium bg-[#1B3A5C] text-white rounded-lg hover:bg-[#2E86AB] disabled:opacity-60">
              {saving ? t('common.saving') : editItem ? t('common.saveChanges') : t('farms.addFarm')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
