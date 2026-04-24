'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Cosmetic, CATEGORY_EMOJIS } from '@/lib/types'
import ColorVerdictBadge from './ColorVerdictBadge'
import ExpiryBadge, { getDaysUntilExpiry } from './ExpiryBadge'

interface Props {
  id: number | string
  onClose: () => void
  onDelete?: (id: number | string) => void
}

export default function CosmeticDetailModal({ id, onClose, onDelete }: Props) {
  const [cosmetic, setCosmetic] = useState<Cosmetic | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activePhoto, setActivePhoto] = useState(0)
  const [tags, setTags] = useState<string[]>([])
  const [tagging, setTagging] = useState(false)
  const [editingTags, setEditingTags] = useState(false)
  const [tagInput, setTagInput] = useState('')

  useEffect(() => {
    setLoading(true)
    setActivePhoto(0)
    fetch(`/api/cosmetics/${id}`).then((r) => r.json()).then((c) => {
      setCosmetic(c)
      try { setTags(c?.sub_tags ? JSON.parse(c.sub_tags) : []) } catch { setTags([]) }
      setLoading(false)
    })
  }, [id])

  async function handleAutoTag() {
    setTagging(true)
    const res = await fetch('/api/auto-tag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cosmetic_id: id }),
    })
    const data = await res.json()
    setTags(data.tags || [])
    setTagging(false)
  }

  async function saveTagsManual(newTags: string[]) {
    setTags(newTags)
    await fetch('/api/auto-tag', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cosmetic_id: id, tags: newTags }),
    })
  }

  async function handleDelete() {
    if (!confirm('確定要刪除這件化妝品嗎？')) return
    setDeleting(true)
    await fetch(`/api/cosmetics/${id}`, { method: 'DELETE' })
    onDelete?.(id)
    onClose()
  }

  // Close on backdrop click
  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose()
  }

  const photos: string[] = (() => {
    if (cosmetic?.photo_urls) {
      try { return JSON.parse(cosmetic.photo_urls) } catch {}
    }
    return cosmetic?.photo_url ? [cosmetic.photo_url] : []
  })()

  const days = cosmetic ? getDaysUntilExpiry(cosmetic.expiry_date) : null
  const hasVerdict = !!cosmetic?.color_verdict
  const emoji = CATEGORY_EMOJIS[cosmetic?.category || ''] || '🌞'

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={handleBackdrop}
    >
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-nude-100 flex-shrink-0">
          <p className="font-semibold text-nude-800 truncate pr-4">
            {loading ? '載入中…' : cosmetic ? `${cosmetic.brand} ${cosmetic.name}` : ''}
          </p>
          <button onClick={onClose} className="text-nude-400 hover:text-nude-600 text-xl w-8 h-8 flex items-center justify-center flex-shrink-0">✕</button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-blush-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !cosmetic ? (
            <div className="text-center py-16 text-nude-500">找不到此商品</div>
          ) : (
            <div className="space-y-4 pb-6">
              {/* Photo */}
              <div className="relative aspect-video bg-nude-100">
                {photos.length > 0 ? (
                  <Image src={photos[activePhoto]} alt={cosmetic.name} fill className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-7xl">{emoji}</div>
                )}
              </div>

              {photos.length > 1 && (
                <div className="flex gap-2 px-4 overflow-x-auto">
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

              {/* Basic info */}
              <div className="px-5 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-nude-500">{cosmetic.brand}</p>
                    <h2 className="text-lg font-bold text-nude-900">{cosmetic.name}</h2>
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

              {/* Sub-tags */}
              <div className="px-5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-nude-500">標籤</span>
                  <div className="flex gap-1.5">
                    {!editingTags && (
                      <button onClick={() => setEditingTags(true)} className="text-xs text-nude-400 hover:text-blush-500 transition-colors">
                        手動編輯
                      </button>
                    )}
                    <button onClick={handleAutoTag} disabled={tagging} className="text-xs text-blush-500 hover:text-blush-700 transition-colors">
                      {tagging ? 'AI 分析中…' : tags.length === 0 ? '🤖 AI 自動標籤' : '🔄 重新標籤'}
                    </button>
                  </div>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag) => (
                      <span key={tag} className="inline-flex items-center gap-1 text-xs bg-nude-100 text-nude-700 rounded-full px-2.5 py-1 font-medium">
                        {tag}
                        {editingTags && (
                          <button onClick={() => saveTagsManual(tags.filter((t) => t !== tag))} className="text-nude-400 hover:text-red-500 transition-colors leading-none">
                            ×
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                )}
                {editingTags && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && tagInput.trim()) {
                          saveTagsManual([...tags, tagInput.trim()])
                          setTagInput('')
                        }
                      }}
                      placeholder="輸入標籤後按 Enter"
                      className="input-field text-xs py-1.5 flex-1"
                    />
                    <button onClick={() => setEditingTags(false)} className="text-xs text-nude-400 hover:text-nude-600 px-2">完成</button>
                  </div>
                )}
                {tags.length === 0 && !tagging && (
                  <p className="text-xs text-nude-400">尚無標籤</p>
                )}
              </div>

              {/* Official info */}
              {(cosmetic.official_description || cosmetic.official_positioning) && (
                <div className="mx-5 space-y-2">
                  <h3 className="text-sm font-semibold text-nude-700">🏷️ 官方資訊</h3>
                  {cosmetic.official_description && (
                    <p className="text-sm text-nude-800 leading-relaxed">{cosmetic.official_description}</p>
                  )}
                  {cosmetic.official_positioning && (
                    <p className="text-xs text-nude-500 leading-relaxed">{cosmetic.official_positioning}</p>
                  )}
                </div>
              )}

              {/* Personal notes */}
              {cosmetic.personal_notes && (
                <div className="mx-5">
                  <h3 className="text-sm font-semibold text-nude-700 mb-1">📝 個人筆記</h3>
                  <p className="text-sm text-nude-800 leading-relaxed">{cosmetic.personal_notes}</p>
                </div>
              )}

              {/* Purchase info */}
              <div className="mx-5">
                <h3 className="text-sm font-semibold text-nude-700 mb-2">📋 購買資訊</h3>
                <dl className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                  {cosmetic.purchase_date && (<><dt className="text-nude-500">購買日期</dt><dd className="text-nude-800">{cosmetic.purchase_date}</dd></>)}
                  {cosmetic.expiry_date && (<><dt className="text-nude-500">到期日</dt><dd className="text-nude-800">{cosmetic.expiry_date}</dd></>)}
                  {cosmetic.price != null && (<><dt className="text-nude-500">價格</dt><dd className="text-nude-800">NT$ {cosmetic.price.toLocaleString()}</dd></>)}
                  <dt className="text-nude-500">新增時間</dt>
                  <dd className="text-nude-800">{new Date(cosmetic.created_at).toLocaleDateString('zh-TW')}</dd>
                </dl>
              </div>

              {/* Actions */}
              <div className="flex gap-3 mx-5">
                <Link href={`/cosmetics/${id}/edit`} className="btn-secondary flex-1 text-center text-sm">
                  ✏️ 編輯
                </Link>
                <button onClick={handleDelete} disabled={deleting} className="btn-danger text-sm px-6">
                  {deleting ? '刪除中…' : '🗑️ 刪除'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
