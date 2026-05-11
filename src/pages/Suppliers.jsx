import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, Search, Building2, Phone, Edit2, Trash2, ChevronRight, ChevronLeft } from 'lucide-react'
import { useSuppliers } from '../hooks/useSuppliers'
import Modal from '../components/common/Modal'
import ConfirmDialog from '../components/common/ConfirmDialog'
import PhoneInput from '../components/common/PhoneInput'
import { useLanguage } from '../contexts/LanguageContext'

const emptyForm = { company_name: '', owner_name: '', phone: '', notes: '' }

const TABS = [
  { key: 'meel',     labelKey: 'meelSuppliers',     icon: '🌾', iconColor: 'text-[#1B3A5C]', bgColor: 'bg-[#1B3A5C]/10' },
  { key: 'medicine', labelKey: 'medicineSuppliers',  icon: '💊', iconColor: 'text-blue-600',   bgColor: 'bg-blue-100' },
  { key: 'choza',    labelKey: 'chozaSuppliers',     icon: '🐥', iconColor: 'text-amber-600',  bgColor: 'bg-amber-100' },
]

function getTabConfig(type) {
  return TABS.find(t => t.key === type) || TABS[0]
}

export default function Suppliers() {
  const { t, isRTL } = useLanguage()
  const { suppliers, loading, addSupplier, updateSupplier, deleteSupplier } = useSuppliers()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const activeTab = ['meel', 'medicine', 'choza'].includes(tabParam) ? tabParam : 'meel'
  function setActiveTab(tab) {
    setSearchParams({ tab })
  }
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const ChevronIcon = isRTL ? ChevronLeft : ChevronRight

  function openAdd() {
    setEditItem(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  function openEdit(s) {
    setEditItem(s)
    setForm({ company_name: s.company_name, owner_name: s.owner_name || '', phone: s.phone || '', notes: s.notes || '' })
    setModalOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    if (editItem) {
      await updateSupplier(editItem.id, form)
    } else {
      await addSupplier({ ...form, type: activeTab })
    }
    setSaving(false)
    setModalOpen(false)
  }

  function getProfileLink(s) {
    if (s.type === 'medicine') return `/suppliers/medicine/${s.id}`
    if (s.type === 'choza') return `/suppliers/choza/${s.id}`
    return `/suppliers/${s.id}`
  }

  function getAddLabel() {
    if (activeTab === 'medicine') return t('suppliers.addMedicineSupplier')
    if (activeTab === 'choza') return t('suppliers.addChozaSupplier')
    return t('suppliers.addSupplier')
  }

  const filtered = suppliers.filter(s =>
    (s.type || 'meel') === activeTab &&
    (!search ||
      s.company_name.toLowerCase().includes(search.toLowerCase()) ||
      (s.owner_name || '').toLowerCase().includes(search.toLowerCase()))
  )

  const tabCfg = getTabConfig(activeTab)

  return (
    <div className="space-y-4">
      {/* Type Tabs */}
      <div className="flex gap-1 bg-white rounded-xl p-1 border border-slate-100 shadow-sm w-fit">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setSearch('') }}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key ? 'bg-[#1B3A5C] text-white shadow' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {tab.icon} {t(`suppliers.${tab.labelKey}`)}
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute inset-s-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('suppliers.searchPlaceholder')}
            className="w-full ps-9 pe-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
          />
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 bg-[#1B3A5C] text-white rounded-xl text-sm font-medium hover:bg-[#2E86AB] transition-colors">
          <Plus size={16} /> {getAddLabel()}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">{t('common.loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400">{t('suppliers.noSuppliers')}</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(s => (
            <div key={s.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl ${tabCfg.bgColor} flex items-center justify-center shrink-0`}>
                    <Building2 size={20} className={tabCfg.iconColor} />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800">{s.company_name}</div>
                    {s.owner_name && <div className="text-xs text-slate-500 mt-0.5">{s.owner_name}</div>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(s)} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => setDeleteTarget(s)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {s.phone && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
                  <Phone size={12} /> <span dir="ltr">{s.phone}</span>
                </div>
              )}
              {s.notes && (
                <p className="text-xs text-slate-400 mb-3 line-clamp-2">{s.notes}</p>
              )}

              <Link
                to={getProfileLink(s)}
                className="flex items-center justify-between w-full px-3 py-2 bg-slate-50 hover:bg-[#1B3A5C] hover:text-white rounded-lg text-sm font-medium text-slate-700 transition-colors group"
              >
                <span>{t('suppliers.viewProfile')}</span>
                <ChevronIcon size={14} />
              </Link>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? t('suppliers.editSupplier') : getAddLabel()}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('suppliers.companyName')} *</label>
            <input
              required
              value={form.company_name}
              onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('suppliers.ownerName')}</label>
            <input
              value={form.owner_name}
              onChange={e => setForm(f => ({ ...f, owner_name: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('suppliers.phone')}</label>
            <PhoneInput value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.notes')}</label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30 resize-none"
            />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium bg-[#1B3A5C] text-white rounded-lg hover:bg-[#2E86AB] disabled:opacity-60">
              {saving ? t('common.saving') : editItem ? t('common.saveChanges') : getAddLabel()}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteSupplier(deleteTarget?.id)}
        title={t('suppliers.deleteSupplier')}
        message={t('suppliers.deleteConfirm')}
      />
    </div>
  )
}
