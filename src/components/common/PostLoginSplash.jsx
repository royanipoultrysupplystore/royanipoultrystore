import { useEffect, useState } from 'react'
import { useBusinessInfo } from '../../contexts/SettingsContext'

// Post-login splash. Rendered by AppShell for ~2.5s after a fresh sign-in
// (flagged via sessionStorage so page refresh / rehydration doesn't
// re-trigger it). Presents "Rahimi Tech Solutions" as the software vendor,
// then the business name, on a slowly animating gradient with orbiting rings.
export default function PostLoginSplash() {
  const { businessName } = useBusinessInfo()
  const [step, setStep] = useState(0)

  useEffect(() => {
    // Two staged text reveals — vendor first, then business name.
    const t1 = setTimeout(() => setStep(1), 900)
    return () => clearTimeout(t1)
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-linear-to-br from-[#0F1E33] via-[#1B3A5C] to-[#2E86AB]">
      {/* Slow-drifting orbs so the background feels alive, not static. */}
      <div className="absolute inset-0 opacity-40 pointer-events-none">
        <div className="absolute -top-20 -start-20 w-[420px] h-[420px] rounded-full bg-cyan-500/30 blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute -bottom-24 -end-24 w-[520px] h-[520px] rounded-full bg-emerald-400/20 blur-3xl animate-pulse" style={{ animationDuration: '5s', animationDelay: '0.7s' }} />
        <div className="absolute top-1/3 start-1/2 w-[380px] h-[380px] rounded-full bg-indigo-500/25 blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '1.4s' }} />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-lg">
        {/* Three concentric spinning rings around a central logo. */}
        <div className="relative w-32 h-32 mb-6">
          <div className="absolute inset-0 rounded-full border-2 border-white/20 border-t-white animate-spin" style={{ animationDuration: '2s' }} />
          <div className="absolute inset-2 rounded-full border-2 border-white/15 border-b-emerald-300 animate-spin" style={{ animationDuration: '2.6s', animationDirection: 'reverse' }} />
          <div className="absolute inset-4 rounded-full border-2 border-white/10 border-s-cyan-300 animate-spin" style={{ animationDuration: '3.2s' }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-14 h-14 rounded-2xl bg-white/95 text-[#1B3A5C] font-black text-2xl shadow-2xl flex items-center justify-center">
              {(businessName || '?').trim().charAt(0).toUpperCase()}
            </div>
          </div>
        </div>

        {/* Vendor line — always shows first. */}
        <div className={`transition-all duration-700 ${step >= 0 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
          <p className="text-[10px] font-medium text-white/50 uppercase tracking-[0.3em]">Powered by</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1 tracking-tight">
            Rahimi Tech Solutions
          </h1>
          <p className="text-xs text-white/60 mt-1 tracking-wide">presents</p>
        </div>

        {/* Business name — reveals a beat after the vendor line. */}
        <div className={`mt-6 transition-all duration-700 ${step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
          <div className="h-px w-16 bg-white/30 mx-auto mb-4" />
          <h2 className="text-xl sm:text-2xl font-semibold text-white/95">
            {businessName}
          </h2>
          <p className="text-xs text-white/60 mt-2 tracking-wide uppercase">Supply Store Management</p>
        </div>

        {/* Progress bar at the bottom fills over the splash duration. */}
        <div className="mt-10 w-56 h-1 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-linear-to-r from-cyan-300 via-emerald-300 to-cyan-300 rounded-full splash-progress" />
        </div>
      </div>

      {/* Inline keyframes — Tailwind doesn't have an "expand from 0 to 100%
          width" animation, so define it locally. */}
      <style>{`
        @keyframes splash-progress-anim {
          from { width: 0%; }
          to   { width: 100%; }
        }
        .splash-progress {
          animation: splash-progress-anim 2.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
      `}</style>
    </div>
  )
}
