'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { ColorProfile, ColorVerdict, Cosmetic } from '@/lib/types'
import AutoResizeTextarea from '@/components/AutoResizeTextarea'
import { X, Plus, RotateCcw } from 'lucide-react'

interface PhotoEntry {
  url: string
  shades: string
  preview: string
}

interface TrialShade {
  id: string
  brand: string
  product: string
  shade_name: string
  verdict: ColorVerdict | null
}

interface BrandShadeEntry {
  brand: string
  recommended: string
  alternative: string
  avoid: string
  notes: string
}

type SurveyStep = 1 | 2 | 3 | 'done'

const VERDICT_OPTIONS: ColorVerdict[] = ['適合', '偏黃', '偏深', '偏淺', '偏冷', '偏暖', '不適合']

function newTrialShade(): TrialShade {
  return { id: Math.random().toString(36).slice(2), brand: '', product: '', shade_name: '', verdict: null }
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ColorProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [foundations, setFoundations] = useState<Cosmetic[]>([])

  // Survey
  const [showSurvey, setShowSurvey] = useState(false)
  const [surveyStep, setSurveyStep] = useState<SurveyStep>(1)
  const [analyzing, setAnalyzing] = useState(false)
  const [photos, setPhotos] = useState<PhotoEntry[]>([])
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [surveyForm, setSurveyForm] = useState({
    skin_tone_description: '',
    skin_type: '',
    skin_concerns: '',
    makeup_preferences: '',
  })

  // Step 2: trial shades
  const [trialShades, setTrialShades] = useState<TrialShade[]>([newTrialShade()])

  // Add to library (post-analysis)
  const [addedToLibrary, setAddedToLibrary] = useState<Record<string, boolean>>({})
  const [addingToLibrary, setAddingToLibrary] = useState<Record<string, boolean>>({})

  // Feedback
  const [feedbackState, setFeedbackState] = useState<'none' | 'bad' | 'submitted'>('none')
  const [feedbackText, setFeedbackText] = useState('')
  const [submittingFeedback, setSubmittingFeedback] = useState(false)

  useEffect(() => {
    fetch('/api/profile')
      .then(r => r.json())
      .then((data: ColorProfile) => {
        setProfile(data)
        setSurveyForm({
          skin_tone_description: data.skin_tone_description || '',
          skin_type: data.skin_type || '',
          skin_concerns: data.skin_concerns || '',
          makeup_preferences: data.makeup_preferences || '',
        })
        setLoading(false)
      })
    fetch('/api/cosmetics?category=粉底/遮瑕&sort=brand&order=ASC')
      .then(r => r.json())
      .then((data: Cosmetic[]) => setFoundations(data))
      .catch(() => {})
  }, [])

  function openSurvey() {
    setSurveyStep(1)
    setPhotos([])
    setTrialShades([newTrialShade()])
    setAddedToLibrary({})
    setFeedbackState('none')
    setShowSurvey(true)
  }

  async function handleAddPhoto(file: File) {
    const preview = URL.createObjectURL(file)
    const fd = new FormData()
    fd.append('file', file)
    setUploadingPhoto(true)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    const data = await res.json()
    setPhotos(prev => [...prev, { url: data.url, shades: '', preview }])
    setUploadingPhoto(false)
  }

  function loadExistingPhotos() {
    const urls = analysisPhotos
    setPhotos(urls.map(url => ({ url, shades: '', preview: url })))
  }

  async function runAnalysis() {
    if (photos.length === 0) return
    setAnalyzing(true)
    try {
      // Save basic info
      await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...profile, ...surveyForm }),
      })

      const userBrands = Array.from(new Set(foundations.map(f => f.brand))).slice(0, 5)

      const res = await fetch('/api/analyze-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photos: photos.map(p => ({ url: p.url, shades: p.shades })),
          trial_shades: trialShades.filter(ts => ts.brand.trim()),
          user_brands: userBrands.length > 0 ? userBrands : undefined,
        }),
      })
      const data = await res.json()
      if (data.error) {
        alert('分析失敗：' + data.error)
        return
      }
      const updated = await fetch('/api/profile').then(r => r.json())
      setProfile(updated)
      setSurveyStep('done')
    } finally {
      setAnalyzing(false)
    }
  }

  async function addToLibrary(ts: TrialShade) {
    if (!ts.brand.trim()) return
    setAddingToLibrary(s => ({ ...s, [ts.id]: true }))
    try {
      const res = await fetch('/api/cosmetics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: ts.brand.trim(),
          name: ts.product.trim() || ts.shade_name.trim() || ts.brand.trim(),
          shade_name: ts.shade_name.trim() || null,
          category: '粉底/遮瑕',
          color_verdict: ts.verdict || null,
        }),
      })
      if (res.ok) setAddedToLibrary(s => ({ ...s, [ts.id]: true }))
    } finally {
      setAddingToLibrary(s => ({ ...s, [ts.id]: false }))
    }
  }

  async function submitFeedback() {
    if (!feedbackText.trim()) return
    setSubmittingFeedback(true)
    await fetch('/api/profile-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback: feedbackText }),
    })
    setFeedbackState('submitted')
    setSubmittingFeedback(false)
  }

  // Derived
  const hasAnalysis = !!(profile?.undertone || profile?.depth)

  const foundationShades = profile?.suitable_foundation_shades
    ? (() => { try { const p = JSON.parse(profile.suitable_foundation_shades); return Array.isArray(p) ? null : p as Record<string, { verdict: string; analysis: string }> } catch { return null } })()
    : null

  const analysisPhotos = profile?.analysis_photo_urls
    ? (() => { try { const p = JSON.parse(profile.analysis_photo_urls); return Array.isArray(p) ? p as string[] : [] } catch { return [] } })()
    : []

  const brandShadeTable = profile?.brand_shade_table
    ? (() => { try { const p = JSON.parse(profile.brand_shade_table); return Array.isArray(p) ? p as BrandShadeEntry[] : [] } catch { return [] } })()
    : []

  const addableShades = trialShades.filter(ts => ts.brand.trim())

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-blush-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-nude-900">我的膚況檔案 🧴</h1>
        <p className="text-sm text-nude-500 mt-0.5">記錄你的膚色特徵，讓 AI 給你更準確的建議</p>
      </div>

      {/* ── Empty state ── */}
      {!hasAnalysis && (
        <div className="card p-6 space-y-5">
          <div className="text-center">
            <div className="text-5xl mb-3">🎨</div>
            <p className="font-bold text-nude-800 text-lg">開始建立你的專屬膚況檔案</p>
            <p className="text-sm text-nude-500 mt-1">只需 3 個步驟，AI 就能分析你的膚色，給你最精準的彩妝建議</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { step: '1', emoji: '⚙️', title: '基本膚況', desc: '膚質、膚況問題' },
              { step: '2', emoji: '💄', title: '試色記錄', desc: '色號試用心得（選填）' },
              { step: '3', emoji: '📸', title: '上傳照片', desc: 'AI 分析你的膚色' },
            ].map(({ step, emoji, title, desc }) => (
              <div key={step} className="bg-nude-50 rounded-2xl p-4 text-center space-y-1">
                <div className="text-2xl">{emoji}</div>
                <div className="text-xs font-bold text-blush-500">Step {step}</div>
                <div className="text-xs font-semibold text-nude-800">{title}</div>
                <div className="text-xs text-nude-400">{desc}</div>
              </div>
            ))}
          </div>
          <button onClick={openSurvey} className="btn-primary w-full text-base py-3">開始分析 →</button>
        </div>
      )}

      {/* ── Analysis report ── */}
      {hasAnalysis && (
        <div className="card p-5 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-nude-800">✨ AI 色彩分析</h2>
            <button
              onClick={openSurvey}
              className="flex items-center gap-1.5 text-xs text-nude-400 hover:text-blush-600 transition-colors"
            >
              <RotateCcw size={13} /> 重新分析
            </button>
          </div>

          {/* Undertone + depth */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blush-50 rounded-xl p-3 text-center">
              <p className="text-xs text-nude-500 mb-1">色調</p>
              <p className="font-bold text-blush-700 text-lg">{profile?.undertone}</p>
            </div>
            <div className="bg-nude-50 rounded-xl p-3 text-center">
              <p className="text-xs text-nude-500 mb-1">膚色深淺</p>
              <p className="font-bold text-nude-700 text-lg">{profile?.depth}</p>
            </div>
          </div>

          {profile?.undertone_confidence && (
            <p className="text-xs text-nude-400 italic">{profile.undertone_confidence}</p>
          )}

          {/* Summary */}
          {profile?.color_analysis_summary && (
            <div className="bg-gradient-to-br from-blush-50 to-rose-50 rounded-xl p-4">
              <p className="text-xs font-medium text-nude-600 mb-2">整體色彩分析</p>
              <p className="text-sm text-nude-800 leading-relaxed">{profile.color_analysis_summary}</p>
            </div>
          )}

          {/* Photo shade analyses */}
          {foundationShades && Object.keys(foundationShades).length > 0 && (
            <div>
              <p className="text-xs font-medium text-nude-600 mb-2">照片色號分析</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-nude-50">
                      <th className="text-left p-2 rounded-l-lg text-nude-600">色號</th>
                      <th className="text-left p-2 text-nude-600">判定</th>
                      <th className="text-left p-2 rounded-r-lg text-nude-600">說明</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(foundationShades).map(([shade, info]) => (
                      <tr key={shade} className="border-t border-nude-100">
                        <td className="p-2 font-medium text-nude-800">{shade}</td>
                        <td className="p-2 w-16">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap inline-block ${info.verdict === '色號剛好' ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'}`}>
                            {info.verdict}
                          </span>
                        </td>
                        <td className="p-2 text-nude-600">{info.analysis}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Brand shade table */}
          {brandShadeTable.length > 0 && (
            <div>
              <p className="text-xs font-medium text-nude-600 mb-2">品牌色號對照表</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[480px]">
                  <thead>
                    <tr className="bg-nude-50">
                      <th className="text-left p-2 rounded-l-lg text-nude-600 whitespace-nowrap">品牌</th>
                      <th className="text-left p-2 text-nude-600 whitespace-nowrap">推薦色號</th>
                      <th className="text-left p-2 text-nude-600 whitespace-nowrap">備選</th>
                      <th className="text-left p-2 text-nude-600 whitespace-nowrap">建議避開</th>
                      <th className="text-left p-2 rounded-r-lg text-nude-600">說明</th>
                    </tr>
                  </thead>
                  <tbody>
                    {brandShadeTable.map((entry, i) => (
                      <tr key={i} className="border-t border-nude-100">
                        <td className="p-2 font-semibold text-nude-800 whitespace-nowrap">{entry.brand}</td>
                        <td className="p-2 font-medium text-emerald-700 whitespace-nowrap">{entry.recommended || '—'}</td>
                        <td className="p-2 text-nude-600 whitespace-nowrap">{entry.alternative || '—'}</td>
                        <td className="p-2 text-red-500 whitespace-nowrap">{entry.avoid || '—'}</td>
                        <td className="p-2 text-nude-500">{entry.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Analysis photos */}
          {analysisPhotos.length > 0 && (
            <div>
              <p className="text-xs font-medium text-nude-600 mb-2">分析照片</p>
              <div className="flex gap-2 flex-wrap">
                {analysisPhotos.map((url, i) => (
                  <div key={i} className="w-16 h-16 rounded-xl overflow-hidden bg-nude-100">
                    <Image src={url} alt={`分析照 ${i + 1}`} width={64} height={64} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-nude-400">最後更新：{new Date(profile?.updated_at || '').toLocaleDateString('zh-TW')}</p>

          {/* Feedback */}
          <div className="border-t border-nude-100 pt-4">
            {feedbackState === 'none' && (
              <div className="flex items-center gap-3">
                <p className="text-xs text-nude-500">分析結果準確嗎？</p>
                <button
                  onClick={() => setFeedbackState('submitted')}
                  className="text-xs px-3 py-1.5 rounded-full border border-nude-200 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 text-nude-600 transition-colors"
                >
                  👍 準確
                </button>
                <button
                  onClick={() => setFeedbackState('bad')}
                  className="text-xs px-3 py-1.5 rounded-full border border-nude-200 hover:border-red-300 hover:bg-red-50 hover:text-red-600 text-nude-600 transition-colors"
                >
                  ✏️ 有問題
                </button>
              </div>
            )}
            {feedbackState === 'bad' && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-nude-700">哪裡不準？告訴我正確的資訊</p>
                <textarea
                  value={feedbackText}
                  onChange={e => setFeedbackText(e.target.value)}
                  placeholder="e.g. B10 其實是冷調色號，我是中性偏暖所以才適合…"
                  rows={3}
                  className="input-field resize-none text-sm"
                />
                <div className="flex gap-2">
                  <button
                    onClick={submitFeedback}
                    disabled={submittingFeedback || !feedbackText.trim()}
                    className="btn-primary text-sm"
                  >
                    {submittingFeedback ? '送出中…' : '送出回饋'}
                  </button>
                  <button onClick={() => setFeedbackState('none')} className="btn-secondary text-sm">取消</button>
                </div>
              </div>
            )}
            {feedbackState === 'submitted' && (
              <p className="text-xs text-nude-500">✓ 感謝回饋，我們會用來改善分析準確度</p>
            )}
          </div>
        </div>
      )}

      {/* ── Survey Modal ── */}
      {showSurvey && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl overflow-hidden flex flex-col max-h-[92vh]">

            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-nude-100 flex-shrink-0">
              <div>
                <h3 className="font-bold text-nude-800">
                  {surveyStep === 1 && 'Step 1 · 基本膚況'}
                  {surveyStep === 2 && 'Step 2 · 試色記錄'}
                  {surveyStep === 3 && 'Step 3 · 上傳照片'}
                  {surveyStep === 'done' && '分析完成 🎉'}
                </h3>
                <p className="text-xs text-nude-500 mt-0.5">
                  {surveyStep === 1 && '告訴我們你的膚質和膚況'}
                  {surveyStep === 2 && '填入試過的色號（選填）'}
                  {surveyStep === 3 && '上傳照片，AI 幫你分析膚色'}
                  {surveyStep === 'done' && '你的膚況檔案已更新'}
                </p>
              </div>
              <button onClick={() => setShowSurvey(false)} className="text-nude-400 hover:text-nude-600 w-8 h-8 flex items-center justify-center">
                <X size={18} />
              </button>
            </div>

            {/* Step indicator */}
            <div className="flex gap-1.5 px-5 pt-4 flex-shrink-0">
              {([1, 2, 3] as const).map(s => (
                <div
                  key={s}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    surveyStep === 'done' || (typeof surveyStep === 'number' && surveyStep >= s)
                      ? 'bg-blush-400' : 'bg-nude-200'
                  }`}
                />
              ))}
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 p-5">

              {/* Step 1 */}
              {surveyStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="label text-sm font-medium text-nude-800 mb-2 block">你的膚質是？</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['乾性', '油性', '混合', '中性'].map(type => (
                        <button key={type} type="button"
                          onClick={() => setSurveyForm(f => ({ ...f, skin_type: type }))}
                          className={`p-3 rounded-xl border-2 text-sm font-medium transition-colors ${surveyForm.skin_type === type ? 'border-blush-400 bg-blush-50 text-blush-700' : 'border-nude-200 text-nude-600 hover:border-nude-300'}`}
                        >
                          {type === '乾性' && '🏜️ 乾性'}
                          {type === '油性' && '💧 油性'}
                          {type === '混合' && '⚡ 混合'}
                          {type === '中性' && '🌿 中性'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="label">膚色描述（選填）</label>
                    <input className="input-field" value={surveyForm.skin_tone_description}
                      onChange={e => setSurveyForm(f => ({ ...f, skin_tone_description: e.target.value }))}
                      placeholder="e.g. 偏黃、中淺膚色" />
                  </div>
                  <div>
                    <label className="label">膚況問題（選填）</label>
                    <AutoResizeTextarea className="input-field" value={surveyForm.skin_concerns}
                      onChange={e => setSurveyForm(f => ({ ...f, skin_concerns: e.target.value }))}
                      placeholder="e.g. 毛孔粗大、容易泛紅、有痘疤" />
                  </div>
                  <div>
                    <label className="label">彩妝偏好（選填）</label>
                    <AutoResizeTextarea className="input-field" value={surveyForm.makeup_preferences}
                      onChange={e => setSurveyForm(f => ({ ...f, makeup_preferences: e.target.value }))}
                      placeholder="e.g. 喜歡自然感，不喜歡太厚重" />
                  </div>
                </div>
              )}

              {/* Step 2: Trial shades */}
              {surveyStep === 2 && (
                <div className="space-y-4">
                  <div className="bg-blush-50 rounded-xl p-3 text-xs text-nude-700 space-y-1">
                    <p>💄 填入你試過覺得適合/不適合的底妝色號，AI 分析時會查詢官方資料，讓建議更準確。</p>
                    <p className="text-nude-400">這個步驟是選填的，沒有試色記錄也可以直接跳到下一步。</p>
                  </div>

                  <div className="space-y-3">
                    {trialShades.map((ts, i) => (
                      <div key={ts.id} className="bg-nude-50 rounded-xl p-3 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-nude-600">試色 {i + 1}</span>
                          {trialShades.length > 1 && (
                            <button onClick={() => setTrialShades(prev => prev.filter((_, idx) => idx !== i))}
                              className="text-nude-400 hover:text-red-500 transition-colors">
                              <X size={14} />
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input className="input-field text-xs" placeholder="品牌 e.g. NARS"
                            value={ts.brand}
                            onChange={e => setTrialShades(prev => prev.map((s, idx) => idx === i ? { ...s, brand: e.target.value } : s))} />
                          <input className="input-field text-xs" placeholder="產品名稱（選填）"
                            value={ts.product}
                            onChange={e => setTrialShades(prev => prev.map((s, idx) => idx === i ? { ...s, product: e.target.value } : s))} />
                        </div>
                        <input className="input-field text-xs" placeholder="色號 e.g. N25 / B10"
                          value={ts.shade_name}
                          onChange={e => setTrialShades(prev => prev.map((s, idx) => idx === i ? { ...s, shade_name: e.target.value } : s))} />
                        <div>
                          <p className="text-xs text-nude-500 mb-1.5">試色結果</p>
                          <div className="flex flex-wrap gap-1.5">
                            {VERDICT_OPTIONS.map(v => (
                              <button key={v}
                                onClick={() => setTrialShades(prev => prev.map((s, idx) =>
                                  idx === i ? { ...s, verdict: s.verdict === v ? null : v } : s
                                ))}
                                className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                                  ts.verdict === v
                                    ? 'bg-blush-500 text-white border-blush-500'
                                    : 'bg-white text-nude-600 border-nude-200 hover:border-blush-300'
                                }`}
                              >{v}</button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => setTrialShades(prev => [...prev, newTrialShade()])}
                    className="flex items-center gap-1.5 text-sm text-blush-500 hover:text-blush-700 transition-colors"
                  >
                    <Plus size={15} /> 新增試色
                  </button>
                </div>
              )}

              {/* Step 3: Photos */}
              {surveyStep === 3 && (
                <div className="space-y-4">
                  <div className="bg-blush-50 rounded-xl p-3 text-sm text-nude-700 space-y-1">
                    <p>💡 上傳照片讓 AI 分析你的膚色。</p>
                    <p className="text-xs text-nude-500">建議：自然光下拍攝、不化妝或淡妝。若有底妝試色照，可填入色號，AI 會一起分析。</p>
                  </div>

                  {/* Re-use existing photos shortcut */}
                  {photos.length === 0 && analysisPhotos.length > 0 && (
                    <button
                      onClick={loadExistingPhotos}
                      className="w-full text-xs text-blush-500 hover:text-blush-700 border border-blush-200 hover:border-blush-400 rounded-xl py-2.5 transition-colors"
                    >
                      使用上次的分析照片
                    </button>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    {photos.map((photo, i) => (
                      <div key={i} className="space-y-1">
                        <div className="aspect-square rounded-xl overflow-hidden bg-nude-100 relative">
                          <Image src={photo.preview} alt={`試色 ${i + 1}`} fill className="object-cover" />
                          <button
                            onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}
                            className="absolute top-1 right-1 w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center"
                          >
                            <X size={12} />
                          </button>
                        </div>
                        <input type="text" value={photo.shades}
                          onChange={e => setPhotos(prev => prev.map((p, idx) => idx === i ? { ...p, shades: e.target.value } : p))}
                          placeholder="色號（選填）e.g. N30"
                          className="input-field text-xs py-1.5" />
                      </div>
                    ))}
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="aspect-square rounded-xl border-2 border-dashed border-nude-300 hover:border-blush-400 flex flex-col items-center justify-center gap-1 text-nude-400 hover:text-blush-500 transition-colors"
                    >
                      {uploadingPhoto
                        ? <div className="w-6 h-6 border-2 border-blush-400 border-t-transparent rounded-full animate-spin" />
                        : <><span className="text-2xl">+</span><span className="text-xs">加入照片</span></>
                      }
                    </button>
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                    onChange={async e => {
                      for (const file of Array.from(e.target.files || [])) await handleAddPhoto(file)
                    }} />
                </div>
              )}

              {/* Done */}
              {surveyStep === 'done' && profile && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-blush-50 rounded-xl p-4 text-center">
                      <p className="text-xs text-nude-500 mb-1">色調</p>
                      <p className="font-bold text-blush-700 text-2xl">{profile.undertone}</p>
                    </div>
                    <div className="bg-nude-50 rounded-xl p-4 text-center">
                      <p className="text-xs text-nude-500 mb-1">深淺</p>
                      <p className="font-bold text-nude-700 text-2xl">{profile.depth}</p>
                    </div>
                  </div>
                  {profile.color_analysis_summary && (
                    <div className="bg-gradient-to-br from-blush-50 to-rose-50 rounded-xl p-4">
                      <p className="text-xs font-medium text-nude-600 mb-2">AI 的話</p>
                      <p className="text-sm text-nude-800 leading-relaxed">{profile.color_analysis_summary}</p>
                    </div>
                  )}

                  {/* Add to library */}
                  {addableShades.length > 0 && (
                    <div className="border-t border-nude-100 pt-4 space-y-3">
                      <p className="text-xs font-medium text-nude-700">將試色記錄加入化妝品庫</p>
                      {addableShades.map(ts => (
                        <div key={ts.id} className="flex items-center justify-between gap-2 bg-nude-50 rounded-xl p-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-nude-800 truncate">
                              {ts.brand}{ts.product ? ` ${ts.product}` : ''}
                            </p>
                            <p className="text-xs text-nude-500">
                              {ts.shade_name || '（無色號）'}{ts.verdict ? ` · ${ts.verdict}` : ''}
                            </p>
                          </div>
                          {addedToLibrary[ts.id]
                            ? <span className="text-xs text-emerald-600 font-medium flex-shrink-0">✓ 已加入</span>
                            : <button onClick={() => addToLibrary(ts)} disabled={addingToLibrary[ts.id]}
                                className="btn-secondary text-xs flex-shrink-0 py-1 px-3">
                                {addingToLibrary[ts.id] ? '加入中…' : '加入'}
                              </button>
                          }
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-nude-100 flex gap-3 flex-shrink-0">
              {surveyStep === 1 && (
                <>
                  <button onClick={() => setShowSurvey(false)} className="btn-secondary flex-1">取消</button>
                  <button onClick={() => setSurveyStep(2)} className="btn-primary flex-1">下一步 →</button>
                </>
              )}
              {surveyStep === 2 && (
                <>
                  <button onClick={() => setSurveyStep(1)} className="btn-secondary">← 上一步</button>
                  <button onClick={() => setSurveyStep(3)} className="btn-primary flex-1">下一步 →</button>
                </>
              )}
              {surveyStep === 3 && (
                <>
                  <button onClick={() => setSurveyStep(2)} className="btn-secondary">← 上一步</button>
                  <button onClick={runAnalysis} disabled={analyzing || photos.length === 0}
                    className="btn-primary flex-1">
                    {analyzing
                      ? <span className="flex items-center gap-2 justify-center">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          AI 分析中，約 30 秒…
                        </span>
                      : `🤖 開始 AI 分析${photos.length === 0 ? '（請先上傳照片）' : ''}`
                    }
                  </button>
                </>
              )}
              {surveyStep === 'done' && (
                <button onClick={() => setShowSurvey(false)} className="btn-primary flex-1">完成 ✓</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
