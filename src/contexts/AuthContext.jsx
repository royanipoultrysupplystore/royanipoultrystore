import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../config/supabase'

const STORAGE_KEY = 'royani_app_user'
const AuthContext = createContext({
  user: null,
  loading: true,
  login: async () => false,
  logout: () => {},
})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setUser(JSON.parse(stored))
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
    setLoading(false)
  }, [])

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
    setUser(safeUser)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safeUser))
    return { ok: true, user: safeUser }
  }

  function logout() {
    setUser(null)
    localStorage.removeItem(STORAGE_KEY)
  }

  const isAdmin = user?.role === 'admin'
  const isAssociate = user?.role === 'associate'

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin, isAssociate }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
