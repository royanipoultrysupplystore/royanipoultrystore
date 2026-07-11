import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../config/supabase'

const STORAGE_KEY = 'royani_app_user'
const AuthContext = createContext({
  user: null,
  loading: true,
  login: async () => false,
  logout: () => {},
  bumpOwnSessionVersion: async () => {},
})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const logout = useCallback(() => {
    setUser(null)
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  // Fetch the DB session_version for the stored user and compare. If the
  // server-side version is higher than what we have (an admin bumped it),
  // or the user row was deleted, log this session out.
  const verifySession = useCallback(async (u) => {
    if (!u) return
    const { data, error } = await supabase
      .from('app_users')
      .select('session_version')
      .eq('id', u.id)
      .maybeSingle()
    if (error) return // network hiccup — keep session, retry later
    if (!data) { logout(); return } // user was deleted
    if ((data.session_version || 1) !== (u.session_version || 1)) {
      logout()
    }
  }, [logout])

  useEffect(() => {
    let stored = null
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) stored = JSON.parse(raw)
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
    if (stored) {
      setUser(stored)
      verifySession(stored)
    }
    setLoading(false)

    // Re-verify whenever the tab regains focus, so a forced logout kicks in
    // as soon as the user comes back to the browser.
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) verifySession(JSON.parse(raw))
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    // Also poll every 60 seconds so idle-open tabs still pick up the change.
    const poll = setInterval(() => {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) verifySession(JSON.parse(raw))
    }, 60_000)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      clearInterval(poll)
    }
  }, [verifySession])

  async function login(username, password) {
    const { data, error } = await supabase.rpc('auth_login', {
      p_username: username,
      p_password: password,
    })
    if (error) {
      console.error('Login error:', error)
      return { ok: false, message: error.message }
    }
    if (!data || data.length === 0) {
      return { ok: false, message: 'Invalid username or password' }
    }
    // Strip the password hash — never persist it to localStorage
    const { password: _pw, ...safeUser } = data[0]
    // Fetch the current session_version so this session is "pinned" to that
    // value; if it's later bumped server-side, verifySession will log us out.
    const { data: verRow } = await supabase
      .from('app_users')
      .select('session_version')
      .eq('id', safeUser.id)
      .maybeSingle()
    safeUser.session_version = verRow?.session_version || 1
    setUser(safeUser)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safeUser))
    return { ok: true, user: safeUser }
  }

  // Used after the current admin bumps their OWN session_version (e.g. after
  // changing their password). Refreshes the pinned version so they don't
  // immediately log themselves out.
  async function refreshOwnSessionVersion() {
    if (!user) return
    const { data } = await supabase
      .from('app_users')
      .select('session_version')
      .eq('id', user.id)
      .maybeSingle()
    if (data) {
      const next = { ...user, session_version: data.session_version || 1 }
      setUser(next)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    }
  }

  const isAdmin = user?.role === 'admin'
  const isAssociate = user?.role === 'associate'

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin, isAssociate, refreshOwnSessionVersion }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
