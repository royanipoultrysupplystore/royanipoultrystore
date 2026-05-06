import { useEffect, useRef, useState } from 'react'
import { Camera, X, Scan } from 'lucide-react'
import { useLanguage } from '../../contexts/LanguageContext'

// USB scanner: listens for fast keyboard input ending in Enter
export function useBarcodeListener(onScan) {
  const buffer = useRef('')
  const timer = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Enter') {
        if (buffer.current.length > 2) onScan(buffer.current)
        buffer.current = ''
        clearTimeout(timer.current)
        return
      }
      if (e.key.length === 1) {
        buffer.current += e.key
        clearTimeout(timer.current)
        timer.current = setTimeout(() => { buffer.current = '' }, 100)
      }
    }
    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
      clearTimeout(timer.current)
    }
  }, [onScan])
}

// Camera barcode scanner using BarcodeDetector API
export default function BarcodeScanner({ onScan, onClose }) {
  const { t } = useLanguage()
  const videoRef = useRef(null)
  const [error, setError] = useState(null)
  const streamRef = useRef(null)
  const animRef = useRef(null)

  useEffect(() => {
    let active = true

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        })
        streamRef.current = stream
        if (videoRef.current && active) {
          videoRef.current.srcObject = stream
        }

        if (!('BarcodeDetector' in window)) {
          setError(t('inventory.notSupported'))
          return
        }

        const detector = new window.BarcodeDetector()

        const scan = async () => {
          if (!active) return
          try {
            if (videoRef.current && videoRef.current.readyState === 4) {
              const barcodes = await detector.detect(videoRef.current)
              if (barcodes.length > 0) {
                onScan(barcodes[0].rawValue)
                return
              }
            }
          } catch {}
          animRef.current = requestAnimationFrame(scan)
        }
        animRef.current = requestAnimationFrame(scan)
      } catch (err) {
        setError(t('inventory.noCameraAccess'))
      }
    }

    start()

    return () => {
      active = false
      cancelAnimationFrame(animRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
    }
  }, [onScan])

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between p-4 bg-black/80">
        <div className="flex items-center gap-2 text-white">
          <Scan size={20} />
          <span className="font-medium">{t('inventory.scanTitle')}</span>
        </div>
        <button onClick={onClose} className="p-2 rounded-full bg-white/20 text-white">
          <X size={20} />
        </button>
      </div>

      {error ? (
        <div className="flex-1 flex items-center justify-center p-8 text-center text-white">
          <div>
            <Camera size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-red-400">{error}</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 relative">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-64 h-48 border-2 border-white rounded-lg opacity-60" />
          </div>
          <p className="absolute bottom-8 left-0 right-0 text-center text-white text-sm opacity-70">
            {t('inventory.pointCamera')}
          </p>
        </div>
      )}
    </div>
  )
}
