import { useEffect, useState } from 'react'
import { useBusinessInfo } from '../../contexts/SettingsContext'

// Post-login splash. Rendered by AppShell for ~5s after a fresh sign-in
// (flagged via sessionStorage so page refresh / rehydration doesn't
// re-trigger it). Presents "Rahimi Tech Solutions" as the software vendor,
// then the business name, then a "Loading workspace" line, over a slowly
// drifting deep-navy gradient. The pacing is intentionally slow so the
// software feels weighty rather than casual.
export default function PostLoginSplash() {
  const { businessName } = useBusinessInfo()
  const [step, setStep] = useState(0)

  useEffect(() => {
    // Three staged text reveals — vendor / business / workspace-ready — each
    // ~1.2s apart so the user gets a beat to read each line.
    const t1 = setTimeout(() => setStep(1), 1300)
    const t2 = setTimeout(() => setStep(2), 2700)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-linear-to-br from-[#0A1626] via-[#122842] to-[#1B3A5C]">
      {/* Slow-drifting orbs so the background feels alive, not static.
          Longer animation durations (~7-10s) so it reads as calm, not busy. */}
      <div className="absolute inset-0 opacity-40 pointer-events-none">
        <div className="absolute -top-20 -start-20 w-[520px] h-[520px] rounded-full bg-cyan-500/25 blur-3xl animate-pulse" style={{ animationDuration: '7s' }} />
        <div className="absolute -bottom-24 -end-24 w-[620px] h-[620px] rounded-full bg-emerald-400/15 blur-3xl animate-pulse" style={{ animationDuration: '8s', animationDelay: '1s' }} />
        <div className="absolute top-1/3 start-1/2 w-[440px] h-[440px] rounded-full bg-indigo-500/20 blur-3xl animate-pulse" style={{ animationDuration: '9s', animationDelay: '2s' }} />
      </div>

      {/* Grid noise overlay — subtle SVG dot pattern for depth. */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle at center, white 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-lg">
        {/* Four concentric spinning rings + a soft outer glow ring around a
            central logo that gently breathes. Slower rotation speeds
            (3s/4.5s/6s/8s) so the animation reads as deliberate. */}
        <div className="relative w-40 h-40 mb-8">
          {/* Outer glow ring — pulses like a heartbeat. */}
          <div className="absolute -inset-2 rounded-full bg-cyan-400/10 blur-xl animate-pulse" style={{ animationDuration: '3s' }} />
          <div className="absolute inset-0 rounded-full border-2 border-white/15 border-t-white animate-spin" style={{ animationDuration: '3s' }} />
          <div className="absolute inset-3 rounded-full border-2 border-white/10 border-b-emerald-300 animate-spin" style={{ animationDuration: '4.5s', animationDirection: 'reverse' }} />
          <div className="absolute inset-6 rounded-full border-2 border-white/10 border-s-cyan-300 animate-spin" style={{ animationDuration: '6s' }} />
          <div className="absolute inset-9 rounded-full border border-white/5 border-e-indigo-300 animate-spin" style={{ animationDuration: '8s', animationDirection: 'reverse' }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-white/95 text-[#0F1E33] font-black text-3xl shadow-2xl flex items-center justify-center splash-logo-in">
              {(businessName || '?').trim().charAt(0).toUpperCase()}
            </div>
          </div>
        </div>

        {/* Vendor line — always shows first, with a gentle fade-in. */}
        <div className={`transition-all duration-1000 ease-out ${step >= 0 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
          <p className="text-[10px] font-medium text-white/40 uppercase tracking-[0.35em]">Powered by</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mt-2 tracking-tight">
            Rahimi Tech Solutions
          </h1>
          <p className="text-xs text-white/50 mt-1.5 tracking-[0.3em] uppercase">presents</p>
        </div>

        {/* Business name — reveals after ~1.3s. */}
        <div className={`mt-8 transition-all duration-1000 ease-out ${step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <div className="h-px w-20 bg-linear-to-r from-transparent via-white/40 to-transparent mx-auto mb-5" />
          <h2 className="text-xl sm:text-2xl font-semibold text-white/95 tracking-wide">
            {businessName}
          </h2>
          <p className="text-[11px] text-white/50 mt-2 tracking-[0.25em] uppercase">Supply Store Management</p>
        </div>

        {/* Workspace loading line — appears near the end for a "finalizing"
            feel, with a subtle dot animation. */}
        <div className={`mt-6 transition-all duration-1000 ease-out ${step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
          <p className="text-xs text-white/60 tracking-wider inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" style={{ animationDuration: '1.2s' }} />
            Preparing your workspace<span className="splash-dots" />
          </p>
        </div>

        {/* Progress bar at the bottom fills over the full splash duration. */}
        <div className="mt-12 w-64 h-1 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-linear-to-r from-cyan-300 via-emerald-300 to-cyan-300 rounded-full splash-progress" />
        </div>
      </div>

      {/* Inline keyframes — Tailwind doesn't have these built in. */}
      <style>{`
        @keyframes splash-progress-anim {
          from { width: 0%; }
          to   { width: 100%; }
        }
        .splash-progress {
          animation: splash-progress-anim 4.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        @keyframes splash-logo-in {
          0%   { transform: scale(0.5) rotate(-15deg); opacity: 0; }
          60%  { transform: scale(1.08) rotate(2deg);  opacity: 1; }
          100% { transform: scale(1)    rotate(0deg);  opacity: 1; }
        }
        .splash-logo-in {
          animation: splash-logo-in 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }

        @keyframes splash-dots-anim {
          0%, 20%   { content: ''; }
          40%       { content: '.'; }
          60%       { content: '..'; }
          80%, 100% { content: '...'; }
        }
        .splash-dots::after {
          content: '';
          animation: splash-dots-anim 1.6s steps(4, end) infinite;
          display: inline-block;
          width: 1em;
          text-align: start;
        }
      `}</style>
    </div>
  )
}
