import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function searchTavily(query: string, maxResults = 4) {
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        search_depth: 'basic',
        max_results: maxResults,
      }),
    })
    const data = await res.json()
    return (data.results || []) as { title: string; content: string }[]
  } catch {
    return []
  }
}

export async function POST(req: NextRequest) {
  const userId = req.cookies.get('cosmetics_user')?.value
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { brand, undertone, depth } = await req.json() as {
    brand: string
    undertone?: string
    depth?: string
  }
  if (!brand?.trim()) return NextResponse.json({ error: 'brand required' }, { status: 400 })

  const results = await searchTavily(
    `${brand} foundation shade range light medium warm neutral cool skin tone`
  )
  const ctx = results.map(r => `${r.title}: ${r.content}`).join('\n').slice(0, 600)

  const prompt = `你是彩妝色彩顧問。用戶膚色：色調=${undertone || '未知'}，深淺=${depth || '未知'}。
根據 ${brand} 的色號資料，為這位用戶推薦最適合、備選、建議避開的色號。

${ctx ? `品牌資料：\n${ctx}\n` : ''}

以 JSON 格式回傳（繁體中文）：
{"brand":"${brand.trim()}","recommended":"推薦色號","alternative":"備選色號（沒有填空字串）","avoid":"建議避開色號（沒有填空字串）","notes":"說明（15-30字）"}

只回傳 JSON，不要其他文字。`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = (response.content[0] as Anthropic.TextBlock).text.trim()
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    const entry = JSON.parse(jsonMatch ? jsonMatch[0] : raw)
    return NextResponse.json(entry)
  } catch {
    return NextResponse.json({ error: 'AI analysis failed', raw }, { status: 500 })
  }
}
