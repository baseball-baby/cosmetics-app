'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { ColorProfile, ShadeNote, ColorVerdict, Cosmetic } from '@/lib/types'
import AutoResizeTextarea from '@/components/AutoResizeTextarea'

interface PhotoEntry {
  url: string
  shades: string
  preview: string
}

type SurveyStep = 1 | 2 | 3

const VERDICT_OPTIONS: ColorVerdict[] = ['適合', '偏黃', '偏深', '偏淺', '偏冷', '偏暖', '不適合']

export default function ProfilePage() {
  const [profile, setProfile] = useState<ColorProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Survey wizard
  const [showSurvey, setShowSurvey] = useState(false)
  const [surveyStep, setSurveyStep] = useState<SurveyStep>(1)
  const [analyzing, setAnalyzing] = useState(false)
  const [photos, setPhotos] = useState<PhotoEntry[]>([])
  const [uploadingIdx, setUploadingIdx] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [surveyForm, setSurveyForm] = useState({
    skin_tone_description: '',
    skin_type: '',
    skin_concerns: '',
    makeup_preferences: '',
  })

  const [basicForm, setBasicForm] = useState({
    skin_tone_description: '',
    skin_type: '',
    skin_concerns: '',
    makeup_preferences: '',
  })

  // Shade notes
  const [shadeNotes, setShadeNotes] = useState<ShadeNote[]>([])
  const [savingNotes, setSavingNotes] = useState(false)
  const [reanalyzing, setReanalyzing] = useState(false)
  const [newShadeInput, setNewShadeInput] = useState('')
  const [foundations, setFoundations] = useState<Cosmetic[]>([])
  const [shadeDropdown, setShadeDropdown] = useState<Cosmetic[]>([])
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => r.json())
      .then((data: ColorProfile) => {
        setProfile(data)
        const basic = {
          skin_tone_description: data.skin_tone_description || '',
          skin_type: data.skin_type || '',
          skin_concerns: data.skin_concerns || '',
          makeup_preferences: data.makeup_preferences || '',
        }
        setBasicForm(basic)
        setSurveyForm(basic)
        try {
          const notes = data.shade_notes ? JSON.parse(data.shade_notes) as ShadeNote[] : []
          setShadeNotes(notes)
        } catch { setShadeNotes([]) }
        setLoading(false)
      })
    // Load foundations for autocomplete
    fetch('/api/cosmetics?category=粉底/遮瑕&sort=brand&order=ASC')
      .then((r) => r.json())
      .then((data: Cosmetic[]) => setFoundations(data))
      .catch(() => {})
  }, [])

  function openSurvey() {
    setSurveyStep(1)
    setPhotos([])
    setShowSurvey(true)
  }

  async function handleAddPhoto(file: File) {
    const preview = URL.createObjectURL(file)
    const fd = new FormData()
    fd.append('file', file)
    setUploadingIdx(true)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    const data = await res.json()
    setPhotos((prev) => [...prev, { url: data.url, shades: '', preview }])
    setUploadingIdx(false)
  }

  async function runAnalysis(shadeNotesForAnalysis?: ShadeNote[]) {
    setAnalyzing(true)
    try {
      await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...profile, ...surveyForm }),
      })

      const body: { photos: { url: string; shades: string }[]; shade_notes?: { shade: string; verdicts: string[] }[] } = {
        photos: photos.map((p) => ({ url: p.url, shades: p.shades })),
      }
      if (shadeNotesForAnalysis && shadeNotesForAnalysis.length > 0) {
        body.shade_notes = shadeNotesForAnalysis.map((n) => ({
          shade: n.shade,
          verdicts: (n.verdicts.filter(Boolean) as string[]),
        }))
      }

      const res = await fetch('/api/analyze-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.error) {
        alert('分析失敗：' + data.error)
        return
      }
      const updated = await fetch('/api/profile').then((r) => r.json())
      setProfile(updated)
      setBasicForm({
        skin_tone_description: updated.skin_tone_description || '',
        skin_type: updated.skin_type || '',
        skin_concerns: updated.skin_concerns || '',
        makeup_preferences: updated.makeup_preferences || '',
      })
      setSurveyStep(3)
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleAnalyze() {
    if (photos.length === 0) {
      alert('請先上傳至少一張照片')
      return
    }
    await runAnalysis()
  }

  async function handleReanalyze() {
    if (photos.length === 0) {
      alert('請先重新上傳照片')
      openSurvey()
      return
    }
    setReanalyzing(true)
    try {
      await runAnalysis(shadeNotes)
    } finally {
      setReanalyzing(false)
    }
  }

  async function handleSaveBasic() {
    setSaving(true)
    const updated = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...profile, ...basicForm }),
    }).then((r) => r.json())
    setProfile(updated)
    setSaving(false)
    alert('已儲存')
  }

  async function saveShadeNotes(notes: ShadeNote[]) {
    setShadeNotes(notes)
    setSavingNotes(true)
    await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shade_notes: notes }),
    })
    setSavingNotes(false)
  }

  function addShadeNote(shade: string, cosmeticId?: number) {
    if (!shade.trim()) return
    const existing = shadeNotes.find((n) => n.shade === shade.trim())
    if (existing) return
    const note: ShadeNote = { shade: shade.trim(), verdicts: [], ...(cosmeticId ? { cosmetic_id: cosmeticId } : {}) }
    saveShadeNotes([...shadeNotes, note])
    setNewShadeInput('')
    setShadeDropdown([])
  }

  function toggleVerdict(shade: string, verdict: ColorVerdict) {
    const updated = shadeNotes.map((n) => {
      if (n.shade !== shade) return n
      const has = n.verdicts.includes(verdict)
      return { ...n, verdicts: has ? n.verdicts.filter((v) => v !== verdict) : [...n.verdicts, verdict] }
    })
    saveShadeNotes(updated)
  }

  function removeShadeNote(shade: string) {
    saveShadeNotes(shadeNotes.filter((n) => n.shade !== shade))
  }

  async function syncFromLibrary() {
    const toSync = foundations.filter((f) => f.color_verdict)
    if (toSync.length === 0) return
    setSyncing(true)
    const existing = shadeNotes.map((n) => n.shade)
    const newNotes: ShadeNote[] = toSync
      .filter((f) => {
        const label = `${f.brand} ${f.name}${f.shade_name ? ` ${f.shade_name}` : ''}`
        return !existing.includes(label)
      })
      .map((f) => ({
        shade: `${f.brand} ${f.name}${f.shade_name ? ` ${f.shade_name}` : ''}`,
        cosmetic_id: f.id,
        verdicts: f.color_verdict ? [f.color_verdict] : [],
      }))
    if (newNotes.length > 0) {
      await saveShadeNotes([...shadeNotes, ...newNotes])
    }
    setSyncing(false)
  }

  function handleShadeInput(val: string) {
    setNewShadeInput(val)
    if (val.trim().length < 1) {
      setShadeDropdown([])
      return
    }
    const q = val.toLowerCase()
    const matches = foundations.filter((f) => {
      const text = `${f.brand} ${f.name}${f.shade_name ? ` ${f.shade_name}` : ''}`.toLowerCase()
      return text.includes(q)
    }).slice(0, 6)
    setShadeDropdown(matches)
  }

  const foundationShades = profile?.suitable_foundation_shades
    ? (() => {
        try {
          const parsed = JSON.parse(profile.suitable_foundation_shades)
          return Array.isArray(parsed) ? null : parsed as Record<string, { verdict: string; analysis: string }>
        } catch { return null }
      })()
    : null

  const analysisPhotos = profile?.analysis_photo_urls
    ? (() => {
        try {
          const parsed = JSON.parse(profile.analysis_photo_urls)
          return Array.isArray(parsed) ? parsed as string[] : []
        } catch { return [] }
      })()
    : []

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-blush-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const hasAnalysis = profile?.undertone || profile?.depth

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-nude-900">我的色彩檔案 🎨</h1>
        <p className="text-sm text-nude-500 mt-0.5">記錄你的膚色特徵，讓 AI 給你更準確的建議</p>
      </div>

      {/* AI Analysis Result */}
      {hasAnalysis ? (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-nude-800 flex items-center gap-1.5">✨ AI 色彩分析</h2>
            <button onClick={openSurvey} className="btn-secondary text-xs">🔄 重新分析</button>
          </div>

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
            <p className="text-xs text-nude-500 italic">{profile.undertone_confidence}</p>
          )}

          {profile?.color_analysis_summary && (
            <div className="bg-gradient-to-br from-blush-50 to-rose-50 rounded-xl p-4">
              <p className="text-xs font-medium text-nude-600 mb-2">整體色彩分析</p>
              <p className="text-sm text-nude-800 leading-relaxed">{profile.color_analysis_summary}</p>
            </div>
          )}

          {foundationShades && Object.keys(foundationShades).length > 0 && (
            <div>
              <p className="text-xs font-medium text-nude-600 mb-2">底妝色號分析</p>
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
                        <td className="p-2 text-nude-600 min-w-0">{info.analysis}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

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
        </div>
      ) : (
        <div className="card p-6 text-center space-y-4 bg-gradient-to-br from-blush-50 to-rose-50">
          <div className="text-5xl">🎨</div>
          <div>
            <p className="font-semibold text-nude-800">尚未建立色彩檔案</p>
            <p className="text-sm text-nude-500 mt-1">完成皮膚調查，讓 AI 分析你的專屬色彩</p>
          </div>
          <button onClick={openSurvey} className="btn-primary">開始皮膚調查</button>
        </div>
      )}

      {/* Shade Notes */}
      {hasAnalysis && (
        <div className="card p-5 space-y-4 overflow-visible">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-nude-800">💄 底妝試色記錄</h2>
            <div className="flex items-center gap-2">
              {savingNotes && <span className="text-xs text-nude-400">儲存中…</span>}
              {foundations.some((f) => f.color_verdict) && (
                <button
                  onClick={syncFromLibrary}
                  disabled={syncing}
                  className="text-xs text-blush-500 hover:text-blush-700 transition-colors"
                >
                  {syncing ? '同步中…' : '從化妝品庫匯入'}
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-nude-500">記錄你實際試過的色號，AI 可以用這些資料給你更準確的建議。</p>

          {/* Add shade note */}
          <div className="relative">
            <div className="flex gap-2">
              <input
                type="text"
                value={newShadeInput}
                onChange={(e) => handleShadeInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { addShadeNote(newShadeInput); e.preventDefault() } }}
                placeholder="搜尋化妝品庫或輸入色號名稱…"
                className="input-field text-sm flex-1"
              />
              <button
                onClick={() => addShadeNote(newShadeInput)}
                className="btn-primary text-sm px-4"
              >
                新增
              </button>
            </div>
            {shadeDropdown.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-nude-200 rounded-xl shadow-lg z-10 overflow-hidden">
                {shadeDropdown.map((f) => (
                  <button
                    key={f.id}
                    onMouseDown={() => addShadeNote(`${f.brand} ${f.name}${f.shade_name ? ` ${f.shade_name}` : ''}`, f.id)}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-nude-50 flex items-center gap-2"
                  >
                    <span className="text-nude-800 font-medium">{f.brand} {f.name}</span>
                    {f.shade_name && <span className="text-nude-500 text-xs">{f.shade_name}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {shadeNotes.length > 0 && (
            <div className="space-y-3">
              {shadeNotes.map((note) => (
                <div key={note.shade} className="bg-nude-50 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-nude-800">{note.shade}</span>
                    <button onClick={() => removeShadeNote(note.shade)} className="text-xs text-nude-400 hover:text-red-500 transition-colors">
                      移除
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {VERDICT_OPTIONS.map((v) => (
                      <button
                        key={v}
                        onClick={() => toggleVerdict(note.shade, v)}
                        className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                          note.verdicts.includes(v)
                            ? 'bg-blush-500 text-white border-blush-500'
                            : 'bg-white text-nude-600 border-nude-200 hover:border-blush-300'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {shadeNotes.some((n) => n.verdicts.length > 0) && (
            <button
              onClick={handleReanalyze}
              disabled={reanalyzing}
              className="btn-primary w-full text-sm"
            >
              {reanalyzing ? (
                <span className="flex items-center gap-2 justify-center">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  重新分析中…
                </span>
              ) : '🔄 加入試色記錄重新分析'}
            </button>
          )}
        </div>
      )}

      {/* Basic settings */}
      <div className="card p-5 space-y-4">
        <h2 className="font-semibold text-nude-800">⚙️ 基本膚況設定</h2>
        <div>
          <label className="label">膚色描述</label>
          <input className="input-field" value={basicForm.skin_tone_description} onChange={(e) => setBasicForm((f) => ({ ...f, skin_tone_description: e.target.value }))} placeholder="e.g. 黃調中淺膚色" />
        </div>
        <div>
          <label className="label">膚質</label>
          <select className="input-field" value={basicForm.skin_type} onChange={(e) => setBasicForm((f) => ({ ...f, skin_type: e.target.value }))}>
            <option value="">選擇膚質</option>
            <option value="乾性">乾性</option>
            <option value="油性">油性</option>
            <option value="混合">混合</option>
            <option value="中性">中性</option>
          </select>
        </div>
        <div>
          <label className="label">膚況問題</label>
          <AutoResizeTextarea className="input-field" value={basicForm.skin_concerns} onChange={(e) => setBasicForm((f) => ({ ...f, skin_concerns: e.target.value }))} placeholder="e.g. 毛孔粗大、容易泛紅" />
        </div>
        <div>
          <label className="label">彩妝偏好</label>
          <AutoResizeTextarea className="input-field" value={basicForm.makeup_preferences} onChange={(e) => setBasicForm((f) => ({ ...f, makeup_preferences: e.target.value }))} placeholder="e.g. 偏好自然感妝容" />
        </div>
        <button onClick={handleSaveBasic} disabled={saving} className="btn-primary w-full sm:w-auto">
          {saving ? '儲存中…' : '儲存設定'}
        </button>
      </div>

      {/* Survey Modal */}
      {showSurvey && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">

            {/* Modal header */}
            <div className="flex items-center justify-between p-5 border-b border-nude-100 flex-shrink-0">
              <div>
                <h3 className="font-bold text-nude-800">
                  {surveyStep === 1 && '皮膚調查 · 第一步'}
                  {surveyStep === 2 && '皮膚調查 · 第二步'}
                  {surveyStep === 3 && '分析完成 🎉'}
                </h3>
                <p className="text-xs text-nude-500 mt-0.5">
                  {surveyStep === 1 && '告訴我們你的膚質和膚況'}
                  {surveyStep === 2 && '上傳照片，AI 幫你分析膚色'}
                  {surveyStep === 3 && '你的色彩檔案已建立'}
                </p>
              </div>
              <button onClick={() => setShowSurvey(false)} className="text-nude-400 hover:text-nude-600 text-xl w-8 h-8 flex items-center justify-center">✕</button>
            </div>

            {/* Step indicator */}
            <div className="flex gap-2 px-5 pt-4 flex-shrink-0">
              {[1, 2, 3].map((s) => (
                <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${surveyStep >= s ? 'bg-blush-400' : 'bg-nude-200'}`} />
              ))}
            </div>

            {/* Modal body */}
            <div className="overflow-y-auto flex-1 p-5">

              {/* Step 1: Basic skin info */}
              {surveyStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="label text-base font-medium text-nude-800 mb-2 block">你的膚質是？</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['乾性', '油性', '混合', '中性'].map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setSurveyForm((f) => ({ ...f, skin_type: type }))}
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
                    <input className="input-field" value={surveyForm.skin_tone_description} onChange={(e) => setSurveyForm((f) => ({ ...f, skin_tone_description: e.target.value }))} placeholder="e.g. 偏黃、中淺膚色" />
                  </div>

                  <div>
                    <label className="label">膚況問題（選填）</label>
                    <AutoResizeTextarea className="input-field" value={surveyForm.skin_concerns} onChange={(e) => setSurveyForm((f) => ({ ...f, skin_concerns: e.target.value }))} placeholder="e.g. 毛孔粗大、容易泛紅、有痘疤" />
                  </div>

                  <div>
                    <label className="label">彩妝偏好（選填）</label>
                    <AutoResizeTextarea className="input-field" value={surveyForm.makeup_preferences} onChange={(e) => setSurveyForm((f) => ({ ...f, makeup_preferences: e.target.value }))} placeholder="e.g. 喜歡自然感，不喜歡太厚重" />
                  </div>
                </div>
              )}

              {/* Step 2: Photos */}
              {surveyStep === 2 && (
                <div className="space-y-4">
                  <div className="bg-blush-50 rounded-xl p-3 text-sm text-nude-700 space-y-1">
                    <p>💡 上傳照片讓 AI 分析你的膚色。</p>
                    <p className="text-xs text-nude-500">建議：自然光下拍攝、不化妝或淡妝。若有底妝試色照，可在下方填入色號，AI 會一起分析哪個色號最適合你。</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {photos.map((photo, i) => (
                      <div key={i} className="space-y-1">
                        <div className="aspect-square rounded-xl overflow-hidden bg-nude-100 relative">
                          <Image src={photo.preview} alt={`試色 ${i + 1}`} fill className="object-cover" />
                          <button
                            onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                            className="absolute top-1 right-1 w-6 h-6 bg-black/50 text-white rounded-full text-sm flex items-center justify-center"
                          >
                            ×
                          </button>
                        </div>
                        <input
                          type="text"
                          value={photo.shades}
                          onChange={(e) => setPhotos((prev) => prev.map((p, idx) => idx === i ? { ...p, shades: e.target.value } : p))}
                          placeholder="色號（選填）e.g. N30"
                          className="input-field text-xs py-1.5"
                        />
                      </div>
                    ))}

                    <button
                      onClick={() => fileRef.current?.click()}
                      className="aspect-square rounded-xl border-2 border-dashed border-nude-300 hover:border-blush-400 flex flex-col items-center justify-center gap-1 text-nude-400 hover:text-blush-500 transition-colors"
                    >
                      {uploadingIdx ? (
                        <div className="w-6 h-6 border-2 border-blush-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <span className="text-2xl">+</span>
                          <span className="text-xs">加入照片</span>
                        </>
                      )}
                    </button>
                  </div>

                  <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={async (e) => {
                    const files = Array.from(e.target.files || [])
                    for (const file of files) await handleAddPhoto(file)
                  }} />
                </div>
              )}

              {/* Step 3: Result */}
              {surveyStep === 3 && profile && (
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
                </div>
              )}
            </div>

            {/* Modal footer */}
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
                  <button onClick={handleAnalyze} disabled={analyzing || photos.length === 0} className="btn-primary flex-1">
                    {analyzing ? (
                      <span className="flex items-center gap-2 justify-center">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        AI 分析中…
                      </span>
                    ) : '🤖 開始 AI 分析'}
                  </button>
                </>
              )}
              {surveyStep === 3 && (
                <button onClick={() => setShowSurvey(false)} className="btn-primary flex-1">完成 ✓</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
