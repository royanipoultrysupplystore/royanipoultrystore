import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../config/supabase'
import { useLanguage } from './LanguageContext'
import toast from 'react-hot-toast'

// Store Cash Lock — internal control so cashiers can't skim by unchecking the
// "Received to store cash" toggle. When a password is set in Settings, every
// attempt to uncheck a Store Cash checkbox opens a password prompt; only the
// person who knows the password (owner / admin) can bypass the till.
//
// If no password is set, checkboxes work normally (backward compatible).
const StoreCashLockContext = createContext(null)

export function StoreCashLockProvider({ children }) {
  const { t } = useLanguage()
  const [password, setPassword] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [prompt, setPrompt] = useState(null) // { onSuccess }
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('settings').select('value').eq('key', 'store_cash_unlock_password').maybeSingle()
      setPassword((data?.value || '').trim())
      setLoaded(true)
    })()
  }, [])

  useEffect(() => {
    if (prompt && inputRef.current) inputRef.current.focus()
  }, [prompt])

  const isLocked = loaded && password.length > 0

  // Ask for the password before running `onSuccess`. If no password is set,
  // runs the callback immediately.
  const requestUncheck = useCallback((onSuccess) => {
    if (!isLocked) { onSuccess?.(); return }
    setInput('')
    setError('')
    setPrompt({ onSuccess })
  }, [isLocked])

  function handleSubmit(e) {
    e.preventDefault()
    if (input === password) {
      const cb = prompt?.onSuccess
      setPrompt(null)
      setInput('')
      setError('')
      cb?.()
    } else {
      setError(t('storeCash.wrongPassword'))
      setInput('')
      if (inputRef.current) inputRef.current.focus()
    }
  }

  // Called from Settings when the admin changes the unlock password.
  async function saveUnlockPassword(next) {
    const val = (next || '').trim()
    const { error: err } = await supabase
      .from('settings')
      .upsert({ key: 'store_cash_unlock_password', value: val }, { onConflict: 'key' })
    if (err) { toast.error(err.message); return false }
    setPassword(val)
    return true
  }

  return (
    <StoreCashLockContext.Provider value={{ isLocked, requestUncheck, unlockPassword: password, saveUnlockPassword }}>
      {children}
      {prompt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setPrompt(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold text-slate-800 text-lg mb-1">{t('storeCash.unlockTitle')}</h2>
            <p className="text-xs text-slate-500 mb-4">{t('storeCash.unlockNote')}</p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                ref={inputRef}
                type="password"
                value={input}
                onChange={e => { setInput(e.target.value); setError('') }}
                placeholder={t('storeCash.passwordPlaceholder')}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86AB]/30"
                autoComplete="off"
              />
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setPrompt(null)} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">
                  {t('common.cancel')}
                </button>
                <button type="submit" className="px-5 py-2 text-sm font-medium bg-[#1B3A5C] text-white rounded-lg hover:bg-[#2E86AB]">
                  {t('storeCash.unlock')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </StoreCashLockContext.Provider>
  )
}

export function useStoreCashLock() {
  const ctx = useContext(StoreCashLockContext)
  if (!ctx) throw new Error('useStoreCashLock must be used inside <StoreCashLockProvider>')
  return ctx
}
