'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  onDetected: (barcode: string) => void
  onClose: () => void
}

export default function BarcodeScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string>('')
  const [manualCode, setManualCode] = useState('')

  useEffect(() => {
    let stream: MediaStream | null = null
    let interval: NodeJS.Timeout | null = null

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }

        // Use BarcodeDetector if available
        if ('BarcodeDetector' in window) {
          const detector = new (window as unknown as { BarcodeDetector: new (opts: object) => { detect: (el: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
          })

          interval = setInterval(async () => {
            if (videoRef.current && videoRef.current.readyState === 4) {
              try {
                const barcodes = await detector.detect(videoRef.current)
                if (barcodes.length > 0) {
                  onDetected(barcodes[0].rawValue)
                }
              } catch {}
            }
          }, 500)
        }
      } catch (err) {
        setError('無法存取相機，請手動輸入條碼。')
      }
    }

    startCamera()

    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop())
      if (interval) clearInterval(interval)
    }
  }, [onDetected])

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
        <div className="p-4 border-b border-nude-100 flex items-center justify-between">
          <h3 className="font-semibold text-nude-800">掃描條碼</h3>
          <button onClick={onClose} className="text-nude-500 hover:text-nude-700 text-lg">✕</button>
        </div>

        <div className="p-4 space-y-4">
          {error ? (
            <p className="text-sm text-red-500">{error}</p>
          ) : (
            <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-48 h-32 border-2 border-blush-400 rounded-xl opacity-70" />
              </div>
            </div>
          )}

          <div className="text-center text-xs text-nude-500">或手動輸入條碼</div>

          <div className="flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="輸入條碼號碼"
              className="input-field flex-1"
              onKeyDown={(e) => e.key === 'Enter' && manualCode && onDetected(manualCode)}
            />
            <button
              onClick={() => manualCode && onDetected(manualCode)}
              className="btn-primary px-3"
              disabled={!manualCode}
            >
              查詢
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
