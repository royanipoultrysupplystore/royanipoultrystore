import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { LanguageProvider } from './contexts/LanguageContext'
import { StoreCashProvider } from './contexts/StoreCashContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LanguageProvider>
      <StoreCashProvider>
        <App />
      </StoreCashProvider>
    </LanguageProvider>
  </StrictMode>,
)
