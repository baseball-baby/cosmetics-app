'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Cosmetic, CATEGORY_EMOJIS } from '@/lib/types'
import ColorVerdictBadge from '@/components/ColorVerdictBadge'
import ExpiryBadge, { getDaysUntilExpiry } from '@/components/ExpiryBadge'

export default function CosmeticDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [cosmetic, setCosmetic] = useState<Cosmetic | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activePhoto, setActivePhoto] = useState(0)

  useEffect(() => {
    fetch(`/api/cosmetics/${id}`).then((r) => r.json()).then((c) => {
      setCosmetic(c)
      setLoading(false)
    })
  }, [id])

  async function handleDelete() {
    if (!confirm('確定要刪除這件化妝品嗎？')) return
    setDeleting(true)
    await fetch(`/api/cosmetics/${id}`, { method: 'DELETE' })
    router.push('/')
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-blush-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!cosmetic) return <div className="text-center py-20 text-nude-500">找不到此商品</div>

  const photos: string[] = (() => {
    if (cosmetic.photo_urls) {
      try { return JSON.parse(cosmetic.photo_urls) } catch {}
    }
    return cosmetic.photo_url ? [cosmetic.photo_url] : []
  })()

  const days = getDaysUntilExpiry(cosmetic.expiry_date)
  const hasVerdict = !!cosmetic.color_verdict
  const emoji = CATEGORY_EMOJIS[cosmetic.category] || '🌞'

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-nude-500 hover:text-nude-700 text-sm">← 返回</Link>
      </div>

      {/* Hero with photo gallery */}
      <div className="card overflow-hidden">
        <div className="relative aspect-video sm:aspect-[2/1] bg-nude-100">
          {photos.length > 0 ? (
            <Image src={photos[activePhoto]} alt={cosmetic.name} fill className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-7xl">{emoji}</div>
          )}
        </div>

        {/* Thumbnail strip */}
        {photos.length > 1 && (
          <div className="flex gap-2 p-3 bg-nude-50 overflow-x-auto">
            {photos.map((url, i) => (
              <button
                key={url}
                onClick={() => setActivePhoto(i)}
                className={`flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-colors ${i === activePhoto ? 'border-blush-400' : 'border-transparent'}`}
              >
                <Image src={url} alt={`photo ${i + 1}`} width={48} height={48} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}

        <div className="p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-nude-500">{cosmetic.brand}</p>
              <h1 className="text-xl font-bold text-nude-900">{cosmetic.name}</h1>
              {cosmetic.shade_name && (
                <p className="text-sm text-nude-600 mt-0.5">
                  {cosmetic.shade_name}
                  {cosmetic.shade_description && ` · ${cosmetic.shade_description}`}
                </p>
              )}
            </div>
            <span className="text-xs bg-blush-50 text-blush-600 border border-blush-200 px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0">
              {cosmetic.category}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {hasVerdict && <ColorVerdictBadge verdict={cosmetic.color_verdict} size="md" />}
            <ExpiryBadge expiryDate={cosmetic.expiry_date} />
          </div>

          {days !== null && days >= 0 && (
            <p className="text-xs text-nude-500">距到期日：{days} 天</p>
          )}
        </div>
      </div>

      {/* Official info */}
      {(cosmetic.official_description || cosmetic.official_positioning) && (
        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-nude-700 flex items-center gap-1.5">🏷️ 官方資訊</h2>
          {cosmetic.official_description && (
            <div>
              <p className="text-xs text-nude-400 mb-1">產品描述</p>
              <p className="text-sm text-nude-800 leading-relaxed">{cosmetic.official_description}</p>
            </div>
          )}
          {cosmetic.official_positioning && (
            <div>
              <p className="text-xs text-nude-400 mb-1">品牌定位</p>
              <p className="text-sm text-nude-800 leading-relaxed">{cosmetic.official_positioning}</p>
            </div>
          )}
        </div>
      )}

      {/* Personal notes */}
      {cosmetic.personal_notes && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-nude-700 mb-2 flex items-center gap-1.5">📝 個人筆記</h2>
          <p className="text-sm text-nude-800 leading-relaxed">{cosmetic.personal_notes}</p>
        </div>
      )}

      {/* Purchase info */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-nude-700 mb-3 flex items-center gap-1.5">📋 購買資訊</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          {cosmetic.purchase_date && (
            <>
              <dt className="text-nude-500">購買日期</dt>
              <dd className="text-nude-800">{cosmetic.purchase_date}</dd>
            </>
          )}
          {cosmetic.expiry_date && (
            <>
              <dt className="text-nude-500">到期日</dt>
              <dd className="text-nude-800">{cosmetic.expiry_date}</dd>
            </>
          )}
          {cosmetic.price != null && (
            <>
              <dt className="text-nude-500">價格</dt>
              <dd className="text-nude-800">NT$ {cosmetic.price.toLocaleString()}</dd>
            </>
          )}
          <dt className="text-nude-500">新增時間</dt>
          <dd className="text-nude-800">{new Date(cosmetic.created_at).toLocaleDateString('zh-TW')}</dd>
        </dl>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Link href={`/cosmetics/${id}/edit`} className="btn-secondary flex-1 text-center text-sm">
          ✏️ 編輯
        </Link>
        <button onClick={handleDelete} disabled={deleting} className="btn-danger text-sm px-6">
          {deleting ? '刪除中…' : '🗑️ 刪除'}
        </button>
      </div>
    </div>
  )
}
