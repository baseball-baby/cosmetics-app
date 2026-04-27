import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function searchTavily(query: string) {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      search_depth: 'basic',
      max_results: 5,
    }),
  })
  const data = await res.json()
  return (data.results || []) as { title: string; content: string }[]
}

export async function POST(req: NextRequest) {
  const { barcode } = await req.json()
  if (!barcode) return NextResponse.json({ error: 'No barcode' }, { status: 400 })

  try {
    const results = await searchTavily(`barcode ${barcode} cosmetics makeup beauty product`)
    if (results.length === 0) {
      return NextResponse.json({ found: false })
    }

    const snippets = results.map((r) => `${r.title}\n${r.content}`).join('\n\n').slice(0, 3000)

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `根據以下搜尋結果，判斷條碼 ${barcode} 對應的美妝產品資訊。

搜尋結果：
${snippets}

若能確定是美妝/保養品，請以 JSON 回傳（繁體中文）：
{
  "found": true,
  "brand": "品牌名稱",
  "name": "產品名稱",
  "category": "類別（粉底/遮瑕、口紅/唇釉、眼影、眼線、睫毛膏、腮紅/修容、打亮、眉筆、定妝、其他 其中一個）",
  "official_description": "產品描述（30-80字，若有的話）"
}

若無法確定是美妝品或找不到資訊，回傳：{"found": false}

只回傳 JSON。`,
      }],
    })

    const text = (response.content[0] as Anthropic.TextBlock).text.trim()
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ found: false })

    const result = JSON.parse(match[0])
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ found: false })
  }
}
