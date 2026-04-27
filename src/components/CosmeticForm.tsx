'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Cosmetic, CATEGORIES } from '@/lib/types'
import BarcodeScanner from './BarcodeScanner'
import AutoResizeTextarea from './AutoResizeTextarea'

interface Props {
  initial?: Partial<Cosmetic>
  onSuccess?: (cosmetic: Cosmetic) => void
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

  // Autocomplete state
  const [brandSuggestions, setBrandSuggestions] = useState<string[]>([])
  const [productSuggestions, setProductSuggestions] = useState<{ name: string; category: string }[]>([])
  const [showBrandDrop, setShowBrandDrop] = useState(false)
  const [showProductDrop, setShowProductDrop] = useState(false)
  const [productSearching, setProductSearching] = useState(false)
  const brandTimer = useRef<ReturnType<typeof setTimeout>>()
  const productTimer = useRef<ReturnType<typeof setTimeout>>()

  const initPhotos = (() => {
    if (initial?.photo_urls) {
      try { return JSON.parse(initial.photo_urls) as string[] } catch {}
    }
    return initial?.photo_url ? [initial.photo_url] : []
  })()

  const [photos, setPhotos] = useState<string[]>(initPhotos)

  const [form, setForm] = useState({
    brand: initial?.brand || '',
    name: initial?.name || '',
    category: initial?.category || '其他',
    shade_name: initial?.shade_name || '',
    shade_description: initial?.shade_description || '',
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
      const data: { name: string; category: string }[] = await res.json()
      setProductSuggestions(data)
      setShowProductDrop(data.length > 0)
      setProductSearching(false)
    }, 600)
  }

  async function handleUpload(file: File) {
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    const data = await res.json()
    if (data.url) setPhotos((prev) => [...prev, data.url])
    setUploading(false)
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
        body: JSON.stringify({ brand: form.brand, name: form.name, category: form.category, hasPhotos: photos.length > 0 }),
      })
      const data = await res.json()
      if (data.official_description) set('official_description', data.official_description)
      if (data.official_positioning) set('official_positioning', data.official_positioning)
      if (data.photo_url && photos.length === 0) setPhotos([data.photo_url])
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
        if (data.official_description) set('official_description', data.official_description)
      } else {
        alert('找不到此條碼的產品資訊')
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
      photo_url: photos[0] || null,
      photo_urls: photos,
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
        {/* Photo upload – multiple */}
        <div className="space-y-2">
          <label className="label">產品照片</label>
          <div className="flex gap-2 flex-wrap">
            {photos.map((url, i) => (
              <div key={url} className="relative w-20 h-20 rounded-xl overflow-hidden bg-nude-100 group">
                <Image src={url} alt={`photo ${i + 1}`} fill className="object-cover" />
                <button
                  type="button"
                  onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/60 text-white rounded-full text-xs items-center justify-center hidden group-hover:flex"
                >
                  ×
                </button>
                {i === 0 && (
                  <span className="absolute bottom-0 left-0 right-0 text-center text-white text-[10px] bg-black/40 py-0.5">封面</span>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-20 h-20 rounded-xl border-2 border-dashed border-nude-300 hover:border-blush-400 flex flex-col items-center justify-center text-nude-400 hover:text-blush-500 transition-colors text-xs gap-1"
            >
              {uploading ? (
                <div className="w-5 h-5 border-2 border-blush-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span className="text-xl">+</span>
                  <span>新增</span>
                </>
              )}
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"

            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
          />
          <button
            type="button"
            onClick={() => setShowScanner(true)}
            disabled={scanning}
            className="btn-secondary text-xs flex items-center gap-1.5"
          >
            {scanning ? '查詢中…' : '📸 掃描條碼'}
          </button>
        </div>

        {/* Required fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">品牌 *</label>
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
                    <button
                      key={b}
                      type="button"
                      onMouseDown={() => { set('brand', b); setShowBrandDrop(false) }}
                      className="w-full px-4 py-2.5 text-left text-sm text-nude-800 hover:bg-blush-50 transition-colors"
                    >
                      {b}
                    </button>
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
                    <button
                      key={p.name}
                      type="button"
                      onMouseDown={() => {
                        set('name', p.name)
                        set('category', p.category)
                        setShowProductDrop(false)
                      }}
                      className="w-full px-4 py-2.5 text-left hover:bg-blush-50 transition-colors"
                    >
                      <span className="text-sm text-nude-800">{p.name}</span>
                      <span className="text-xs text-nude-400 ml-2">{p.category}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>
        </div>

        <div>
          <label className="label">類別</label>
          <select className="input-field" value={form.category} onChange={(e) => set('category', e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">色號名稱</label>
            <input className="input-field" value={form.shade_name} onChange={(e) => set('shade_name', e.target.value)} placeholder="e.g. Syracuse" />
          </div>
          <div>
            <label className="label">顏色描述</label>
            <input className="input-field" value={form.shade_description} onChange={(e) => set('shade_description', e.target.value)} placeholder="e.g. 暖米棕色" />
          </div>
        </div>

        {/* Official description */}
        <div className="space-y-3">
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
              ) : '✨ AI 幫我填入'}
            </button>
          </div>
          <div>
            <label className="label">官方產品描述</label>
            <AutoResizeTextarea className="input-field" value={form.official_description} onChange={(e) => set('official_description', e.target.value)} placeholder="官網/包裝上的產品描述" />
          </div>
          <div>
            <label className="label">品牌定位 / 風格</label>
            <AutoResizeTextarea className="input-field" value={form.official_positioning} onChange={(e) => set('official_positioning', e.target.value)} placeholder="e.g. 高遮瑕、持妝 16 小時" />
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
