'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { Cosmetic, CATEGORIES, CATEGORY_EMOJIS } from '@/lib/types'
import CosmeticCard from '@/components/CosmeticCard'
import CosmeticDetailModal from '@/components/CosmeticDetailModal'
import ExpiryBadge, { getDaysUntilExpiry } from '@/components/ExpiryBadge'
import Image from 'next/image'

type SortKey = 'created_at' | 'expiry_date' | 'purchase_date' | 'brand' | 'price'
type ViewMode = 'grid' | 'list'

export default function HomePage() {
  const [cosmetics, setCosmetics] = useState<Cosmetic[]>([])
  const [allCosmetics, setAllCosmetics] = useState<Cosmetic[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<ViewMode>('grid')
  const [category, setCategory] = useState('全部')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('created_at')
  const [order, setOrder] = useState<'ASC' | 'DESC'>('DESC')
  const [showStats, setShowStats] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [subTag, setSubTag] = useState('')
  const [showMigrate, setShowMigrate] = useState(false)
  const [oldName, setOldName] = useState('')
  const [migrating, setMigrating] = useState(false)
  const [migrateMsg, setMigrateMsg] = useState<string | null>(null)
  const allFetched = useRef(false)

  // Reset sub-tag when category changes
  useEffect(() => { setSubTag('') }, [category])

  // Available sub-tags for the selected category, derived from allCosmetics
  const availableSubTags = useMemo(() => {
    if (category === '全部') return []
    const tagSet = new Set<string>()
    allCosmetics
      .filter((c) => c.category === category)
      .forEach((c) => {
        if (c.sub_tags) {
          try { (JSON.parse(c.sub_tags) as string[]).forEach((t) => { const s = t.trim(); if (s) tagSet.add(s) }) } catch {}
        }
      })
    return Array.from(tagSet).sort()
  }, [allCosmetics, category])

  // Fetch filtered list
  const fetchCosmetics = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ sort, order })
    if (category !== '全部') params.set('category', category)
    if (search) params.set('search', search)
    if (subTag) params.set('sub_tag', subTag)
    const res = await fetch(`/api/cosmetics?${params}`)
    const data = await res.json()
    setCosmetics(data)
    setLoading(false)
  }, [category, search, sort, order, subTag])

  // Fetch all for stats
  useEffect(() => {
    fetch('/api/cosmetics?sort=created_at&order=DESC')
      .then((r) => r.json())
      .then((data) => {
        setAllCosmetics(data)
        if (!allFetched.current) {
          allFetched.current = true
          if (data.length === 0) setShowMigrate(true)
        }
      })
  }, [])

  useEffect(() => {
    const timer = setTimeout(fetchCosmetics, 200)
    return () => clearTimeout(timer)
  }, [fetchCosmetics])

  const expiringSoon = allCosmetics.filter((c) => {
    const days = getDaysUntilExpiry(c.expiry_date)
    return days !== null && days >= 0 && days <= 60
  })
  const expired = allCosmetics.filter((c) => {
    const days = getDaysUntilExpiry(c.expiry_date)
    return days !== null && days < 0
  })
  const alerts = [...expired, ...expiringSoon]

  // Stats
  const totalValue = allCosmetics.reduce((sum, c) => sum + (c.price || 0), 0)
  const categoryCounts = CATEGORIES.map((cat) => ({
    cat,
    count: allCosmetics.filter((c) => c.category === cat).length,
  })).filter((x) => x.count > 0)

  async function handleMigrate() {
    if (!oldName.trim()) return
    setMigrating(true)
    const res = await fetch('/api/migrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldName: oldName.trim() }),
    })
    const data = await res.json()
    setMigrating(false)
    if (res.ok) {
      setMigrateMsg(`成功匯入 ${data.migrated} 件化妝品！`)
      setTimeout(() => { setShowMigrate(false); window.location.reload() }, 1500)
    } else if (data.error === 'no_data') {
      setMigrateMsg('找不到這個名字的資料，請確認一下')
    } else {
      setMigrateMsg('匯入失敗，請再試一次')
    }
  }

  function handleModalDelete(id: number | string) {
    setCosmetics((prev) => prev.filter((c) => c.id !== id))
    setAllCosmetics((prev) => prev.filter((c) => c.id !== id))
    setSelectedId(null)
  }

  return (
    <div className="space-y-6">
      {selectedId !== null && (
        <CosmeticDetailModal
          id={selectedId}
          onClose={() => setSelectedId(null)}
          onDelete={handleModalDelete}
        />
      )}
      {/* Migration banner */}
      {showMigrate && (
        <div className="bg-blush-50 border border-blush-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-nude-800">之前有用過這個 app 嗎？</p>
              <p className="text-xs text-nude-500 mt-0.5">輸入舊的名字來匯入你的資料</p>
            </div>
            <button onClick={() => setShowMigrate(false)} className="text-nude-400 hover:text-nude-600 text-xs flex-shrink-0">我是新用戶</button>
          </div>
          {migrateMsg ? (
            <p className="text-sm text-blush-700 font-medium">{migrateMsg}</p>
          ) : (
            <div className="flex gap-2">
              <input
                className="input-field flex-1 text-sm py-2"
                placeholder="你之前的名字"
                value={oldName}
                onChange={(e) => setOldName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleMigrate()}
              />
              <button
                onClick={handleMigrate}
                disabled={migrating || !oldName.trim()}
                className="btn-primary text-sm px-4 py-2"
              >
                {migrating ? '匯入中…' : '匯入'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-nude-900">化妝品庫 💄</h1>
          <p className="text-sm text-nude-500 mt-0.5">{allCosmetics.length} 件商品</p>
        </div>
        <Link href="/cosmetics/new" className="btn-primary flex items-center gap-1.5 text-sm">
          <span>+</span> 新增
        </Link>
      </div>

      {/* Stats dashboard (collapsible) */}
      {allCosmetics.length > 0 && (
        <div className="card overflow-hidden">
          <button
            onClick={() => setShowStats((s) => !s)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-nude-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-nude-700">📊 庫存統計</span>
              <div className="flex gap-3 text-xs text-nude-500">
                <span>{allCosmetics.length} 件</span>
                {totalValue > 0 && <span>NT$ {totalValue.toLocaleString()}</span>}
                {alerts.length > 0 && <span className="text-orange-500">⚠️ {alerts.length} 件待注意</span>}
              </div>
            </div>
            <span className="text-nude-400 text-sm">{showStats ? '▲' : '▼'}</span>
          </button>

          {showStats && (
            <div className="px-4 pb-4 space-y-4 border-t border-nude-100">
              <div className="grid grid-cols-3 gap-3 pt-3">
                <div className="bg-blush-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-blush-600">{allCosmetics.length}</p>
                  <p className="text-xs text-nude-500 mt-0.5">總件數</p>
                </div>
                <div className="bg-nude-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-nude-700">{totalValue > 0 ? `${Math.round(totalValue / 1000)}k` : '-'}</p>
                  <p className="text-xs text-nude-500 mt-0.5">總價值(NT$)</p>
                </div>
                <div className="bg-orange-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-orange-500">{alerts.length}</p>
                  <p className="text-xs text-nude-500 mt-0.5">待注意</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-nude-500 mb-2">類別分布</p>
                <div className="flex flex-wrap gap-2">
                  {categoryCounts.map(({ cat, count }) => (
                    <button
                      key={cat}
                      onClick={() => { setCategory(cat); setShowStats(false) }}
                      className="flex items-center gap-1.5 bg-nude-50 hover:bg-blush-50 border border-nude-200 hover:border-blush-200 rounded-full px-3 py-1 text-xs transition-colors"
                    >
                      <span>{CATEGORY_EMOJIS[cat]}</span>
                      <span className="text-nude-700">{cat}</span>
                      <span className="text-nude-400 font-medium">{count}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Expiry alerts */}
      {alerts.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 space-y-2">
          <h2 className="text-sm font-semibold text-orange-700 flex items-center gap-1.5">
            ⚠️ 到期提醒（{alerts.length} 件）
          </h2>
          <div className="space-y-1.5">
            {alerts.slice(0, 5).map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className="w-full flex items-center gap-3 bg-white rounded-xl p-2.5 hover:bg-orange-50/50 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg overflow-hidden bg-nude-100 flex-shrink-0">
                  {c.photo_url ? (
                    <Image src={c.photo_url} alt={c.name} width={32} height={32} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm">
                      {CATEGORY_EMOJIS[c.category] || '🌞'}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-nude-800 truncate">{c.brand} {c.name}</p>
                </div>
                <ExpiryBadge expiryDate={c.expiry_date} />
              </button>
            ))}
          </div>
          {alerts.length > 5 && (
            <p className="text-xs text-orange-600 text-center">還有 {alerts.length - 5} 件…</p>
          )}
        </div>
      )}

      {/* Search + View toggle */}
      <div className="flex gap-2">
        <input
          type="search"
          placeholder="搜尋品牌、產品名、色號…"
          className="input-field flex-1"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex bg-nude-100 rounded-xl p-1 gap-1">
          <button
            onClick={() => setView('grid')}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${view === 'grid' ? 'bg-white shadow-sm text-blush-600' : 'text-nude-500'}`}
          >
            ⊞
          </button>
          <button
            onClick={() => setView('list')}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${view === 'list' ? 'bg-white shadow-sm text-blush-600' : 'text-nude-500'}`}
          >
            ≡
          </button>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {['全部', ...CATEGORIES].map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`pill whitespace-nowrap flex-shrink-0 ${category === cat ? 'pill-active' : 'pill-inactive'}`}
          >
            {cat !== '全部' && <span className="mr-1">{CATEGORY_EMOJIS[cat]}</span>}
            {cat}
          </button>
        ))}
      </div>

      {/* Sub-tag filter */}
      {availableSubTags.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mt-2">
          <button
            onClick={() => setSubTag('')}
            className={`pill whitespace-nowrap flex-shrink-0 text-xs ${!subTag ? 'pill-active' : 'pill-inactive'}`}
          >全部</button>
          {availableSubTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setSubTag(subTag === tag ? '' : tag)}
              className={`pill whitespace-nowrap flex-shrink-0 text-xs ${subTag === tag ? 'pill-active' : 'pill-inactive'}`}
            >{tag}</button>
          ))}
        </div>
      )}

      {/* Sort */}
      <div className="flex gap-2 items-center">
        <label className="text-xs text-nude-500 whitespace-nowrap">排序：</label>
        <select
          className="input-field text-xs py-1.5 flex-1 max-w-40"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
        >
          <option value="created_at">新增時間</option>
          <option value="expiry_date">到期日</option>
          <option value="purchase_date">購買日期</option>
          <option value="brand">品牌</option>
          <option value="price">價格</option>
        </select>
        <button
          onClick={() => setOrder((o) => (o === 'ASC' ? 'DESC' : 'ASC'))}
          className="text-xs text-nude-500 hover:text-blush-500 transition-colors px-2 py-1.5 bg-nude-100 rounded-lg"
        >
          {order === 'ASC' ? '↑ 升冪' : '↓ 降冪'}
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-blush-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : cosmetics.length === 0 ? (
        <div className="text-center py-20 space-y-4">
          <div className="text-6xl">💄</div>
          <p className="text-nude-500">還沒有任何化妝品</p>
          <Link href="/cosmetics/new" className="btn-primary inline-block">
            新增第一件
          </Link>
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {cosmetics.map((c) => (
            <CosmeticCard key={c.id} cosmetic={c} view="grid" onOpen={() => setSelectedId(c.id)} />
          ))}
        </div>
      ) : (
        <div className="border border-nude-200 rounded-2xl overflow-hidden bg-white divide-y divide-nude-100">
          {cosmetics.map((c) => (
            <CosmeticCard key={c.id} cosmetic={c} view="list" onOpen={() => setSelectedId(c.id)} />
          ))}
        </div>
      )}
    </div>
  )
}
