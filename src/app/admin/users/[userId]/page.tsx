'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { CATEGORY_EMOJIS } from '@/lib/types'

interface Cosmetic {
  id: number
  brand: string
  name: string
  category: string
  shade_name: string | null
  color_verdict: string | null
  photo_url: string | null
  created_at: string
}

interface Profile {
  undertone: string | null
  depth: string | null
  undertone_confidence: string | null
  color_analysis_summary: string | null
  brand_shade_table: string | null
  analysis_photo_urls: string | null
  skin_type: string | null
  skin_concerns: string | null
  updated_at: string
}

interface ShadeAnalysis {
  id: number
  ai_verdict: string
  ai_analysis: string
  photo_url: string | null
  created_at: string
}

interface Feedback {
  id: number
  question: string
  user_correction: string
  created_at: string
}

type Tab = 'cosmetics' | 'profile' | 'ai'

export default function AdminUserPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params)
  const decodedId = decodeURIComponent(userId)

  const [tab, setTab] = useState<Tab>('cosmetics')
  const [loading, setLoading] = useState(true)
  const [cosmetics, setCosmetics] = useState<Cosmetic[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [analyses, setAnalyses] = useState<ShadeAnalysis[]>([])
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])

  useEffect(() => {
    fetch(`/api/admin/users/${encodeURIComponent(decodedId)}`)
      .then(r => r.json())
      .then(data => {
        setCosmetics(data.cosmetics || [])
        setProfile(data.profile || null)
        setAnalyses(data.analyses || [])
        setFeedbacks(data.feedbacks || [])
        setLoading(false)
      })
  }, [decodedId])

  const brandShadeTable = (() => {
    if (!profile?.brand_shade_table) return []
    try { return JSON.parse(profile.brand_shade_table) } catch { return [] }
  })()

  const analysisPhotos = (() => {
    if (!profile?.analysis_photo_urls) return []
    try { return JSON.parse(profile.analysis_photo_urls) as string[] } catch { return [] }
  })()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blush-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-nude-50 p-4 sm:p-8">
      <div className="max-w-3xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-nude-400 hover:text-nude-600 transition-colors text-sm">← 返回</Link>
          <div>
            <h1 className="text-xl font-bold text-nude-900">{decodedId}</h1>
            <p className="text-xs text-nude-400">{cosmetics.length} 件化妝品</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-nude-100 rounded-xl p-1 gap-1 w-fit">
          {([
            { key: 'cosmetics', label: '💄 化妝品庫' },
            { key: 'profile', label: '🎨 膚況檔案' },
            { key: 'ai', label: '🤖 AI 紀錄' },
          ] as { key: Tab; label: string }[]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors whitespace-nowrap ${tab === t.key ? 'bg-white shadow-sm text-blush-600 font-medium' : 'text-nude-500 hover:text-nude-700'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab: Cosmetics */}
        {tab === 'cosmetics' && (
          <div className="space-y-2">
            {cosmetics.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center text-nude-400 border border-nude-100">尚無化妝品</div>
            ) : (
              cosmetics.map(c => (
                <div key={c.id} className="bg-white rounded-2xl p-3 border border-nude-100 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-nude-100 flex-shrink-0 flex items-center justify-center text-sm">
                    {c.photo_url
                      ? <Image src={c.photo_url} alt={c.name} width={40} height={40} className="w-full h-full object-cover" />
                      : <span>{CATEGORY_EMOJIS[c.category] || '🌞'}</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-nude-800 truncate">{c.brand} {c.name}</p>
                    <p className="text-xs text-nude-400 truncate">
                      {c.category}{c.shade_name ? ` · ${c.shade_name}` : ''}{c.color_verdict ? ` · ${c.color_verdict}` : ''}
                    </p>
                  </div>
                  <p className="text-xs text-nude-300 flex-shrink-0">{new Date(c.created_at).toLocaleDateString('zh-TW')}</p>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab: Profile */}
        {tab === 'profile' && (
          <div className="space-y-4">
            {!profile?.undertone ? (
              <div className="bg-white rounded-2xl p-8 text-center text-nude-400 border border-nude-100">尚未完成膚況分析</div>
            ) : (
              <>
                <div className="bg-white rounded-2xl p-5 border border-nude-100 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-blush-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-nude-500 mb-1">色調</p>
                      <p className="font-bold text-blush-700 text-lg">{profile.undertone}</p>
                    </div>
                    <div className="bg-nude-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-nude-500 mb-1">膚色深淺</p>
                      <p className="font-bold text-nude-700 text-lg">{profile.depth}</p>
                    </div>
                  </div>

                  {profile.undertone_confidence && (
                    <p className="text-xs text-nude-400 italic">{profile.undertone_confidence}</p>
                  )}

                  {profile.color_analysis_summary && (
                    <div className="bg-gradient-to-br from-blush-50 to-rose-50 rounded-xl p-4">
                      <p className="text-xs font-medium text-nude-600 mb-2">整體色彩分析</p>
                      <p className="text-sm text-nude-800 leading-relaxed">{profile.color_analysis_summary}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {profile.skin_type && (
                      <div><span className="text-nude-400">膚質：</span><span className="text-nude-700">{profile.skin_type}</span></div>
                    )}
                    {profile.skin_concerns && (
                      <div><span className="text-nude-400">膚況：</span><span className="text-nude-700">{profile.skin_concerns}</span></div>
                    )}
                  </div>

                  {analysisPhotos.length > 0 && (
                    <div>
                      <p className="text-xs text-nude-500 mb-2">分析照片</p>
                      <div className="flex gap-2 flex-wrap">
                        {analysisPhotos.map((url, i) => (
                          <div key={i} className="w-16 h-16 rounded-xl overflow-hidden bg-nude-100">
                            <Image src={url} alt={`分析照 ${i + 1}`} width={64} height={64} className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-nude-300">最後更新：{new Date(profile.updated_at).toLocaleDateString('zh-TW')}</p>
                </div>

                {brandShadeTable.length > 0 && (
                  <div className="bg-white rounded-2xl p-5 border border-nude-100">
                    <p className="text-xs font-medium text-nude-600 mb-3">品牌色號對照表</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {brandShadeTable.map((entry: { brand: string; recommended: string; alternative: string; avoid: string; notes: string }, i: number) => (
                        <div key={i} className="bg-nude-50 rounded-xl p-3 space-y-2">
                          <p className="font-semibold text-nude-800 text-sm">{entry.brand}</p>
                          <div className="space-y-1 text-xs">
                            {entry.recommended && <div className="flex gap-2"><span className="text-nude-400 w-10">推薦</span><span className="text-emerald-700 font-medium">{entry.recommended}</span></div>}
                            {entry.alternative && <div className="flex gap-2"><span className="text-nude-400 w-10">備選</span><span className="text-nude-600">{entry.alternative}</span></div>}
                            {entry.avoid && <div className="flex gap-2"><span className="text-nude-400 w-10">避開</span><span className="text-red-500">{entry.avoid}</span></div>}
                          </div>
                          {entry.notes && <p className="text-xs text-nude-400 border-t border-nude-200 pt-1.5">{entry.notes}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Tab: AI records */}
        {tab === 'ai' && (
          <div className="space-y-4">
            {/* Shade analyses */}
            {analyses.length > 0 && (
              <div className="bg-white rounded-2xl p-5 border border-nude-100 space-y-3">
                <p className="text-xs font-medium text-nude-600">色號分析記錄（{analyses.length} 筆）</p>
                {analyses.map(a => (
                  <div key={a.id} className="border-t border-nude-100 pt-3 flex gap-3">
                    {a.photo_url && (
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-nude-100 flex-shrink-0">
                        <Image src={a.photo_url} alt="分析照" width={40} height={40} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.ai_verdict === '色號剛好' ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'}`}>
                          {a.ai_verdict}
                        </span>
                        <span className="text-xs text-nude-400">{new Date(a.created_at).toLocaleDateString('zh-TW')}</span>
                      </div>
                      <p className="text-xs text-nude-600">{a.ai_analysis}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Feedback */}
            {feedbacks.length > 0 && (
              <div className="bg-white rounded-2xl p-5 border border-nude-100 space-y-3">
                <p className="text-xs font-medium text-nude-600">用戶回饋（{feedbacks.length} 筆）</p>
                {feedbacks.map(f => (
                  <div key={f.id} className="border-t border-nude-100 pt-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-nude-400 bg-nude-50 px-2 py-0.5 rounded-full">{f.question}</span>
                      <span className="text-xs text-nude-400">{new Date(f.created_at).toLocaleDateString('zh-TW')}</span>
                    </div>
                    <p className="text-sm text-nude-700">{f.user_correction}</p>
                  </div>
                ))}
              </div>
            )}

            {analyses.length === 0 && feedbacks.length === 0 && (
              <div className="bg-white rounded-2xl p-8 text-center text-nude-400 border border-nude-100">尚無 AI 使用紀錄</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
