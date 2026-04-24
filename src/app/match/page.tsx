'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ColorProfile, Cosmetic } from '@/lib/types'

interface Product {
  id: number
  reason: string
  cosmetic: Cosmetic
}

interface Combination {
  name: string
  description: string
  products: Product[]
}

interface MatchResult {
  combinations: Combination[]
}

export default function MatchPage() {
  const [profile, setProfile] = useState<ColorProfile | null>(null)
  const [situation, setSituation] = useState('')
  const [extraNotes, setExtraNotes] = useState('')
  const [result, setResult] = useState<MatchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [profileLoading, setProfileLoading] = useState(true)

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => r.json())
      .then((data) => {
        setProfile(data)
        setProfileLoading(false)
      })
  }, [])

  async function handleMatch() {
    if (!situation.trim()) {
      alert('請輸入今天的需求或場合')
      return
    }

    setLoading(true)
    setResult(null)

    try {
      const res = await fetch('/api/ai-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ situation, extra_notes: extraNotes }),
      })
      const data = await res.json()
      setResult(data)
    } catch {
      alert('發生錯誤，請重試')
    } finally {
      setLoading(false)
    }
  }

  const hasProfile = profile?.undertone || profile?.depth

  const suggestions = [
    '今天要跟姐妹出去逛街，想要底妝自然光澤感、氣色好',
    '今天有重要會議，需要專業整齊感但不能太濃',
    '約會妝，自然系但要有魅力',
    '戶外活動一整天，要抗汗持妝，少補妝',
    '今天想嘗試比較有個性的妝容',
  ]

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-nude-900">AI 搭配推薦 ✨</h1>
        <p className="text-sm text-nude-500 mt-0.5">告訴 AI 今天的情境，讓它從你的庫存推薦完整妝容</p>
      </div>

      {/* Profile summary */}
      {!profileLoading && (
        <div className={`card p-4 ${!hasProfile ? 'border-orange-200 bg-orange-50' : 'bg-gradient-to-r from-blush-50 to-rose-50'}`}>
          {hasProfile ? (
            <div className="space-y-1">
              <p className="text-xs font-medium text-nude-600">你的色彩特徵</p>
              <div className="flex gap-3 text-sm">
                <span className="font-semibold text-blush-700">{profile?.undertone} 色調</span>
                <span className="text-nude-500">·</span>
                <span className="font-semibold text-nude-700">{profile?.depth} 膚色</span>
              </div>
              {profile?.color_analysis_summary && (
                <p className="text-xs text-nude-600 line-clamp-2 mt-1">{profile.color_analysis_summary}</p>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-orange-700">尚未建立色彩檔案</p>
                <p className="text-xs text-orange-600 mt-0.5">建立後 AI 推薦會更精準</p>
              </div>
              <Link href="/profile" className="btn-secondary text-xs">去建立</Link>
            </div>
          )}
        </div>
      )}

      {/* Step 1: Input */}
      <div className="card p-5 space-y-4">
        <h2 className="font-semibold text-nude-800">📝 今天的需求</h2>

        <div>
          <label className="label">場合描述 *</label>
          <textarea
            className="input-field resize-none"
            rows={3}
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
            placeholder="例：今天要跟朋友下午茶，想要有氣色但輕鬆感，適合日間自然感妝容"
          />
        </div>

        {/* Quick suggestions */}
        <div>
          <p className="text-xs text-nude-500 mb-2">快速選擇：</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => setSituation(s)}
                className="text-xs bg-nude-100 hover:bg-blush-50 hover:text-blush-600 text-nude-600 px-3 py-1.5 rounded-full transition-colors border border-nude-200 hover:border-blush-200"
              >
                {s.slice(0, 20)}…
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">補充今天狀態（可選）</label>
          <input
            className="input-field"
            value={extraNotes}
            onChange={(e) => setExtraNotes(e.target.value)}
            placeholder="e.g. 今天有點浮腫、昨晚睡眠不足有黑眼圈"
          />
        </div>

        <button
          onClick={handleMatch}
          disabled={loading || !situation.trim()}
          className="btn-primary w-full"
        >
          {loading ? (
            <span className="flex items-center gap-2 justify-center">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              AI 搭配中…（可能需要 15-30 秒）
            </span>
          ) : '✨ 讓 AI 幫我搭配'}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          <h2 className="font-semibold text-nude-800 flex items-center gap-2">
            🎨 AI 推薦搭配
            <span className="text-xs text-nude-500 font-normal">（{result.combinations.length} 個組合）</span>
          </h2>

          {result.combinations.map((combo, i) => (
            <div key={i} className="card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-blush-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {i + 1}
                </span>
                <h3 className="font-semibold text-nude-900">{combo.name}</h3>
              </div>

              <p className="text-sm text-nude-700 leading-relaxed bg-nude-50 rounded-xl p-3">
                {combo.description}
              </p>

              <div className="space-y-2">
                <p className="text-xs font-medium text-nude-600">選用產品</p>
                {combo.products.map((product) => (
                  <Link
                    key={product.id}
                    href={`/cosmetics/${product.id}`}
                    className="flex items-start gap-3 p-3 rounded-xl hover:bg-blush-50/50 transition-colors border border-nude-100 hover:border-blush-200"
                  >
                    <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-nude-100">
                      {product.cosmetic?.photo_url ? (
                        <Image
                          src={product.cosmetic.photo_url}
                          alt={product.cosmetic.name}
                          width={48}
                          height={48}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl">💄</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-nude-500">{product.cosmetic?.brand}</p>
                      <p className="text-sm font-medium text-nude-900 truncate">{product.cosmetic?.name}</p>
                      {product.cosmetic?.shade_name && (
                        <p className="text-xs text-nude-400">{product.cosmetic.shade_name}</p>
                      )}
                      <p className="text-xs text-nude-600 mt-1 leading-relaxed">{product.reason}</p>
                    </div>
                    <span className="text-xs text-nude-400 flex-shrink-0">→</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}

          <button
            onClick={() => { setResult(null); setSituation(''); setExtraNotes('') }}
            className="btn-secondary w-full text-sm"
          >
            重新搭配
          </button>
        </div>
      )}
    </div>
  )
}
