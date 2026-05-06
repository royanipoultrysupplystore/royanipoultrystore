import { createContext, useContext, useState, useEffect } from 'react'
import translations from '../i18n/translations'

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem('lang') || 'en')

  const isRTL = lang !== 'en'

  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr'
    document.documentElement.lang = lang
    document.documentElement.className = isRTL ? 'font-dari' : ''
  }, [lang, isRTL])

  function t(key) {
    const keys = key.split('.')
    let val = translations[lang]
    for (const k of keys) {
      if (val == null) break
      val = val[k]
    }
    if (val == null || typeof val !== 'string') {
      val = translations.en
      for (const k of keys) {
        if (val == null) break
        val = val[k]
      }
    }
    return (typeof val === 'string' ? val : key)
  }

  function setLanguage(newLang) {
    setLangState(newLang)
    localStorage.setItem('lang', newLang)
  }

  return (
    <LanguageContext.Provider value={{ lang, t, setLanguage, isRTL }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider')
  return ctx
}
