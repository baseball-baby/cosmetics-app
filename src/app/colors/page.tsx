'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import type { Cosmetic, ColorData } from '@/lib/types'

type TabCategory = '口紅/唇釉' | '腮紅/修容' | 'all'

const TAB_LABELS: { key: TabCategory; label: string; emoji: string }[] = [
  { key: 'all', label: '全部', emoji: '🎨' },
  { key: '口紅/唇釉', label: '口紅/唇釉', emoji: '💋' },
  { key: '腮紅/修容', label: '腮紅/修容', emoji: '🌸' },
]

const COLOR_FAMILIES = ['裸色系', '玫瑰紅', '橘色系', '珊瑚色', '莓果色', '正紅色', '酒紅色', '大地色', '粉色系', '棕色系', '紫色系', '磚紅色']
const FINISHES_BY_CAT: Record<string, string[]> = {
  '口紅/唇釉': ['霧面', '緞面', '亮面', '玻璃唇', '珠光'],
  '腮紅/修容': ['霧面', '緞面', '珠光', '亮面'],
}
const DEFAULT_FINISHES = ['霧面', '緞面', '亮面', '珠光', '玻璃唇']

function parseColorData(raw: string | null): ColorData | null {
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

function groupBy<T>(items: T[], key: (item: T) => string): Record<string, T[]> {
  return items.reduce((acc, item) => {
    const k = key(item)
    if (!acc[k]) acc[k] = []
    acc[k].push(item)
    return acc
  }, {} as Record<string, T[]>)
}

interface ProductWithColor extends Cosmetic {
  colorData: ColorData | null
}

// ── Edit popover ──────────────────────────────────────────────────────────────
function EditPopover({
  product,
  onSave,
  onReanalyze,
  onClose,
}: {
  product: ProductWithColor
  onSave: (data: ColorData) => void
  onReanalyze: () => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState<ColorData>(
    product.colorData ?? { hex: '#E8B4B8', color_family: '粉色系', finish: '霧面', is_expansion_color: true, description: '' }
  )
  const finishes = FINISHES_BY_CAT[product.category] ?? DEFAULT_FINISHES
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  return (
    <div ref={ref} className="absolute z-30 top-full mt-2 left-1/2 -translate-x-1/2 bg-white border border-nude-200 rounded-2xl shadow-xl p-4 w-64 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-nude-700 truncate max-w-[160px]">
          {product.brand} · {product.shade_name || product.name}
        </p>
        <button onClick={onClose} className="text-nude-400 hover:text-nude-600 text-sm w-5 h-5 flex items-center justify-center">✕</button>
      </div>

      {/* Hex color picker */}
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={draft.hex}
          onChange={(e) => setDraft((d) => ({ ...d, hex: e.target.value }))}
          className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0.5 bg-transparent"
        />
        <div>
          <p className="text-xs text-nude-400">顏色</p>
          <p className="text-sm font-mono text-nude-800">{draft.hex.toUpperCase()}</p>
        </div>
      </div>

      {/* Color family */}
      <div>
        <p className="text-xs text-nude-400 mb-1.5">色系</p>
        <div className="flex flex-wrap gap-1">
          {COLOR_FAMILIES.map((f) => (
            <button
              key={f}
              onClick={() => setDraft((d) => ({ ...d, color_family: f }))}
              className={`text-xs px-2 py-0.5 rounded-full transition-colors ${draft.color_family === f ? 'bg-nude-700 text-white' : 'bg-nude-100 text-nude-600 hover:bg-nude-200'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Finish */}
      <div>
        <p className="text-xs text-nude-400 mb-1.5">妝感</p>
        <div className="flex flex-wrap gap-1">
          {finishes.map((f) => (
            <button
              key={f}
              onClick={() => setDraft((d) => ({ ...d, finish: f }))}
              className={`text-xs px-2 py-0.5 rounded-full transition-colors ${draft.finish === f ? 'bg-blush-500 text-white' : 'bg-nude-100 text-nude-600 hover:bg-nude-200'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Expansion toggle */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-nude-500">膨脹色（顯豐盈）</p>
        <button
          onClick={() => setDraft((d) => ({ ...d, is_expansion_color: !d.is_expansion_color }))}
          className={`w-9 h-5 rounded-full transition-colors relative ${draft.is_expansion_color ? 'bg-blush-400' : 'bg-nude-300'}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${draft.is_expansion_color ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </button>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button onClick={() => onSave(draft)} className="btn-primary text-xs flex-1 py-1.5">儲存</button>
        <button onClick={onReanalyze} className="btn-secondary text-xs px-3 py-1.5">🔄 重分析</button>
      </div>
    </div>
  )
}

// ── Swatch ─────────────────────────────────────────────────────────────────────
function Swatch({
  product,
  isEditing,
  onEdit,
  onSave,
  onReanalyze,
  onClose,
}: {
  product: ProductWithColor
  isEditing: boolean
  onEdit: () => void
  onSave: (data: ColorData) => void
  onReanalyze: () => void
  onClose: () => void
}) {
  const cd = product.colorData
  return (
    <div className="relative flex flex-col items-center gap-1.5">
      <button
        onClick={onEdit}
        className="relative w-12 h-12 rounded-full shadow-sm border-2 border-white hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-blush-400"
        title={`${product.brand} ${product.shade_name || product.name} — 點擊編輯`}
        style={{ backgroundColor: cd?.hex ?? '#e5e7eb' }}
      >
        {!cd && (
          <span className="absolute inset-0 flex items-center justify-center text-nude-400 text-lg">?</span>
        )}
        {cd?.user_override && (
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-blush-500 rounded-full border border-white text-[8px] text-white flex items-center justify-center">✎</span>
        )}
      </button>
      <div className="text-center max-w-[64px]">
        <p className="text-xs font-medium text-nude-800 leading-tight truncate">{product.shade_name || '—'}</p>
        <p className="text-[10px] text-nude-400 truncate">{product.brand}</p>
      </div>
      {isEditing && (
        <EditPopover product={product} onSave={onSave} onReanalyze={onReanalyze} onClose={onClose} />
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function ColorsPage() {
  const [tab, setTab] = useState<TabCategory>('all')
  const [groupMode, setGroupMode] = useState<'color_family' | 'finish' | 'expansion'>('color_family')
  const [products, setProducts] = useState<ProductWithColor[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [analyzingIds, setAnalyzingIds] = useState<number[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [summary, setSummary] = useState<{ summary: string; gaps: string } | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)

  // Load products
  useEffect(() => {
    setLoadingProducts(true)
    const cats = tab === 'all' ? ['口紅/唇釉', '腮紅/修容'] : [tab]
    Promise.all(cats.map((c) =>
      fetch(`/api/cosmetics?category=${encodeURIComponent(c)}&sort=brand&order=ASC`).then((r) => r.json())
    )).then((results: Cosmetic[][]) => {
      const all = results.flat().map((c) => ({ ...c, colorData: parseColorData(c.color_data) }))
      setProducts(all)
      setLoadingProducts(false)
    })
  }, [tab])

  const analyzed = products.filter((p) => p.colorData)
  const unanalyzed = products.filter((p) => !p.colorData)

  async function analyzeAll() {
    if (unanalyzed.length === 0) return
    const ids = unanalyzed.map((p) => p.id)
    setAnalyzingIds(ids)
    await fetch('/api/color-catalog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    // Reload products to get new color_data
    const cats = tab === 'all' ? ['口紅/唇釉', '腮紅/修容'] : [tab]
    const results: Cosmetic[][] = await Promise.all(cats.map((c) =>
      fetch(`/api/cosmetics?category=${encodeURIComponent(c)}&sort=brand&order=ASC`).then((r) => r.json())
    ))
    setProducts(results.flat().map((c) => ({ ...c, colorData: parseColorData(c.color_data) })))
    setAnalyzingIds([])
  }

  async function reanalyzeSingle(id: number) {
    setAnalyzingIds([id])
    setEditingId(null)
    await fetch('/api/color-catalog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id] }),
    })
    const updated: Cosmetic = await fetch(`/api/cosmetics/${id}`).then((r) => r.json())
    setProducts((prev) => prev.map((p) => p.id === id ? { ...p, ...updated, colorData: parseColorData(updated.color_data) } : p))
    setAnalyzingIds([])
  }

  async function saveOverride(id: number, data: ColorData) {
    await fetch('/api/color-catalog', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, data }),
    })
    setProducts((prev) => prev.map((p) => p.id === id ? { ...p, colorData: { ...data, user_override: true } } : p))
    setEditingId(null)
  }

  async function loadSummary() {
    setLoadingSummary(true)
    const cat = tab === 'all' ? 'all' : tab
    const data = await fetch(`/api/color-catalog?category=${encodeURIComponent(cat)}`).then((r) => r.json())
    setSummary(data)
    setLoadingSummary(false)
  }

  const grouped = groupMode === 'color_family'
    ? groupBy(analyzed, (p) => p.colorData!.color_family)
    : groupMode === 'finish'
      ? groupBy(analyzed, (p) => p.colorData!.finish)
      : {
          '膨脹色（顯豐盈）': analyzed.filter((p) => p.colorData!.is_expansion_color),
          '收縮色（顯精緻）': analyzed.filter((p) => !p.colorData!.is_expansion_color),
        }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-nude-900">色彩統整 🎨</h1>
        <p className="text-sm text-nude-500 mt-0.5">分析你的口紅與腮紅色彩分布</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {TAB_LABELS.map(({ key, label, emoji }) => (
          <button key={key} onClick={() => { setTab(key); setSummary(null) }}
            className={`pill flex-shrink-0 ${tab === key ? 'pill-active' : 'pill-inactive'}`}>
            <span className="mr-1">{emoji}</span>{label}
          </button>
        ))}
      </div>

      {loadingProducts ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-blush-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : products.length === 0 ? (
        <div className="card p-8 text-center text-nude-500">此類別尚無產品</div>
      ) : (
        <div className="space-y-5">
          {/* Unanalyzed banner */}
          {unanalyzed.length > 0 && (
            <div className="card p-4 flex items-center justify-between gap-3 bg-nude-50">
              <p className="text-sm text-nude-600">
                <span className="font-medium text-nude-800">{unanalyzed.length} 件</span> 尚未分析色彩
              </p>
              <button
                onClick={analyzeAll}
                disabled={analyzingIds.length > 0}
                className="btn-primary text-sm whitespace-nowrap"
              >
                {analyzingIds.length > 0 ? (
                  <span className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    分析中…
                  </span>
                ) : `🎨 分析 ${unanalyzed.length} 件`}
              </button>
            </div>
          )}

          {/* Summary */}
          {analyzed.length >= 2 && (
            <div className="card p-4 space-y-2 bg-gradient-to-br from-blush-50 to-rose-50">
              {summary ? (
                <>
                  <p className="text-sm font-semibold text-nude-800">✨ 色彩收藏總結</p>
                  <p className="text-sm text-nude-700 leading-relaxed">{summary.summary}</p>
                  {summary.gaps && (
                    <div className="bg-white/70 rounded-xl p-3">
                      <p className="text-xs font-medium text-nude-600 mb-1">💡 可考慮補齊</p>
                      <p className="text-sm text-nude-700">{summary.gaps}</p>
                    </div>
                  )}
                </>
              ) : (
                <button onClick={loadSummary} disabled={loadingSummary} className="w-full text-sm text-blush-600 hover:text-blush-800 font-medium transition-colors">
                  {loadingSummary ? '分析中…' : '✨ 產生收藏總結與建議'}
                </button>
              )}
            </div>
          )}

          {/* Group mode */}
          {analyzed.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-nude-500">分類：</span>
              {(['color_family', 'finish', 'expansion'] as const).map((mode) => (
                <button key={mode} onClick={() => setGroupMode(mode)}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${groupMode === mode ? 'bg-blush-500 text-white' : 'bg-nude-100 text-nude-600 hover:bg-nude-200'}`}>
                  {mode === 'color_family' ? '色系' : mode === 'finish' ? '妝感' : '膨脹/收縮'}
                </button>
              ))}
            </div>
          )}

          {/* Color groups */}
          <div className="space-y-4">
            {Object.entries(grouped).filter(([, items]) => items.length > 0).map(([groupName, items]) => (
              <div key={groupName} className="card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-nude-800 text-sm">{groupName}</h3>
                  <span className="text-xs text-nude-400">{items.length} 件</span>
                </div>
                {/* Swatches */}
                <div className="flex flex-wrap gap-4">
                  {items.map((p) => (
                    <Swatch
                      key={p.id}
                      product={p}
                      isEditing={editingId === p.id}
                      onEdit={() => setEditingId(editingId === p.id ? null : p.id)}
                      onSave={(data) => saveOverride(p.id, data)}
                      onReanalyze={() => reanalyzeSingle(p.id)}
                      onClose={() => setEditingId(null)}
                    />
                  ))}
                </div>
                {/* Color bar */}
                <div className="flex h-2 rounded-full overflow-hidden gap-px">
                  {items.map((p) => (
                    <div key={p.id} className="flex-1" style={{ backgroundColor: p.colorData!.hex }} />
                  ))}
                </div>
                {/* Product list */}
                <div className="space-y-1.5">
                  {items.map((p) => (
                    <div key={p.id} className="flex items-center gap-2.5 text-xs">
                      <div className="w-3 h-3 rounded-full flex-shrink-0 border border-nude-100" style={{ backgroundColor: p.colorData!.hex }} />
                      {p.photo_url && (
                        <div className="w-5 h-5 rounded overflow-hidden flex-shrink-0 bg-nude-100">
                          <Image src={p.photo_url} alt={p.name} width={20} height={20} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <span className="font-medium text-nude-800">{p.brand}</span>
                      <span className="text-nude-600 truncate">{p.name}{p.shade_name ? ` · ${p.shade_name}` : ''}</span>
                      <span className="ml-auto text-nude-400 flex-shrink-0">{p.colorData!.description}</span>
                      {p.colorData!.user_override && <span className="text-blush-400 text-[10px]">已校正</span>}
                      {analyzingIds.includes(p.id) && <div className="w-3 h-3 border border-blush-400 border-t-transparent rounded-full animate-spin" />}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Unanalyzed products (shown as gray swatches) */}
          {unanalyzed.length > 0 && analyzed.length > 0 && (
            <div className="card p-4 space-y-3 opacity-60">
              <h3 className="text-sm font-medium text-nude-600">待分析（{unanalyzed.length} 件）</h3>
              <div className="flex flex-wrap gap-4">
                {unanalyzed.map((p) => (
                  <div key={p.id} className="flex flex-col items-center gap-1.5">
                    <div className="relative w-12 h-12 rounded-full bg-nude-200 border-2 border-white flex items-center justify-center">
                      <span className="text-nude-400 text-lg">?</span>
                    </div>
                    <p className="text-xs text-nude-500 truncate max-w-[64px] text-center">{p.shade_name || p.name}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
