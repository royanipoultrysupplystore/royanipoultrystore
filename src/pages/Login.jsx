import { useState } from 'react'
import { LogIn, Lock, User } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useBusinessInfo } from '../contexts/SettingsContext'
import toast from 'react-hot-toast'

export default function Login() {
  const { login } = useAuth()
  const { businessName } = useBusinessInfo()
  const logoLetter = (businessName || '?').trim().charAt(0).toUpperCase()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    const result = await login(username.trim(), password)
    setSubmitting(false)
    if (!result.ok) {
      toast.error(result.message || 'Login failed')
    } else {
      toast.success(`Welcome, ${result.user.name}`)
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-[#1B3A5C] to-[#2E86AB] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto bg-white rounded-2xl flex items-center justify-center text-[#1B3A5C] font-bold text-3xl shadow-lg mb-4">
            {logoLetter}
          </div>
          <h1 className="text-2xl font-bold text-white">{businessName}</h1>
          <p className="text-white/70 text-sm">Supply Store Management</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-2xl">
          <h2 className="text-lg font-semibold text-slate-800 mb-1">Sign In</h2>
          <p className="text-xs text-slate-500 mb-5">Enter your credentials to continue</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Username</label>
              <div className="relative">
                <User size={16} className="absolute inset-s-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  required
                  autoFocus
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="admin"
                  autoComplete="username"
                  dir="ltr"
                  className="w-full ps-9 pe-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute inset-s-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  required
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  dir="ltr"
                  className="w-full ps-9 pe-16 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(s => !s)}
                  className="absolute inset-e-2 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-700 px-2 py-1"
                >
                  {showPwd ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#1B3A5C] hover:bg-[#2E86AB] text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-60"
            >
              <LogIn size={16} />
              {submitting ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="text-xs text-slate-400 mt-5 text-center">
            Default admin: <code className="bg-slate-100 px-1.5 py-0.5 rounded">admin</code> / <code className="bg-slate-100 px-1.5 py-0.5 rounded">admin123</code>
            <br />
            <span className="text-amber-600 font-medium">⚠ Change after first login</span>
          </p>
        </div>

        <p className="text-center text-white/50 text-xs mt-6">
          {businessName} System v1.0
        </p>
      </div>
    </div>
  )
}
