import { useState, useEffect } from 'react'
import { Plus, Trash2, Edit2, Shield, User, UserCog } from 'lucide-react'
import { supabase } from '../config/supabase'
import { useAuth } from '../contexts/AuthContext'
import Modal from '../components/common/Modal'
import ConfirmDialog from '../components/common/ConfirmDialog'
import { formatDate } from '../utils/dateHelpers'
import toast from 'react-hot-toast'

const emptyForm = { name: '', username: '', password: '', role: 'associate' }

export default function Users() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  async function fetchUsers() {
    setLoading(true)
    const { data, error } = await supabase
      .from('app_users')
      .select('id, name, username, role, created_at')
      .order('created_at', { ascending: true })
    if (error) toast.error(error.message)
    else setUsers(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchUsers() }, [])

  function openAdd() {
    setEditItem(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  function openEdit(u) {
    setEditItem(u)
    setForm({ name: u.name, username: u.username, password: '', role: u.role })
    setModalOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!editItem && !form.password) {
      toast.error('Password is required for new users')
      return
    }
    setSaving(true)
    if (editItem) {
      const { error } = await supabase.rpc('update_user', {
        p_id: editItem.id,
        p_name: form.name,
        p_username: form.username,
        p_role: form.role,
        p_password: form.password || null,
      })
      if (error) toast.error(error.message)
      else toast.success('User updated')
    } else {
      const { error } = await supabase.rpc('add_user', {
        p_name: form.name,
        p_username: form.username,
        p_password: form.password,
        p_role: form.role,
      })
      if (error) toast.error(error.message)
      else toast.success('User added')
    }
    setSaving(false)
    setModalOpen(false)
    await fetchUsers()
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('app_users').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('User deleted'); await fetchUsers() }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <UserCog size={22} className="text-[#1B3A5C]" /> Users & Access
        </h2>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#1B3A5C] text-white rounded-xl text-sm font-medium hover:bg-[#2E86AB]"
        >
          <Plus size={16} /> Add User
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
        <p><strong>Admin</strong> users see and manage everything in the system.</p>
        <p className="mt-1"><strong>Associate</strong> users only see the Commission section — designed for the bazaar associate using a phone or tablet.</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading…</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase">
                  <th className="text-start px-5 py-3 font-medium">Name</th>
                  <th className="text-start px-5 py-3 font-medium">Username</th>
                  <th className="text-start px-5 py-3 font-medium">Role</th>
                  <th className="text-start px-5 py-3 font-medium">Created</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-800">
                      {u.name}
                      {u.id === currentUser.id && (
                        <span className="ms-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">You</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-600 font-mono" dir="ltr">{u.username}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                        u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {u.role === 'admin' ? <Shield size={11} /> : <User size={11} />}
                        {u.role === 'admin' ? 'Admin' : 'Associate'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-500 text-xs">{formatDate(u.created_at)}</td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => openEdit(u)} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg">
                          <Edit2 size={14} />
                        </button>
                        {u.id !== currentUser.id && (
                          <button onClick={() => setDeleteTarget(u)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Edit User' : 'Add User'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Full Name *</label>
            <input
              required value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Username *</label>
            <input
              required value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase().replace(/\s/g, '') }))}
              dir="ltr" autoComplete="off"
              placeholder="e.g. associate1"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Password {!editItem && '*'}
              {editItem && <span className="text-slate-400 ms-1 font-normal">(leave blank to keep current)</span>}
            </label>
            <input
              type="text" value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              dir="ltr" autoComplete="off"
              required={!editItem}
              placeholder={editItem ? '••••••••' : 'Min 6 characters'}
              minLength={editItem ? 0 : 6}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Role *</label>
            <div className="grid grid-cols-2 gap-2">
              <label className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 cursor-pointer text-sm font-medium ${form.role === 'admin' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                <input type="radio" name="role" value="admin" checked={form.role === 'admin'} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="sr-only" />
                <Shield size={14} /> Admin
              </label>
              <label className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 cursor-pointer text-sm font-medium ${form.role === 'associate' ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                <input type="radio" name="role" value="associate" checked={form.role === 'associate'} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="sr-only" />
                <User size={14} /> Associate
              </label>
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              {form.role === 'admin' ? 'Full access to entire system' : 'Only sees Commission section'}
            </p>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium bg-[#1B3A5C] text-white rounded-lg hover:bg-[#2E86AB] disabled:opacity-60">
              {saving ? 'Saving…' : editItem ? 'Save Changes' : 'Add User'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => handleDelete(deleteTarget?.id)}
        title="Delete User"
        message={`Delete user "${deleteTarget?.name}"? They will no longer be able to log in.`}
        confirmLabel="Delete"
      />
    </div>
  )
}
