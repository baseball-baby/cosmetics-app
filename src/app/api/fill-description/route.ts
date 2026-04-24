import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const { brand, name, category } = await req.json()
  if (!brand || !name) return NextResponse.json({ error: 'brand and name required' }, { status: 400 })

  const prompt = `你是一位美妝產品資料庫專家。請根據以下產品資訊，用繁體中文提供官方描述和品牌定位。

品牌：${brand}
產品名稱：${name}
類別：${category || ''}

請以 JSON 格式回傳：
{
  "official_description": "產品功效與特色的官方描述（50-120字）",
  "official_positioning": "品牌定位與風格（30-60字，例如：高遮瑕持妝、適合乾性肌膚、自然裸妝感）"
}

如果你不確定這個產品的詳細資訊，請根據品牌風格和產品名稱推測合理的描述。只回傳 JSON。`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = (response.content[0] as Anthropic.TextBlock).text.trim()
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const result = JSON.parse(jsonMatch ? jsonMatch[0] : text)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Parse failed', raw: text }, { status: 500 })
  }
}
