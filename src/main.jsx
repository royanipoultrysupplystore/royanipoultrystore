import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { LanguageProvider } from './contexts/LanguageContext'
import { StoreCashProvider } from './contexts/StoreCashContext'
import { StoreCashLockProvider } from './contexts/StoreCashLockContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LanguageProvider>
      <StoreCashLockProvider>
        <StoreCashProvider>
          <App />
        </StoreCashProvider>
      </StoreCashLockProvider>
    </LanguageProvider>
  </StrictMode>,
)
