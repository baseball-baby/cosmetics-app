'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Cosmetic, CATEGORIES } from '@/lib/types'
import BarcodeScanner from './BarcodeScanner'
import AutoResizeTextarea from './AutoResizeTextarea'
import { ScanBarcode, Sparkles, ImagePlus, X, Info } from 'lucide-react'
import { compressImage } from '@/lib/compressImage'

interface Props {
  initial?: Partial<Cosmetic>
  onSuccess?: (cosmetic: Cosmetic) => void
}

function DismissibleTip({ storageKey, children }: { storageKey: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(storageKey)) setVisible(true)
  }, [storageKey])

  if (!visible) return null

  return (
    <div className="flex items-start gap-2 bg-blush-50 border border-blush-200 rounded-xl px-3 py-2.5 text-xs text-blush-700">
      <Info size={13} className="flex-shrink-0 mt-0.5" />
      <span className="flex-1">{children}</span>
      <button
        type="button"
        onClick={() => { localStorage.setItem(storageKey, '1'); setVisible(false) }}
        className="flex-shrink-0 text-blush-400 hover:text-blush-600 transition-colors"
      >
        <X size={13} />
      </button>
    </div>
  )
}

export default function CosmeticForm({ initial, onSuccess }: Props) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [showScanner, setShowScanner] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [filling, setFilling] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [brandSuggestions, setBrandSuggestions] = useState<string[]>([])
  const [productSuggestions, setProductSuggestions] = useState<{ name: string; category: string; image: string | null }[]>([])
  const [shadeSuggestions, setShadeSuggestions] = useState<{ name: string; image: string | null }[]>([])
  const [showBrandDrop, setShowBrandDrop] = useState(false)
  const [showProductDrop, setShowProductDrop] = useState(false)
  const [showShadeDrop, setShowShadeDrop] = useState(false)
  const [productSearching, setProductSearching] = useState(false)
  const [shadeSearching, setShadeSearching] = useState(false)
  const brandTimer = useRef<ReturnType<typeof setTimeout>>()
  const productTimer = useRef<ReturnType<typeof setTimeout>>()
  const shadeTimer = useRef<ReturnType<typeof setTimeout>>()

  const initPhoto = (() => {
    if (initial?.photo_urls) {
      try { return (JSON.parse(initial.photo_urls) as string[])[0] || null } catch {}
    }
    return initial?.photo_url || null
  })()

  const [photo, setPhoto] = useState<string | null>(initPhoto)

  const [form, setForm] = useState({
    brand: initial?.brand || '',
    name: initial?.name || '',
    category: initial?.category || '其他',
    shade_name: initial?.shade_name || '',
    official_description: initial?.official_description || '',
    official_positioning: initial?.official_positioning || '',
    personal_notes: initial?.personal_notes || '',
    expiry_date: initial?.expiry_date || '',
    purchase_date: initial?.purchase_date || '',
    price: initial?.price != null ? String(initial.price) : '',
  })

  const set = (key: string, val: string) => {
    setForm((f) => ({ ...f, [key]: val }))
    setErrors((e) => ({ ...e, [key]: '' }))
  }

  function searchBrands(q: string) {
    clearTimeout(brandTimer.current)
    if (q.length < 2) { setBrandSuggestions([]); setShowBrandDrop(false); return }
    brandTimer.current = setTimeout(async () => {
      const res = await fetch(`/api/search-cosmetics?type=brand&q=${encodeURIComponent(q)}`)
      const data: string[] = await res.json()
      setBrandSuggestions(data)
      setShowBrandDrop(data.length > 0)
    }, 500)
  }

  function searchProducts(q: string, brand: string) {
    clearTimeout(productTimer.current)
    if (q.length < 2 || !brand) { setProductSuggestions([]); setShowProductDrop(false); return }
    setProductSearching(true)
    productTimer.current = setTimeout(async () => {
      const res = await fetch(`/api/search-cosmetics?type=product&q=${encodeURIComponent(q)}&brand=${encodeURIComponent(brand)}`)
      const data: { name: string; category: string; image: string | null }[] = await res.json()
      setProductSuggestions(data)
      setShowProductDrop(data.length > 0)
      setProductSearching(false)
    }, 600)
  }

  function searchShades(q: string, brand: string, product: string) {
    clearTimeout(shadeTimer.current)
    if (q.length < 1 || !brand || !product) { setShadeSuggestions([]); setShowShadeDrop(false); return }
    setShadeSearching(true)
    shadeTimer.current = setTimeout(async () => {
      const res = await fetch(
        `/api/search-cosmetics?type=shade&q=${encodeURIComponent(q)}&brand=${encodeURIComponent(brand)}&product=${encodeURIComponent(product)}`
      )
      const data: { name: string; image: string | null }[] = await res.json()
      setShadeSuggestions(data)
      setShowShadeDrop(data.length > 0)
      setShadeSearching(false)
    }, 700)
  }

  async function handleUpload(file: File) {
    setUploading(true)
    try {
      const compressed = await compressImage(file)
      const fd = new FormData()
      fd.append('file', compressed)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.url) setPhoto(data.url)
    } catch {
      alert('照片上傳失敗，請重試')
    } finally {
      setUploading(false)
    }
  }

  async function handleAiFill() {
    if (!form.brand.trim() || !form.name.trim()) {
      alert('請先填寫品牌和產品名稱')
      return
    }
    setFilling(true)
    try {
      const res = await fetch('/api/fill-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: form.brand,
          name: form.name,
          category: form.category,
          hasPhotos: !!photo,
          shade_name: form.shade_name || undefined,
        }),
      })
      const data = await res.json()
      if (data.official_description) set('official_description', data.official_description)
      if (data.official_positioning) set('official_positioning', data.official_positioning)
      if (data.photo_url && !photo) setPhoto(data.photo_url)
    } finally {
      setFilling(false)
    }
  }

  async function handleBarcode(barcode: string) {
    setShowScanner(false)
    setScanning(true)
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode }),
      })
      const data = await res.json()
      if (data.found) {
        if (data.brand) set('brand', data.brand)
        if (data.name) set('name', data.name)
        if (data.category) set('category', data.category)
        if (data.official_description) set('official_description', data.official_description)
      } else {
        alert('找不到此條碼的產品資訊，請手動輸入')
      }
    } finally {
      setScanning(false)
    }
  }

  function validate() {
    const errs: Record<string, string> = {}
    if (!form.brand.trim()) errs.brand = '品牌為必填'
    if (!form.name.trim()) errs.name = '產品名稱為必填'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setSaving(true)
    const payload = {
      ...form,
      price: form.price ? Number(form.price) : null,
      expiry_date: form.expiry_date || null,
      purchase_date: form.purchase_date || null,
      photo_url: photo || null,
      photo_urls: photo ? [photo] : [],
    }

    const url = initial?.id ? `/api/cosmetics/${initial.id}` : '/api/cosmetics'
    const method = initial?.id ? 'PUT' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await res.json()
    setSaving(false)

    if (onSuccess) {
      onSuccess(data)
    } else {
      router.push(`/cosmetics/${data.id}`)
    }
  }

  return (
    <>
      {showScanner && (
        <BarcodeScanner onDetected={handleBarcode} onClose={() => setShowScanner(false)} />
      )}

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Tip 1: completeness tip */}
        <DismissibleTip storageKey="tip_form_quality">
          填寫完整品牌、產品名稱、色號，可增加 AI 填入資訊的正確度喔！
        </DismissibleTip>

        {/* ── 上半部：使用者自填 ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label mb-0">品牌 *</label>
              <button
                type="button"
                onClick={() => setShowScanner(true)}
                disabled={scanning}
                className="flex items-center gap-1 text-xs text-nude-500 hover:text-blush-600 transition-colors"
              >
                {scanning
                  ? <div className="w-3 h-3 border-2 border-blush-400 border-t-transparent rounded-full animate-spin" />
                  : <ScanBarcode size={14} />
                }
                {scanning ? '搜尋中…' : '掃條碼'}
              </button>
            </div>
            <div className="relative">
              <input
                className={`input-field ${errors.brand ? 'border-red-400' : ''}`}
                value={form.brand}
                autoComplete="off"
                onChange={(e) => { set('brand', e.target.value); searchBrands(e.target.value) }}
                onBlur={() => setTimeout(() => setShowBrandDrop(false), 150)}
                onFocus={() => brandSuggestions.length > 0 && setShowBrandDrop(true)}
                placeholder="e.g. NARS"
              />
              {showBrandDrop && (
                <div className="absolute z-20 w-full bg-white border border-nude-200 rounded-xl shadow-lg mt-1 overflow-hidden max-h-48 overflow-y-auto">
                  {brandSuggestions.map((b) => (
                    <button key={b} type="button"
                      onMouseDown={() => { set('brand', b); setShowBrandDrop(false) }}
                      className="w-full px-4 py-2.5 text-left text-sm text-nude-800 hover:bg-blush-50 transition-colors"
                    >{b}</button>
                  ))}
                </div>
              )}
            </div>
            {errors.brand && <p className="text-xs text-red-500 mt-1">{errors.brand}</p>}
          </div>

          <div>
            <label className="label">產品名稱 *</label>
            <div className="relative">
              <input
                className={`input-field ${errors.name ? 'border-red-400' : ''}`}
                value={form.name}
                autoComplete="off"
                onChange={(e) => { set('name', e.target.value); searchProducts(e.target.value, form.brand) }}
                onBlur={() => setTimeout(() => setShowProductDrop(false), 150)}
                onFocus={() => productSuggestions.length > 0 && setShowProductDrop(true)}
                placeholder="e.g. Natural Radiant Foundation"
              />
              {productSearching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-3.5 h-3.5 border-2 border-blush-400 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {showProductDrop && (
                <div className="absolute z-20 w-full bg-white border border-nude-200 rounded-xl shadow-lg mt-1 overflow-hidden max-h-48 overflow-y-auto">
                  {productSuggestions.map((p) => (
                    <button key={p.name} type="button"
                      onMouseDown={() => { set('name', p.name); set('category', p.category); setShowProductDrop(false) }}
                      className="w-full px-3 py-2 text-left hover:bg-blush-50 transition-colors flex items-center gap-2.5"
                    >
                      {p.image ? (
                        <img src={p.image} alt={p.name} className="w-7 h-7 rounded object-cover flex-shrink-0 bg-nude-100" />
                      ) : (
                        <div className="w-7 h-7 rounded bg-nude-100 flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <span className="text-sm text-nude-800 block truncate">{p.name}</span>
                        <span className="text-xs text-nude-400">{p.category}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">類別</label>
            <select className="input-field" value={form.category} onChange={(e) => set('category', e.target.value)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="label">色號名稱</label>
            <div className="relative">
              <input
                className="input-field"
                value={form.shade_name}
                autoComplete="off"
                onChange={(e) => { set('shade_name', e.target.value); searchShades(e.target.value, form.brand, form.name) }}
                onBlur={() => setTimeout(() => setShowShadeDrop(false), 150)}
                onFocus={() => shadeSuggestions.length > 0 && setShowShadeDrop(true)}
                placeholder="e.g. Syracuse"
              />
              {shadeSearching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-3.5 h-3.5 border-2 border-blush-400 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {showShadeDrop && (
                <div className="absolute z-20 w-full bg-white border border-nude-200 rounded-xl shadow-lg mt-1 overflow-hidden max-h-48 overflow-y-auto">
                  {shadeSuggestions.map((s) => (
                    <button key={s.name} type="button"
                      onMouseDown={() => { set('shade_name', s.name); setShowShadeDrop(false) }}
                      className="w-full px-3 py-2 text-left hover:bg-blush-50 transition-colors flex items-center gap-2.5"
                    >
                      {s.image ? (
                        <img src={s.image} alt={s.name} className="w-7 h-7 rounded object-cover flex-shrink-0 bg-nude-100" />
                      ) : (
                        <div className="w-7 h-7 rounded bg-nude-100 flex-shrink-0" />
                      )}
                      <span className="text-sm text-nude-800">{s.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div>
          <label className="label">個人使用心得</label>
          <AutoResizeTextarea className="input-field" value={form.personal_notes} onChange={(e) => set('personal_notes', e.target.value)} placeholder="使用感受、搭配技巧等個人筆記" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="label">購買日期</label>
            <input type="date" className="input-field" value={form.purchase_date} onChange={(e) => set('purchase_date', e.target.value)} />
          </div>
          <div>
            <label className="label">到期日</label>
            <input type="date" className="input-field" value={form.expiry_date} onChange={(e) => set('expiry_date', e.target.value)} />
          </div>
          <div>
            <label className="label">價格（NT$）</label>
            <input type="number" className="input-field" value={form.price} onChange={(e) => set('price', e.target.value)} placeholder="0" min="0" />
          </div>
        </div>

        {/* ── 下半部：官方資訊（AI 填入） ── */}
        <div className="border-t border-nude-100 pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <label className="label mb-0">官方資訊</label>
            <button
              type="button"
              onClick={handleAiFill}
              disabled={filling}
              className="btn-secondary text-xs flex items-center gap-1.5"
            >
              {filling ? (
                <>
                  <div className="w-3 h-3 border-2 border-blush-400 border-t-transparent rounded-full animate-spin" />
                  填入中…
                </>
              ) : (
                <>
                  <Sparkles size={13} />
                  AI 幫我填入
                </>
              )}
            </button>
          </div>

          {/* Tip 2: AI fill explanation */}
          <DismissibleTip storageKey="tip_ai_fill">
            「AI 幫我填入」會自動搜尋官方描述、品牌定位與封面照片。填入後，AI 將根據描述自動標記妝效標籤（如：控油、水光、持妝），讓你之後能依標籤快速篩選。
          </DismissibleTip>

          {/* Photo + descriptions side by side */}
          <div className="flex gap-4 items-start">
            {/* Photo */}
            <div className="flex-shrink-0">
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />

              {photo ? (
                <div className="relative w-28 h-28 rounded-xl overflow-hidden bg-nude-100">
                  <Image src={photo} alt="產品照片" fill className="object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhoto(null)}
                    className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-28 h-28 rounded-xl border-2 border-dashed border-nude-300 hover:border-blush-400 flex flex-col items-center justify-center text-nude-400 hover:text-blush-500 transition-colors gap-1.5"
                >
                  {uploading
                    ? <div className="w-5 h-5 border-2 border-blush-400 border-t-transparent rounded-full animate-spin" />
                    : <>
                        <ImagePlus size={20} />
                        <span className="text-xs">上傳照片</span>
                      </>
                  }
                </button>
              )}

              {/* Allow re-upload when photo exists */}
              {photo && !uploading && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="mt-1.5 w-28 text-center text-xs text-nude-400 hover:text-blush-500 transition-colors"
                >
                  更換照片
                </button>
              )}
            </div>

            {/* Description fields */}
            <div className="flex-1 space-y-3 min-w-0">
              <div>
                <label className="label">官方產品描述</label>
                <AutoResizeTextarea className="input-field" value={form.official_description}
                  onChange={(e) => set('official_description', e.target.value)}
                  placeholder="官網/包裝上的產品描述" />
              </div>
              <div>
                <label className="label">品牌定位 / 風格</label>
                <AutoResizeTextarea className="input-field" value={form.official_positioning}
                  onChange={(e) => set('official_positioning', e.target.value)}
                  placeholder="e.g. 高遮瑕、持妝 16 小時" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" className="btn-primary flex-1" disabled={saving}>
            {saving ? '儲存中…' : initial?.id ? '儲存修改' : '新增化妝品'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => router.back()}>
            取消
          </button>
        </div>
      </form>
    </>
  )
}
