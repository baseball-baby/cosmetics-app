'use client'

import { useState } from 'react'

interface AdviceResult {
  shade_recommendation: string
  formula_recommendation: string
  cautions?: string
  confidence: '高' | '中' | '低'
}

interface HistoryItem {
  question: string
  result: AdviceResult
  feedback?: 'good' | 'bad'
}

const CONFIDENCE_COLORS = {
  高: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  中: 'bg-amber-50 text-amber-700 border-amber-200',
  低: 'bg-nude-100 text-nude-600 border-nude-200',
}

const EXAMPLE_QUESTIONS = [
  'NARS Natural Radiant Longwear Foundation 適合我嗎？哪個色號？',
  'MAC Studio Fix Fluid 我應該選哪個色號？',
  '想買 YSL 奢華緞面唇膏，哪個顏色最適合我？',
  'Giorgio Armani Luminous Silk Foundation 推薦哪個號碼？',
]

export default function AdvicePage() {
  const [question, setQuestion] = useState('')
  const [result, setResult] = useState<AdviceResult | null>(null)
  const [currentQuestion, setCurrentQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<HistoryItem[]>([])

  // Feedback state
  const [feedbackState, setFeedbackState] = useState<'none' | 'bad' | 'submitted'>('none')
  const [correction, setCorrection] = useState('')
  const [submittingFeedback, setSubmittingFeedback] = useState(false)

  async function handleSubmit() {
    if (!question.trim()) return
    setLoading(true)
    setResult(null)
    setFeedbackState('none')
    setCorrection('')
    const q = question.trim()
    try {
      const res = await fetch('/api/advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      })
      const data = await res.json() as AdviceResult
      setResult(data)
      setCurrentQuestion(q)
      setHistory((prev) => [{ question: q, result: data }, ...prev.slice(0, 9)])
    } finally {
      setLoading(false)
    }
  }

  async function submitFeedback() {
    if (!correction.trim() || !result) return
    setSubmittingFeedback(true)
    await fetch('/api/advice', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: currentQuestion, ai_answer: result, user_correction: correction }),
    })
    setFeedbackState('submitted')
    setSubmittingFeedback(false)
    // Update history item
    setHistory((prev) => prev.map((item, i) => i === 0 ? { ...item, feedback: 'bad' } : item))
  }

  function markGood() {
    setFeedbackState('submitted')
    setHistory((prev) => prev.map((item, i) => i === 0 ? { ...item, feedback: 'good' } : item))
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-nude-900">買前建議 🛍️</h1>
        <p className="text-sm text-nude-500 mt-0.5">告訴我你想買什麼，AI 幫你分析色號和妝效是否適合你</p>
      </div>

      {/* Input */}
      <div className="card p-5 space-y-4">
        <div className="space-y-2">
          <label className="label">你的問題</label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit() }}
            placeholder="e.g. 想買 MAC Studio Fix Fluid，我適合哪個色號？"
            rows={3}
            className="input-field resize-none"
          />
          <p className="text-xs text-nude-400">Cmd/Ctrl + Enter 送出</p>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || !question.trim()}
          className="btn-primary w-full"
        >
          {loading ? (
            <span className="flex items-center gap-2 justify-center">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              AI 分析中…
            </span>
          ) : '🤖 獲取建議'}
        </button>

        {/* Example questions */}
        <div>
          <p className="text-xs text-nude-400 mb-2">試試看：</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => setQuestion(q)}
                className="text-xs bg-nude-50 hover:bg-blush-50 text-nude-600 hover:text-blush-600 border border-nude-200 hover:border-blush-200 rounded-full px-3 py-1.5 transition-colors text-left"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-nude-800">✨ AI 建議</h2>
            <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${CONFIDENCE_COLORS[result.confidence]}`}>
              信心度：{result.confidence}
            </span>
          </div>

          <div className="bg-blush-50 rounded-xl p-4 space-y-1">
            <p className="text-xs font-semibold text-blush-700">💄 色號建議</p>
            <p className="text-sm text-nude-800 leading-relaxed">{result.shade_recommendation}</p>
          </div>

          <div className="bg-nude-50 rounded-xl p-4 space-y-1">
            <p className="text-xs font-semibold text-nude-600">🌟 妝效 / 質地建議</p>
            <p className="text-sm text-nude-800 leading-relaxed">{result.formula_recommendation}</p>
          </div>

          {result.cautions && (
            <div className="bg-amber-50 rounded-xl p-4 space-y-1 border border-amber-100">
              <p className="text-xs font-semibold text-amber-700">⚠️ 注意事項</p>
              <p className="text-sm text-nude-800 leading-relaxed">{result.cautions}</p>
            </div>
          )}

          {/* Feedback */}
          <div className="border-t border-nude-100 pt-3">
            {feedbackState === 'none' && (
              <div className="flex items-center gap-3">
                <p className="text-xs text-nude-500">這個建議準嗎？</p>
                <button
                  onClick={markGood}
                  className="text-xs px-3 py-1.5 rounded-full border border-nude-200 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 text-nude-600 transition-colors"
                >
                  👍 準
                </button>
                <button
                  onClick={() => setFeedbackState('bad')}
                  className="text-xs px-3 py-1.5 rounded-full border border-nude-200 hover:border-red-300 hover:bg-red-50 hover:text-red-600 text-nude-600 transition-colors"
                >
                  👎 不準
                </button>
              </div>
            )}

            {feedbackState === 'bad' && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-nude-700">哪裡不準？告訴我正確答案（例如：色號應該是 N25 而不是 N30）</p>
                <textarea
                  value={correction}
                  onChange={(e) => setCorrection(e.target.value)}
                  placeholder="e.g. 我試了 N25 更適合，不是 N30；或是建議的霧面質地對我太乾了，緞面更好"
                  rows={3}
                  className="input-field resize-none text-sm"
                />
                <div className="flex gap-2">
                  <button
                    onClick={submitFeedback}
                    disabled={submittingFeedback || !correction.trim()}
                    className="btn-primary text-sm"
                  >
                    {submittingFeedback ? '送出中…' : '送出修正'}
                  </button>
                  <button
                    onClick={() => setFeedbackState('none')}
                    className="btn-secondary text-sm"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}

            {feedbackState === 'submitted' && (
              <p className="text-xs text-nude-500">
                {history[0]?.feedback === 'good' ? '👍 感謝回饋！' : '✓ 修正已記錄，下次建議會更準確'}
              </p>
            )}
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 1 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-nude-600">歷史諮詢</h2>
          {history.slice(1).map((item, i) => (
            <div key={i} className="card p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium text-nude-700 line-clamp-2">{item.question}</p>
                {item.feedback === 'good' && <span className="text-xs text-emerald-600 flex-shrink-0">👍</span>}
                {item.feedback === 'bad' && <span className="text-xs text-nude-400 flex-shrink-0">已修正</span>}
              </div>
              <p className="text-xs text-nude-500 line-clamp-2">{item.result.shade_recommendation}</p>
              <button
                onClick={() => { setQuestion(item.question); setResult(item.result); setCurrentQuestion(item.question); setFeedbackState('none'); setCorrection('') }}
                className="text-xs text-blush-500 hover:text-blush-700 transition-colors"
              >
                查看完整建議 →
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
