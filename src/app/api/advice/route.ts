import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getDb } from '@/lib/db'
import type { ShadeNote } from '@/lib/types'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface FeedbackRow {
  question: string
  ai_answer: string
  user_correction: string
}

interface UserProfile {
  undertone?: string | null
  depth?: string | null
  skin_tone_description?: string | null
  skin_type?: string | null
  skin_concerns?: string | null
  makeup_preferences?: string | null
  color_analysis_summary?: string | null
  shade_notes?: string | null
}

async function searchTavily(query: string, maxResults = 4) {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: process.env.TAVILY_API_KEY, query, search_depth: 'basic', max_results: maxResults }),
  })
  const data = await res.json()
  return (data.results || []) as { title: string; content: string; url?: string }[]
}

function pickRelevantFeedback(question: string, rows: FeedbackRow[]): FeedbackRow[] {
  const qWords = question.toLowerCase().split(/\s+/)
  return rows
    .map((r) => {
      const rWords = r.question.toLowerCase().split(/\s+/)
      const overlap = qWords.filter((w) => w.length > 1 && rWords.includes(w)).length
      return { row: r, overlap }
    })
    .filter(({ overlap }) => overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, 3)
    .map(({ row }) => row)
}

function buildProfileContext(profile: UserProfile | undefined): string {
  if (!profile) return '（尚無膚況檔案）'
  const lines = [
    profile.undertone ? `色調：${profile.undertone}` : '',
    profile.depth ? `膚色深淺：${profile.depth}` : '',
    profile.skin_tone_description ? `膚色描述：${profile.skin_tone_description}` : '',
    profile.skin_type ? `膚質：${profile.skin_type}` : '',
    profile.skin_concerns ? `膚況：${profile.skin_concerns}` : '',
    profile.makeup_preferences ? `彩妝偏好：${profile.makeup_preferences}` : '',
    profile.color_analysis_summary ? `色彩分析總結：${profile.color_analysis_summary}` : '',
  ].filter(Boolean)
  return lines.length > 0 ? lines.join('\n') : '（尚無膚況檔案）'
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const body = await req.json() as { question?: string; type?: string; category?: string; budget?: number }
  const db = getDb()
  const profile = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(userId) as UserProfile | undefined
  const profileContext = buildProfileContext(profile)

  let shadeNotesContext = ''
  if (profile?.shade_notes) {
    try {
      const notes = JSON.parse(profile.shade_notes) as ShadeNote[]
      if (notes.length > 0) {
        shadeNotesContext = '\n\n使用者底妝試色記錄：\n' +
          notes.filter((n) => n.verdicts.length > 0)
            .map((n) => `- ${n.shade}：${n.verdicts.join('、')}`)
            .join('\n')
      }
    } catch {}
  }

  // ── Recommendation mode ──
  if (body.type === 'recommend') {
    const { category, budget } = body
    if (!category) return NextResponse.json({ error: 'category required' }, { status: 400 })

    const budgetText = budget ? `NT$ ${budget} 以內` : '不限'
    let searchContext = ''
    try {
      const results = await searchTavily(`${category} 推薦 ${budget ? `預算${budget}` : ''} 台灣 購買`, 5)
      searchContext = results.map((r) => `${r.title}: ${r.content}${r.url ? ` (${r.url})` : ''}`).join('\n').slice(0, 2000)
    } catch {}

    const prompt = `你是一位專業彩妝顧問。根據使用者的膚況檔案和預算，推薦最適合的${category}產品。

使用者膚況檔案：
${profileContext}${shadeNotesContext}

品類：${category}
預算：${budgetText}

網路參考資料：
${searchContext || '（無搜尋結果）'}

請推薦 3-5 款真實存在的產品，以 JSON 格式回傳（繁體中文）：
{
  "recommendations": [
    {
      "brand": "品牌名稱",
      "name": "產品名稱",
      "price_range": "大約售價（NT$ xxx 起）",
      "purchase_url": "購買連結（若有的話，否則空字串）",
      "why_suitable": "為何適合這位使用者（40-80字，具體說明與膚色/膚質的關聯）"
    }
  ],
  "confidence": "高" | "中" | "低"
}

只回傳 JSON。`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = (response.content[0] as Anthropic.TextBlock).text.trim()
    try {
      const match = text.match(/\{[\s\S]*\}/)
      return NextResponse.json({ type: 'recommend', ...(match ? JSON.parse(match[0]) : { error: 'parse failed' }) })
    } catch {
      return NextResponse.json({ error: 'parse failed', raw: text }, { status: 500 })
    }
  }

  // ── Advice mode ──
  const { question } = body
  if (!question?.trim()) return NextResponse.json({ error: 'question required' }, { status: 400 })

  const allFeedback = db.prepare('SELECT question, ai_answer, user_correction FROM advice_feedback WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(userId) as FeedbackRow[]
  const relevant = pickRelevantFeedback(question, allFeedback)
  const feedbackContext = relevant.length > 0
    ? '\n\n過去的建議修正（請根據這些修正調整你的回答）：\n' +
      relevant.map((r) => {
        const ai = (() => { try { return JSON.parse(r.ai_answer) } catch { return null } })()
        return `問題：${r.question}\nAI 原本建議：${ai ? `色號 - ${ai.shade_recommendation?.slice(0, 60)}` : r.ai_answer.slice(0, 80)}\n使用者修正：${r.user_correction}`
      }).join('\n\n')
    : ''

  let searchContext = ''
  try {
    const results = await searchTavily(`${question} 色號 試色 評測 makeup`)
    searchContext = results.map((r) => `${r.title}: ${r.content}`).join('\n').slice(0, 1200)
  } catch {}

  const prompt = `你是一位專業彩妝色彩顧問。根據使用者的膚況檔案和提問，給出購買前的色號與妝效建議。

使用者膚況檔案：
${profileContext}${shadeNotesContext}${feedbackContext}

網路搜尋資料：
${searchContext || '（無搜尋結果）'}

使用者問題：${question}

請以 JSON 格式回傳建議（繁體中文）：
{
  "shade_recommendation": "色號建議（說明哪個色號最適合，為什麼，60-120字）",
  "formula_recommendation": "妝效/質地建議（說明哪種質地/妝感最適合，60-100字）",
  "cautions": "注意事項或需要注意的色號（30-60字，若無則省略此欄）",
  "confidence": "高" | "中" | "低"
}

只回傳 JSON。`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = (response.content[0] as Anthropic.TextBlock).text.trim()
  try {
    const match = text.match(/\{[\s\S]*\}/)
    return NextResponse.json(match ? JSON.parse(match[0]) : { error: 'parse failed', raw: text })
  } catch {
    return NextResponse.json({ error: 'parse failed', raw: text }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = session.user.id

  const { question, ai_answer, user_correction } = await req.json() as {
    question: string
    ai_answer: object
    user_correction: string
  }
  if (!question || !user_correction?.trim()) {
    return NextResponse.json({ error: 'question and user_correction required' }, { status: 400 })
  }
  const db = getDb()
  db.prepare('INSERT INTO advice_feedback (user_id, question, ai_answer, user_correction) VALUES (?, ?, ?, ?)')
    .run(userId, question, JSON.stringify(ai_answer), user_correction.trim())
  return NextResponse.json({ ok: true })
}
